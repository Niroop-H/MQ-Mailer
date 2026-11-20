# Security status — MQ Mailer

**Release classification:** Access-controlled source build; **not yet validated with real multi-user traffic**, and not production email ready.

## Implemented authorization

- Cloudflare Access JWT validation with issuer and audience checks in production.
- The signed-in Cloudflare Access email claim is normalized and used as the employee identity. Neither a client-supplied header nor mailbox URL establishes identity.
- An administrator is identified only by exact match with `MQ_ADMIN_EMAIL` Worker secret.
- Mailbox authorization is stored separately from mutable mailbox settings under `mailbox-acl/<mailbox>.json` in R2. Each mailbox can have one owner and explicit member emails.
- All `/api/v1/mailboxes/:mailboxId` and nested email, draft, folder, search, thread and attachment routes run `requireMailbox` before accessing a Durable Object.
- Mailbox listing is filtered to owner/member mailboxes for nonadministrators.
- Mailbox creation, deletion and mailbox ACL changes are restricted to the administrator.
- Missing or malformed ACLs restrict access to the administrator (legacy mailbox migration).
- MCP and AI agent HTTP/WebSocket interfaces are **administrator-only** because upstream internal agent execution does not yet independently enforce per-user ACLs. Employees can use normal webmail but **cannot currently use agent chat or MCP**.
- The owner and sharing editor is shown to admins only; UI hiding is supplemental to server-side authorization.
- Outgoing HTTP send/reply/forward routes wait for sender-provider acceptance before reporting success. Acceptance does not establish final delivery.

## Security and operational work still required

- Demonstrate authentication and ACL enforcement against a **real deployed Worker** with multiple Access accounts. The CI tests exercise isolated backend middleware with a mocked R2 bucket; those tests do not prove production JWT or end-to-end Cloudflare Access enforcement.
- Extend ACL checks within MCP sessions and Durable Object agent tool execution before enabling employees' AI features.
- Review login revocation behavior and active WebSocket termination on changed membership, and avoid stale grants during long-lived requests.
- Enforce malware/virus scanning or appropriate controls on attachments, content sanitation, phishing and spam protections, delivery failure handling, mailbox quota/retention, and privacy policies.
- Implement and verify backups/restores of R2 and Durable Object storage; GitHub does not back up emails.
- Review mailbox deletion: upstream deletes metadata but does not yet purge Durable Object database or associated attachment blobs.
- Configure proper domain email delivery provider, SPF/DKIM/DMARC, rate limits, and monitoring.
- Audit AI prompt injection and ensure AI-generated sends require explicit human approval.

**Never** authorize a team-wide mailbox API by Cloudflare Access login alone or assume separate Durable Objects automatically imply access isolation.
