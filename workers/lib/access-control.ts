// Mailbox authorization primitives. Copyright (c) 2026 MAH Quantum.
// This module deliberately does not trust names, paths, or client-supplied identities.
export interface MailIdentity { email: string; isAdmin: boolean }
export interface MailboxAccess { ownerEmail: string; members: string[] }

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/;

export function normalizeIdentity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email) || email.includes("..") || email.includes("/")) return null;
  return email;
}

export function normalizeMailboxId(value: unknown): string | null {
  return normalizeIdentity(value);
}

export function mailboxAccessKey(mailboxId: string): string {
  const canonical = normalizeMailboxId(mailboxId);
  if (!canonical) throw new Error("Invalid mailbox identifier");
  return `mailbox-acl/${canonical}.json`;
}

export function parseMailboxAccess(value: unknown): MailboxAccess | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const owner = normalizeIdentity(record.ownerEmail);
  if (!owner || !Array.isArray(record.members) || record.members.length > 100) return null;
  const members: string[] = [];
  for (const entry of record.members) {
    const member = normalizeIdentity(entry);
    if (!member) return null;
    if (member !== owner && !members.includes(member)) members.push(member);
  }
  return { ownerEmail: owner, members };
}

export function canAccessMailbox(identity: MailIdentity, acl: MailboxAccess | null): boolean {
  if (identity.isAdmin) return true;
  const email = normalizeIdentity(identity.email);
  if (!email || !acl) return false; // Legacy/unassigned mailboxes fail closed.
  return acl.ownerEmail === email || acl.members.includes(email);
}

export async function loadMailboxAccess(bucket: R2Bucket, mailboxId: string): Promise<MailboxAccess | null> {
  const obj = await bucket.get(mailboxAccessKey(mailboxId));
  if (!obj) return null;
  try { return parseMailboxAccess(await obj.json()); }
  catch { return null; }
}
export async function saveMailboxAccess(bucket: R2Bucket, mailboxId: string, value: unknown): Promise<MailboxAccess> {
  const acl = parseMailboxAccess(value);
  if (!acl) throw new Error("Invalid mailbox access policy");
  await bucket.put(mailboxAccessKey(mailboxId), JSON.stringify(acl));
  return acl;
}
