# Teammate server integration

The teammate's `server` branch (initial commit `c263f38`) is merged into `backend/quick-match`, preserving its Git history and the original frontend. It supplies a Next.js custom HTTP server and Socket.IO connection demo. It did not implement accounts, matchmaking, scoring or storage; those now come from the shared PITCH backend.

## Run locally

Use Node 24, pnpm 11.19.0 and npm:

```sh
# Repository root
pnpm install --frozen-lockfile
cd beef
npm ci
npm run dev
```

The predev script builds the shared backend and applies migrations to an ignored `.local/pitch.db` database. No cloud account or key is needed. `http://localhost:3000/` remains the frontend team's page. `/server-check` displays the existing Socket.IO handshake and the real backend/database health. `/api/pitch/*` is handled by the same authenticated game engine as Vercel. The frontend can import `PitchApi` from `beef/src/pitch-api.ts` and use same-origin calls. No CORS proxy or second local process is needed.

The branch contains both `beef/app` and `beef/src/app`; Next.js selects `app`. The server demo is explicitly exposed at `app/server-check/page.tsx` instead of replacing the team's homepage. Socket listeners are cleaned up on unmount and do not auto-connect during server rendering.

`HOST` and `PORT` configure the listener. Explicit Turso variables override the local database; do not use the production database for experiments. On a separately managed Node host, production startup requires a configured persistent database; the development file fallback is disabled. `npm start` runs the actual TypeScript server through tsx, fixing the original reference to a nonexistent server.js. Dependencies must include tsx on such a host.

## Vercel

The existing Vercel project deploys the root API and the Figma-derived Vite frontend (`frontend/dist`). Vercel Functions do not host this long-running Socket.IO process ([Socket.IO's Next.js guidance](https://socket.io/how-to/use-with-nextjs)). Gameplay uses HTTP polling and WebRTC signaling there; browser audio is peer-to-peer. No additional paid service has been created.

The `ready` → `hello` handshake is retained for local development. A `hello` message also returns a `backend` event identifying `/api/pitch`. Socket messages do not mutate ratings, bypass login, or broadcast private ballots. Use the HTTP API contract for game actions so the two entrypoints cannot drift into different game engines.

## Checks

- Root `pnpm check`: game and adapter integration tests, types and browser scripts.
- In `beef`, `npm run typecheck` and `npm run lint`.
- Start the custom server, verify `/api/health` and `/api/pitch/config`, and verify the Socket.IO handshake.
- `npm run build` checks the Next.js frontend separately. Fonts may need network access during build.

Future merges should continue from the integrated backend branch or merge it into the teammate's working branch through a PR; do not copy a second database or rating implementation into the Socket.IO server.
