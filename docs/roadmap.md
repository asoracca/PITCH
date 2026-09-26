# PRD alignment and follow-up

Source: [shared PRD](https://docs.google.com/document/d/1EEwdoeWlbDhHMmom1H1mth19KN8dbK0PwRT3ReQyu9E/edit?tab=t.ysf0rv1stc0), plus [current scenario tab](https://docs.google.com/document/d/1EEwdoeWlbDhHMmom1H1mth19KN8dbK0PwRT3ReQyu9E/edit?tab=t.32ku66b9k6j9). The latter supersedes the older 18–25 band with 18–22 and 23+, alongside 14–17. The repository contains implemented requirements, not a copied private document.

Implemented: 36 age-specific scenarios and face-off positions, five-person rounds, three queues, timed audio/text turns, peer rubrics and feedback, Elo, history and age-separated weekly ranking, leave recovery/penalties, reports, blocks, moderator access controls, and a plain functional interface. The original tournament debate roadmap is no longer the current product scope.

Next work for the team:

- Run a real-device five-person audio playtest. STUN has no guaranteed connectivity across every network; no paid TURN infrastructure is provisioned.
- Assign an actual moderator, test report handling, and decide operational policies before broader access.
- Add email verification/password recovery or free federated authentication if public account access is needed. Self-reported birth dates do not verify age.
- Integrate the team's Figma-derived frontend using the shared API. Keep the framework route structure consistent.
- Complete repository-owner authorization for the native Vercel GitHub app, then verify automatic deployment from a push.
- Evaluate video, private lobbies, tournaments, seasons, transcripts and voice effects separately if the PRD explicitly restores them.

Paid AI and fake AI substitutes are excluded by the user's no-spending instruction. The earlier AI integration code is dormant compatibility code; the Vercel handler never enables it.

A Codex task monitor checks the document every 15 minutes and acts on clear changes when this task is idle. It is a periodic monitor, not real-time collaborative editing. It preserves teammates' work, the backend branch, free hosting and pending access approvals.
