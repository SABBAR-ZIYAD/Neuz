# NEUZ — Maison de création

A single-page, French-first showcase built with Next.js App Router, TypeScript and next-intl. English and Arabic have their own pre-rendered routes; Arabic uses RTL and a dedicated typeface. No admin panel, database or CMS is included in this phase.

## Run locally

Use Bun 1.3.11 or newer. Bun is this project's package manager, runtime and test runner; no separate Node.js installation is required for local development.

```sh
bun install
bun run dev
```

Open http://127.0.0.1:3000/fr. For a production preview, run `bun run build` followed by `bun run start`.

Current verification: local development, eight unit tests, TypeScript and lint pass on the installed Bun 1.3.11. The production build currently fails in Bun's CommonJS loader while loading Next.js 16.3.4's server runtime; both Turbopack and webpack reproduce it. A newer Bun release must be tested before the production build can be marked ready. The global Bun installation has not been changed.

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
SITE_URL=https://your-actual-domain.com
RESEND_API_KEY=re_your_key
RESEND_FROM=NEUZ <devis@your-verified-domain.com>
```

Resend must verify the domain in `RESEND_FROM`. The sender **cannot be the Gmail address**. Every request goes to `neuzinteriordesign@gmail.com`; `Reply-To` points to the customer. The French owner email includes all twelve form fields, the original brief, preferred contact method, inspiration, language, reference number and attachments. No automatic customer email is sent.

Without a configured sender/key, submission returns a clear unavailable message with direct email and WhatsApp links. It never reports a successful delivery. A successful response means Resend accepted the email; inbox placement cannot be guaranteed by the app. Before launch, make one authorised live request and confirm receipt and reply behaviour in Gmail.

### Attachments and privacy

The form accepts up to five JPG, PNG, WebP or PDF files, with a **3 MiB combined limit**. This keeps the request below common serverless request limits and the encoded email comfortably below email limits. For original 3D files or larger references, clients can include a sharing link in their brief.

File sizes, MIME types and file signatures are checked on the server. Files go directly to the owner email as attachments; they are not published or stored in a public folder. There is **no separate durable lead archive** in this version: Resend and the receiving Gmail mailbox are the delivery records. Form drafts remain only in page memory and disappear on reload/language navigation. Do not collect confidential plans or sensitive documents through this form without establishing the necessary privacy process.

The server escapes all user content in the email, rejects cross-origin requests and honeypots, limits request body sizes, and uses retry-safe idempotency keys. Its in-memory rate limit is instance-local; configure Turnstile before a public launch for distributed abuse protection:

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_public_site_key
TURNSTILE_SECRET_KEY=your_secret_key
```

Register the actual site hostname in Turnstile and configure both keys together. A valid verification is required when the secret is set. The public key is compiled into the frontend, so rebuild after changing it. There are no analytics or advertising trackers. The privacy notice should be reviewed against the business's actual retention and processing practices before publication.

## Search readiness

- Real HTML for `/fr`, `/en`, `/ar`, not client-only translated content.
- Each language has a self-referencing canonical, localized title/description and reciprocal `hreflang` links.
- `robots.txt`, a multilingual sitemap, Open Graph artwork and factual Organization/service JSON-LD.
- Visible explanations, material descriptions, process and FAQ content that search engines and AI systems can read. No promise of rankings or AI citations.

**Set `SITE_URL` to the actual HTTPS production domain before the production build.** Without it the preview is deliberately `noindex` and robots disallows crawling. Do not set a guessed domain. Use the same canonical origin for the page and quote endpoint; redirect alternate hostnames at your hosting provider.

The site is not deployed by this project setup. For a Bun deployment, use a Bun-compatible Next.js host, set the environment variables, then run `bun run build` and `bun run start`. Review the proposed budget bands (MAD), translated copy, image publication rights and privacy notice with NEUZ before launch.
