# PITCH prototype

[Website](https://pitch-prototype-asoracca.vercel.app) · [Backend branch](https://github.com/asoracca/Pitch/tree/backend/quick-match)

The team's Figma Make design is integrated in `frontend/` (React, Vite and Tailwind). It uses the existing authenticated PITCH backend. The teammate's Next.js/Socket.IO development workspace remains in `beef/`; the previous plain UI is retained as reference in `prototype/`.

## Implemented

- Email/password accounts and conduct consent for ages 14+. Age is a profile detail; matching and the leaderboard are shared across ages.
- Five-person rated rounds and optional unrated two-player duels with opponent feedback.
- Optional camera/video, turn-based voice and text; local solo voice/video recording, browser transcription and approximate delivery measurements.
- Labelled demo opponents, leaderboard and 500-day profile; public text spectating while queued.
- Category chips and scenario cards; customizable avatars that start empty and can be saved to the account.
- 108 scenarios: the 36 PRD prompts plus 72 additional prototype prompts, including assigned sides for face-offs; each match saves its scenario snapshot.
- Quick/contestant, judge and earned priority queues; a 120-second timeout and widening Elo range.
- Server-timed speaking turns, optional text submissions, browser peer-to-peer audio and judge scoring.
- Majority verdicts, rubric tiebreaks, Elo, leave penalties, feedback helpfulness, history and a shared weekly leaderboard.
- Private contestant chat with reactions, scripted demo chat, and topic-compatible quick play.
- Private saved solo practices (text, AI feedback and measurements), automatic opponent-match history, and labelled sample practice logs.
- Optional free on-device transcript coaching with WebLLM; model download only after the user chooses to load it.
- Reports, blocking and a moderator review endpoint/UI; moderation requires an assigned moderator.
- Atomic, repeat-safe ratings and rewards on Vercel/Turso and Sites/D1. No paid AI or API key.

Audio uses free peer-to-peer WebRTC with STUN. Some networks require a TURN relay, which is not provisioned. Five-person microphone playback still needs a real-device playtest. Birth dates are self-reported; email verification, password recovery and Google sign-in are not implemented. Keep this a supervised prototype.

## Run the prototype

Use Node 24 and pnpm 11.19.0 from this directory:

```sh
pnpm install --frozen-lockfile
pnpm build
node scripts/dev-frontend.mjs
# In a second terminal:
pnpm --dir frontend dev
```

Open `http://127.0.0.1:5173/`. The local API uses an ignored SQLite database and no cloud credentials. Run `pnpm check` for type checks, integration tests and browser-script syntax checks. The separate Next.js server setup is documented in [the teammate handoff](docs/server-integration.md).

[Vercel deployment](docs/vercel.md) · [API contract](docs/backend.md) · [Figma frontend handoff](docs/figma-handoff.md) · [Elo rules](docs/ratings.md) · [Sites deployment](docs/deployment.md) · [Scope and follow-up](docs/roadmap.md)

The frontend includes real sign-in, dashboard data, matchmaking, live rounds, scorecards, results, history, leaderboard, reporting and blocking. Solo practice is unscored. Recordings remain local; choosing Save practice stores only text, feedback and measurements in the signed-in account’s private history. Character styles preview locally and can be saved to the account. Coins, purchases, XP, earned badges and general profile editing are not enabled. Browser transcription may use the browser vendor’s speech service. On-device AI requires WebGPU and a large first-use download; it evaluates text and approximate measurements, not audio, emotion or faces. See the [handoff](docs/figma-handoff.md) before importing future design exports.

## Original project

Made during Badger BuildFest 2026 with Next.js and Tailwind. Continue using feature branches and pull requests in `asoracca/Pitch`; this work does not modify `main` directly.
