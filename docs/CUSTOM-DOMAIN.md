# Custom webmail hostname: mailer.mahquantum.tech

**New website hostname:** `https://mailer.mahquantum.tech`.

**New mailbox email domain:** `@international.mahquantum.tech`.

**Keep Zoho `@mahquantum.tech` unchanged.**

The Worker is not deployed yet and the Cloudflare DNS zone is **pending**. Do not save a Namify CNAME to the `workers.dev` address. With a Cloudflare **Workers Custom Domain**, Cloudflare creates the DNS entry and TLS certificate after the domain's zone is active.

To activate the existing pending zone, first migrate every real DNS record from Namify and verify all websites and Zoho mail records (MX, SPF, DKIM, DMARC). Then switch the registrar nameservers. In **Workers & Pages → mq-mailer → Settings → Domains & Routes → Add → Custom Domain**, enter `mailer.mahquantum.tech` after the Worker is deployed and the zone is active. No additional CNAME should be created for this hostname.

The existing `mail.mahquantum.tech` verification TXT records are unrelated to the new `mailer` name; leave them unchanged. `mailer` is an HTTPS web application only, not an MX mail-server host.

For inbound messages on `@international.mahquantum.tech`, configure Cloudflare Email Routing **only for that subdomain** with explicit recipients directed to the Worker, after the Cloudflare zone is active. Do not enable Cloudflare routing on the apex or change Zoho MX records.

See [INTERNATIONAL-DEPLOYMENT.md](INTERNATIONAL-DEPLOYMENT.md) for a full checklist.

Cloudflare Worker Custom Domain docs: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
