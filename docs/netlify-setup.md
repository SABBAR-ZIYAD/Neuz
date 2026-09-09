NEUZ — deploy to Netlify

The project now includes `netlify.toml` with Bun 1.4.2, frozen dependency installation, Node 22 and the `.next` publish directory. Netlify supplies the Next.js adapter automatically. The application selects Netlify's trusted client-IP header, allows the exact deployment origin supplied by Netlify, prevents local-storage fallback, and keeps preview/branch builds noindex. You do not need to set `TRUSTED_CLIENT_IP_HEADER` for Netlify.

**1. Put the complete project on your Git provider.**

In your editor's Source Control view, review and commit all intended application changes, including the new admin/API/catalog files, Supabase migrations, `netlify.toml`, `src/lib/deployment.ts`, tests and `bun.lock`, then push the branch you want Netlify to deploy. Do not include `.env.local`, `tmp`, `data` or `node_modules`; these are ignored. The existing repository contains changes from earlier work, so review them before committing. This setup did not create a commit or push your branch.

**2. Create the Netlify project.**

In Netlify, choose **Add new project → Import an existing project**, select your Git provider and this repository. Use the project root as the base directory. The checked-in settings specify:

| Setting | Value |
| --- | --- |
| Build command | `bun run build` |
| Publish directory | `.next` |
| Bun | `1.4.2` |
| Node | `22` |
| Bun install flags | `--frozen-lockfile` |

Keep the automatic Next.js adapter enabled. Do not choose static export or use drag-and-drop deployment: this project requires server functions. If the first build starts before you have added the environment values, configure them and redeploy. Choose a stable project hostname and copy its exact `your-project.netlify.app` name for the next step. [Netlify Next.js setup](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)

**3. Create a real Cloudflare Turnstile widget.**

Open the Cloudflare dashboard, select **Turnstile → Add widget**, name it **NEUZ**, choose **Managed**, and add these hostnames without protocols or paths:

- `neuz.ma` (also covers subdomains such as `www.neuz.ma`).
- Your exact Netlify project hostname, for example `your-project.netlify.app`.
- Any exact deploy-preview hostname where you intend to test quotes/admin login. Names such as `deploy-preview-12--your-project.netlify.app` are separate hostnames and need approval too.

Save the widget. Copy its site key and secret key directly into the Netlify settings below. Real keys are required; Cloudflare testing keys are intentionally rejected by the hosted app. You can use Turnstile without moving your domain's DNS to Cloudflare. To test locally with real keys, also authorize `localhost` and `127.0.0.1` and add the keys to `.env.local`; otherwise local keys can stay empty while you test Turnstile on Netlify. [Turnstile setup](https://developers.cloudflare.com/turnstile/get-started/), [hostname rules](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)

**4. Set Netlify environment variables.**

Open **Project configuration → Environment variables**. Copy existing private values from `.env.local` directly into Netlify. If you can select scopes, include **Builds and Functions**; the public site key needs Builds and the server credentials need Functions. Set values for the deploy context you will use. Avoid giving untrusted pull-request builds access to production secrets.

| Variable | Value |
| --- | --- |
| `SITE_URL` | `https://neuz.ma`, assuming this is the final domain |
| `SITE_NOINDEX` | `true` until the public launch |
| `SUPABASE_URL` | Existing value from `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server key from `.env.local` |
| `ADMIN_USERNAME` | Existing bootstrap value from `.env.local` |
| `ADMIN_PASSWORD_HASH` | Existing hash from `.env.local` |
| `ADMIN_SESSION_SECRET` | Existing secret from `.env.local` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key from the new widget |
| `TURNSTILE_SECRET_KEY` | Secret key from the same widget |
| `RESEND_API_KEY` | Existing Resend API key |
| `RESEND_FROM` | Leave unset until the sender domain is verified; then use the sender in step 6 |

The default quote limits already apply: 90 send attempts per rolling 24 hours and 2,700 per rolling 31 days. Copy custom quota settings only if you have deliberately changed them. A separate `QUOTE_RATE_LIMIT_SECRET` is optional; the configured admin secret is already the fallback.

Leave `CATALOG_STORAGE` and `CATALOG_DATA_DIR` unset. The site uses the existing Supabase database and storage bucket, which were verified during the audit. No repeat migration or admin reset is needed. Use your most recently chosen admin password; `tmp/admin-access.txt` may contain older bootstrap credentials.

Do not add any private values to `netlify.toml` or the `env` section of `next.config.ts`. Only the deployment context and URL are compiled there. Netlify build variables are not automatically runtime variables, which is why the app compiles those two nonsecret deployment facts. If an older `AWS_LAMBDA_JS_RUNTIME` override exists in Netlify, remove it or align it with Node 22. [Netlify environment settings](https://docs.netlify.com/build/environment-variables/get-started/), [runtime environment scopes](https://docs.netlify.com/build/functions/environment-variables/)

**5. Redeploy and check the hosted preview.**

Trigger a new deploy after setting the environment values. Confirm the build log installs with Bun and uses the Next.js adapter. Open `/fr`, `/en`, `/ar` and `/admin/login` on the Netlify URL. Complete a real Turnstile challenge and sign in with the current admin credentials. Check that products and their images load. Confirm the site remains noindex while `SITE_NOINDEX=true`.

The quote form will show its unavailable state until `RESEND_FROM` is configured. Do not interpret mocked browser-test success as actual email delivery. The primary deployment URL is trusted automatically; other exact preview URLs can be added to `TRUSTED_PREVIEW_ORIGINS` if needed. Every hostname where Turnstile runs also needs approval in its widget settings.

**6. Finish Resend when DNS access is available.**

In **Resend → Domains**, add or open the domain you own and copy the exact DNS records Resend displays into your DNS provider. Wait until Resend reports the sending domain as verified. Then set this in Netlify, using that verified domain:

```dotenv
RESEND_FROM=NEUZ <devis@neuz.ma>
```

Use the example only if `neuz.ma` is the verified domain; if you verified a subdomain, use an address on that subdomain instead. Keep `neuzinteriordesign@gmail.com` as the recipient; it is already set in application code. Redeploy, submit one deliberate test quote, and confirm the email, attachments and customer Reply-To in Gmail. [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)

**7. Connect the public domain and launch.**

In Netlify's domain settings, add `neuz.ma` and `www.neuz.ma`. Apply the DNS records Netlify provides, choose `neuz.ma` as the primary domain, and confirm HTTPS works and the alternate hostname redirects correctly. After hosted login, quote delivery and content checks pass, set `SITE_NOINDEX=false` for production and redeploy. Netlify preview/branch builds remain noindex automatically. Check `/robots.txt` and `/sitemap.xml` on the final domain.

Before relying on admin edits in production, confirm an intended edit persists after redeployment and arrange Supabase catalog/image backups and error monitoring. No real admin mutation or quote delivery was performed by this setup.

**Verified locally**

TypeScript and ESLint passed. All 50 unit/security tests passed (241 assertions). A build with simulated Netlify preview metadata passed, and its running server retained noindex and exact-origin enforcement even without Netlify's build variables at runtime. Tests cover trusted-IP selection, spoofed/missing IPs, unrelated preview origins, storage fallback and required Turnstile. Netlify's actual adapter build, real challenges, hosted login and delivery still require the dashboard/deployment steps above.