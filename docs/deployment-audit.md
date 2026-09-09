# NEUZ deployment, security and feature audit

Audit date: 2026-09-08. Target: current working tree, intended deployment at https://neuz.ma on Vercel or another serverless host.

## Verdict

**Not ready for a public production launch yet.** The implemented website and admin features pass the local checks, but durable serverless storage is unconfigured, abuse controls need improvement, and live hosting/email integration remains unverified. A passing build alone does not demonstrate that the server can read its catalog after deployment.

This was a source review, dependency advisory check, local production HTTP probing, unit tests and automated Chrome testing. It is not an exhaustive penetration test, a legal/privacy certification, or evidence of live indexing. Application source was not changed during this audit. Test mutations were confined to tmp/deployment-audit-data; no real emails were sent and the working admin account was not changed.

## Findings, in priority order

### 1. BLOCKER — Supabase is not configured

Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are absent from the current local environment. src/lib/catalog-storage.ts deliberately refuses local file storage on Vercel and in production unless explicitly allowed for local testing. Home/category pages and sitemap read that store on every request through src/lib/catalog-data.ts. Therefore the current configuration will build successfully but cannot serve catalog-backed pages on Vercel.

Before launch: run supabase/admin.sql in a Supabase project; configure both server-only variables in hosting; verify the table, RLS and bucket in that actual project. To retain local products, uploads and changed credentials, use admin:migrate before first opening the remote-connected site. The migration refuses to overwrite an existing remote catalog. Test a product edit and image upload on a preview, restart/redeploy, and confirm persistence. SQL and local storage paths were reviewed; the real Supabase connection and policies were not tested because credentials are absent.

### 2. HIGH — Admin login rate limiting lets one visitor block every admin

src/lib/catalog-repository.ts: recordLoginAttempt stores a single list of 20 attempts per 15 minutes. src/app/api/admin/login/route.ts consumes an attempt before checking credentials. There is no separation by client or account; account changes also consume this same budget.

Confirmed over HTTP on the isolated production server: after exhausting the remaining budget with incorrect logins, a correct login using a different forwarded client address returned 429. Seven attempts from earlier feature checks plus thirteen bad logins exhausted the window. An attacker can keep denying fresh admin logins. Existing sessions are not automatically invalidated by the rate limit.

Before public launch: replace the shared blanket lockout with persistent limits keyed by a trusted client identifier and account, backed by an edge/WAF limit and optional challenge after repeated failures. Avoid making the account-wide threshold alone sufficient to lock out its owner. Verify how the selected host provides trustworthy client IPs. Keep rate-limit state separate from catalog revisions so login traffic does not create stale-edit conflicts.

### 3. HIGH — Quote endpoint abuse controls are not sufficient across serverless instances

src/app/api/quote/route.ts uses an in-memory Map for its five-request window. Each serverless instance has an independent allowance, and restarts reset it. Both Turnstile keys are missing. Origin validation and the honeypot help, but a non-browser client can supply the expected Origin header and bypass those basic checks. Spoofable forwarded headers also need attention if deployed behind an unspecified proxy.

Before public launch: configure and test both Turnstile keys for neuz.ma, and add a persistent or hosting-level rate limit for /api/quote. Limit email expenditure at the provider as well. The current bounded body, field validation and file-signature checks remain useful protections; they do not replace distributed abuse control.

### 4. DEPLOYMENT GAP — Hosted runtime selection is not recorded

package.json pins the project workflow to Bun 1.4.2; checks here used the portable Bun 1.4.2 binary. There is no vercel.json. Using Bun as the package manager does not establish that deployed functions use the tested Bun runtime.

Before deployment: explicitly configure the chosen host's runtime and build settings. For Vercel, its current documentation uses bunVersion: "1.4.x" in vercel.json; Vercel manages patch versions. Keep the Next.js framework preset, bun install --frozen-lockfile, and bun run build. Test native Sharp image processing in the hosted preview. See [Vercel Bun runtime documentation](https://vercel.com/docs/functions/runtimes/bun).

### 5. MEDIUM — Quote submission is blocked on localhost and alternate preview domains

src/app/api/quote/route.ts accepts only the SITE_URL origin when configured. SITE_URL currently equals https://neuz.ma. A request from the actual local preview origin returned 403 with code FORBIDDEN, before payload processing. A Vercel preview origin will likewise fail while using production SITE_URL. The public browser tests intercept success/error responses, so they do not reveal this integration issue.

Choose an explicit trusted preview-origin policy or separate preview configuration. Do not simply accept arbitrary Origins. Production neuz.ma uses the expected origin; ensure HTTP/www/alternate domains redirect to it. Keep preview deployments private/noindex. Re-test the form through the real endpoint on the deployed origin.

### 6. LAUNCH VERIFICATION — Actual email delivery is not established

RESEND_API_KEY and RESEND_FROM are populated, and the sender is not the example placeholder. A read-only Resend domain check was denied because the key is send-only. This is sensible least privilege, but it leaves sender verification unknown. No email was sent during this audit.

Before launch, confirm the configured sending domain in Resend, make an explicitly authorized real quote submission from the hosted site, and verify receipt, attachments and Reply-To in the destination mailbox. The configured recipient is ziyadsabbar7@gmail.com. Success responses mean provider acceptance, not guaranteed inbox delivery. There is no database lead archive or automatic customer confirmation email; neither was part of the implemented scope.

### 7. MEDIUM HARDENING — Logout clears the browser cookie, but does not revoke a copied token

src/app/api/admin/logout/route.ts deletes the cookie only. Sessions are stateless signed tokens valid for up to eight hours. A previously copied token remains valid after logout until expiry; changing the password or signing secret invalidates it. This is a source-review finding, not a demonstrated account compromise.

For stronger session control, persist session IDs/revocation state and revoke the current session on logout. Password-change revocation already works and was browser-tested. MFA and session management are not implemented.

### 8. LOWER PRIORITY — Additional hardening and operational gaps

- Security headers confirmed: X-Frame-Options DENY, X-Content-Type-Options nosniff; configuration also sets Referrer-Policy and Permissions-Policy. No Content-Security-Policy is configured. Add a tested CSP that accounts for Next.js scripts and Turnstile. Local HTTP responses have no HSTS; verify HSTS and HTTPS redirects at hosting instead of interpreting this local result as a live HTTPS failure.
- Product images are intentionally public and retained after product deletion/replacement. Deleting a product is not an image-erasure operation. Plan storage cleanup and database/bucket backups; no backup/restore exercise was performed.
- Every public catalog request reads the private catalog document, then explicitly projects public fields. This did not leak account data in tested responses, but availability and latency depend on Supabase and the entire catalog travels to the server. At larger sizes, paginate/split the document, keep auth/rate-limit state separate, and measure hosted performance.
- The login page uses the bootstrap ADMIN_PASSWORD_HASH to decide whether the login form is enabled even after an account is stored. Retain the documented bootstrap variables for now; removing that hash after seeding can disable the UI even though the stored credentials exist. The unused legacy requireAdmin helper still checks the environment hash, whereas real routes use requireAccount; remove or align the helper to prevent future misuse.
- Changes are uncommitted and many necessary admin/service files are untracked. Deploy from a complete reviewed commit, including bun.lock. Do not include .env.local, data or tmp. The open tmp/package-lock.pre-bun.json is an ignored backup, not the active lockfile.
- README's plain build/start preview instructions omit the required local production storage override, and its fixed sitemap count can become stale after category CRUD. Correct these instructions before handing deployment to another operator.

## Feature verification

| Area | Result | Evidence / boundary |
| --- | --- | --- |
| Production build, TypeScript, lint | PASS | bun run build, typecheck, lint using Bun 1.4.2 |
| Unit/security tests | PASS | 26 tests, 142 assertions |
| French, English, Arabic and RTL | PASS | Language metadata, switches, responsive layouts and mobile menus |
| Public gallery | PASS | Category filters, focus behavior, product dialog, inspiration prefill |
| Quote form UI | PASS | Adaptive dimensions, attachments, validation, preserved draft, simulated success/error; real local endpoint has finding 5 |
| Product/category CRUD | PASS locally | Create, edit existing/new, delete, hide/show; nonempty category deletion blocked |
| Image uploads | PASS locally | Responsive WebP variants, public rendering, invalid payload rejection; remote bucket not verified |
| Dynamic public content | PASS locally | Product changes, category URLs and sitemap reflect visibility without rebuild |
| Admin authentication | PASS with finding 2 | Unauthorized access, cross-origin writes, login/logout, tampered/expired tokens |
| Account settings | PASS | Top-left account icon; eight-character password accepted; reveal/hide controls; changed credentials persist and revoke old sessions |
| Persistence/concurrent edits | PASS locally | Seed-once behavior, edits across storage instances, stale writes rejected; Supabase integration pending |
| Accessibility | PASS automated scope | No axe WCAG A/AA violations in tested public desktop/mobile/form and admin account/form screens; not a manual certification |
| Responsive layout | PASS tested sizes | Arabic/menu interactions at widths 320, 375, 768, 812; public desktop 1440; account mobile 390; no measured overflow |
| Browser runtime errors/images | PASS tested pages | Public visual suite found no page errors or failed images |
| Search metadata | PASS locally | All 15 seeded sitemap pages, unique titles, canonical/hreflang, JSON-LD, expected 404s |
| External delivery/storage/hosting | UNVERIFIED | No Supabase connection, no live email submission, no deployed-host access |

## Security evidence and limits

- bun audit --json returned an empty advisory report for the installed dependency graph. This is a known-advisory result, not proof that no vulnerabilities exist.
- Installed Next.js 16.3.4 is newer than the 16.3.3 patch identified in the [official August security release](https://nextjs.org/blog/august-2026-security-release). No dependency upgrade was required by this check.
- Passwords are stored as salted scrypt hashes; production session cookies are HttpOnly, Secure and SameSite=Strict. Session signatures are compared with timingSafeEqual. Account changes require the current password.
- Inputs are validated on the server; admin mutations require authentication and origin checks. Uploads are bounded to 3 MiB and 25 megapixels, decoded and re-encoded as nonanimated WebP. Quote attachments are limited to five files and 3 MiB combined, with filename and signature checks. Signature checks are not malware scanning.
- HTML email content is escaped. JSON-LD serialization neutralizes script termination. No arbitrary HTML rendering of product descriptions was found.
- Requests for /.env.local, /data/catalog.json, /tmp/admin-access.txt and the tested media traversal returned 404. Unauthenticated catalog API access returned 401.
- No configured secret value was found in built client JavaScript. No private data/tmp/env files appeared in production trace manifests. Git does not track the checked .env.local/data/tmp paths. Full historical Git secret scanning was not performed.
- Runtime security results are recorded in tmp/qa/deployment-audit-checks.json; browser reports/screenshots are in tmp/qa. These private evidence files are intentionally ignored by Git.

## SEO and AI search readiness

Technical foundations are good: public server-rendered text in three locales, canonical neuz.ma URLs, reciprocal language alternates, crawlable category pages, Organization/Service/Breadcrumb structured data, internal links, FAQs and responsive images. Admin routes are excluded from the sitemap and marked noindex. Robots disallows admin/API crawling; authentication, not robots, protects private content.

The original catalog produces 15 sitemap URLs: three homepages, nine category/service pages and three privacy pages. Counts correctly change when visible categories change. Products currently have gallery dialogs and category-page entries, not individual product detail URLs. This is consistent with a quotation-based showcase, but limits independent product search landing pages. There is no cart, payment, stock or order management system.

Missing optional translations fall back to French, including on /en and /ar category pages. This is a usable fallback, but new categories need real English/Arabic copy before targeting those languages in search. The admin does not manage general homepage copy, contact details or legal text; those remain in code/message files.

There is no llms.txt/OKF bundle. Its absence is not a deployment blocker or proof of poor AI visibility. There is no special structured-data shortcut that guarantees AI inclusion; see [Google's AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). Current content is readable by crawlers, but no live indexing or AI citations can be confirmed for this local project.

After deployment: verify HTTPS and www redirects, robots and hosting-level index controls, fetch the live sitemap, submit it to Search Console/Bing Webmaster Tools, inspect representative URLs and measure mobile Core Web Vitals. No live search-account, analytics, DNS/TLS, load test or field performance data was available. Local response times would not substantiate production performance claims. Review the business's contact information, imagery permissions, French/Arabic/English copy and privacy statements before publication; this audit does not certify their legal compliance.

## Release acceptance checklist

1. Configure Supabase, apply SQL, migrate local content if required, and verify remote read/write/upload and persistence.
2. Fix admin-wide lockout; enable and test distributed quote abuse controls.
3. Record the intended hosting runtime/build configuration and deploy a protected preview with its own environment policy.
4. Confirm the sender domain and perform an authorized end-to-end quote delivery check.
5. Validate the hosted cookie/headers/origin behavior, uploads, multilingual routes, sitemap and durable data after redeployment.
6. Commit the complete source/lockfile, establish backups and error monitoring, then connect production neuz.ma and perform live SEO checks.

Until items 1–5 are satisfied, treat the project as a working local implementation awaiting production integration and security fixes, not a deployment-approved release.

## Follow-up: quote protection implemented

The original finding about instance-local quote limits has been addressed in code with shared per-IP/email counters and atomic daily/monthly email budgets. See [quote limits setup](quote-limits.md). Production activation still requires applying both SQL migrations and configuring Supabase. Turnstile remains unconfigured, and the preview-origin finding is unchanged. The audit above records its original results.
