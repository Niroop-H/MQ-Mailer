# Custom-domain setup: mail.mahquantum.tech

The intended public address is **https://mail.mahquantum.tech**.

## Important DNS clarification

Cloudflare Workers **Custom Domains** work only on a hostname in an **active Cloudflare DNS zone owned by the account**. Adding a DNS CNAME by itself does **not** register the hostname with Cloudflare Workers, and Cloudflare documentation specifically disallows attaching a Workers Custom Domain to a hostname that already has a CNAME record.

**Recommended:** First put the `mahquantum.tech` zone in the Cloudflare account that hosts `mq-mailer`; after the Worker is deployed, open **Workers & Pages → mq-mailer → Settings → Domains & Routes → Add → Custom Domain**, and enter `mail.mahquantum.tech`. Cloudflare will create its own DNS record and certificate. Do **not** pre-create a conflicting CNAME.

If the domain must remain at another DNS provider, choose a supported, separately verified DNS and Worker routing architecture instead. Do not point a raw CNAME at a `*.workers.dev` URL and assume production TLS/host routing will work.

## Critical distinction: website versus email routing

- **Website:** `mail.mahquantum.tech` opens the protected MQ Mailer web application. It needs Worker custom-domain routing and Cloudflare Access.
- **Email:** `employee@mahquantum.tech` receives messages only after Cloudflare Email Routing and the relevant **MX records** are correctly configured for `mahquantum.tech`.
- **Sending:** SMTP/provider acceptance, SPF/DKIM/DMARC, sender/domain verification, and a legitimate general-purpose outgoing email service are separate requirements. The copied Cloudflare Email Service implementation is **transactional**, not a general business mail provider.

Do not modify existing MX records until you verify whether current employee email already uses another provider.

## Infrastructure prerequisites before website can work

1. **R2 must be activated.** As of 2026-11-20, the connected account returns Cloudflare error `10042`: `Please enable R2 through the Cloudflare Dashboard.` The upstream app cannot operate without its R2 bucket binding.
2. Create `mq-mailer` and `mq-mailer-preview` R2 buckets; confirm cost policy first.
3. Deploy the Worker with `npm run deploy` (or Cloudflare Workers Builds) and verify its health/response on a temporary `workers.dev` hostname.
4. Configure Cloudflare Access and set secrets `POLICY_AUD`, `TEAM_DOMAIN`, `MQ_ADMIN_EMAIL`. Configure the Access application login policy for the intended employees **without giving them administrator privileges**. The server reads the validated JWT and authorizes only explicitly assigned mailboxes.
5. Admin creates mailboxes and specifies the employee's exact Cloudflare Access login address as **Owner**. Shared mailboxes are assigned explicitly in **Settings → Employee access & shared mailboxes**.
6. Complete cross-user isolation tests and live send/receive tests before allowing sensitive company communication.
7. Attach the Custom Domain from the Cloudflare Worker dashboard when the zone is active and no conflicting CNAME exists.

## Current account status

The connected Cloudflare account had no `mahquantum.tech` zone in the exact-name lookup at the time of inspection. Consequently a Custom Domain could **not** be provisioned from that account in this session. Neither DNS, MX nor billing settings were changed.

Official documentation: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
