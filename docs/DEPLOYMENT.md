# MAH Quantum Mail — Deployment checklist

**STOP: Zoho Mail coexistence.** Do not change any MX records or enable Cloudflare Email Routing on `mahquantum.tech`. MQ Mailer is a separate HTTPS webmail application. For existing company mail, Zoho remains the mail delivery provider. Read [ZOHO-COEXISTENCE.md](ZOHO-COEXISTENCE.md). A new free Cloudflare DNS zone is pending with zero imported active DNS records; do not switch Namify nameservers until its existing DNS zone is copied and verified.

This software is a Cloudflare Workers application. Vercel must not host the same backend or receive R2/Access secrets. Deploy an optional separate Vercel admin portal only after dedicated authentication and role-based API authorization exist.

## Before you deploy

- Use one designated Cloudflare Access identity as the **only administrator** via `MQ_ADMIN_EMAIL`. Other approved employees can log in but see only mailboxes explicitly assigned to them through the server-side ACL.
- Review current MX records for `mahquantum.tech` before enabling Email Routing. Switching MX could interrupt existing mail. Start with a test subdomain if existing mailboxes are active; set `DOMAINS` to that test domain during pilot.
- Confirm Cloudflare R2, Durable Objects (SQLite), Workers, Workers AI availability/quotas, and Email Service onboarding. **Cloudflare Email Service is for transactional email only.** Arbitrary-recipient transactional sending requires Workers Paid; ordinary staff correspondence requires an appropriate separate delivery provider and adapter.
- Complete a privacy, abuse and backup review before production use.

## Deploy Cloudflare

1. Clone `Niroop-H/MQ-Mailer`, or connect GitHub to **Cloudflare Workers Builds**. Configure build command `npm run build` and deploy command `npx wrangler deploy`; keep project/Worker name `mq-mailer` in sync with `wrangler.jsonc`.
2. Use the existing dedicated D1 database `mq-mailer-free` and its `mq_objects`/`mq_chunks` tables; the application uses a limited 6 MiB per-object adapter. No R2 billing activation or R2 buckets are needed. Enable Workers AI only within free allowance. Durable Object migrations remain in Wrangler.
3. Choose the correct `DOMAINS` value in Wrangler. The default is `mahquantum.tech`. For a test subdomain, update this before deploying.
4. Deploy with `npm ci && npm run deploy` or the Cloudflare Builds integration.
5. Enable **Cloudflare Access** on the deployed Worker with a policy allowing only approved employees and the administrator, not the public. Retrieve the application audience and team domain from Cloudflare Access.
6. Set the following three **Worker secrets**, never GitHub files or Vercel client variables: `POLICY_AUD` (Access app audience), `TEAM_DOMAIN` (Access team issuer URL), `MQ_ADMIN_EMAIL` (the exact signed-in email address of the single admin). Use `npx wrangler secret put <NAME>` locally or Cloudflare dashboard. Keep all three separate.
7. Verify unauthenticated requests are rejected. Create owner-assigned and shared mailboxes as admin, then sign in as two different employees and verify that user A cannot list/read/send/search/download user B's private messages. Test revocation and missing ACL behavior; employee AI/MCP must return 403.
8. **DO NOT enable Cloudflare Email Routing on `mahquantum.tech`.** Zoho MX records must remain authoritative. An independently routed mail subdomain, or a real Zoho API/IMAP sync integration, must be designed and tested before MQ Mailer can display delivered company messages.
9. The Workers Free configuration intentionally has **no outbound email binding**; sending is disabled. Implement an approved outbound provider compatible with the company's business-email use before enabling send. Do not change existing Zoho SPF/DKIM/DMARC records without an explicit plan.
10. Create an internal pilot mailbox in the app for authorization and storage testing only. Its existence does not make that address routable at Zoho. Do not attempt live inbound/outbound tests until a compliant sending and receiving integration is set up. Verify mailbox isolation, attachments, quota enforcement, and restore operations independently.
11. Connect `mail.mahquantum.tech` through Cloudflare Worker **Custom Domain** after testing. Read [CUSTOM-DOMAIN.md](CUSTOM-DOMAIN.md): an active Cloudflare DNS zone is required; do not create a conflicting CNAME in advance.
12. Establish R2 object versioning or backups as supported, a tested Durable Objects SQLite export/backup process, retention policy and recovery procedures. GitHub backs up **code only**, not received emails.

## Deployment and data isolation

Cloudflare Access validates the login, and the Worker enforces mailbox ownership/member ACLs before accessing HTTP mailbox APIs. Mailbox creation, deletion, and permission changes are admin-only. Employee AI/MCP entrypoints remain blocked because the upstream agent tools do not yet independently enforce owner/member authorization. Real multi-user Cloudflare Access testing is mandatory before company email use.

## Secrets

Never commit `.dev.vars`, tokens, sender verification secrets, API credentials or live email contents. Use scoped Cloudflare secrets and restrict GitHub/Cloudflare build integration permissions.

## Vercel usage

Vercel may later serve `admin.mahquantum.tech` for a separate company admin application. Until then, no Vercel project is required for mail; adding an unnecessary proxy to Vercel would complicate Cloudflare Access tokens, WebSockets and Worker email bindings.
