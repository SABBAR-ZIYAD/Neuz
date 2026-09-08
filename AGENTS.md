<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project tooling

Use Bun for dependency installation, scripts, and tests. Do not use npm or npx. Keep `bun.lock` as the project lockfile. Use `bun install`, `bun run dev`, `bun run build`, `bun run typecheck`, `bun run lint`, and `bun run test`. Next.js commands must run with Bun's runtime, as configured in package.json. Ask before changing the user's global Bun installation.
