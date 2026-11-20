// Isolated mailbox authorization regression tests. No real mail or Cloudflare account is contacted.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { Hono } from "hono";

const buildDir = await mkdtemp(path.join(tmpdir(), "mq-mailer-test-"));
await build({
  entryPoints: ["workers/lib/access-control.ts", "workers/lib/mailbox.ts"],
  outdir: buildDir,
  outbase: "workers/lib",
  bundle: true, platform: "node", format: "esm", target: "node22",
  outExtension: { ".js": ".mjs" },
});
const acl = await import(pathToFileURL(path.join(buildDir, "access-control.mjs")).href);
const { requireMailbox } = await import(pathToFileURL(path.join(buildDir, "mailbox.mjs")).href);
process.on("exit", () => { /* ephemeral test files are cleaned below */ });

test.after(async () => { await rm(buildDir, {recursive: true, force: true}); });

const alice = "alice@mahquantum.tech";
const bob = "bob@mahquantum.tech";
const admin = "founder@gmail.com";

function mockBucket() {
  const records = new Map([
    [`mailboxes/${alice}.json`, JSON.stringify({fromName:"Alice"})],
    [`mailboxes/${bob}.json`, JSON.stringify({fromName:"Bob"})],
    [`mailboxes/${"legacy@mahquantum.tech"}.json`, "{}"],
    [`mailbox-acl/${alice}.json`, JSON.stringify({ownerEmail:alice, members:["shared@gmail.com"]})],
    [`mailbox-acl/${bob}.json`, JSON.stringify({ownerEmail:bob, members:[]})],
  ]);
  return {
    records,
    head: async key => records.has(key) ? {key} : null,
    get: async key => records.has(key) ? {json: async () => JSON.parse(records.get(key))} : null,
    put: async (key, value) => records.set(key, value),
    delete: async key => records.delete(key),
  };
}
function makeApp(identity, bucket = mockBucket()) {
  const parent = new Hono();
  parent.use("*", async (c, next) => {
    if (identity) c.set("mqIdentity", identity);
    await next();
  });
  const api = new Hono();
  api.use("/api/v1/mailboxes/:mailboxId", requireMailbox);
  api.use("/api/v1/mailboxes/:mailboxId/*", requireMailbox);
  api.get("/api/v1/mailboxes/:mailboxId", c => c.json({ok:true,mailbox:c.req.param("mailboxId")}));
  api.get("/api/v1/mailboxes/:mailboxId/emails/:id", c => c.json({ok:true}));
  api.get("/api/v1/mailboxes/:mailboxId/emails/:id/attachments/:attachmentId", c => c.json({ok:true}));
  api.post("/api/v1/mailboxes/:mailboxId/emails", c => c.json({ok:true}));
  parent.route("/", api);
  const env = { BUCKET: bucket, MAILBOX: {idFromName: name => name, get: name => ({ name })} };
  return path => parent.request(path, {}, env);
}

test("normalizes signed-in identities and rejects malformed mailbox identifiers", () => {
  assert.equal(acl.normalizeIdentity(" Alice@MAHQUANTUM.TECH "), alice);
  for (const v of ["", null, "../bob@mahquantum.tech", "bob@other.com/path", "bob@evil..com", "no-at-sign"]) {
    assert.equal(acl.normalizeMailboxId(v), null);
  }
});

test("malformed, missing and forged ACL data denies regular employees", () => {
  const actor = {email:alice,isAdmin:false};
  assert.equal(acl.canAccessMailbox(actor,null),false);
  assert.equal(acl.canAccessMailbox(actor,{ownerEmail:bob,members:[]}),false);
  assert.equal(acl.parseMailboxAccess({ownerEmail:alice,members:[bob,12]}),null);
  assert.equal(acl.parseMailboxAccess({ownerEmail:alice,members:["x@evil.com".repeat(40)]}),null);
  assert.equal(acl.canAccessMailbox(actor,{ownerEmail:alice,members:[]}),true);
  assert.equal(acl.canAccessMailbox({email:"shared@gmail.com",isAdmin:false},{ownerEmail:alice,members:["shared@gmail.com"]}),true);
});

test("alice cannot read or send from bob's inbox or download bob's attachments", async () => {
  const request = makeApp({email:alice,isAdmin:false});
  assert.equal((await request(`/api/v1/mailboxes/${alice}`)).status,200);
  assert.equal((await request(`/api/v1/mailboxes/${bob}`)).status,403);
  assert.equal((await request(`/api/v1/mailboxes/${bob}/emails/1`)).status,403);
  assert.equal((await request(`/api/v1/mailboxes/${bob}/emails/1/attachments/2`)).status,403);
  assert.equal((await request(`/api/v1/mailboxes/${bob}/emails`)).status,403);
});

test("bob is limited to bob's mailbox, and assigned members may open Alice's", async () => {
  assert.equal((await makeApp({email:bob,isAdmin:false})(`/api/v1/mailboxes/${alice}`)).status,403);
  assert.equal((await makeApp({email:bob,isAdmin:false})(`/api/v1/mailboxes/${bob}`)).status,200);
  assert.equal((await makeApp({email:"shared@gmail.com",isAdmin:false})(`/api/v1/mailboxes/${alice}`)).status,200);
});

test("legacy/unassigned mailbox remains inaccessible until admin assigns owner", async () => {
  assert.equal((await makeApp({email:alice,isAdmin:false})("/api/v1/mailboxes/legacy@mahquantum.tech")).status,403);
  assert.equal((await makeApp({email:admin,isAdmin:true})("/api/v1/mailboxes/legacy@mahquantum.tech")).status,200);
});

test("unauthenticated actors and unknown mailboxes fail closed", async () => {
  assert.equal((await makeApp(null)(`/api/v1/mailboxes/${alice}`)).status,403);
  assert.equal((await makeApp({email:alice,isAdmin:false})("/api/v1/mailboxes/notfound@mahquantum.tech")).status,404);
});

test("admin assignment updates/revocations are effective immediately on next request", async () => {
  const bucket = mockBucket();
  const request = makeApp({email:alice,isAdmin:false},bucket);
  assert.equal((await request(`/api/v1/mailboxes/${bob}`)).status,403);
  await acl.saveMailboxAccess(bucket,bob,{ownerEmail:bob,members:[alice]});
  assert.equal((await request(`/api/v1/mailboxes/${bob}`)).status,200);
  await acl.saveMailboxAccess(bucket,bob,{ownerEmail:bob,members:[]});
  assert.equal((await request(`/api/v1/mailboxes/${bob}`)).status,403);
});
