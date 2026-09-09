# Supabase connection verification

The local application is connected to Supabase. Migration imported 5 products, 2 categories and the existing stored admin account into the previously empty remote catalog. Product/category content and stored credentials were compared with local originals; database JSON key ordering was ignored during comparison. Local data and a private backup under tmp/supabase-backup-2026-09-08T18-12-48-213Z remain available.

Verified:
- Required catalog and quote-limit tables are accessible using the server key.
- A temporary image uploaded, rendered publicly at 480/800/1440 sizes, and was removed after verification.
- The publishable key cannot read private table data or invoke the quote-limit RPCs.
- Both quote-limit RPCs are installed and reject invalid arguments without reserving email slots. Full concurrent quota behavior was tested locally; this connection check did not consume the production email budget.
- Production build passes with Supabase configured.
- Runtime sitemap/page checks pass, including canonicals, hreflang, JSON-LD and expected 404 responses.
- Authenticated catalog API, admin panel and account page work against Supabase using a temporary server-signed test session; account hashes are not returned by the catalog API.

The bootstrap password in tmp/admin-access.txt differs from the stored account. No password was reset and no password-based login was attempted during final verification. Use the most recently chosen admin credentials. No real email was sent.

Before Vercel deployment, copy the configured server environment variables to the hosting project. Keep the server key private. Hosted-domain, cookie, email delivery and redeployment checks still need to run on the actual host; this migration does not by itself resolve every finding in deployment-audit.md.
