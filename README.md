# MQ Mailer — MAH Quantum Mail

Independent, self-hosted email and AI inbox based on [Cloudflare Agentic Inbox](https://github.com/cloudflare/agentic-inbox).

**Source ownership:** All application source files are stored in this repository. It is not a Git submodule, hosted iframe, or dependency on the continued existence of the upstream repository. The project preserves upstream Apache-2.0 licensing and attribution; see [LICENSE](LICENSE) and [NOTICE](NOTICE).

**Current phase:** Code deployed on Cloudflare Workers; custom domain `mailer.mahquantum.tech` attached. Google OIDC login implementation is committed and CI-tested, but **live Google sign-in needs Worker OAuth secrets and real-user testing**. Brevo Free sending adapter is implemented but has no API key or sender verification; no live outbound mail is configured.

## Current coexistence policy — Zoho continues to receive @mahquantum.tech

**Do not switch MX or activate Cloudflare Email Routing on the root domain.** Existing Zoho MX records must remain in place. MQ Mailer will be a separate web interface, not a replacement for Zoho's delivery. Synchronizing Zoho mailbox contents to this UI requires an additional authorized Zoho API/IMAP integration that is **not implemented**. See [Zoho coexistence guide](docs/ZOHO-COEXISTENCE.md).

The Cloudflare DNS zone is active; existing Zoho records are preserved. The Worker and Custom Domain have already been deployed; sign-in remains unavailable until Google OAuth secrets are configured.

## Dedicated international mail domain and webmail address

- **New MQ Mailer mailbox addresses:** `@international.mahquantum.tech`.
- **Planned protected website:** `https://mailer.mahquantum.tech`.
- **Zoho existing addresses:** `@mahquantum.tech` — leave MX, SPF, DKIM and DMARC untouched.

Cloudflare Email Routing supports a separately configured **international** subdomain. Do not enable apex routing on Zoho. The full [international deployment guide](docs/INTERNATIONAL-DEPLOYMENT.md) explains the DNS prerequisites, free-tier limitations, and routing rules. The webmail custom domain is attached; international email routing is still pending.

## CEO address as its own Google Account (no Google Workspace)

Google allows creating an account using an existing non-Gmail email address such as `ceo@international.mahquantum.tech`. This does **not** give that address a Gmail-hosted mailbox. MQ Mailer accepts this identity after the trusted administrator approves and binds it, and after inbound routing enables Google verification email. See [CEO Google Account and Send/Receive setup](docs/CEO-GOOGLE-ACCOUNT-AND-MAIL-SETUP.md). Existing Zoho remains untouched.

## Card-free authentication setup

Read **[GOOGLE-AUTH-FREE.md](docs/GOOGLE-AUTH-FREE.md)**. Create a standard Google OAuth web client and enter the client ID, client secret and admin login email as **encrypted Cloudflare Worker secrets**, not GitHub files. Callback: `https://mailer.mahquantum.tech/auth/google/callback`. This uses only identity scopes (`openid email profile`) and D1 Free, not paid Google APIs. If the Google console asks for a credit card, stop rather than enabling billing.

The D1 schema is committed in `migrations/0002_auth_google.sql` and was applied to the dedicated `mq-mailer-free` database. **No Google sign-in has been tested against a real account yet.**

## Stack

- UI: React 19 + React Router 7 + Tailwind CSS + Cloudflare Kumo
- Backend: Cloudflare Workers + Hono
- Mailbox data: Durable Objects / SQLite
- Attachments and mailbox metadata: Cloudflare D1 limited object adapter (6 MiB per object, free-tier quota limits)
- Incoming email: Cloudflare Worker email handler exists; targets international subdomain routing only, not existing Zoho mail
- Outgoing email: disabled until an approved provider integration is configured; no Cloudflare Email Service binding in the free-tier Wrangler setup
- Outgoing messages: optional Brevo Free API sender adapter (requires approved use, dedicated sender verification and a Worker secret; currently disabled)
- AI: Cloudflare Workers AI and the Agents SDK
- Authentication: free Google OpenID Connect (OAuth code + PKCE) with D1-backed admin-approved accounts and sessions. **No Cloudflare Access/Zero Trust required**.
- Source and CI: GitHub (`Niroop-H/MQ-Mailer`)
- Vercel: reserved for a **separate optional future administration site**; this React Router/Worker runtime must not be redeployed as a Vercel Next.js application.

## Quick start

1. `npm ci`
2. Configure `wrangler.jsonc`; dedicated D1 database `mq-mailer-free` is already created and its storage tables initialized. Do not activate R2 billing.
3. `npm run dev` for local UI work.
4. Set up [Google sign-in without a Cloudflare Zero Trust subscription](docs/GOOGLE-AUTH-FREE.md); follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** and **[docs/ZOHO-COEXISTENCE.md](docs/ZOHO-COEXISTENCE.md)** for protected Cloudflare deployment without disrupting Zoho.

Build and type checks: `npm run build` and `npm run typecheck`.

**Never commit** your `.dev.vars`, tokens, private keys, or emails. The checked-in `.dev.vars.example` contains placeholders only.

## Branding

Product: **MQ Mailer / MAH Quantum Mail**. This copy changes the branding and adds a separate administrator check while retaining the upstream email/AI architecture. Do not remove the original license and source notices when modifying or distributing it.

## Outbound mail limitation

Cloudflare Email Service is documented for **transactional email only**; it must not be assumed to support general employee/business correspondence. Before using MQ Mailer as a full replacement for a commercial mailbox provider, implement and test a permitted general-purpose outbound delivery provider and complete SPF/DKIM/DMARC setup.

## Employee mailbox access

Administrators can approve Google login emails, then create mailboxes and assign ownership to those approved Google sign-in emails. Shared members are added in **Settings → Employee access & shared mailboxes**. Employees see only assigned mailboxes and cannot modify access policies or create/delete mailboxes. Legacy mailboxes without assignments remain admin-only.

Employee AI/MCP access is intentionally blocked until its tools and sessions support fine-grained authorization.

Run `npm test` for authorization regression tests. See [docs/CUSTOM-DOMAIN.md](docs/CUSTOM-DOMAIN.md) before creating any CNAME for `mailer.mahquantum.tech`.

## Known limitations and release gates

- Mailbox owner/member ACLs are enforced on the HTTP webmail API. Employee AI/MCP is deliberately disabled, and live Google OAuth and end-to-end authorization tests are still required.
- Sending via the installed Brevo adapter remains unavailable until an approved sender and `BREVO_API_KEY` are configured and live delivery has been tested.
- Existing Zoho MX records must not be changed. The Worker will receive only international subdomain mail after explicit Email Routing is activated.
- This repository does not include or back up live email messages, D1 data, or Durable Object data. Configure operational backups separately.
- The copied upstream demo screenshot and generic favicon.ico are intentionally not carried forward, replaced with our own branding and documentation.
- Production validation, backups, incident response, DKIM/SPF/DMARC, and abuse monitoring remain to be performed.

## Origin and license

Derived from [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox), copyright Cloudflare, Inc., 2026. Changes by MAH Quantum. Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
