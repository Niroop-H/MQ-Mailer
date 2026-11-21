# MAH Quantum Mail — Deployment checklist

**New authentication:** Google OAuth + D1. Read [GOOGLE-AUTH-FREE.md](GOOGLE-AUTH-FREE.md). There is **no Cloudflare Zero Trust requirement** and no credit card required by this Worker code.

**STOP: Zoho Mail coexistence.** Do not change any MX records or enable Cloudflare Email Routing on `mahquantum.tech`. MQ Mailer is a separate HTTPS webmail application at `mailer.mahquantum.tech` that will receive new `@international.mahquantum.tech` addresses only; Zoho stays the root-domain mail provider. Read [ZOHO-COEXISTENCE.md](ZOHO-COEXISTENCE.md). Cloudflare DNS is now active, with the existing Zoho records preserved. Do not replace the apex MX records.

This software is a Cloudflare Workers application. Vercel must not host the same backend or receive Cloudflare identity secrets. Deploy an optional separate Vercel admin portal only after dedicated authentication and role-based API authorization exist.

## Before you deploy

- Use Google OIDC credentials on the Worker, not Cloudflare Zero Trust Access. `MQ_ADMIN_EMAIL` must match a verified Gmail login for the sole administrator. Other employees require explicit administrator approval and mailbox ACL assignment.
- Existing Zoho MX records must not change. Enable Email Routing only for `international.mahquantum.tech` after nameserver and DNS validation. Full checklist: [INTERNATIONAL-DEPLOYMENT.md](INTERNATIONAL-DEPLOYMENT.md).
- Confirm Cloudflare D1 free-tier object adapter, Durable Objects (SQLite), Workers and Workers AI availability/quotas. **Cloudflare Email Service is for transactional email only.** Arbitrary-recipient transactional sending requires Workers Paid; ordinary staff correspondence requires an appropriate separate delivery provider and adapter.
- Complete a privacy, abuse and backup review before production use.

## Deploy Cloudflare

1. **Already completed:** `Niroop-H/MQ-Mailer` is connected to Cloudflare Workers Builds. Source pushes on `main` run the build and deploy to Worker `mq-mailer`.
2. **Already completed:** Dedicated D1 database `mq-mailer-free`, its `mq_objects`/`mq_chunks` tables and `mq_auth_users`/`mq_auth_flows`/`mq_auth_sessions` tables; the application uses a limited 6 MiB per-object adapter. No R2 billing activation or R2 buckets are needed. Enable Workers AI only within free allowance. Durable Object migrations remain in Wrangler.
3. The `DOMAINS` value in Wrangler is set to `international.mahquantum.tech`. Do not change it to the root Zoho domain.
4. **Already completed:** Cloudflare Worker and Custom Domain `mailer.mahquantum.tech` attached; deployment continues from GitHub.
5. In Google Auth Platform create a **Web application** OAuth client with exact redirect URI `https://mailer.mahquantum.tech/auth/google/callback`. Keep the client app in Testing initially and add your administrator account as a test user.
6. Add three **encrypted Cloudflare Worker secrets** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MQ_ADMIN_EMAIL` using **Workers & Pages → mq-mailer → Settings → Variables and Secrets**. Never commit credentials. The old `POLICY_AUD` and `TEAM_DOMAIN` variables are no longer used.
7. Open `https://mailer.mahquantum.tech/auth/login`, sign in with the administrator's verified Google account, approve employees under **Employee sign-in access**, then separately assign their mailbox owner/member ACL. Verify cross-user isolation, revocation, CSRF and private attachments using actual Google accounts. Employee AI/MCP must return 403.
8. **DO NOT enable Cloudflare Email Routing on the root `mahquantum.tech`.** Zoho MX records remain authoritative. Configure the Email Routing `international` subdomain only, and add explicit recipient routing rules to `mq-mailer`.
9. The Workers Free configuration intentionally has **no outbound email binding**; sending is disabled. Implement an approved outbound provider compatible with the company's business-email use before enabling send. Do not change existing Zoho SPF/DKIM/DMARC records without an explicit plan.
10. Create an internal pilot mailbox (e.g. `hello@international.mahquantum.tech`) and add its explicit Email Routing rule to the Worker after activation. Do not attempt live outbound tests until a compliant sending integration is set up. Verify mailbox isolation, attachments, quota enforcement, and restore operations independently.
11. **Already completed:** Worker Custom Domain `mailer.mahquantum.tech` is attached and Cloudflare manages its DNS record. `workers.dev` intentionally rejects logins.
12. Establish D1 data backup/export, a tested Durable Objects SQLite backup/restore process, retention policy and recovery procedures. GitHub backs up **code only**, not received emails.

## Deployment and data isolation

Google OIDC validates the login, D1 stores short-lived and revocable sessions, and the Worker enforces mailbox ownership/member ACLs before accessing HTTP mailbox APIs. Mailbox creation, deletion, and permission changes are admin-only. Employee AI/MCP entrypoints remain blocked because the upstream agent tools do not yet independently enforce owner/member authorization. Real multi-user Google OIDC testing is mandatory before company email use.

## Secrets

Never commit `.dev.vars`, tokens, sender verification secrets, API credentials or live email contents. Use scoped Cloudflare secrets and restrict GitHub/Cloudflare build integration permissions.

## Vercel usage

Vercel may later serve `admin.mahquantum.tech` for a separate company admin application. Until then, no Vercel project is required for mail; adding an unnecessary proxy to Vercel would complicate Google OAuth cookies, WebSockets and Worker email bindings.
