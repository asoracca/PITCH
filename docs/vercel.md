# Vercel deployment

Website: https://beef-debate-prototype.vercel.app

Project `beef-debate-prototype`, scope `anggunsoracca`, uses the repository root, Node 24, `pnpm build:vercel`, and static output `prototype`. Turso resource `beef-prototype-db` is connected. Both hosting and database use the selected free plans; do not enable paid upgrades or overages. All deployment protection settings are preserved. The Sites preview uses a separate database and login context.

## Native GitHub automatic deployment

The chosen route is Vercel's GitHub app, not a persistent deployment token in Actions. **Repository-owner authorization is still pending** as of this integration. Cerlina should open https://github.com/apps/vercel, install/configure the app for her account, select only `Beef`, and save. Then connect `cerlina-chen/Beef` in this existing Vercel project's Settings → Git (or `vercel git connect`). Set its production branch to `backend/quick-match`, with root directory unchanged. This does not merge into or modify `main`.

Verify a subsequent push creates a Vercel deployment tied to that commit before calling automatic deployment enabled. GitHub Actions runs checks without a Vercel secret. Native Vercel builds run type checks and a packaged-entry/database check; GitHub CI separately runs the complete integration suite. See https://vercel.com/docs/git/vercel-for-github.

Manual authorized deployments continue to work while app authorization is pending:

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

Teammates contribute through GitHub branches and pull requests. Keep the existing Hobby owner; adding shared dashboard administration may require a paid team plan. Do not create another project, fork, database or paid service as a workaround. The teammate's Socket.IO custom server is integrated for local development; Vercel serves the HTTP API and static prototype, not a persistent Socket.IO process. See [server integration](server-integration.md).
