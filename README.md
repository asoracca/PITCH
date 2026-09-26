# Beef / Pitch prototype

[Website](https://beef-debate-prototype.vercel.app) · [Backend branch](https://github.com/asoracca/Pitch/tree/backend/quick-match)

Pitch is the current working name for the career and social practice pivot. The functional, deliberately plain website is in `prototype/`; the team's Next.js design workspace remains in `beef/`.

## Implemented

- Email/password accounts, conduct consent, and age-separated matching: 14–17, 18–22, 23+.
- Five-person rounds: two contestants, three independent peer judges.
- 36 scenarios from the current PRD, including assigned sides for face-offs; each match saves its scenario snapshot.
- Quick/contestant, judge and earned priority queues; a 120-second timeout and widening Elo range.
- Server-timed speaking turns, optional text submissions, browser peer-to-peer audio and judge scoring.
- Majority verdicts, rubric tiebreaks, Elo, leave penalties, feedback helpfulness, history and weekly age-band leaderboards.
- Reports, blocking and a moderator review endpoint/UI; moderation requires an assigned moderator.
- Atomic, repeat-safe ratings and rewards on Vercel/Turso and Sites/D1. No paid AI or API key.

Audio uses free peer-to-peer WebRTC with STUN. Some networks require a TURN relay, which is not provisioned. Five-person microphone playback still needs a real-device playtest. Birth dates are self-reported; email verification, password recovery and Google sign-in are not implemented. Keep this a supervised prototype.

## Run the prototype

Use Node 24 and pnpm 11.19.0 from this directory:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Open `http://localhost:8787/`. Run `pnpm check` for type checks, integration tests and browser-script syntax checks. The separate Next.js server setup is documented in [the teammate handoff](docs/server-integration.md).

[Vercel deployment](docs/vercel.md) · [API contract](docs/backend.md) · [Elo rules](docs/ratings.md) · [Sites deployment](docs/deployment.md) · [Scope and follow-up](docs/roadmap.md)

## Original project

Made during Badger BuildFest 2026 with Next.js and Tailwind. Continue using feature branches and pull requests in `asoracca/Pitch`; this work does not modify `main` directly.
