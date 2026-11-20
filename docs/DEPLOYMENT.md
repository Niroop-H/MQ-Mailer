# MAH Quantum Mail — Deployment checklist

This software is a Cloudflare Workers application. Vercel must not host the same backend or receive R2/Access secrets. Deploy an optional separate Vercel admin portal only after dedicated authentication and role-based API authorization exist.

## Before you deploy

- Use one designated Cloudflare Access identity as the **only administrator** via `MQ_ADMIN_EMAIL`. Other approved employees can log in but see only mailboxes explicitly assigned to them through the server-side ACL.
- Review current MX records for `mahquantum.tech` before enabling Email Routing. Switching MX could interrupt existing mail. Start with a test subdomain if existing mailboxes are active; set `DOMAINS` to that test domain during pilot.
- Confirm Cloudflare R2, Durable Objects (SQLite), Workers, Workers AI availability/quotas, and Email Service onboarding. **Cloudflare Email Service is for transactional email only.** Arbitrary-recipient transactional sending requires Workers Paid; ordinary staff correspondence requires an appropriate separate delivery provider and adapter.
- Complete a privacy, abuse and backup review before production use.

## Deploy Cloudflare

1. Clone `Niroop-H/MQ-Mailer`, or connect GitHub to **Cloudflare Workers Builds**. Configure build command `npm run build` and deploy command `npx wrangler deploy`; keep project/Worker name `mq-mailer` in sync with `wrangler.jsonc`.
2. Create both R2 buckets matching `wrangler.jsonc` (`mq-mailer` and `mq-mailer-preview`, for example), and enable Workers AI. Durable Object migrations are already configured in Wrangler.
3. Choose the correct `DOMAINS` value in Wrangler. The default is `mahquantum.tech`. For a test subdomain, update this before deploying.
4. Deploy with `npm ci && npm run deploy` or the Cloudflare Builds integration.
5. Enable **Cloudflare Access** on the deployed Worker with a policy allowing only approved employees and the administrator, not the public. Retrieve the application audience and team domain from Cloudflare Access.
6. Set the following three **Worker secrets**, never GitHub files or Vercel client variables: `POLICY_AUD` (Access app audience), `TEAM_DOMAIN` (Access team issuer URL), `MQ_ADMIN_EMAIL` (the exact signed-in email address of the single admin). Use `npx wrangler secret put <NAME>` locally or Cloudflare dashboard. Keep all three separate.
7. Verify unauthenticated requests are rejected. Create owner-assigned and shared mailboxes as admin, then sign in as two different employees and verify that user A cannot list/read/send/search/download user B's private messages. Test revocation and missing ACL behavior; employee AI/MCP must return 403.
8. Enable Cloudflare **Email Routing** for the selected domain. Route a single pilot address or catch-all to the Worker as appropriate. Do not modify existing MX records until migration is approved.
9. For **transactional** messages only, enable Cloudflare **Email Service** outbound sending, onboard and verify sender domain, SPF/DKIM/DMARC as instructed by the provider, and confirm the `EMAIL` send binding is active. The provided code uses Cloudflare's sending API; it is not a generic SMTP implementation. For ordinary business emails, implement a separate permitted sender adapter first.
10. Create a mailbox in the app matching the domain/address, send inbound tests from outside the domain and verify received message + attachment storage. For authorized transactional tests, send outward to verified/approved recipients as allowed by your account, verify delivered headers and proper replies. Inspect DMARC alignment and bounce/failure events.
11. Connect `mail.mahquantum.tech` through Cloudflare Worker **Custom Domain** after testing. Read [CUSTOM-DOMAIN.md](CUSTOM-DOMAIN.md): an active Cloudflare DNS zone is required; do not create a conflicting CNAME in advance.
12. Establish R2 object versioning or backups as supported, a tested Durable Objects SQLite export/backup process, retention policy and recovery procedures. GitHub backs up **code only**, not received emails.

## Deployment and data isolation

Cloudflare Access validates the login, and the Worker enforces mailbox ownership/member ACLs before accessing HTTP mailbox APIs. Mailbox creation, deletion, and permission changes are admin-only. Employee AI/MCP entrypoints remain blocked because the upstream agent tools do not yet independently enforce owner/member authorization. Real multi-user Cloudflare Access testing is mandatory before company email use.

## Secrets

Never commit `.dev.vars`, tokens, sender verification secrets, API credentials or live email contents. Use scoped Cloudflare secrets and restrict GitHub/Cloudflare build integration permissions.

## Vercel usage

Vercel may later serve `admin.mahquantum.tech` for a separate company admin application. Until then, no Vercel project is required for mail; adding an unnecessary proxy to Vercel would complicate Cloudflare Access tokens, WebSockets and Worker email bindings.
