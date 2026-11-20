// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Hono middleware to handle repetitive Mailbox Durable Object instantiation.
 * Checks if the mailbox exists in R2, then instantiates the DO stub
 * and attaches it to the Hono context (`c.var.mailboxStub`).
 */
import { createMiddleware } from "hono/factory";
import type { MailboxDO } from "../durableObject";
import type { Env } from "../types";
import { getBucket } from "./d1-bucket";
import { canAccessMailbox, loadMailboxAccess, normalizeMailboxId, type MailIdentity } from "./access-control";

export type MailboxContext = {
	Bindings: Env;
	Variables: {
		mailboxStub: DurableObjectStub<MailboxDO>;
		mqIdentity: MailIdentity;
	};
};

export const requireMailbox = createMiddleware<MailboxContext>(async (c, next) => {
	const rawId = c.req.param("mailboxId");
	if (!rawId) return c.json({ error: "Mailbox ID required" }, 400);
	// Hono supplies the decoded route parameter. Do not decode it again.
	const mailboxId = normalizeMailboxId(rawId);
	if (!mailboxId || rawId !== mailboxId) return c.json({ error: "Invalid mailbox" }, 400);
	if (!c.var.mqIdentity) return c.json({ error: "Authentication required" }, 403);

	// Verify mailbox exists
	const key = `mailboxes/${mailboxId}.json`;
	const obj = await getBucket(c.env).head(key);
	if (!obj) {
		return c.json({ error: "Not found" }, 404);
	}

	// The mailbox ACL lives in a separate R2 record and cannot be modified
	// through the general mailbox settings API. Missing or malformed ACLs
	// allow the administrator only (legacy mailboxes fail closed).
	const access = await loadMailboxAccess(getBucket(c.env), mailboxId);
	if (!canAccessMailbox(c.var.mqIdentity, access)) {
		return c.json({ error: "Mailbox access denied" }, 403);
	}

	// Instantiate DO stub
	const ns = c.env.MAILBOX;
	const id = ns.idFromName(mailboxId);
	const stub = ns.get(id);

	c.set("mailboxStub", stub);
	
	await next();
});
