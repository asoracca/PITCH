# Pitch API and frontend handoff

The current product uses `/api/pitch` with the `pitch.v1` contract. See [the Figma frontend handoff](figma-handoff.md) for screen wiring and the export/deployment steps. The older Beef routes remain available for compatibility, with separate game/ratings tables; do not mix their guest tokens, room IDs, rating rules or UI contracts with Pitch.

Use the same origin as the website. `client/pitch-api.ts` is the small browser client; it keeps a token in memory unless the UI explicitly persists it. The skeleton uses sessionStorage. Send `Authorization: Bearer <session token>` on authenticated requests and JSON on writes. Responses use `{error:{code,message}}` with HTTP status codes. Server timestamps are UTC milliseconds. No database or hosting secret belongs in frontend code.

## Accounts and discovery

| Method/path | Body or behavior |
|---|---|
| GET `/api/health` | Checks the database; no authentication |
| GET `/api/pitch/config` | API version, supported capability flags, rules, timeline and 36 scenario definitions |
| POST `/api/pitch/signup` | `{name,email,password,birthDate,acceptedConduct:true}`; ISO birth date, 12–128 character password; returns `{player,token,expiresAt}` |
| POST `/api/pitch/login` | `{email,password}`; same session response |
| POST `/api/pitch/logout` | Revokes this token |
| GET `/api/pitch/me` | Rating, judge reliability, priority credits, bans, blocked players, active room and moderator flag |
| GET `/api/pitch/history` | Last 50 rated rounds, own feedback, rubric averages and category win rates |
| GET `/api/pitch/leaderboard` | Top 30 in your age band by net Elo earned since Monday 00:00 UTC, with lifetime Elo alongside |

Birth dates and email addresses are never exposed to other players. There is no email delivery, verification or recovery service. Passwords are salted/hashed; session secrets are stored as hashes and expire after 30 days. Age bands use self-declared dates, not identity verification.

## Queue and round lifecycle

`POST /api/pitch/queue` accepts `{mode:'quick'|'contestant'|'judge'|'priority'|'mixed'}`. Quick and mixed fill either role; with an earned credit they prioritize a contestant seat. Contestant and judge explicitly select one role. Poll `GET /api/pitch/queue` every four seconds. `DELETE` cancels only an unmatched entry. Responses have `idle`, `waiting`, `expired`, or `matched` status; matched includes the room. Two contestants and three judges must be present in the same age band, respecting blocks. Priority improves order, not guaranteed availability. Queues expire after 120 seconds.

Poll `GET /api/pitch/rooms/:code` every four seconds while participating. This is also the heartbeat. It returns the scenario snapshot, your assigned position, role/slot, participants, phase deadline, server time, visible text, result and feedback. Derive countdowns from serverTime/deadline. Speaking order is randomized. Phases: reveal 20s; A opening 60s; B opening 60s; A response 20s; B response 20s; judging 60s. A missing heartbeat for 60 seconds counts as leaving. Keep room polling active while the audio connection is active. Backgrounded mobile browsers may pause timers and count as disconnected.

| Round POST suffix | JSON body |
|---|---|
| `/response` | `{phase,content}`; optional text up to 1,200 characters, once during your own speaking phase |
| `/vote` | `{winnerId,a:{clarity,persuasiveness,composure,tip},b:{clarity,persuasiveness,composure,tip}}`; each score integer 1–5, each tip 12–400 characters |
| `/leave` | `{}`; contestant forfeits, unsubmitted judge receives reliability penalty, temporary queue ban |
| `/report` | `{targetId,reason,details}`; reason `harassment`, `unsafe-contact`, `abusive-feedback`, `cheating` or `other` |
| `/block` | `{targetId}`; prevents future matching; the UI also mutes their current audio locally |

Ballots are independent and private until resolution. Three judges use majority; two disagreeing judges use combined rubric totals, then draw if equal. Fewer than two judgments cancels without Elo. Finalization, both players' ratings, judge credits and room closure occur atomically. Repeat requests cannot award duplicate points or credits.

`POST /api/pitch/feedback` accepts `{ballotId,value:'helpful'|'unhelpful'|'abusive'}` from the feedback recipient only, once. Abusive feedback is hidden for that recipient and creates a report.

## Audio

`GET /api/pitch/voice` returns ICE configuration. Each participant exchanges directed `offer`, `answer`, `candidate` messages at `/api/pitch/rooms/:code/signals`: POST `{targetId,kind,payload}`; GET `?after=<cursor>` every two seconds. Access is restricted to active room members. Judges receive contestant audio and do not publish microphone tracks. The browser implementation is `prototype/voice.js`. It gates microphone tracks using the server timeline, reconnects connections and stops tracks when leaving. Peer connections cannot enforce turn-taking against a modified malicious client; an authoritative audio relay would be later infrastructure.

No recording, transcript generation, AI, voice changer or paid TURN service is provided. STUN-only audio may fail on restrictive networks; text participation remains available. Peer connections can reveal network addresses to the other participants; the privacy notice describes this.

## Reports

Set `PITCH_MODERATOR_IDS` to comma-separated IDs of actual approved moderator accounts, obtained from their authenticated `/me`. Until configured, reports are stored but no person can review them in this UI. `GET /api/pitch/reports` lists pending reports for moderators; POST `{id,decision:'upheld'|'dismissed'}` reviews one. Two upheld reports trigger a 24-hour queue ban. This is a prototype queue, not a staffed safety service or comprehensive language filter.

## Playtest

Use five accounts in separate browser profiles in the same age band: two contestants and three judges. Join within two minutes, enable audio, finish speaking turns, submit all three ballots, and check both Elo changes and feedback. Two completed judging rounds earn one contestant priority credit. Automated API tests cover the lifecycle; real device microphone behavior still requires this playtest.
