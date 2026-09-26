# PRD follow-up scope

Source: [Beef product management — BEEF PRD](https://docs.google.com/document/d/1EEwdoeWlbDhHMmom1H1mth19KN8dbK0PwRT3ReQyu9E/edit?tab=t.ysf0rv1stc0), draft v0.1, reviewed September 26, 2026. The owner chose to ship the quick-game backend now and track the larger PRD next. Unchecked items are not implemented.

## Delivered

- [x] Two contestants and one human judge; score-based outcomes and draws.
- [x] Quick/mixed, dedicated judge, standard contestant and earned priority queues.
- [x] Exactly-once judge tickets, consumed only on successful contestant matching.
- [x] Random public topics/sides, private topics, three timer presets, server-controlled transitions.
- [x] Guest sessions, private transcripts, rematches, history and casual standings.
- [x] Tutorial content and optional AI practice/judging integrations.
- [x] Member-only WebRTC signaling; no audio recordings.
- [x] Beef Rating v1: Elo-based public match ratings, five placement games, rating history, and rating-sorted leaderboard. Added after the quick-game scope at the owner's request.
- [x] Plain website skeleton for guest entry, public quick games, text rounds, human scoring, results and ratings.
- [x] Vercel Node.js/libSQL adapter and deployment configuration; hosted Vercel provisioning requires the owner's connected account and free database.

## Connect the frontend next

- [ ] Apply the frontend team's design to the Next.js screens and connect the API; the plain skeleton is available for functional testing.
- [ ] Microphone permission/test, live audio, voice effects, mute/playback, and TURN or managed audio integration.
- [ ] AI practice is deferred: the owner requested no AI key and no spending. Vercel does not enable paid AI.
- [ ] Ready checks, reconnect grace, explicit leave/forfeit, and recovery after judge abandonment. Current open rooms expire after 24 hours with no replacement judge.

## Larger PRD

- [ ] Two independent judges, hidden votes, majority decision, combined-score tiebreak and extra sudden-death judge.
- [ ] Four alternating 30-second speaking turns plus 15-second judging, with audio-system speaker permissions.
- [ ] Eight-contestant brackets, acceptance, quarterfinals/semifinals/final, advancement and forfeits.
- [ ] Recoverable accounts, age/rules onboarding, avatars and controlled playtest access.
- [ ] Rating-aware opponent matching, collusion controls, separate Fair Play standing and 5-/10-minute abandonment cooldowns.
- [ ] Report/block/mute/leave, moderator review/suspension and prompt-management tools; block-aware matching.
- [ ] Queue times, role completion/abandonment, ticket redemption, brackets, fair-result feedback and retention measurement.
- [ ] Decide consent, retention and deletion rules before adding audio recording.

The Notes tab mentions three judges, while the PRD specifies two. Immediate delivery retains one; resolve the expanded format before implementation. Current standings use [Beef Rating](ratings.md) with provisional labels. Timed-out users can re-enter; matching is not guaranteed. Broader rollout depends on the PRD's reconnect, moderation and launch criteria.
