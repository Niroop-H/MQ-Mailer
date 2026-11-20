# MQ Mailer — MAH Quantum Mail

Independent, self-hosted email and AI inbox based on [Cloudflare Agentic Inbox](https://github.com/cloudflare/agentic-inbox).

**Source ownership:** All application source files are stored in this repository. It is not a Git submodule, hosted iframe, or dependency on the continued existence of the upstream repository. The project preserves upstream Apache-2.0 licensing and attribution; see [LICENSE](LICENSE) and [NOTICE](NOTICE).

**Current phase:** Employee mailbox isolation is implemented and CI-tested, but **not production-deployed or verified with real Cloudflare Access identities**. The AI and MCP interfaces remain administrator-only.

## Stack

- UI: React 19 + React Router 7 + Tailwind CSS + Cloudflare Kumo
- Backend: Cloudflare Workers + Hono
- Mailbox data: Durable Objects / SQLite
- Attachments and mailbox metadata: Cloudflare R2
- Incoming email: Cloudflare Email Routing → Worker email handler
- Outgoing transactional email: Cloudflare Email Service sending binding (provider onboarding required)
- Outgoing **ordinary business correspondence**: requires an additional compliant, permitted email-sending provider/adapter; **not implemented yet**
- AI: Cloudflare Workers AI and the Agents SDK
- Authentication: Cloudflare Access with validated JWT and owner/member mailbox ACLs; administrator configured by `MQ_ADMIN_EMAIL`
- Source and CI: GitHub (`Niroop-H/MQ-Mailer`)
- Vercel: reserved for a **separate optional future administration site**; this React Router/Worker runtime must not be redeployed as a Vercel Next.js application.

## Quick start

1. `npm ci`
2. Configure `wrangler.jsonc` (domain and bucket). Ensure the R2 bucket exists, e.g. `npx wrangler r2 bucket create mq-mailer` and `npx wrangler r2 bucket create mq-mailer-preview`.
3. `npm run dev` for local UI work.
4. Follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for protected Cloudflare deployment and Email Routing.

Build and type checks: `npm run build` and `npm run typecheck`.

**Never commit** your `.dev.vars`, tokens, private keys, or emails. The checked-in `.dev.vars.example` contains placeholders only.

## Branding

Product: **MQ Mailer / MAH Quantum Mail**. This copy changes the branding and adds a separate administrator check while retaining the upstream email/AI architecture. Do not remove the original license and source notices when modifying or distributing it.

## Outbound mail limitation

Cloudflare Email Service is documented for **transactional email only**; it must not be assumed to support general employee/business correspondence. Before using MQ Mailer as a full replacement for a commercial mailbox provider, implement and test a permitted general-purpose outbound delivery provider and complete SPF/DKIM/DMARC setup.

## Employee mailbox access

Administrators can create mailboxes and assign an owner using the owner's exact **Cloudflare Access login email**. Shared members are added in **Settings → Employee access & shared mailboxes**. Employees see only assigned mailboxes and cannot modify access policies or create/delete mailboxes. Legacy mailboxes without assignments remain admin-only.

Employee AI/MCP access is intentionally blocked until its tools and sessions support fine-grained authorization.

Run `npm test` for authorization regression tests. See [docs/CUSTOM-DOMAIN.md](docs/CUSTOM-DOMAIN.md) before creating any CNAME for `mail.mahquantum.tech`.

## Known limitations and release gates

- Mailbox owner/member ACLs are enforced on the HTTP webmail API. Employee AI/MCP is deliberately disabled, and real Cloudflare Access security tests are still required.
- Sending is not ready until Cloudflare Email Service has approved the sender domain, the binding is enabled, and delivery has been tested.
- Receiving is not ready until Email Routing DNS/MX records are correctly configured. **Do not overwrite existing MX records without a migration plan.**
- This repository does not include or back up live email messages, R2 objects, or Durable Object data. Configure operational backups separately.
- The copied upstream demo screenshot and generic favicon.ico are intentionally not carried forward, replaced with our own branding and documentation.
- Production validation, backups, incident response, DKIM/SPF/DMARC, and abuse monitoring remain to be performed.

## Origin and license

Derived from [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox), copyright Cloudflare, Inc., 2026. Changes by MAH Quantum. Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
