# MQ Mailer — International mail and webmail deployment

## Final hostnames

- **New company mailboxes:** `@international.mahquantum.tech`. Examples: `hello@international.mahquantum.tech`, `support@international.mahquantum.tech`, `research@international.mahquantum.tech`.
- **Web application:** `https://mailer.mahquantum.tech`.
- **Existing Zoho:** `@mahquantum.tech` stays on Zoho Mail and its existing MX records must remain unchanged.

These hostnames serve different purposes: `mailer` is an HTTPS app; `international` has independently configured inbound MX records.

## What is prepared

The Worker configuration sets `DOMAINS=international.mahquantum.tech`. Admins can provision only that email domain, and the inbound handler rejects any other mailbox domain. Employee authorization is based on Cloudflare Access login identity and owner/member ACLs.

A separate Cloudflare D1 database (`mq-mailer-free`) holds limited metadata and attachments through the free-tier adapter. **Free does not mean unlimited**: the adapter enforces a 6 MiB maximum per stored object, and free-tier Worker/D1/DO/AI usage quotas apply. Outbound sends are disabled until an approved general-purpose sending provider is configured. No R2 billing or paid sending service was activated.

## DNS prerequisites — do not disrupt Zoho

Cloudflare zone `mahquantum.tech` exists on the Free Website plan but is **pending** because the live domain still uses Namify nameservers. Cloudflare's zone currently has **zero active DNS records**.

**Before switching nameservers**: export the entire live DNS zone from Namify, including all A/AAAA/CNAME/TXT/MX/SRV/CAA records, all website subdomains, Zoho MX and DKIM/SPF/DMARC, verification TXT records, and Vercel entries. Cloudflare's scan produced candidates, not a complete or authoritative migration. Correctly import all confirmed records to Cloudflare, with email records set to DNS-only, then verify the full comparison. Do not import the suspicious `mx.zoho.in.mahquantum.tech` candidate without checking Namify.

Only after comparing and validating the DNS inventory should you change the registrar's authoritative nameservers to the two Cloudflare-assigned nameservers:

- `clara.ns.cloudflare.com`
- `max.ns.cloudflare.com`

Do **not** create a CNAME for `mailer`. Cloudflare Workers Custom Domain creates its own DNS record and TLS certificate after the Cloudflare DNS zone is active.

## Deploy webmail

1. Connect **Niroop-H/MQ-Mailer** to Cloudflare Workers Builds, production branch `main`. The previous API connection attempt failed with Git-provider error 8000008; authorize the Cloudflare/GitHub integration through the dashboard if still disconnected.
2. Set build command `npm run build` and deploy command `npx wrangler deploy`, using the checked-in `wrangler.jsonc`. Verify `mq-mailer-free` is bound as `D1_MAIL` and the SQL storage tables exist.
3. Create the protected Cloudflare Access application and restrict who may authenticate. Provide required Worker secrets `POLICY_AUD`, `TEAM_DOMAIN`, and `MQ_ADMIN_EMAIL` (do not put their values in GitHub). Access must cover the public hostname and the workers.dev URL if enabled.
4. Deploy the Worker and perform actual unauthorized, admin, and employee login tests. No live URL is confirmed until those pass.
5. In Cloudflare **Workers & Pages → mq-mailer → Settings → Domains & Routes → Add → Custom Domain**, add `mailer.mahquantum.tech`. This needs an active Cloudflare DNS zone. It can create its own DNS record and certificate.

## Receive only international emails

Once the zone is active, in **Compute → Email Service → Email Routing**, choose `mahquantum.tech` and use **Settings → Subdomains** to configure **international**. Review changes carefully; it must add MX/DKIM/SPF routing records **only for `international.mahquantum.tech`**, not replace the existing Zoho MX at `mahquantum.tech`.

Create **explicit recipient rules** (for example `support@international.mahquantum.tech`) with action **Send to a Worker → mq-mailer**. Do not activate root-domain routing or catch-all on Zoho. Configure real mailboxes in MQ Mailer that match these recipients and assign employee owners. Validate inbound handling using external test senders before operational use.

Cloudflare official docs:
- [Email Routing subdomains](https://developers.cloudflare.com/email-service/configuration/subdomains/)
- [Email Routing rules and Worker delivery](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/)
- [Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## What this does NOT provide yet

- It does not replace or synchronize Zoho mailboxes.
- It does not provide verified general-purpose outbound mail yet.
- It does not certify secure production email: live Cloudflare Access isolation, delivery, quota/retention, backups/restores, abuse prevention, and attachment safety still need validation.
- The planned HTTPS URL is not yet deployed or confirmed publicly reachable.

## Correct outcome

Zoho `@mahquantum.tech` remains unchanged. New `@international.mahquantum.tech` addresses are routed separately to MQ-Mailer **after subdomain Email Routing is enabled and tested**. Employees sign in at `https://mailer.mahquantum.tech` **after the protected Worker and custom domain are live**.
