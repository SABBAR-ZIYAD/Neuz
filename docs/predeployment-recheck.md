# NEUZ pre-deployment re-audit

Date: 2026-09-08. Current working tree after Supabase migration, shared quote budgets and removal of the small workshop photo.

## Verdict

Ready for a protected staging deployment after configuring hosting environment/runtime settings. Not yet approved for an unrestricted public launch. The missing database blocker is resolved; admin login denial-of-service, bot protection, hosted-origin checks and real email verification remain.

No application source was changed in this audit. Remote Supabase access was read-only. No quote emails were sent, no production budget slots were consumed, and no products or passwords were changed. Authenticated HTTP checks used a temporary server-signed session; they were not a password-login test.

## Checks run now

| Check | Result |
| --- | --- |
| bun run typecheck | Passed |
| bun run lint | Passed |
| bun run test | 35 passed, 162 assertions |
| bun run build | Passed with real Supabase configuration, Bun 1.4.2 |
| bun audit --json | Empty advisory report; no reported known vulnerabilities |
| Supabase catalog | Readable by server key; 5 products, 2 categories, stored admin account |
| Quote tables | Both accessible; no quote counters/reservations currently present |
| Storage bucket | neuz-products exists and is public |
| Private table protection | Publishable key cannot read catalog or either quote table |
| Production SEO | Sitemap pages, titles, canonicals, hreflang, JSON-LD, server HTML and 404 checks pass |
| Production admin routes | Catalog API, panel and account page return 200 with valid signed session; no credential hash in catalog response |
| Access controls | Anonymous catalog request 401; cross-origin authenticated mutation 403 |
| Private files | /.env.local, /data/catalog.json and /tmp/admin-access.txt return 404 |
| Client secret scan | No configured sensitive value found in built client JS |
| Trace manifests | No private data/tmp/env files found |
| Public visual suite | French/English/Arabic desktop and mobile: no reported axe violations, overflow, image failures or page errors; quote error/success/limit states pass with intercepted responses |
| Latest image removal | All three production locale pages have one main savoir-faire image and no atelier inset; mobile overflow check passes |

The visual suite ran against the development server on port 3000. Separate production checks ran against port 3001 with the real remote catalog. Destructive browser CRUD tests were not rerun against the working Supabase catalog; earlier isolated CRUD tests passed and current repository/account unit tests pass. Remote image upload and cleanup were verified during the preceding Supabase migration, not repeated here. Quota concurrency is covered by local tests; live Supabase quota reservations were not consumed during this audit.

## Resolved since the first audit

- Supabase server credentials, catalog migration and image bucket are in place. Catalog-backed pages now work using remote data.
- Per-IP and per-email quote counters are shared through Supabase rather than per-instance memory.
- Quote email budgets are 90 attempts per rolling 24 hours and 2,700 per rolling 31 days. Reservations happen before sending, block on storage failure and conservatively count uncertain failures/retries. Defaults leave room below the stated Resend allowance; other account usage is not included in local counters.
- Quota-limit UI offers direct email/WhatsApp alternatives and preserves input.

## Remaining launch findings

### High: anyone can exhaust the shared admin login window

src/lib/catalog-repository.ts:132 still stores one account-wide list capped at 20 attempts per 15 minutes. src/app/api/admin/login/route.ts consumes it before password verification. Its unchanged logic allows bad logins to prevent a legitimate new login. This was reproduced in the earlier isolated audit; it was not reproduced against production data here to avoid locking out the owner. Login attempts also change the catalog revision and can cause otherwise unrelated stale-edit conflicts.

Fix before public launch: persistent limits keyed to a trusted client source, with layered account/IP protection and an edge challenge or WAF. Avoid an account-wide lockout as the sole protection. Store counters separately from product revisions.

### High availability risk: Turnstile is still unconfigured

Neither Turnstile key is set. Shared quotas prevent uncontrolled quote sending from this application, but a distributed attacker can still consume the daily allowance and deny legitimate quote submissions. Configure both keys and verify the challenge on the hosted domain, or deploy equivalent hosting-level bot protection. Origin validation alone does not stop non-browser bots.

QUOTE_RATE_LIMIT_SECRET is unset, so client-key HMACs currently use ADMIN_SESSION_SECRET. This works, but a separate stable secret avoids resetting those identities when rotating admin secrets. Global email budgets do not depend on this HMAC secret.

### Hosting setup must be finalized

There is no vercel.json runtime declaration. packageManager alone does not pin hosted function execution to the locally tested runtime. Configure Vercel for Next.js and the supported Bun 1.4.x runtime, install with bun install --frozen-lockfile and build with bun run build. The host manages Bun patch versions. Reference: https://vercel.com/docs/functions/runtimes/bun

Copy required values from the private local environment into Vercel server environment settings: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SESSION_SECRET, retained admin bootstrap values, RESEND_API_KEY, RESEND_FROM, SITE_URL and quote/Turnstile configuration. Keep the service key server-only. Keep preview and production data/credentials appropriately isolated. For a non-Vercel host, configure QUOTE_TRUSTED_IP_HEADER to a single-IP header overwritten by trusted ingress; otherwise the quote endpoint fails closed.

### Preview quote origin still returns 403

SITE_URL=https://neuz.ma, and the quote route accepts only that Origin. Reproduced on the production local server: a localhost quote POST returns 403. A Vercel preview domain will also be rejected if its SITE_URL remains the production domain. This is not evidence that canonical neuz.ma submissions fail; it is a preview integration limitation.

Use an explicit trusted preview configuration, keep previews noindex/protected, and redirect production www/HTTP traffic to the canonical HTTPS host. Test the real endpoint through the chosen hosted URL. The simulated browser success case does not verify actual delivery.

### Real email and deployed infrastructure remain unverified

Resend key and sender are configured. Previous read-only sender-domain verification was blocked by the key's send-only permissions. Before launch, confirm the sender domain in Resend and make an explicitly authorized hosted quote request, checking mailbox delivery, attachments and Reply-To. No real email was sent during this re-audit.

DNS/TLS, HTTPS/www redirects, production Secure cookie behavior, host-level noindex/HSTS, error monitoring, backups/restore, load capacity and Core Web Vitals require actual hosting checks. Indexing and AI citations cannot be certified from a local build. Submit and inspect the live sitemap in Search Console/Bing after launch.

## Non-blocking hardening and maintenance

- Add a tested Content Security Policy compatible with Next.js and Turnstile. Existing configuration sets nosniff, frame denial, referrer and permissions policies.
- Logout clears the cookie but cannot revoke a copied stateless token before its eight-hour expiry. Password changes invalidate sessions; server-side session revocation would strengthen logout.
- Login UI still depends on the bootstrap hash being configured. Preserve the documented bootstrap environment values until this is decoupled from stored credentials.
- No durable quote archive is implemented beyond Resend and the recipient mailbox; failed/limited requests are not queued.
- Many necessary files are untracked/uncommitted. Deploy a complete reviewed commit with bun.lock; keep .env.local, tmp and data excluded.
- Back up the catalog and image bucket. Product deletion retains image assets by design.

## Next release steps

1. Fix the admin shared lockout and enable bot protection.
2. Configure hosting runtime, environments and preview-origin policy.
3. Deploy a protected preview; verify real quote delivery, remote CRUD/upload and persistence after redeploy.
4. Confirm production HTTPS/redirects/cookies, backups and monitoring.
5. Launch neuz.ma, submit the sitemap and measure production performance.

This report supersedes the earlier audit's missing-Supabase and instance-local quote-limit findings. It does not claim the remaining launch findings are resolved.
