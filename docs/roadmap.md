# PRD alignment and follow-up

Source: [shared PRD](https://docs.google.com/document/d/1EEwdoeWlbDhHMmom1H1mth19KN8dbK0PwRT3ReQyu9E/edit?tab=t.ysf0rv1stc0), plus [current scenario tab](https://docs.google.com/document/d/1EEwdoeWlbDhHMmom1H1mth19KN8dbK0PwRT3ReQyu9E/edit?tab=t.32ku66b9k6j9). The latter supersedes the older 18–25 band with 18–22 and 23+, alongside 14–17. The repository contains implemented requirements, not a copied private document.

Implemented: 108 scenarios with age-appropriate content variants and face-off positions, five-person rated rounds, two-player practice fallback, three queues, optional video and timed audio/text turns, peer rubrics and feedback, Elo, history and shared weekly ranking, leave recovery/penalties, reports, blocks, moderator access controls, and the integrated Figma-derived React interface. The original tournament debate roadmap is no longer the current product scope.

Next work for the team:

- Run real-device two-person and five-person audio/video playtests. STUN has no guaranteed connectivity across every network; no paid TURN infrastructure is provisioned.
- Assign an actual moderator, test report handling, and decide operational policies before broader access.
- Add email verification/password recovery or free federated authentication if public account access is needed. Self-reported birth dates do not verify age.
- Import later Figma Make exports into the integrated frontend, preserving API wiring and reviewing changes before deployment.
- Agree on server-authoritative XP, coins, streaks and cosmetic unlock rules before enabling the shop. Current character customization is free and can be saved to the account.
- Add general profile editing if desired; the account profile offers labelled demo data alongside real activity.
- Maintain the connected native Vercel GitHub deployment and check status after pushes.
- Evaluate private lobbies, tournaments, seasons and voice effects separately if the PRD explicitly restores them.

Private contestant chat, reactions, saved avatars, topic matching, browser transcription, local delivery measurements and optional on-device transcript AI are implemented. Test WebGPU model loading and feedback on target devices; no physical-device inference validation has been performed. Paid AI and fake AI substitutes are excluded by the user's no-spending instruction. The earlier AI integration code is dormant compatibility code; the Vercel handler never enables it.

A Codex requirement monitor is configured for hourly checks but was paused at the time of this integration. Its paused state is preserved; it will not check for changes until resumed. It preserves teammates' work, the backend branch, free hosting and the existing deployment audience. Figma exports still require a reviewed import into this repository.
