# Vercel prototype deployment

This branch contains a Vercel Node.js backend and a deliberately plain, functional website skeleton. The existing Next.js project in `beef/` is still owned by the frontend team. Deploy from the **repository root**, not `beef/`.

## No paid AI

The Vercel handler does not pass OpenAI credentials into the game, even if such variables exist in the hosting environment. All visible matches use human judges. AI practice, private AI judging, microphones and voice effects are absent from the skeleton. No OpenAI account or key is needed.

Target [Vercel Hobby](https://vercel.com/docs/plans/hobby) for this non-commercial prototype and [Turso Free](https://turso.tech/pricing) for its database. Free plans have usage limits. Do not select a paid plan, enable database overages or enter billing details for this setup. Turso currently offers free signup without a credit card. If free capacity is unavailable, stop rather than upgrade.

## Import and connect

1. Sign in to Vercel and create a project from `cerlina-chen/Beef`, selecting the `backend/quick-match` branch containing this configuration. Keep **Root Directory** at the repository root and **Framework Preset** as **Other**. Use Node.js 24. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so the build uses the pinned pnpm version. The root `vercel.json` supplies `pnpm build:vercel` and the `prototype` output folder.
2. Create a Turso database on the **Free** plan, with overages disabled. Connect it to the Vercel project through the [Turso integration](https://vercel.com/marketplace/turso), or enter its database URL and database token as server-only environment variables:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. Apply those variables to the deployment environment being used. Use a separate free database for preview environments if they should be isolated. Never use `NEXT_PUBLIC_` prefixes or put credentials in GitHub, browser JavaScript, or chat.
4. Deploy the branch. The build applies existing migrations before publishing the function. A missing database connection fails the build with a setup error instead of silently using temporary storage. Set the production branch to `backend/quick-match` only if promoting this branch is intended; do not change the repository's main branch.
5. Preserve deployment protection for a private playtest. Vercel preview and production protection can differ; confirm access before sharing a URL. Hosting on Vercel does not inherit the existing Sites access settings.

If the GitHub import does not expose the original owner's repo, the repo owner must grant the Vercel integration access, or an authenticated Vercel CLI can deploy the local checkout. Creating another fork is not required.

## What is deployed

- `api/index.ts`: Vercel function entrypoint, using the same game routes and validations as the existing backend.
- `server/vercel-handler.ts`: database configuration, safe request adaptation and Vercel client-IP handling. Does not configure paid AI.
- `server/libsql.ts`: prepared-query adapter with atomic write batches, preserving score/rating/ticket transaction semantics.
- `scripts/migrate-libsql.mjs`: migration tracking with content hashes and per-migration transactions. No schema changes occur during gameplay requests.
- `prototype/`: plain HTML, CSS and JavaScript for guest entry, quick/role queues, format choice, text debate rounds, human judgments, results, Beef Rating and instructions.
- `vercel.json`: static hosting, same-origin API rewrites, response headers and function duration.

The live API and the skeleton share one origin; no cross-host authentication proxy is required. Persistent records live in Turso, never in Vercel's temporary filesystem. Browser session storage keeps only the guest token and current room code; the database remains authoritative for games and ratings. Vercel deploys the Node.js handler directly; it does not proxy gameplay through Sites.

The existing Sites preview continues to use its D1 database. A new Turso database starts empty; existing Sites users, games and ratings are not automatically copied or deleted. A data migration would require an authenticated export before cutover. Keep the Sites preview available until the Vercel deployment is confirmed working.

## Local checks

From the repository root with Node.js 24:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm db:migrate:local
pnpm dev
```

The website is available at `http://localhost:8787/` using the existing local D1 database. The test suite also runs complete matches through the Vercel handler using an actual local libSQL client, including duplicate verdicts, rollback, migration checks and no-paid-AI behavior.

To validate the Vercel build against a disposable local database without any account or credentials:

```sh
BEEF_LOCAL_DATABASE=1 TURSO_DATABASE_URL=file:/tmp/beef-vercel-check.db pnpm build:vercel
```

Local file databases are explicitly rejected when running on Vercel. For a hosted connection, configure environment variables first and use `pnpm db:migrate:vercel` if a separate migration step is needed. Never print database tokens while debugging.

## Teammate handoff

The skeleton has no design-system dependency. Your teammates can replace it with the Next.js frontend or reuse `client/beef-api.ts` and [the API contract](backend.md). A three-person test needs three guest identities, two contestants and a judge, choosing the same timer format. Separate browser profiles avoid sharing one identity. If one judge abandons the game, replacement/forfeit recovery is still follow-up work; this prototype has a 24-hour room expiry.

Teammates can work in GitHub branches and pull requests. The original repository is public, and Vercel documents free collaboration for public repositories. Sharing Vercel dashboard administration through team membership requires a paid plan, so keep one Hobby owner for this no-cost setup. See [collaboration guidance](https://vercel.com/docs/deployments/troubleshoot-project-collaboration) and [team accounts](https://vercel.com/docs/accounts). Never share the owner's password or database token with browser code.

After deployment, verify `/api/health`, guest entry, matching with three people, argument submission, human scoring, rating changes and leaderboard refresh. Automated local tests verify the adapter, but cannot verify a hosted Vercel deployment until account access and a real database are connected.

Runtime and routing references: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [rewrites](https://vercel.com/docs/routing/rewrites), [Turso client transactions](https://docs.turso.tech/sdk/ts/reference).
