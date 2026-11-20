# MAH Quantum Mail — Deployment checklist

This software is a Cloudflare Workers application. Vercel must not host the same backend or receive R2/Access secrets. Deploy an optional separate Vercel admin portal only after dedicated authentication and role-based API authorization exist.

## Before you deploy

- Use one designated Cloudflare Access identity as the **only administrator**. The code explicitly refuses all other identities in production. Do not add a team-wide Access policy.
- Review current MX records for `mahquantum.tech` before enabling Email Routing. Switching MX could interrupt existing mail. Start with a test subdomain if existing mailboxes are active; set `DOMAINS` to that test domain during pilot.
- Confirm Cloudflare R2, Durable Objects (SQLite), Workers, Workers AI availability/quotas, and Email Service onboarding. Costs and free allocations vary; sending may require Workers Paid.
- Complete a privacy, abuse and backup review before production use.

## Deploy Cloudflare

1. Clone `Niroop-H/MQ-Mailer`, or connect GitHub to **Cloudflare Workers Builds**. Configure build command `npm run build` and deploy command `npx wrangler deploy`; keep project/Worker name `mq-mailer` in sync with `wrangler.jsonc`.
2. Create both R2 buckets matching `wrangler.jsonc` (`mq-mailer` and `mq-mailer-preview`, for example), and enable Workers AI. Durable Object migrations are already configured in Wrangler.
3. Choose the correct `DOMAINS` value in Wrangler. The default is `mahquantum.tech`. For a test subdomain, update this before deploying.
4. Deploy with `npm ci && npm run deploy` or the Cloudflare Builds integration.
5. Enable **Cloudflare Access** on the deployed Worker with a policy limited to the single admin identity. Retrieve the application audience and team domain from Cloudflare Access.
6. Set the following three **Worker secrets**, never GitHub files or Vercel client variables: `POLICY_AUD` (Access app audience), `TEAM_DOMAIN` (Access team issuer URL), `MQ_ADMIN_EMAIL` (the exact signed-in email address of the single admin). Use `npx wrangler secret put <NAME>` locally or Cloudflare dashboard. Keep all three separate.
7. Verify unauthenticated requests are rejected and a different authenticated user's requests receive 403. Then confirm the administrator can load the interface.
8. Enable Cloudflare **Email Routing** for the selected domain. Route a single pilot address or catch-all to the Worker as appropriate. Do not modify existing MX records until migration is approved.
9. Enable Cloudflare **Email Service** outbound sending, onboard and verify sender domain, SPF/DKIM/DMARC as instructed by the provider, and confirm the `EMAIL` send binding is active. The provided code uses Cloudflare's sending API; it is not a generic SMTP implementation.
10. Create a mailbox in the app matching the domain/address, send inbound tests from outside the domain and verify received message + attachment storage. Then send outward to multiple providers, verify delivered headers and proper replies. Inspect DMARC alignment and bounce/failure events.
11. Configure a custom domain like `mail.mahquantum.tech` for the Worker **after** the application, Access, and email routing are tested. Avoid conflicting Worker/Pages/Vercel routes.
12. Establish R2 object versioning or backups as supported, a tested Durable Objects SQLite export/backup process, retention policy and recovery procedures. GitHub backs up **code only**, not received emails.

## Deployment and data isolation

Cloudflare Access validates an identity; our temporary `MQ_ADMIN_EMAIL` check restricts to exactly one administrator. It is **not** per-mailbox RBAC. Do not add employees until all endpoints (including mailbox listing, email delivery APIs, agent connections and MCP) use server-side ownership checks. Browser-only filtering is not sufficient.

## Secrets

Never commit `.dev.vars`, tokens, sender verification secrets, API credentials or live email contents. Use scoped Cloudflare secrets and restrict GitHub/Cloudflare build integration permissions.

## Vercel usage

Vercel may later serve `admin.mahquantum.tech` for a separate company admin application. Until then, no Vercel project is required for mail; adding an unnecessary proxy to Vercel would complicate Cloudflare Access tokens, WebSockets and Worker email bindings.
