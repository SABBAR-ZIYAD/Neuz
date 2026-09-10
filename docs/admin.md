# Administration NEUZ

## Local use

Use Bun 1.4.2. Run:

~~~sh
bun install --frozen-lockfile
bun run admin:setup
bun run admin:seed
bun run dev
~~~

Open /abdel. The setup command writes a randomly generated password to the ignored, private file tmp/admin-access.txt. Only its scrypt hash and a random session secret are added to .env.local. After seeding, the active username and password hash live in the private catalog document (local JSON or Supabase); neither is included in public data or the catalog API. No default password is shipped. Restart the server after changing credentials. The setup values seed a stored account once. Run bun run admin:seed to initialize it explicitly; login also seeds it automatically if absent. Re-running the seed never overwrites an existing account.

The panel has two sections: Products and Categories. Existing content is imported once on the first catalog read. Edit it in the panel afterwards; changing the seed files does not overwrite saved content. Deleting all products does not re-import the seed.

Products support name, subtitle, description, alternative image text, category, image replacement, visibility and position. Categories support names, descriptive copy, optional extended page content, visibility, position and the corresponding quote type (including poufs and sculptures). French is required; missing English or Arabic text falls back to French. A category appears publicly only when it contains at least one visible product. All its product descriptions, category page, filters, counts and sitemap update on subsequent requests without rebuilding. Reload an already open public page to see changes.

Category URLs are immutable after creation. Reassign or delete its products before deleting a category. A stale edit is rejected rather than overwriting another admin's changes. Deleted products disappear from the catalog; image files are retained so saved/shared image URLs remain valid. Supabase storage can be reviewed separately for unused files.

Uploads accept a single JPG, PNG or WebP up to 3 MiB and 25 megapixels. The server decodes the file, strips metadata and produces 480/800/1440-pixel WebP variants. Animated images and SVG files are not accepted. This request limit fits within Vercel's function request limit.

## Supabase and Vercel

Local previews without Supabase save to data/catalog.json and data/uploads. These folders are ignored by Git. They are not durable serverless storage. The application refuses this fallback on Vercel, and a production server requires Supabase unless CATALOG_STORAGE=local is explicitly set for a local production test.

1. Create a Supabase project.
2. Run supabase/admin.sql in its SQL editor. It creates a catalog table with RLS, grants access only to the server service role, and creates the public neuz-products bucket. Do not add public write policies.
3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local and the hosting environment. These variables must never be NEXT_PUBLIC variables or appear in client-side code. Configure both together.
4. Copy the initial seed values ADMIN_USERNAME, ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET from your private environment into Vercel. Use the generated values, not the plaintext password. Set SITE_URL=https://neuz.ma and use the tested Bun 1.4.2 runtime.
5. If you want to keep local edits, run the migration below **before opening the site or admin with the remote connection**. Otherwise restart locally or deploy, then log into /abdel and verify an edit and image upload. On its first connection an empty remote catalog receives the original six products and three categories. The private local preview catalog is not automatically copied to the remote project.

To transfer a locally edited catalog, run bun run admin:migrate after adding Supabase credentials and before opening the connected site. It uploads locally managed images, copies the local catalog and only inserts it if no remote catalog exists. It refuses to overwrite an existing remote catalog. Keep a backup of data/catalog.json and data/uploads until the migration is verified. Existing repository images remain served from public/images.

The service-role key stays on the server. Admin APIs enforce authenticated, expiring HttpOnly sessions, same-origin mutation checks, bounded request bodies and schema validation. Login attempts use shared per-client counters (20 requests per 15 minutes), separate from the catalog. One client cannot lock out every admin. Hosted logins also require Turnstile. See [launch security](launch-security.md) for bot protection and trusted preview origins. Admin routes have noindex metadata and are excluded from the public sitemap.

Back up the Supabase database and bucket using your account's backup/export tools. Retain the server secrets in your hosting provider's secret settings. These credentials and the local data folder must not be committed.

## Verification

Run `bun run test`, `bun run lint`, and `bun run build`. For the destructive CRUD browser test, start a separate local production server on port 3001 with `CATALOG_STORAGE=local`, `CATALOG_DATA_DIR=tmp/admin-e2e-data`, and both Supabase variables unset, then run `bun run test:admin`. The test uses localhost for Secure cookies, reads the generated local credentials, and exercises creation, editing, uploads, publication and deletion against the isolated catalog. Do not point it at your working catalog.

## Changing credentials and recovery

Open **Admin → Mon compte**. Enter your current password, username, a new password of at least 8 characters and its confirmation. Saving signs out all sessions, including the current one. Sign in with the new credentials; no rebuild or environment edit is required. The original password in tmp/admin-access.txt is only the bootstrap password and is no longer valid after a change. Keep the new password in your password manager.

Keep ADMIN_SESSION_SECRET configured and private. ADMIN_USERNAME and ADMIN_PASSWORD_HASH are bootstrap values only; redeploying or re-running the seed does not restore them over a changed account. Local-to-Supabase migration preserves the stored account. No SQL schema change is needed because the private catalog document stores the account.

If locked out, an operator with access to the configured storage and environment can run `bun run admin:setup --reset`, then `bun run admin:seed --reset`. The second command explicitly replaces the stored account in the currently configured local or Supabase database. For a deployed site, copy the new ADMIN_SESSION_SECRET and bootstrap values to hosting and redeploy. The generated recovery password is in tmp/admin-access.txt. Never run a reset against the wrong environment.
