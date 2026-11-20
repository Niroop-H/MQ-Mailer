# MQ Mailer — MAH Quantum Mail

Independent, self-hosted business email and AI inbox based on [Cloudflare Agentic Inbox](https://github.com/cloudflare/agentic-inbox).

**Source ownership:** All application source files are stored in this repository. It is not a Git submodule, hosted iframe, or dependency on the continued existence of the upstream repository. The project preserves upstream Apache-2.0 licensing and attribution; see [LICENSE](LICENSE) and [NOTICE](NOTICE).

**Current phase:** Administrator-only pilot. **Do not add employee accounts or enable broad Cloudflare Access policies yet.** Upstream has no per-mailbox access control; in this version production requests additionally require an exact-match admin email via `MQ_ADMIN_EMAIL`.

## Stack

- UI: React 19 + React Router 7 + Tailwind CSS + Cloudflare Kumo
- Backend: Cloudflare Workers + Hono
- Mailbox data: Durable Objects / SQLite
- Attachments and mailbox metadata: Cloudflare R2
- Incoming email: Cloudflare Email Routing → Worker email handler
- Outgoing email: Cloudflare Email Service sending binding (provider onboarding required)
- AI: Cloudflare Workers AI and the Agents SDK
- Authentication: Cloudflare Access with validated JWT, plus an administrator identity restriction
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

## Known limitations and release gates

- There is currently no tenant or per-mailbox RBAC. Until implemented across HTTP API, agents, and MCP, only a single designated administrator can be permitted in production.
- Sending is not ready until Cloudflare Email Service has approved the sender domain, the binding is enabled, and delivery has been tested.
- Receiving is not ready until Email Routing DNS/MX records are correctly configured. **Do not overwrite existing MX records without a migration plan.**
- This repository does not include or back up live email messages, R2 objects, or Durable Object data. Configure operational backups separately.
- The copied upstream demo screenshot and generic favicon.ico are intentionally not carried forward, replaced with our own branding and documentation.
- Production validation, backups, incident response, DKIM/SPF/DMARC, and abuse monitoring remain to be performed.

## Origin and license

Derived from [cloudflare/agentic-inbox](https://github.com/cloudflare/agentic-inbox), copyright Cloudflare, Inc., 2026. Changes by MAH Quantum. Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
