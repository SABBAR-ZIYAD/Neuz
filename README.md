# NEUZ — Maison de création

A French-first showcase with a protected product/category admin, built with Next.js App Router, TypeScript and next-intl. Public catalog pages render current data on the server in French, English and Arabic. Supabase stores the deployed catalog and images; local previews can use the ignored data folder.

For the selected Netlify deployment, follow [the Netlify setup guide](docs/netlify-setup.md). Build settings, trusted client-IP detection, deployment-origin validation and preview noindex behavior are prepared in the project.

## Run locally

Use Bun 1.4.2. Bun is this project's package manager, runtime and test runner; no separate Node.js installation is required for local development.

```sh
bun install
bun run dev
```

Open http://127.0.0.1:3000/fr. For a production preview, run `bun run build` followed by `bun run start`.

Production builds and checks are verified with Bun 1.4.2. The global Bun installation has not been changed.

Commit `bun.lock` with dependency changes. Use `bun install --frozen-lockfile` for reproducible installs. The Next.js scripts explicitly use Bun's runtime, following the [official Bun + Next.js setup](https://bun.sh/guides/ecosystem/nextjs).

```sh
bun run typecheck
bun run lint
bun run test
```

With the production preview running and Google Chrome installed, run `bun run test:browser`. It uses isolated headless sessions (no personal browser profile), checks all three locales and several viewport sizes, and writes screenshots/reports into `tmp/qa`. Form success/failure responses are intercepted locally; these tests do not send real emails. Unit tests also mock Resend, including envelope, attachment and idempotency checks.

## Content and design

- `messages/fr.json`, `en.json`, `ar.json`: all public copy, field labels and metadata. French is the editorial source; review Arabic with the business before publication.
- `src/lib/catalog.ts`: the curated image collection. Names are descriptive editorial titles, not existing product SKUs.
- `src/app/globals.css`: warm brown/cream palette from the PDF, self-hosted fonts, responsive layout and reduced-motion styles.
- `src/components/landing.tsx`: the continuous page, gallery, fixed transparent navigation and detail panels.
- `scripts/prepare-assets.mjs`: generates responsive WebP copies from the original artwork. `bun run assets` refreshes them without changing the originals.

The image collection is described as creations and artistic visualisations, not verified completed client installations. No invented testimonials, awards, fixed product dimensions or client names are published. The standalone favicon is a provisional N monogram; the supplied NEUZ logo is used in the page.

## Connect quote delivery

Copy `.env.example` to `.env.local`, then supply:

```dotenv
SITE_URL=https://neuz.ma
RESEND_API_KEY=re_your_key
RESEND_FROM=NEUZ <devis@your-verified-domain.com>
```

Resend must verify the domain in `RESEND_FROM`. The sender **cannot be the Gmail address**. Every request goes to the address in `src/lib/catalog.ts`; `Reply-To` points to the customer. The French owner email includes all twelve form fields, the original brief, preferred contact method, inspiration, language, reference number and attachments. No automatic customer email is sent.

Without a configured sender/key, submission returns a clear unavailable message with direct email and WhatsApp links. It never reports a successful delivery. A successful response means Resend accepted the email; inbox placement cannot be guaranteed by the app. Before launch, make one authorised live request and confirm receipt and reply behaviour in Gmail.

### Attachments and privacy

The form accepts up to five JPG, PNG, WebP or PDF files, with a **3 MiB combined limit**. This keeps the request below common serverless request limits and the encoded email comfortably below email limits. For original 3D files or larger references, clients can include a sharing link in their brief.

File sizes, MIME types and file signatures are checked on the server. Files go directly to the owner email as attachments; they are not published or stored in a public folder. There is **no separate durable lead archive** in this version: Resend and the receiving Gmail mailbox are the delivery records. Form drafts remain only in page memory and disappear on reload/language navigation. Do not collect confidential plans or sensitive documents through this form without establishing the necessary privacy process.

The server escapes all user content in the email, rejects cross-origin requests and honeypots, limits request body sizes, and uses retry-safe idempotency keys. Shared Supabase counters limit clients, and an atomic email budget caps quote sends at 90 per rolling 24 hours and 2,700 per rolling 31 days. Apply the migrations and settings in [the quote limits guide](docs/quote-limits.md). Configure Turnstile before a public launch for challenge-based abuse protection:

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_public_site_key
TURNSTILE_SECRET_KEY=your_secret_key
```

Register the actual site hostname in Turnstile and configure both keys together. Hosted quotes and admin logins require both keys and a valid verification; missing configuration blocks those operations. Loopback development can omit both keys. See [launch security](docs/launch-security.md) for activation, per-client admin limits and trusted preview origins. The public key is compiled into the frontend, so rebuild after changing it. There are no analytics or advertising trackers. The privacy notice should be reviewed against the business's actual retention and processing practices before publication.

## Search readiness

- Real HTML for `/fr`, `/en`, `/ar`, not client-only translated content.
- Each language has a self-referencing canonical, localized title/description and reciprocal `hreflang` links.
- `robots.txt`, a multilingual sitemap, Open Graph artwork and factual Organization/service JSON-LD.
- Visible explanations, material descriptions, process and FAQ content that search engines and AI systems can read. No promise of rankings or AI citations.

**Set `SITE_URL` to the actual HTTPS production domain before the production build.** Without it the preview is deliberately `noindex` and robots disallows crawling. Do not set a guessed domain. Keep the production canonical origin on previews; exact trusted preview origins are configured separately. Vercel Preview builds remain noindex; use SITE_NOINDEX=true for other preview hosts. Redirect alternate production hostnames at your hosting provider.

The site is not deployed by this project setup. For a Bun deployment, use a Bun-compatible Next.js host, set the environment variables, then run `bun run build` and `bun run start`. Review the proposed budget bands (MAD), translated copy, image publication rights and privacy notice with NEUZ before launch.

## SEO launch checks

Set `SITE_URL=https://neuz.ma` in the hosting environment before `bun run build`. An empty value intentionally emits noindex and blocks crawling. The sitemap includes the three homepages, nine service pages and three privacy pages. HTML and sitemap alternates share the same canonical URLs; middleware alternate headers are disabled to avoid conflicting signals.

After deployment, redirect HTTP and www traffic to https://neuz.ma at the hosting provider. Verify robots.txt, sitemap.xml, canonicals and the absence of hosting-level noindex headers. Submit https://neuz.ma/sitemap.xml to Google Search Console and Bing Webmaster Tools, inspect representative URLs, and measure production Core Web Vitals. Search indexing and AI citations require post-launch monitoring.

Run `bun run test:seo` against a running preview (default http://127.0.0.1:3000). Set `SEO_TEST_URL` to test another preview address; expected canonical URLs come from `SITE_URL`. This checks all sitemap pages, metadata, rendered service content and 404 behavior.

Production builds are verified with Bun 1.4.2 (see packageManager). Bun 1.3.11 fails while loading the Next.js production runtime on this Windows setup. Use Bun 1.4.2 in CI and hosting. The audit tested a temporary copy in tmp/bun-runtime without changing the global installation.

## Product and category administration

Open /abdel after running `bun run admin:setup` and restarting the development server. Private local login details are written to `tmp/admin-access.txt`. See [the admin guide](docs/admin.md) for CRUD, Supabase setup, migration and deployment.
