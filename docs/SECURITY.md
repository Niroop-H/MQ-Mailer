# Security status — MQ Mailer

**Release classification:** Google OIDC/D1 source authentication with CI tests. Live Google sign-in, employee isolation, inbound email and backup/restore remain unverified. Not production-email ready.

## Implemented authorization

- Google OpenID Connect ID-token signature, issuer, audience, expiry, verified-email and nonce checks. OAuth S256 PKCE + one-time server-side flow state prevent login CSRF/replay.
- Only Gmail and Google Workspace hosted-domain accounts are accepted. The signed-in Google email/sub claims are validated, and each approved employee's Google subject is bound to their D1 record on first login.
- An administrator is identified only by exact match with `MQ_ADMIN_EMAIL` Worker secret.
- Mailbox authorization is stored separately from mutable mailbox settings under `mailbox-acl/<mailbox>.json` in D1 through the capped storage adapter. Each mailbox can have one owner and explicit member emails.
- All `/api/v1/mailboxes/:mailboxId` and nested email, draft, folder, search, thread and attachment routes run `requireMailbox` before accessing a Durable Object.
- Mailbox listing is filtered to owner/member mailboxes for nonadministrators.
- Mailbox creation, deletion and mailbox ACL changes are restricted to the administrator.
- Missing or malformed ACLs restrict access to the administrator (legacy mailbox migration).
- MCP and AI agent HTTP/WebSocket interfaces are **administrator-only** because upstream internal agent execution does not yet independently enforce per-user ACLs. Employees can use normal webmail but **cannot currently use agent chat or MCP**.
- The admin can approve/revoke/restore Google sign-in identities separately from mailbox owner/member ACLs; revocation deletes existing sessions.
- Only the canonical `mailer.mahquantum.tech` hostname accepts login; other Worker URLs fail closed. Browser sessions are opaque, randomly generated, hashed in D1, 12-hour maximum and stored in Secure/HttpOnly/SameSite=Lax host-only cookies.
- Non-read HTTP API requests require exact same-origin Origin; admin-only agent WebSockets also require same-site Origin.
- The owner and sharing editor is shown to admins only; UI hiding is supplemental to server-side authorization.
- Outgoing HTTP send/reply/forward routes wait for sender-provider acceptance before reporting success. Acceptance does not establish final delivery.

## Security and operational work still required

- Demonstrate authentication and ACL enforcement against a **real deployed Worker** with multiple real Google accounts. The CI tests cover OAuth security primitives and isolated mailbox middleware with mocked D1/R2-compatible storage; these tests do not prove real OAuth authorization or production session/ACL enforcement.
- Extend ACL checks within MCP sessions and Durable Object agent tool execution before enabling employees' AI features.
- Review login revocation behavior and active WebSocket termination on changed membership, and avoid stale grants during long-lived requests.
- Enforce malware/virus scanning or appropriate controls on attachments, content sanitation, phishing and spam protections, delivery failure handling, mailbox quota/retention, and privacy policies.
- Implement and verify backups/restores of D1 and Durable Object storage; GitHub does not back up emails.
- Review mailbox deletion: upstream deletes metadata but does not yet purge Durable Object database or associated attachment blobs.
- Configure proper domain email delivery provider, SPF/DKIM/DMARC, rate limits, and monitoring.
- Audit AI prompt injection and ensure AI-generated sends require explicit human approval.

**Never** authorize a team-wide mailbox API by Google login alone or assume separate Durable Objects automatically imply access isolation.
