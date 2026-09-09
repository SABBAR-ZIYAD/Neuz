# Final deployment audit — 9 September 2026

**Verdict: suitable for a protected staging deployment after hosting configuration; not ready for an unrestricted public launch with the currently inspected environment.**

This review covers the current working tree, not just committed source. It supersedes the unresolved-code findings in the older deployment audit: per-client admin limits, trusted preview origins and mandatory hosted Turnstile verification are now implemented and covered by passing tests.

## Confirmed launch blocker

Both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are absent from .env.local. The frontend therefore renders no challenge, while hosted verification requires both real keys and a valid hostname/action-bound token. Hosted quotes and admin login cannot complete with this configuration (src/lib/turnstile.ts:11; src/components/bot-check.tsx:64).

Configure a real Turnstile widget for the production hostname and any approved preview hostname; set both keys in hosting and rebuild. Local configuration is not proof of the hosting environment's configuration. This audit did not inspect a hosting account.

## Hosting and release requirements

- Use the tested Bun 1.4.2 runtime for local/CI validation. The active global installation is 1.3.11; this audit used the existing tmp/bun-runtime installation for production build/start and final checks. No global installation was changed.
- If using Vercel, explicitly select the Bun runtime: no vercel.json is present. Current official documentation specifies bunVersion: "1.4.x" for this runtime line, with patch versions managed by Vercel. Keep the Next.js framework preset and the existing Bun build scripts. packageManager alone does not select the hosted function runtime. See https://vercel.com/docs/functions/runtimes/bun.
- For a different host, configure TRUSTED_CLIENT_IP_HEADER to a single-IP header overwritten by trusted ingress. Neither supported header variable is configured locally; remote quote/admin limits fail closed without one. Vercel has a separate trusted-header path (src/lib/quote-rate-limit.ts:43).
- The start command binds 127.0.0.1 (package.json:9). This works behind a reverse proxy on the same machine/network namespace; a container or host requiring an externally reachable listener needs the appropriate bind address. This is conditional on the selected hosting architecture, not a demonstrated Vercel failure.
- Copy required Supabase, Resend, admin and site settings to the correct hosting environments. Retain ADMIN_PASSWORD_HASH: the login page still uses it to enable the form, even when the current account is stored in Supabase (src/app/admin/login/page.tsx:9).
- Deploy all required current source and bun.lock. Many application files are untracked and other files are modified; a deployment of the existing committed revision will not include this entire audited implementation. Keep .env.local, data and tmp excluded.

## Checks performed now

| Check | Result |
| --- | --- |
| Production build/start, Bun 1.4.2 | Pass |
| Typecheck and ESLint | Pass |
| Unit/security suite | 46 passed, 0 failed, 214 assertions |
| Dependency advisory audit | bun audit --json returned {}; no reported advisories |
| Production metadata/route suite | Pass: sitemap pages, unique titles, canonicals, hreflang, robots, rendered content, JSON-LD and 404s |
| Public browser suite | Pass: FR/EN/AR, desktop/mobile, RTL, menus, gallery, attachments and form states |
| Automated browser accessibility | No reported violations on checked screens; no reported overflow, failed images or page errors |
| Production public pages | /fr, /en and /ar return 200 |
| Anonymous admin protection | /admin redirects to login; catalog API returns 401 |
| Foreign-origin POSTs | Quote, login, catalog, upload and account routes return 403 |
| Private file URLs | .env.local, data/catalog.json and tmp/admin-access.txt return 404 |
| Supabase read access | Catalog readable: 5 products, 2 categories, stored admin account |
| Shared quote tables | Both accessible by server key; email quota table currently empty |
| Image bucket and current catalog images | Bucket accessible/public; checked 480px images return 200 |
| Client bundle secret scan | No configured sensitive value found in checked client JS/JSON/maps |
| Server trace scan | No private data/tmp/env entries found |

Production HTTP/SEO checks used the newly built server on port 3001. The existing browser scripts use the existing local server on port 3000, so browser results must not be described as a fresh production-browser certification. The in-app browser could not connect because of a Windows sandbox ACL error; the existing headless test scripts completed successfully. Screenshots were generated but manual screenshot inspection was unavailable for the same sandbox reason.

Unit tests mock Turnstile and Resend. Browser form tests intercept responses and send no real email. Current admin CRUD/account behavior is covered by local unit tests; this audit did not mutate the remote catalog, upload/delete remote assets, reset credentials, reserve email allowance, or attempt a real password login. Remote anonymous-key/RLS behavior and quota RPC concurrency were not revalidated in this run; SQL protections were reviewed, and earlier checks are documented in supabase-verification.md.

## Required hosted acceptance checks

1. Confirm that the selected deployment uses the intended runtime, environment values and durable Supabase storage.
2. Verify a real Turnstile challenge and owner password login on the hosted origin, including Secure session cookies and preview-origin behavior.
3. Confirm the Resend sender domain and the intended recipient (currently ziyadsabbar7@gmail.com in src/lib/catalog.ts:21). Make an explicitly authorized hosted quote submission and verify mailbox receipt, attachments and Reply-To. No live message was sent during this audit.
4. Exercise catalog editing/upload in an isolated staging environment and confirm persistence after redeploy.
5. Check production DNS/TLS, HTTPS/canonical-host redirects, robots/sitemap/indexability and hosting security headers. Use noindex and access protection for previews. Measure hosted performance and establish error monitoring and catalog/image backups.

These are outstanding integration checks, not demonstrated failures of the live deployment: no deployed target was supplied or inspected.

## Non-blocking findings

- No Content-Security-Policy is configured. Existing nosniff, frame denial, referrer and permissions headers provide partial hardening.
- Logout deletes the browser cookie without revoking a copied signed token before its eight-hour expiry. Password or signing-secret changes invalidate sessions.
- QUOTE_RATE_LIMIT_SECRET is unset; the implemented ADMIN_SESSION_SECRET fallback satisfies the length requirement. A separate secret is optional operational hardening, not a current functional blocker.
- No durable lead queue/archive exists beyond Resend and the receiving mailbox; delivery failures are not queued for automatic recovery.
- General homepage/contact/legal content is managed in source. Obtain business confirmation of recipient, translations, imagery rights and privacy statements before publication; these were not certified by this technical audit.

No application logic or environment values were changed. The audit produced this report and ignored temporary evidence at tmp/qa/final-audit-2026-09-09.json. Next.js regenerated next-env.d.ts during build; its original development imports were restored afterward.
