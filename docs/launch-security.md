# Login, bot protection and preview origins

## Admin login

Login requests use a persistent **20 attempts per 15 minutes per client IP** limit. IPv6 addresses share a /64 bucket. Requests from another client no longer lock out the administrator. The same office/VPN still shares a limit and may receive `429` with `Retry-After`.

Account changes have a separate limit of 5 attempts per 15 minutes and require a valid session and current password. Login counters are separate from catalog revisions and quote counters. Historical `loginAttempts` in catalog documents are ignored. No password reset is required for this fix.

Both admin and quote limits use the existing `supabase/quote-limits.sql` RPC. Apply that migration if absent; this change needs no additional migration. Storage errors fail closed. Vercel uses its trusted `x-vercel-forwarded-for` header. Other hosts must set `TRUSTED_CLIENT_IP_HEADER` to a single-IP header overwritten by their trusted ingress. The legacy `QUOTE_TRUSTED_IP_HEADER` remains a fallback for both endpoints. Never use a header visitors can freely supply.

## Activate Turnstile before deployment

1. In Cloudflare, open **Turnstile**, add a **Managed** widget, and add `neuz.ma` as a hostname. Add only the actual additional hosts that need forms. Prefer a separate widget for development/previews; do not authorize every Vercel customer by allowing `vercel.app`.
2. Save `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `.env.local` and the appropriate Vercel environment. The secret belongs only on the server. Never commit it or paste it into chat.
3. Rebuild/redeploy: the public key is compiled into the browser bundle.
4. Check `/abdel/login` and the final quote-form step on the intended host. A full quote-delivery test sends a real email and consumes one allowance slot.

Hosted admin logins and quotes require both keys and a valid token. Missing/partial configuration or provider failure blocks the operation. Official dummy testing keys are rejected on hosted requests. Server verification checks the token's hostname against the trusted browser origin and its action against `admin_login` or `quote`. Invalid/expired tokens cannot spend the email budget. Browser failures clear the token, offer a retry control, and preserve quote content.

Loopback development can omit **both** keys. If either is configured, verification is required. For a local production test, explicitly set `CATALOG_STORAGE=local`; the loopback exception is disabled on Vercel and does not apply to a remote Host header. A configured widget must authorize the local hostname and return matching hostname/action results. Dummy tokens with generic test metadata are unsuitable for these strict verification checks; automated tests mock Cloudflare instead.

Reference: [server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Local and hosted previews

Keep `SITE_URL=https://neuz.ma` for canonical URLs. Quote and admin endpoints accept:

- The configured canonical origin.
- Same-port loopback origins during development or an explicit local production test.
- Exact `VERCEL_URL` and `VERCEL_BRANCH_URL` origins supplied by Vercel **in its Preview environment**.
- Additional exact HTTPS origins in `TRUSTED_PREVIEW_ORIGINS`, comma-separated (for example `https://preview.neuz.ma`). No paths or wildcards.

Unlisted origins receive `403`; request Host/forwarded headers cannot add a public origin to the allowlist. Origin acceptance and Turnstile authorization are separate: the preview hostname must also be authorized in the widget. Prefer a stable preview alias. See [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables).

Vercel Preview builds emit noindex and disallow crawling automatically. For another preview host, set `SITE_NOINDEX=true` before building. Production should omit that flag. Preview tests should use separate Supabase storage and mocked email delivery to protect the production catalog and allowance.

## Verification

Run `bun run test`, `bun run lint`, and `bun run build`. Tests cover client isolation, historical lockout removal, persistent limits, trusted origins, token hostname/action validation and rejection before Resend. Isolated admin browser suites exercise CRUD and account changes.

`bun scripts/turnstile-check.mjs` requires an isolated build running on localhost:3001 with a public site key compiled in (or set `BOT_TEST_URL`). It intercepts Cloudflare and both form POSTs to exercise retry, expiration and token reset without sending email. Rebuild using the deployment's real environment after any temporary test build.
