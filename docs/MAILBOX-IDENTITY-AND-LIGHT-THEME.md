# CEO and employee inboxes: Gmail login != company mailbox

MQ Mailer is intentionally **light theme only** and must stay on Cloudflare Workers/D1 free-tier resources wherever possible.

## The distinction

**Login identity:** an administrator-approved Gmail or Google Workspace login (for example `your-existing-gmail@gmail.com`). Google OAuth is used only to prove identity; it does not host or forward company email. The Google sign-in never needs an account named `ceo@international.mahquantum.tech`.

**Company inbox:** `ceo@international.mahquantum.tech`, created by MQ Mailer. This inbox belongs to the international email subdomain and can be assigned to the exact approved Google login in the mailbox owner/member ACL. For example:

| MQ Mailer inbox | Who signs in | How access works |
| --- | --- | --- |
| `ceo@international.mahquantum.tech` | Administrator's existing Gmail | Admin can open, manage and assign CEO mailbox |
| `research@international.mahquantum.tech` | Research employee's existing Google email | Admin must approve identity and assign mailbox ownership |
| `support@international.mahquantum.tech` | Approved Google accounts | Admin can explicitly assign multiple shared members |

The inbox name and login name can differ. Mailbox creation is restricted to the `international.mahquantum.tech` domain. Existing Zoho `@mahquantum.tech` addresses are not hosted here.

## Create the first CEO mailbox

1. Finish standard **Google OAuth client** configuration and Worker secrets as described in [GOOGLE-AUTH-FREE.md](GOOGLE-AUTH-FREE.md). No Google Workspace purchase or Cloudflare Zero Trust payment method needed. Sign in using your **existing Gmail account**.
2. On the MQ Mailer home page, choose **New Mailbox**, prefix `ceo`, domain `international.mahquantum.tech`.
3. Set `Owner's approved Google sign-in email` to the exact Gmail identity that should control the mailbox. If omitted, the UI defaults to the currently logged-in administrator.
4. Create the inbox. The mailbox exists in application storage, but **is not yet externally deliverable** until an independent Cloudflare Email Routing rule is configured.
5. In Cloudflare **Email Service → Email Routing → Settings → Subdomains**, configure only the **international** subdomain. Do **NOT** modify the root Zoho MX records.
6. Add explicit destination rule for `ceo@international.mahquantum.tech`: **Send to a Worker → mq-mailer**. Do not use apex catch-all routing.
7. Verify an external message arrives in the app and that an unapproved employee cannot access the CEO mailbox.
8. Outbound general-purpose mail is **not enabled yet**. The recipient-visible `From: ceo@international.mahquantum.tech` requires a separately approved outbound provider that supports business correspondence, proper domain SPF/DKIM/DMARC and a Worker sender adapter.

## Cost reality

- Google OAuth for standard identity scopes: no Google Workspace subscription or paid API required.
- Cloudflare Email Routing for the international subdomain: available on the Workers Free plan with operational limits; it does not automatically include general-purpose outbound SMTP.
- Cloudflare D1/Workers/DO: available within Free plan quotas, not unlimited. Storage in this repository is capped at 6 MiB per object.
- **Arbitrary-recipient outbound sending with Cloudflare Email Sending requires Workers Paid**. Because the requirement is no credit card, do not turn this on. A compatible free outbound alternative must be selected and tested before we can call it a full send-and-receive business mail service.
- No Google OAuth consent screen, API key, credential or secret belongs in GitHub files.

## Light-only UI rule

- HTML root is fixed to `data-mode="light"` with `color-scheme: light`, including on dark-mode operating systems.
- The separately served Google login page is white/light with dark readable text.
- Removed the previous dark-only CSS media variant and updated the browser theme color.
- Do not add a dark-mode toggle or conditional automatic dark system theme in later work.

See [INTERNATIONAL-DEPLOYMENT.md](INTERNATIONAL-DEPLOYMENT.md) for the domain routing plan; no existing Zoho mailbox should ever be migrated as part of this setup.
