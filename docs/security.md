# Security operations

## Roles and access

- `owner` — case studies, campaigns, `/meta-ads`, `/api/meta/owner/**`, `/admin`, `/api/admin/**`, `/api/data/**`.
- `client` — case studies, campaigns, `/api/meta/client/**`.
- `/api/data/template` is the only blank template exception and stays public.
- Wrong-role API requests return `403`; page requests redirect to the role home (`/meta-ads` or `/campaigns`).
- Owner emails come from `OWNER_EMAILS` only. Client emails can also be managed in `/meta-ads/settings`; those are stored in MongoDB `access_emails`.
- Sensitive owner actions (Meta connect/disconnect, client email changes, party-map changes, CSV/Excel exports) require a sign-in within 15 minutes (`authTime`).

## Sessions

- Google Authorization Code + PKCE (S256), signed 10-minute state/nonce cookie.
- ID tokens are verified with `google-auth-library` (JWKS signature, issuer, audience, expiry, nonce, `email_verified`).
- Session cookie is `__Host-ro_session` in production and `ro_session` in development.
- 12-hour absolute lifetime, 2-hour idle timeout, server-side session record in MongoDB `sessions`, session id rotated at every sign-in.
- Logout revokes the session record. “Sign out of all devices” deletes every session for the email.
- Break-glass password login exists only when `BREAKGLASS_LOGIN_ENABLED=true`, is limited to 5 attempts/hour/IP and writes an audit event.

## CSRF

Every mutating API route checks both:

1. The `Origin` header equals the site origin (or `NEXT_PUBLIC_SITE_URL`).
2. The `x-csrf-token` header matches the non-HttpOnly `ro_csrf` cookie.

The middleware issues the CSRF cookie; `components/site/csrf-fetch.tsx` adds the header for browser fetches. GET is never used for state changes.

## Headers and caching

- CSP uses a per-request nonce and `strict-dynamic`; no `unsafe-inline` in `script-src`.
- HSTS, `nosniff`, strict referrer policy, restrictive permissions policy, `frame-ancestors 'none'`, `object-src 'none'`.
- Protected pages/APIs send `Cache-Control: private, no-store` and `Vary: Cookie`.
- Source maps are disabled in production.

## Secrets

Required in production:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OWNER_EMAILS` (comma-separated), `CLIENT_EMAILS` (optional seed list)
- `META_APP_ID`, `META_APP_SECRET`
- `TOKEN_ENCRYPTION_KEY` (32 bytes, base64; e.g. `openssl rand -base64 32`)
- `ADMIN_SESSION_SECRET` (at least 32 characters)
- `CRON_SECRET`
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `MONGODB_URI`, `MONGODB_DB`
- Optionally `ADMIN_PASSWORD` for break-glass, `BREAKGLASS_LOGIN_ENABLED=true`
- Optionally `NEXT_PUBLIC_SITE_URL`, `GOOGLE_REDIRECT_URI`, `META_REDIRECT_URI`, `MAX_UPLOAD_MB`, `TOKEN_KEY_VERSION`

`instrumentation.ts` fails production startup if required values are missing or too short.

## OAuth console setup

- Google Cloud: create an OAuth 2.0 Web client. Authorised redirect URI: `https://<host>/api/auth/google/callback` for each environment.
- Meta: Facebook Login for Business app. Valid OAuth redirect URI: `https://<host>/api/meta/owner/connect/callback`. Request `ads_read`, `read_insights`, `business_management`, `pages_read_engagement`, `instagram_basic`. App review/advanced access may be required before non-test users can grant them.

## Meta token storage

- AES-256-GCM, random 12-byte IV, auth tag, key version stored per record.
- Only ciphertext is stored in `meta_connection`; decryption happens in `lib/meta/client.ts` at call time.
- Tokens are never returned to a response, log, error or page.
- Disconnect deletes the ciphertext and calls the Graph permission revoke endpoint.
- The status screen warns when the token has fewer than 7 days left and offers Reconnect.

## Database least privilege

Create a dedicated MongoDB user for the app:

- Role: `readWrite` on the `reachout` database only. No `dbAdmin`, `clusterAdmin`, `readAnyDatabase` or `root`.
- Restrict Atlas Network Access to the narrowest possible range. Prefer Vercel egress ranges or a static proxy; do not leave `0.0.0.0/0` if it can be avoided.
- Rotate the database password if it has ever appeared in a log or chat.
- Do not change Atlas settings from this repository.

## Vercel

- Enable Deployment Protection for preview deployments so preview URLs are not public.
- Keep production secrets scoped to Production only.
- Do not deploy until `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_EMAILS`, `META_APP_ID`, `META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`, `ADMIN_SESSION_SECRET` and `CRON_SECRET` are set; otherwise the startup check blocks the deployment.

## Residual audit findings

`npm audit --omit=dev` currently reports two high transitive findings:

- `xlsx` — upstream has no fixed release. It is used only server-side for admin imports/exports, behind owner auth, strict workbook validation and upload-size limits. Replace with an actively maintained parser before allowing untrusted uploads from a wider audience.
- `postcss` nested inside Next.js — fixed only by a Next major upgrade. Track the Next advisory and upgrade when the app is ready for the major version.

The critical Next.js advisories were addressed by upgrading Next to 15.5.29. `sharp`, `source-map-js` and `zod` were upgraded by `npm audit fix`.
