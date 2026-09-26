# Beef
The `backend/quick-match` branch adds the debate backend, with Cloudflare Worker/D1 and Vercel/libSQL adapters. A plain functional website skeleton lives in `prototype/`. The original Next.js + Tailwind frontend in `beef/` remains available for the frontend team's design work.

## Quick-game backend

- Quick/mixed, judge, contestant and earned priority queues; two contestants and one human judge.
- Random public topics/sides, private custom topics, three timer presets, results, rematches and history.
- Private guest sessions, human scoring, exactly-once priority rewards and a Beef Rating leaderboard.
- Elo-based ratings starting at 1,000, five placement games, and individual rating histories for public debates.
- Tutorials, optional AI practice/judging, and authenticated WebRTC signaling.
- Database migrations, API integration tests, CI and a frontend API helper.

The website skeleton uses human judges and requires no AI key. The Vercel adapter deliberately disables paid AI. Optional AI integration code remains for future use on other hosts, but is not part of this no-cost prototype. Voice capture, playback and voice-changing effects remain future frontend integration work. No fake AI responses or audio effects are supplied. This is the approved quick-game prototype, not the full tournament PRD.

From this repository's root, use Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Open `http://localhost:8787/` for the skeleton or `/api/health` for the API status. Run `pnpm check` for type checking and integration tests. Copy `.dev.vars.example` to `.dev.vars` only for optional local configuration; no AI key is needed. Never commit real secrets. The teammate frontend has separate instructions in `beef/README.md`.

See [Vercel setup](docs/vercel.md), [API integration](docs/backend.md), [rating rules](docs/ratings.md), [Sites deployment](docs/deployment.md), and [PRD follow-up scope](docs/roadmap.md).

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
        
