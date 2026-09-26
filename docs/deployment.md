# Deployment

For the Vercel backend and simple website skeleton, use [Vercel setup](vercel.md). The configuration below describes the existing private Sites preview, which remains available during migration.

`.openai/hosting.json` identifies the existing Beef Backend Site and declares D1 binding `DB`. Reuse that Site for updates. Sites provisions the database and applies generated migrations. The identifier is metadata, not a credential. GitHub hosts the source; Sites runs the backend.

`pnpm build` emits `dist/server/index.js`, the skeleton assets in `dist/client/`, `dist/.openai/hosting.json` and `dist/.openai/drizzle/`. It also compiles the Node.js adapter under `build/node/` for tests; that directory is not part of the Sites archive. Publish validated source and its matching archive through Sites. Keep the approved prototype private.

Set runtime values in the host, never Git:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Secret for AI practice/private judging |
| `OPENAI_MODEL` | Explicit model supporting Responses structured outputs |
| `CORS_ORIGINS` | Comma-separated exact frontend origins |
| `VOICE_ICE_SERVERS` | JSON RTCIceServer array for your STUN/TURN service |

Local `.dev.vars` values are ignored by Git and are not automatically uploaded to Sites. AI needs both key and model. Health reveals configuration status only. Set provider spending limits before broad AI access.

For optional direct Cloudflare deployment, create your own D1 database and replace the local zero-ID/name in your deployment config with its actual values. Apply `pnpm db:migrate:remote` before `pnpm deploy`; authenticate Wrangler and manage secrets using the host. The zero ID in this repo is for local development only. This alternative is separate from the selected Sites deployment.

`pnpm check` type-checks, builds and tests the API against a transactional SQLite adapter. It covers authorization, privacy, round transitions, duplicate result/ticket/rating handling, queues, voice recipient isolation, malformed mocked AI output, placements, rating math, stale snapshots and transaction rollback. `pnpm db:migrate:local` plus `pnpm dev` permits a real Worker/D1 smoke test. Mocked tests do not verify live model availability or quality. Root backend checks do not validate or connect the original frontend.
