# CEO Google Account + working MQ Mailer (no Google Workspace subscription)

## Desired result

Use **ceo@international.mahquantum.tech** to:
- Receive inbound mail in the light-only MQ Mailer inbox at `https://mailer.mahquantum.tech`.
- Send messages FROM that exact address through an approved, separately verified provider.
- Sign in to Google services using a Google Account created with that **existing company email** rather than buying Google Workspace.
- Sign in to MQ Mailer with the same Google account, after administrator approval and mailbox ACL assignment.

**A Google Account created with an external email is NOT a Gmail-hosted inbox.** Email storage and delivery still belong to MQ Mailer. Google does not offer free Google Workspace or Gmail mailbox hosting just because a free Google Account exists.

## Setup order (important: Google sends an email verification code)

1. **First configure MQ Mailer administrator Google OAuth** with the trusted administrator's existing Gmail: Google Auth Platform Web OAuth client redirect `https://mailer.mahquantum.tech/auth/google/callback`. Set Worker secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `MQ_ADMIN_EMAIL` (existing Gmail). Do not use `ceo@international.mahquantum.tech` as the initial privileged administrator identity; enrollment/reverification requires additional protection.
2. Sign in as the trusted administrator on `https://mailer.mahquantum.tech`. Create `ceo@international.mahquantum.tech` in the app. Give the CEO mailbox an administrator-controlled owner initially.
3. **Activate inbound routing for only `international.mahquantum.tech`** and a literal `ceo` recipient rule pointing to Worker `mq-mailer`. Keep the apex `mahquantum.tech` Zoho MX untouched. IMPORTANT: Cloudflare's apex Email Routing onboarding refuses existing third-party MX (error 2008). If the dashboard tries to replace the root MX, STOP; do not accept that change. The independent subdomain routing workflow must be validated first or use a separate compatible inbound gateway.
4. From another working address, send a test email to CEO and verify it arrives in MQ Mailer. This is essential before creating the Google Account.
5. Open https://accounts.google.com/signup and select **Use your existing email**. Enter `ceo@international.mahquantum.tech` and complete Google's verification via the test-proven MQ Mailer inbox. This creates a **Google Account**, not a Google Workspace subscription or Gmail inbox.
6. On MQ Mailer, while signed in as trusted administrator, explicitly approve `ceo@international.mahquantum.tech` under **Employee sign-in access**, and assign that account as CEO mailbox owner in **Settings → Employee access & shared mailboxes**. The first verified Google login binds Google's immutable **sub** identifier. Existing root-domain Zoho accounts are outside this login allowlist.
7. Log out and sign in to MQ Mailer using Google with `ceo@international.mahquantum.tech`. The account can read only assigned inboxes. For long-term privileged admin use, a separate audited account promotion and stronger re-verification mechanism are required; keep the original trusted Gmail administrator for now.
8. For sending, create/verify the **international.mahquantum.tech** sender domain on a **Brevo Free** account (no card, if eligible). Set `BREVO_API_KEY` as an **encrypted Cloudflare Worker secret**. Brevo's sending-provider account and sender domain must be approved, with dedicated SPF/DKIM and DMARC alignment checked **before** live mail. Do not overwrite Zoho SPF/DKIM/MX. The MQ Mailer send/reply/forward routes use Brevo's `POST https://api.brevo.com/v3/smtp/email` API when configured.
9. Send a test from CEO to an independent inbox, verify sender, delivery, headers, reply-to handling, and send a reply back to CEO. Provider acceptance is not equivalent to successful delivery; check provider event logs and bounces.
10. Review quotas, storage durability, retention, account revocation, backups, attachments, spam handling and recovery before using for confidential communications.

## Cost/security limitations

- Cloudflare Workers Free/D1/DO/Email Routing and standard Google sign-in offer no-subscription allowances, not unlimited capacity. Never activate R2 or Workers Paid under a strict no-card policy.
- Brevo Free currently advertises **300 sends per day**, subject to provider policies, sender verification, account approval and possible branding. Brevo is a transactional sending platform; **confirm that the intended human-to-human business correspondence is permitted on the selected account before relying on it**. The Worker only calls Brevo if `BREVO_API_KEY` exists.
- Google has warned that externally hosted email accounts are **not authoritative identity sources** long term. Therefore MQ Mailer never auto-registers external accounts: login requires trusted-admin approval and a pinned Google `sub`; changing email ownership must involve admin revocation and re-verification.
- Never put OAuth client secrets, Brevo API keys or mail contents into a public GitHub repository or shared screenshots.
- The UI stays LIGHT ONLY.

## Verified current implementation status

- The app recognizes verified Google Accounts using existing addresses under `@international.mahquantum.tech`, subject to admin approval and Google sub binding.
- Brevo outbound provider adapter is implemented in code but **unconfigured**, with fail-closed behavior when no API key is present.
- CEO mailbox itself, subdomain MX/route, sender verification, OAuth keys and live send/receive tests **still need setup**. Do not claim production email delivery until those complete.

## Official references

- Google Account without Gmail: https://support.google.com/accounts/answer/27441
- Google warning re third-party emails: https://developers.google.com/identity/sign-in/web/backend-auth
- Cloudflare subdomain Email Routing: https://developers.cloudflare.com/email-service/configuration/subdomains/
- Cloudflare root MX conflict warning: https://developers.cloudflare.com/email-service/configuration/domains/
- Brevo API: https://developers.brevo.com/docs/send-a-transactional-email
- Brevo free plan: https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans
