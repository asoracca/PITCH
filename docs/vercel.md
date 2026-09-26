# Vercel deployment

Website: https://pitch-prototype-asoracca.vercel.app

Project `pitch`, scope `anggunsoracca`, uses the repository root, Node 24, `pnpm build:vercel`, and static output `frontend/dist`. Turso resource `beef-prototype-db` is connected. Both hosting and database use the selected free plans; do not enable paid upgrades or overages. All deployment protection settings are preserved. The Sites preview uses a separate database and login context.

## Native GitHub automatic deployment

The native Vercel GitHub app is connected to `asoracca/Pitch` after the user authorized the transferred repository. The deployment branch is `backend/quick-match`, with the repository root unchanged. Pushes to this branch update the website; other branches produce previews. This does not merge into or modify `main`.

GitHub Actions runs checks without a Vercel secret. Native Vercel builds run type checks and a packaged-entry/database check; GitHub CI separately runs the complete integration suite. See https://vercel.com/docs/git/vercel-for-github. Verify deployment status and its source commit after each push; a failed build does not replace the working website.

For an explicitly authorized manual deployment:

```sh
pnpm dlx vercel@60.0.1 deploy --yes --scope anggunsoracca --prod
```

## Runtime and configuration

`api/index.mjs` exports the bundled Node handler from `build/vercel/index.js`. The build compiles TypeScript, applies additive database migrations and imports the actual entry to verify database access. This avoids extensionless ESM imports failing only after deployment. Never change an already-applied migration: add a new migration.

Server-only configuration:

- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: provisioned by the connected database integration.
- `ENABLE_EXPERIMENTAL_COREPACK=1`: use pinned pnpm 11.19.0.
- `PITCH_MODERATOR_IDS`: optional comma-separated approved moderator account IDs.
- `CORS_ORIGINS`: optional additional exact frontend origins; same-origin requires none.
- `VOICE_ICE_SERVERS`: optional WebRTC configuration; defaults to free STUN, with no TURN relay.

No OpenAI key is used. Never prefix secrets with `NEXT_PUBLIC_`, commit environment files, or put them in browser code. Local file databases are rejected on Vercel. Preview and production currently share the connected prototype database; migrations must remain additive and previews must not be treated as isolated data environments.

Validate locally:

```sh
pnpm check
BEEF_LOCAL_DATABASE=1 TURSO_DATABASE_URL=file:/tmp/pitch-check.db pnpm build:vercel
```

After deploying, verify the page, `/api/health` and `/api/pitch/config` with authenticated `vercel curl` if protection applies. Do not disable access protection merely to run a check. A Ready build alone does not prove the runtime starts.

## Teammates

Teammates contribute through GitHub branches and pull requests. Keep the existing Hobby owner; adding shared dashboard administration may require a paid team plan. Do not create another project, fork, database or paid service as a workaround. The teammate's Socket.IO custom server is integrated for local development; Vercel serves the HTTP API and integrated React frontend, not a persistent Socket.IO process. See [server integration](server-integration.md).

## Frontend build and address

Root pnpm workspaces install `frontend/` alongside the backend. `pnpm build:vercel` type-checks and builds the imported Vite frontend, bundles the existing API, then checks database migrations and the packaged handler. Keep the Vercel root at the repository root so both deploy together. Navigation uses URL hashes, preserving reloads without an API-conflicting catch-all rewrite. CSP permits the exported Google fonts and React inline styling; scripts and API requests remain same-origin.

The project was renamed to `pitch`. Both `pitch.vercel.app` and `pitch-prototype.vercel.app` were unavailable; `pitch-prototype-asoracca.vercel.app` is the new free production address. The previous Beef address remains an alias. No project, database or subscription was replaced.
