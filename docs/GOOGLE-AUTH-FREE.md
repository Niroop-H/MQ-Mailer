# MQ Mailer — Free Google sign-in setup (no Cloudflare Zero Trust)

## Why this exists

The production Worker implements its own Google OpenID Connect (OIDC) sign-in with short-lived OAuth state, S256 PKCE challenge, OIDC nonce, Google's signed ID-token verification, administrator-approved logins, and a revocable session store in the existing D1 `mq-mailer-free` database.

**No Cloudflare Zero Trust subscription or credit card is required for this implementation.** Standard Google sign-in uses OIDC identity scopes, not paid Google APIs. Google may show other optional paid products during project setup; do not activate billing. If the Google console unexpectedly requires a payment method, stop and review alternatives rather than entering a card.

## Current domain

- Frontend and login: `https://mailer.mahquantum.tech`
- OAuth start: `https://mailer.mahquantum.tech/auth/google/start`
- **Google callback:** `https://mailer.mahquantum.tech/auth/google/callback`
- Worker `mq-mailer.mahquantum.workers.dev` is intentionally denied at the application layer, including its API. Do not register it as a Google callback.
- Employee mailbox domain: `@international.mahquantum.tech`; existing Zoho `@mahquantum.tech` continues unchanged.

## One-time Google console setup (user action)

1. Go to **Google Cloud Console** (https://console.cloud.google.com/) and choose/create an ordinary project for MQ Mailer. You do **not** need to enable a paid Google API or Google Cloud billing for basic Google sign-in.
2. Open **Google Auth Platform**. Configure an app named **MQ Mailer — MAH Quantum**, support email and authorized domain `mahquantum.tech` (Google may require domain verification).
3. Choose **External** audience if employees will use personal Gmail accounts. Keep it in **Testing** initially and add your own Gmail address as a **test user** (and any employees who will test). When you are ready to onboard many employees, review the production publishing requirements and data-access scopes.
4. Under **Clients → Create client**, choose **Web application**.
5. Enter **Authorized JavaScript origin**: `https://mailer.mahquantum.tech`.
6. Enter **Authorized redirect URI**: `https://mailer.mahquantum.tech/auth/google/callback` (**exact**, including HTTPS and trailing path; **no trailing slash**).
7. Save and copy the **Client ID** and **Client secret** into Cloudflare Worker secrets, **not GitHub**. These credentials are for MQ Mailer's OIDC login only.

## Configure the Worker secrets

In Cloudflare Dashboard → **Workers & Pages → mq-mailer → Settings → Variables and Secrets → Add**, create:

| Secret | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Web application OAuth client ID from Google Auth Platform |
| `GOOGLE_CLIENT_SECRET` | Corresponding Google OAuth client secret |
| `MQ_ADMIN_EMAIL` | Exact Gmail address of the initial administrator, e.g. `owner@gmail.com` |

Use **Secret / encrypted** for each. The example admin address above is a placeholder—use your actual verified Gmail address. The Web app will return a setup page rather than exposing email until all three are configured.

There is **no** `POLICY_AUD` or `TEAM_DOMAIN` for this mode; those belonged to the removed Cloudflare Zero Trust integration.

**D1 schema already created in this account:** `migrations/0002_auth_google.sql` — `mq_auth_users`, `mq_auth_flows`, `mq_auth_sessions`. Keep these tables and the Worker D1 binding `D1_MAIL`.

## First login and employee onboarding

1. Open `https://mailer.mahquantum.tech/auth/login`. Select **Continue with Google** and sign in using `MQ_ADMIN_EMAIL`.
2. As the admin, open the **Employee sign-in access** section on the MQ Mailer home page. Approve a colleague's actual **Google sign-in email** (typically their personal `@gmail.com` or Google Workspace login). Approval lets them log in but grants **no mailbox access** by itself.
3. Create an address such as `research@international.mahquantum.tech` and set its owner to that approved Google login email. Or add the employee to an existing mailbox under **Settings → Employee access & shared mailboxes**.
4. Each employee clicks Google sign-in using that approved account. Their original Google subject ID is bound on first login. Revoking a login invalidates sessions, and restoring access preserves the original subject binding.
5. The admin account can manage every mailbox. Unassigned legacy mailboxes remain admin-only.
6. AI/MCP agent routes stay admin-only until separately secured. A mailbox owner cannot bypass ACLs by guessing another mailbox's URL.

## Security properties and operational limits

- Google ID token signature, issuer, audience, expiry and nonce are verified server-side with `jose` and Google's public signing keys.
- Only Google-verified `@gmail.com` or Google Workspace hosted-domain identities are accepted. A Google login using an unrelated third-party email address is rejected due to potential loss of ownership.
- OAuth requests use a one-time D1 state row, HTTPS host-only cookie, S256 PKCE and a 10-minute expiration.
- Browser sessions use a random opaque `__Host-mq_session` Secure/HttpOnly/SameSite=Lax cookie, 12-hour maximum session, and only the SHA-256 hash of the session token is stored in D1.
- All non-read requests require exact same-origin POST/PUT/PATCH/DELETE origin verification.
- No password database, refresh token storage, Google mailbox scope, or identity-provider fees are needed.
- Periodically clean up expired D1 flow/session records, and configure Cloudflare free-tier abuse rate limiting. D1 and Worker free quotas remain bounded.
- All mailbox operations remain behind the existing owner/member authorization middleware.
- Cookie-backed browser sessions do **not** replace end-to-end security validation: test identity revocation, CSRF, session fixation, WebSockets, Mailbox ACLs, and actual Google sign-in before handling sensitive business mail.

## What remains unrelated to login

**Inbound:** Configure Cloudflare Email Routing for **`international.mahquantum.tech` only**, preserving Zoho's apex MX.

**Outbound:** MQ Mailer currently has no general-purpose outbound sending service. Installing Google sign-in does not activate sending; select and integrate a separately approved outbound service without a payment method.

**Zero spend:** Cloudflare Workers Free, D1 Free, free OAuth identity scopes and existing GitHub CI require no subscription for their included allowances. These are usage-limited services, not unlimited free infrastructure. Avoid enabling billable products.
