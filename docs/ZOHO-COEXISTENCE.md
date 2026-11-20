# Zoho Mail + MQ Mailer coexistence (NO MAIL MIGRATION)
Date: 2026-11-20

## Non-negotiable production policy
MQ Mailer is a **separate web application** intended for `https://mailer.mahquantum.tech`. It must not take over inbound email for `@mahquantum.tech` from Zoho Mail without an explicit, tested migration decision. Keep all live Zoho mailboxes, MX records, SPF, DKIM, DMARC, and existing website records unchanged.

**DO NOT** enable Cloudflare Email Routing on the `mahquantum.tech` apex or replace the Zoho MX records. Cloudflare Email Routing requires its own MX records for that domain, so it cannot be turned on for the same apex alongside Zoho's MX while preserving normal Zoho delivery.

**DO NOT** add Cloudflare's MX records as lower-priority 'fallbacks'. MX priority is NOT a provider mailbox split or a reliable mirroring mechanism.

## Separate website hostname versus email delivery
- `mailer.mahquantum.tech` is the **HTTPS user interface**, not the SMTP mailbox delivery service.
- Employee addresses such as `ceo@mahquantum.tech` continue to be delivered by **Zoho** while Zoho remains the MX destination.
- The current upstream-derived MQ Mailer **does not automatically synchronize Zoho mailboxes**. Its inbound Cloudflare Worker email handler receives messages only if mail is actually routed to it.
- To see Zoho messages in MQ Mailer while keeping Zoho as the provider, implement a proper **Zoho Mail integration** (OAuth/API or supported IMAP, depending on Zoho plan and capabilities), with independent per-employee authorization and retention controls. A mailbox created in MQ Mailer is not automatically a live Zoho email address.
- **Chosen MQ-Mailer email domain:** `@international.mahquantum.tech`, configured via Cloudflare Email Routing's subdomain settings, with independent MX and routing rules. It does not modify Zoho's apex-domain mailboxes.
- A selective Zoho forwarding route can duplicate approved messages to a configured external inbox after verifying the forwarding destination. Zoho forwarding does not remove the need for a receiving provider and does not migrate mailboxes by itself.

## DNS migration safety
The domain registrar and current authoritative DNS are managed with Namify. The new Cloudflare zone was created on Free on 2026-11-20, but **it is PENDING and currently has ZERO active DNS records**. A Cloudflare DNS scan found candidate records including:
- Zoho `MX` at the apex: `mx.zoho.in` priority 10; `mx2.zoho.in` priority 20; `mx3.zoho.in` priority 50.
- Apex Zoho SPF `v=spf1 include:zoho.in ~all`.
- Apex DMARC at `_dmarc.mahquantum.tech`.
- DKIM at `zmail._domainkey.mahquantum.tech`.
- `www.mahquantum.tech` CNAME to a Vercel-controlled hostname.
- Verification TXT records at apex and `mail.mahquantum.tech`.

The scanner also proposed `mx.zoho.in.mahquantum.tech` as a malformed-looking extra MX record. **Do not import that candidate automatically.** Confirm real records from Namify/Zoho's DNS setup screen.

The scan is NOT comprehensive. Other subdomains such as website/research/workspace applications may have records that a scan missed. Export the *entire* Namify DNS zone, compare line-by-line, import to Cloudflare with correct proxying, and validate TXT, SPF, DKIM, MX, CNAME/A/AAAA, ACME and subdomains BEFORE ever switching authoritative nameservers.

Cloudflare Workers Custom Domain requires an active Cloudflare zone and creates the routing record itself; **do not pre-create a CNAME for `mailer`**. Existing TXT records at `mail.mahquantum.tech` are unrelated and should remain untouched.

Do not use a raw CNAME from Namify to `mq-mailer.mahquantum.workers.dev` as though it provided a valid Workers Custom Domain with correct TLS.

## Deployment gates
1. Keep current Namify nameservers and Zoho MX unchanged during development.
2. Use the `mq-mailer.mahquantum.workers.dev` Worker **only after it actually deploys**; do not claim it is live before an HTTP and login smoke test.
3. Cloudflare's GitHub source integration must be authorized in the dashboard; Cloudflare rejected the attempted repository connection with code 8000008.
4. The R2-free D1 adapter is bounded storage and must pass runtime checks; do not use with real business email until tested.
5. Configure and verify Access JWT settings and real employee isolation, backups, attachment limits, recovery and security.
6. If shifting DNS hosting to Cloudflare later, first copy/verify all DNS records. Then attach a Worker Custom Domain for the HTTPS application **without changing Zoho MX**.
7. Configure Email Routing for **international subdomain only**, with explicit recipient rules to the Worker, after validating the Cloudflare zone. Do not enable apex routing.
8. A supported outbound email service requires separate setup and permission. No commercial sender was activated.

See [INTERNATIONAL-DEPLOYMENT.md](INTERNATIONAL-DEPLOYMENT.md).

Reference documentation:
- https://developers.cloudflare.com/email-service/configuration/domains/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://www.zoho.com/mail/help/email-forwarding.html
