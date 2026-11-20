# DNS migration inventory — mahquantum.tech
**Prepared 20 Nov 2026 | Cloudflare zone: pending | DO NOT switch nameservers until final cutover checks pass**

## Operational objective

Preserve all existing Zoho mail on `@mahquantum.tech`, existing Vercel domains and sending-provider authentication. New MQ Mailer uses the independent `@international.mahquantum.tech` mailbox domain and `https://mailer.mahquantum.tech` website, with dedicated Cloudflare routing after a safe DNS transition.

The registrar remains Namify, authoritative nameservers remain Namify's, and no DNS cutover has occurred. The below records are **staged only** in the Cloudflare Free zone.

## Record inventory — 29 staged DNS records

### A (1)
| Host | Value | Purpose |
| --- | --- | --- |
| `@` | `216.198.79.1` | Existing apex Vercel website |

### CNAME (11)
| Host | Value | Note |
| --- | --- | --- |
| `71743826` | `google.com` | Verification mapping |
| `asura` | `09fdd4d9d2c8ee11.vercel-dns-017.com` | Vercel; project domain verified |
| `legacy` | `cname.vercel-dns.com` | Preserve existing mapping |
| `quantum` | `cname.vercel-dns.com` | Vercel; project domain verified |
| `mqsiquantum` | `cname.vercel-dns.com` | Vercel; project domain verified |
| `nirooph` | `331118ac2948887c.vercel-dns-017.com` | Vercel; project domain verified |
| `brevo1._domainkey.mail` | `b1.mail-mahquantum-tech.dkim.brevo.com` | Brevo DKIM |
| `brevo2._domainkey.mail` | `b2.mail-mahquantum-tech.dkim.brevo.com` | Brevo DKIM |
| `research` | `4757d98eac1f3d24.vercel-dns-017.com` | Vercel; project domain verified |
| `workspace` | `ab1c1c2592ea5bf5.vercel-dns-017.com` | Vercel verified and preferred of two duplicate Namify records |
| `www` | `4cbe6e884f1a1efc.vercel-dns-017.com` | **REVIEW REQUIRED:** duplicate Namify target and Vercel reports misconfigured |

### MX (4)
| Host | Mail server | Priority | Purpose |
| --- | --- | ---: | --- |
| `@` | `mx.zoho.in` | 10 | Zoho Mail |
| `@` | `mx2.zoho.in` | 20 | Zoho Mail |
| `@` | `mx3.zoho.in` | 50 | Zoho Mail |
| `send.send` | `feedback-smtp.us-east-1.amazonses.com` | 10 | Resend/Amazon SES feedback handling; exact value supplied by owner |

### TXT (13)
| Host | Contents/role |
| --- | --- |
| `@` | Zoho SPF `v=spf1 include:zoho.in ~all` |
| `@` | Zoho verification `zoho-verification=zb58276526.zmverify.zoho.in` |
| `@` | Google GWS recovery domain verification |
| `@` | Two separate Google site-verification strings |
| `_dmarc` | `v=DMARC1; p=none;` |
| `zmail._domainkey` | Existing long Zoho DKIM public key (copied from Cloudflare DNS scan) |
| `mail` | Existing Brevo code `brevo-code:403cee07ec01d00910770fac3fc9c882` |
| `mail` | SPF includes Brevo, Mailjet and SendGrid |
| `_gh-mah-quantum-e.www` | GitHub verification `ad3412edc1` |
| `_gh-mah-quantum-o.www` | GitHub verification `59674bf4a2` |
| `send.send` | Amazon SES SPF `v=spf1 include:amazonses.com ~all` |
| `resend._domainkey.send` | Complete Resend DKIM public key provided directly by owner (stored in Cloudflare TXT) |

## Intentionally not copied

- One suspicious MX entry `@` -> `mx.zoho.in.mahquantum.tech` (priority 10), which appears to be malformed. Reconfirm how Namify constructed this value before considering migration.
- The second duplicate `workspace` CNAME pointing at `cname.vercel-dns.com`. Vercel prefers the unique `ab1c1c2592ea5bf5.vercel-dns-017.com` entry and reports workspace configured correctly.
- The second duplicate `www` CNAME pointing at `cname.vercel-dns.com`. Vercel currently reports **www misconfigured** even while the root `mahquantum.tech` project is verified. Investigate and fix `www` before cutover; do not blindly rely on either duplicate.
- Namify's NS and SOA values. Cloudflare generates new authoritative NS and SOA records. **Do not manually add the old registrar nameservers**.
- AAAA and SRV: user confirmed neither section has any records.
- DNSSEC: Namify screenshot shows no DS records. Check registrar DNSSEC state and upstream DS before delegation; an empty screenshot alone is not a cryptographic verification.

## Required checks before nameserver switch

1. Verify all sites currently used, including ones not visible in the screenshots, are represented in the intended Cloudflare zone. Cloudflare auto-discovery is incomplete by design.
2. Resolve and validate Vercel `www` configuration. Avoid duplicate CNAMEs at the same owner name.
3. Confirm that none of the omitted/ambiguous records is needed for an operational provider.
4. Check DNSSEC/DS status at registrar and authoritative delegation.
5. Keep existing Zoho apex MX, SPF, DKIM, DMARC and verification records intact. Never enable Cloudflare Email Routing on the apex.
6. Confirm 29 staged records in Cloudflare, all DNS-only where appropriate. Do not enable proxying on email/verification records.
7. Only after these pass: set Namify nameservers to `clara.ns.cloudflare.com` and `max.ns.cloudflare.com`. Recheck live mail and websites after propagation.
8. Only then configure `international.mahquantum.tech` Cloudflare Email Routing as a separately configured subdomain (independent MX), plus protected Worker Custom Domain `mailer.mahquantum.tech`.

## Important distinction

**DNS subdomain mapping is not an XML sitemap.** This checklist covers DNS records only. Search-engine sitemap.xml and robots.txt files are managed inside each website deployment and are not migrated through DNS.

**The MX/SMTP server for `@international.mahquantum.tech` and the `mailer` Worker Custom Domain do not exist yet.** A DNS migration alone does not make MQ Mailer a working mail service.
