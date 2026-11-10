# Security operations

## Roles and access

- `owner` — case studies, campaigns, `/meta-ads`, `/api/meta/owner/**`, `/admin`, `/api/admin/**`, `/api/data/**`.
- `client` — case studies, campaigns, `/api/meta/client/**`.
- `/api/data/template` is the only blank template exception and stays public.
- Wrong-role API requests return `403`; page requests redirect to the role home (`/meta-ads` or `/campaigns`).
- Sign-in is password-only. The owner password maps to `owner`; the client password maps to `client`. No email allowlist is used.
- Sensitive owner actions (Meta connect/disconnect, party-map changes, CSV/Excel exports) require a password re-check within 15 minutes (`authTime`). `POST /api/auth/reauth` refreshes that timestamp.

## Sessions

- Password login with a constant-time comparison against `ADMIN_PASSWORD` and `CLIENT_PASSWORD`.
- 5 login attempts per 15 minutes per IP, plus a 15-minute lockout after 10 failures.
- Session cookie is `__Host-ro_session` in production and `ro_session` in development.
- 12-hour absolute lifetime, 2-hour idle timeout, server-side session record in MongoDB `sessions`, session id rotated at every sign-in.
- Logout revokes the session record. “Sign out of all devices” deletes every session for the subject (`owner` or `client`).

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
- Turnstile is off by default. When `TURNSTILE_ENABLED` is not `true`, the login page does not load the widget, the server does not call Cloudflare, and the CSP does not allow `challenges.cloudflare.com`.

## Secrets

Required in production:

- `ADMIN_PASSWORD`, `CLIENT_PASSWORD` (must be different)
- `ADMIN_SESSION_SECRET` (at least 32 characters)
- `MONGODB_URI`
- `TOKEN_ENCRYPTION_KEY` (32 bytes, base64; e.g. `openssl rand -base64 32`)
- `CRON_SECRET`

Optional:

- `META_APP_ID`, `META_APP_SECRET` — without them the site starts normally, `/meta-ads/settings` shows “Meta app not configured”, and `/api/meta/owner/connect/*` returns `503`.
- `TURNSTILE_ENABLED=true`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — all three are needed together when Turnstile is enabled.
- `MONGODB_DB`, `NEXT_PUBLIC_SITE_URL`, `META_REDIRECT_URI`, `MAX_UPLOAD_MB`, `TOKEN_KEY_VERSION`, `META_SYSTEM_USER_TOKEN`.

`instrumentation.ts` fails production startup if required values are missing or invalid, and logs one Meta warning when Meta is unconfigured.

## Meta OAuth console setup

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
- Do not deploy until `ADMIN_PASSWORD`, `CLIENT_PASSWORD`, `ADMIN_SESSION_SECRET`, `MONGODB_URI`, `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` are set; otherwise the startup check blocks the deployment.

## Residual audit findings

`npm audit --omit=dev` currently reports two high transitive findings:

- `xlsx` — upstream has no fixed release. It is used only server-side for admin imports/exports, behind owner auth, strict workbook validation and upload-size limits. Replace with an actively maintained parser before allowing untrusted uploads from a wider audience.
- `postcss` nested inside Next.js — fixed only by a Next major upgrade. Track the Next advisory and upgrade when the app is ready for the major version.

The critical Next.js advisories were addressed by upgrading Next to 15.5.29. `sharp`, `source-map-js` and `zod` were upgraded by `npm audit fix`.

## Chunk data scan

`npm run check:security` scans every file under `.next/static` after a build. It fails if survey, device, historical or opinion-poll identifiers appear in a client chunk. The Telangana history bundle and the Tamil Nadu comparison/opinion/forecaster data are server-side only.
