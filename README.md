# Beef
The `backend/quick-match` branch adds a Cloudflare Worker + D1 backend. The original Next.js + Tailwind frontend in `beef/` still needs to be connected to it.

## Quick-game backend

- Quick/mixed, judge, contestant and earned priority queues; two contestants and one human judge.
- Random public topics/sides, private custom topics, three timer presets, results, rematches and history.
- Private guest sessions, human scoring, exactly-once priority rewards and a casual public leaderboard.
- Tutorials, optional AI practice/judging, and authenticated WebRTC signaling.
- Database migrations, API integration tests, CI and a frontend API helper.

AI requires a configured key and model. Voice capture, playback and voice-changing effects require frontend integration. No fake AI responses or audio effects are supplied. This is the approved quick-game prototype, not the full tournament PRD.

From this repository's root, use Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Check `http://localhost:8787/api/health`. Run `pnpm check` for type checking and integration tests. Copy `.dev.vars.example` to `.dev.vars` for optional configuration; never commit real secrets. The frontend has separate instructions in `beef/README.md`.

See [API integration](docs/backend.md), [deployment](docs/deployment.md), and [PRD follow-up scope](docs/roadmap.md).

## Original project

Made during 24hrs during the Badger BuildFest 2026

Made with nextjs and tailwind
run

**git clone https://github.com/cerlina-chen/Beef.git**
Yall make some branches

main
   |- frontend
        |-mainscreen
        |-fight screen
        |-leaderboard
   |-backend
        |-leaderboard
        |-server
        |-AI

```
git clone https://github.com/cerlina-chen/Beef.git
```
        
