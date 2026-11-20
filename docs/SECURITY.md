# Security status — MQ Mailer

**Release classification: single-administrator pilot only.** Not approved for general employee mailboxes or handling sensitive corporate correspondence until a security review and data backup plan are complete.

## Already enforced

- Cloudflare Access JWT signature, issuer and audience verification in production (upstream behavior).
- Production **fail-closed** when `POLICY_AUD`, `TEAM_DOMAIN` or `MQ_ADMIN_EMAIL` is missing.
- Production verified `email` claim must match the exact designated administrator email before the HTTP API, React app, MCP and agent WebSocket routes are reached.
- Local development continues to bypass Access under the upstream development flag; development instances must not be internet-exposed.

## Before onboarding employees

- Implement server-side owner/member/role mapping and access checks on **every** mailbox API route, mailbox CRUD, agent WebSockets, and `/mcp`, including tool execution and Durable Object calls.
- Add security regression tests demonstrating that user A cannot list/read/send/delete user B messages, access attachments, connect to B agent, or use MCP to act on B mailbox.
- Review and restrict email sending rights, rate limiting, delivery abuse, attachment scanning/content handling, prompt injection risk, HTML sanitization and provider quotas.
- Review mail privacy, retention, compliance requirements, backups/restores, incident response and audit logging.
- Make outgoing sends require explicit human approval for AI-generated content.

Do not confuse separate Durable Object storage with access control: upstream isolates storage per mailbox but shares authorization at the application level.
