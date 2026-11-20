/**
 * D1-backed bucket shim for the MQ Mailer no-paid-subscription deployment.
 *
 * This supports the limited R2 operations used by the upstream application:
 * head/get/put/delete/list. Binary payloads are split into 512 KiB D1 rows.
 * The 6 MiB maximum per object is intentional, to stay below Workers Free
 * per-invocation query limits. This is NOT an unlimited R2 replacement.
 *
 * Database schema: migrations/0001_mail_objects.sql.
 */
import type { Env } from "../types";

const CHUNK_SIZE = 512 * 1024;
export const MAX_STORED_OBJECT_BYTES = 6 * 1024 * 1024;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

function checkKey(key: string): void {
  if (typeof key !== "string" || !key || key.length > 500 || key.includes("\0")) {
    throw new Error("Invalid storage object key");
  }
}
async function bytesOf(value: string | ArrayBuffer | Uint8Array | Blob): Promise<Uint8Array> {
  if (typeof value === "string") return encoder.encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  throw new Error("Unsupported storage object type");
}
interface Metadata { key: string; size: number; updated_at: string }
interface Part { idx: number; payload: ArrayBuffer | Uint8Array | number[] }

export class D1Bucket {
  constructor(private readonly db: D1Database) {}
  async head(key: string) {
    checkKey(key);
    const row = await this.db.prepare("SELECT key, size, updated_at FROM mq_objects WHERE key = ?").bind(key).first<Metadata>();
    return row ? { key: row.key, size: row.size, uploaded: new Date(row.updated_at + "Z") } : null;
  }
  async get(key: string) {
    checkKey(key);
    const row = await this.db.prepare("SELECT key, size, updated_at FROM mq_objects WHERE key = ?").bind(key).first<Metadata>();
    if (!row) return null;
    const result = await this.db.prepare("SELECT idx, payload FROM mq_chunks WHERE key = ? ORDER BY idx").bind(key).all<Part>();
    const pieces = result.results ?? [];
    const data = new Uint8Array(row.size);
    let offset = 0;
    let index = 0;
    for (const piece of pieces) {
      if (piece.idx !== index++) throw new Error("Storage chunk index mismatch");
      const bytes = piece.payload instanceof ArrayBuffer
        ? new Uint8Array(piece.payload)
        : new Uint8Array(piece.payload);
      if (offset + bytes.byteLength > row.size) throw new Error("Storage object corrupted");
      data.set(bytes, offset);
      offset += bytes.byteLength;
    }
    if (offset !== row.size) throw new Error("Storage object incomplete");
    return {
      key: row.key,
      size: row.size,
      body: new Response(data).body,
      json: async <T = unknown>(): Promise<T> => JSON.parse(decoder.decode(data)) as T,
      text: async () => decoder.decode(data),
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  }
  async put(key: string, value: string | ArrayBuffer | Uint8Array | Blob) {
    checkKey(key);
    const data = await bytesOf(value);
    if (data.byteLength > MAX_STORED_OBJECT_BYTES) {
      throw new Error("Object exceeds the 6 MiB per-file limit on the free D1 mailbox storage");
    }
    // D1 batch executes as a transaction; we never expose partial content.
    const stmts = [
      this.db.prepare("INSERT INTO mq_objects (key,size) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET size=excluded.size,updated_at=CURRENT_TIMESTAMP").bind(key,data.byteLength),
      this.db.prepare("DELETE FROM mq_chunks WHERE key = ?").bind(key),
    ];
    for (let idx=0; idx*CHUNK_SIZE < data.length; idx++) {
      const chunk = data.slice(idx*CHUNK_SIZE, Math.min((idx+1)*CHUNK_SIZE,data.length));
      stmts.push(this.db.prepare("INSERT INTO mq_chunks (key,idx,payload) VALUES (?,?,?)").bind(key,idx,chunk));
    }
    await this.db.batch(stmts);
    return { key, size: data.byteLength };
  }
  async delete(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return;
    if (keys.length > 30) throw new Error("Use batch deletion in groups of at most 30 objects");
    const statements: D1PreparedStatement[] = [];
    for (const k of keys) {
      checkKey(k);
      statements.push(this.db.prepare("DELETE FROM mq_chunks WHERE key = ?").bind(k));
      statements.push(this.db.prepare("DELETE FROM mq_objects WHERE key = ?").bind(k));
    }
    await this.db.batch(statements);
  }
  async list(options: {prefix?: string} = {}) {
    const prefix = options.prefix ?? "";
    const results = await this.db.prepare(
      "SELECT key,size,updated_at FROM mq_objects WHERE substr(key,1,?) = ? ORDER BY key LIMIT 1001"
    ).bind(prefix.length,prefix).all<Metadata>();
    const rows = results.results ?? [];
    return {
      objects: rows.slice(0,1000).map(row => ({key:row.key,size:row.size,uploaded:new Date(row.updated_at+"Z")})),
      truncated: rows.length > 1000,
    };
  }
}

/** Retain R2's limited shape at the integration boundary, avoiding an R2 subscription. */
export function getBucket(env: Env): R2Bucket {
  // Existing unit-test mocks may supply a bucket directly. Production Wrangler
  // configuration has no R2 binding and always selects D1.
  if (env.BUCKET) return env.BUCKET;
  if (!env.D1_MAIL) throw new Error("MQ Mailer free D1 storage is not configured");
  return new D1Bucket(env.D1_MAIL) as unknown as R2Bucket;
}
