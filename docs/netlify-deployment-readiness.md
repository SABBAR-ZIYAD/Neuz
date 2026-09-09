NEUZ deployment readiness — Netlify

Reviewed 9 September 2026 against the current working tree.

**Implementation follow-up:** Netlify build configuration, automatic trusted-IP selection, exact deployment-origin acceptance and preview noindex behavior have now been added and tested (50 passing tests). Findings 2 and the configuration portion of 4 below are resolved in source. Real Turnstile keys, sender DNS, hosting environment values and hosted acceptance checks remain. Follow [the current setup steps](netlify-setup.md); the findings below record the earlier audit state.

**Verdict: ready to prepare a Netlify preview; not ready for a working public launch with the currently inspected configuration.** The application passes the local checks below. Production configuration and hosted acceptance checks remain. No Netlify account or deployed target was inspected.

**Findings requiring action**

1. **Turnstile is unconfigured.** Both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are empty in `.env.local`. They are not test keys. `src/lib/turnstile.ts` deliberately rejects hosted verification without both real keys. This prevents quotes and admin login even if Resend DNS is completed. Create a widget for the intended hostname, set the public key for the build and the secret for Functions, and rebuild. Verify the real challenge on the hosted origin. [Cloudflare setup](https://developers.cloudflare.com/turnstile/get-started/)

2. **Netlify client-IP configuration is missing.** Neither supported trusted-header variable is set locally. `src/lib/quote-rate-limit.ts:45` automatically handles Vercel only; other hosts require configuration. With the current production environment, an allowed-origin login request returned 503 before credential validation. Set `TRUSTED_CLIENT_IP_HEADER=x-nf-client-connection-ip` in Netlify's Functions environment. A local pure-function check confirmed that the setting selects Netlify's header correctly; propagation through the deployed Next.js adapter still needs verification. [Netlify's supported header](https://answers.netlify.com/t/upcoming-change-stripping-exposed-netlify-headers-from-function-and-proxy-requests/52665)

3. **Resend delivery is pending.** The configured sender uses `resend.dev`, which is restricted to testing. After DNS verification, use the verified-domain sender in `RESEND_FROM`. The code now receives quotes at `neuzinteriordesign@gmail.com`, with Reply-To set to the customer. A live quote, attachments and Gmail reply behavior remain unverified. No real email was sent. [Resend testing restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

4. **Netlify preview origins and indexing require explicit settings.** `src/lib/request-origin.ts` automatically allows Vercel previews, but does not automatically allow Netlify preview domains. If `SITE_URL` remains the production canonical origin, set `TRUSTED_PREVIEW_ORIGINS` to the exact approved HTTPS preview origin(s). Otherwise form/API writes there receive 403. Set `SITE_NOINDEX=true` for preview contexts only; the application's automatic preview detection is Vercel-specific. Add approved preview hostnames to Turnstile too. Keep the production canonical URL on previews.

5. **The release must include the current work.** Many essential admin, API, catalog, migration and test files are untracked, and tracked files have modifications. Deploying only the existing commit omits substantial parts of this implementation. Review and commit the required source and `bun.lock`. Private `.env.local`, `tmp` and `data` are ignored and were not found in Git's tracked-file check.

**Netlify settings to prepare**

| Setting | Value or requirement |
| --- | --- |
| Framework | Next.js with Netlify's automatic OpenNext adapter |
| Build command | `bun run build` |
| Publish directory | `.next` |
| Bun version | `BUN_VERSION=1.4.2` |
| Dependency install | Bun with `bun.lock`; use frozen-lockfile installation and verify the install command in the Netlify build log |
| Client-IP setting | `TRUSTED_CLIENT_IP_HEADER=x-nf-client-connection-ip`, available to Functions |
| Site origin | `SITE_URL=https://neuz.ma` if this is the final canonical domain |
| Server environment | Supabase URL/service key, admin bootstrap hash and session secret, Resend key/sender, Turnstile secret, and origin/rate-limit settings |
| Public build environment | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and site/preview metadata settings |
| Preview configuration | Exact allowed preview origin(s), `SITE_NOINDEX=true`, approved Turnstile hostname |

Use the Netlify UI/API for server environment values and ensure they reach Functions, not only Builds. Keep Supabase enabled; do not set `CATALOG_STORAGE=local` on serverless hosting. Retain `ADMIN_PASSWORD_HASH` because the login page still checks bootstrap configuration even when the active account is stored in Supabase.

Netlify supports Next.js through its automatic adapter; no manual plugin pin or custom `next start` service is needed. Bun is used for this project's dependency installation and build. Netlify's hosted server execution must be verified separately; local Bun validation does not certify the deployed adapter/runtime. No Bun-only APIs were found in application source. [Next.js on Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/), [Bun build settings](https://docs.netlify.com/build/configure-builds/manage-dependencies/), [environment scopes](https://docs.netlify.com/build/environment-variables/overview/)

**Checks completed in this audit**

| Check | Result |
| --- | --- |
| TypeScript and ESLint | Passed |
| Unit/security tests | 46 passed, 0 failed; 214 assertions |
| Production build and start | Built with existing local Bun 1.4.2; fresh production server started on port 3001 |
| Dependency advisory audit | `bun audit --json` returned `{}`; no reported advisories |
| Production SEO/route suite | Passed sitemap pages, unique titles, canonicals, hreflang, robots, server content, JSON-LD and 404 checks |
| Production public browser checks | French, English, Arabic; desktop/mobile/RTL, gallery, filters, menus, attachments, draft retention and form states passed |
| Automated accessibility/layout | No reported axe violations, horizontal overflow, broken images or page errors on checked screens |
| Header anchor alignment | All four links align within 1 CSS pixel on desktop and mobile |
| Supabase read checks | Catalog readable: 5 products, 2 categories and stored admin account; both quote protection tables readable; image bucket public |
| Anonymous admin access | Admin page redirects to login; catalog API returns 401 |
| Foreign-origin API writes | Quote, login, catalog, upload and account return 403 |
| Private-file HTTP probes | Environment, catalog-data and admin-access file paths return 404 |
| Browser bundle scan | None of the configured private values appeared in 18 checked JS/JSON/map files |

Browser tests ran against the freshly built production preview on port 3001 using temporary copies of the existing suites. Challenge scripts and email responses were mocked; these checks prove UI behavior, not real Turnstile verification or delivery. The global Bun installation remains 1.3.11 and was not changed; the existing project-local 1.4.2 binary was used for build, startup and browser checks. Typecheck/lint/unit tests passed on the global version.

**Remaining hosted acceptance checks**

- Run a Netlify preview build to verify adapter packaging, serverless Node compatibility and image processing.
- Confirm required environment variables exist in the correct deploy contexts and scopes.
- Test a real Turnstile challenge and the owner's current password, including Secure cookies and correct client-IP handling.
- After DNS verification and explicit authorization, submit a real quote and confirm Gmail receipt, attachments and Reply-To.
- Exercise admin edits/uploads in isolated staging and confirm persistence after redeployment. Live catalog writes, credential changes and quota reservations were not exercised in this audit; local tests cover their logic.
- Confirm DNS, TLS, canonical-host redirects, preview protection/noindex and production indexability. Measure hosted performance; local browser checks do not establish production Core Web Vitals.
- Establish error monitoring and a catalog/image backup and restore process. Remote RLS and RPC concurrency were not revalidated in this run; their SQL was reviewed and prior verification is documented separately.

**Lower-priority limitations**

No Content Security Policy is configured. Logout clears the cookie but cannot revoke a copied signed token before its eight-hour expiry; password changes invalidate it. Quotes have no durable queue or archive beyond email delivery records. Public pages depend on Supabase availability and have no custom application error/recovery page. A dedicated quote-rate-limit secret is optional because the existing admin-secret fallback works.

No application source or environment values were changed during this audit. No deployment, email delivery, remote catalog mutation or credential reset was performed. Temporary evidence is in `tmp/qa/netlify-readiness-evidence.json`; screenshots and browser reports are also under `tmp/qa`. This report supersedes the earlier Vercel-focused hosting advice for the user's selected Netlify deployment.