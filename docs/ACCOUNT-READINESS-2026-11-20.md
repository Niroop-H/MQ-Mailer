# Operational handoff — 20 November 2026

This is an account-specific readiness snapshot. It **does not certify production readiness**.

## Verified connected systems

- GitHub repository: `Niroop-H/MQ-Mailer` (independent source copy, default branch main).
- Cloudflare account: connected and readable. An existing Worker named `d25-license` was found and **not modified**.
- Cloudflare R2: **not activated**. Listing buckets returns HTTP 403, Cloudflare error 10042: "Please enable R2 through the Cloudflare Dashboard." This is a product activation blocker, not simply an OAuth permission error. Nothing was purchased or enabled.
- Cloudflare `mahquantum.tech` zone: not found in the connected Cloudflare account in the zone-name lookup. This snapshot cannot establish existing DNS/mail routing; no DNS or MX records were changed.
- Vercel: connected. The linked team is on Vercel Hobby; business/commercial hosting on Hobby is restricted by Vercel's current terms. No Vercel project was created for MQ Mailer.

## Why the copied app is not live yet

Upstream Agentic Inbox uses R2 for mailbox metadata and attachments, Durable Objects for per-mailbox SQLite, Workers for HTTP/email hooks, Cloudflare Access for authentication, Workers AI, and an Email Service `send_email` binding. Provisioning or deploying unchanged before R2 activation would fail. The outbound Cloudflare Email Service is for **transactional** sending, not general staff correspondence.

The current production authorization restricts all mailbox HTTP/agent/MCP access to an explicitly configured single administrator identity, because upstream has **no per-mailbox ACL**. Do not add other employees yet.

## Strict zero-spend policy

No payment details, new subscriptions, Workers Paid plan, R2 activation or outbound provider signup was authorized or executed. Cloudflare R2 has free usage allowances, but activating it is a billing-enabled product and **free usage allowance is not a hard zero-spend guarantee**. Quotas must be monitored to avoid overages.

Possible future architecture with no R2 activation: replace mailbox metadata/attachment storage paths with a suitably sized Cloudflare D1/Durable Object storage implementation. This is a **separate engineering migration**, not present in the current application. Data size constraints, email attachment limits, retries and retention will need rigorous testing. It is not equivalent to unlimited free email hosting.

## Work completed

- Copied the upstream Cloudflare Agentic Inbox source into this repository as independent files, preserving Apache 2.0 attribution.
- Applied MAH Quantum Mail/MQ Mailer branding.
- Added Cloudflare Access JWT validation with exact-match administrator email check and production fail-closed settings.
- Fixed the three HTTP send/reply/forward paths to await provider acceptance instead of returning immediate success while sending asynchronously. **Acceptance does not guarantee final delivery**.
- GitHub CI builds and type checks the application on main.

## Next actions requiring operator access or decisions

1. Decide whether to activate Cloudflare R2 (with possible billing implications) or commission an R2-free rewrite.
2. Configure Cloudflare Access only for the designated admin and set `POLICY_AUD`, `TEAM_DOMAIN`, `MQ_ADMIN_EMAIL` via Worker secrets.
3. Set up a free/approved outbound service that permits the intended business email use. The current Cloudflare email sender does **not** provide general-purpose outbound business mail.
4. Prepare the domain move and MX/SPF/DKIM/DMARC plan. No live DNS changes should occur until existing mailboxes are assessed.
5. Test the real Worker, inbound routing, outbound acceptance and delivery, attachments, failed sends, backups and restores, and authorization boundaries.

See `docs/DEPLOYMENT.md` and `docs/SECURITY.md` for detailed setup and remaining release gates.
