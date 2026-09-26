# PITCH API and frontend handoff

The current product uses `/api/pitch` with the `pitch.v1` contract. See [the Figma frontend handoff](figma-handoff.md) for screen wiring and the export/deployment steps. The older Beef routes remain available for compatibility, with separate game/ratings tables; do not mix their guest tokens, room IDs, rating rules or UI contracts with PITCH.

Use the same origin as the website. `client/pitch-api.ts` is the small browser client; it keeps a token in memory unless the UI explicitly persists it. The skeleton uses sessionStorage. Send `Authorization: Bearer <session token>` on authenticated requests and JSON on writes. Responses use `{error:{code,message}}` with HTTP status codes. Server timestamps are UTC milliseconds. No database or hosting secret belongs in frontend code.

## Accounts and discovery

| Method/path | Body or behavior |
|---|---|
| GET `/api/health` | Checks the database; no authentication |
| GET `/api/pitch/config` | API version, supported capability flags, rules, timeline and 108 scenario definitions |
| GET `/api/pitch/spectate` | Active public rounds across ages; excludes blocked participants |
| GET `/api/pitch/spectate/:code` | Read-only public round progress, finished-turn text and final aggregate result; no private tips, ballots, audio or video |
| POST `/api/pitch/signup` | `{name,email,password,birthDate,acceptedConduct:true}`; ISO birth date, 12–128 character password; returns `{player,token,expiresAt}` |
| POST `/api/pitch/login` | `{email,password}`; same session response |
| POST `/api/pitch/logout` | Revokes this token |
| GET `/api/pitch/me` | Rating, judge reliability, priority credits, bans, blocked players, age band, saved avatar, active room and moderator flag |
| GET `/api/pitch/history` | Last 50 rated rounds with opponent names, own feedback, rubric averages, category win rates, recent unrated duels and last 50 saved solo practices |
| GET `/api/pitch/leaderboard` | Top 30 across ages by net Elo earned since Monday 00:00 UTC, with lifetime Elo alongside |

Birth dates and email addresses are never exposed to other players. There is no email delivery, verification or recovery service. Passwords are salted/hashed; session secrets are stored as hashes and expire after 30 days. Age bands use self-declared dates, not identity verification.

## Queue and round lifecycle

`POST /api/pitch/queue` accepts `{mode:'quick'|'contestant'|'judge'|'priority'|'mixed',allowSpectators?:boolean,allowPeerMatch?:boolean,category?:'all'|'career'|'conflict'|'money'|'leadership'|'social'}`. Quick and mixed fill either role; with an earned credit they prioritize a contestant seat. Contestant and judge explicitly select one role. Poll `GET /api/pitch/queue` every four seconds. `DELETE` cancels only an unmatched entry. Responses have `idle`, `waiting`, `expired`, or `matched` status; matched includes the room. Rated rounds require two contestants and three judges with compatible topic choices, respecting blocks. Age does not separate queues. `all` is a wildcard; otherwise every participant must choose the same category. Mixed-age rooms use a scenario from the youngest participant’s content band. Cancel and rejoin to change a queued topic. If both contestants opted into `allowPeerMatch` and have waited at least 15 seconds, they can start an unrated two-player duel. Judged matching is attempted first. Public spectating requires unanimous `allowSpectators` consent; both flags default false for API clients. Priority improves order, not guaranteed availability. Queues expire after 120 seconds.

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

`GET /api/pitch/voice` returns ICE configuration. Each participant exchanges directed `offer`, `answer`, `candidate` messages at `/api/pitch/rooms/:code/signals`: POST `{targetId,kind,payload}`; GET `?after=<cursor>` every two seconds. Access is restricted to active room members. Judges receive contestant audio/video and do not publish microphone or camera tracks. The integrated browser implementation is `frontend/src/voice.ts`; the older `prototype/voice.js` remains audio-only. It gates microphone tracks using the server timeline, reconnects connections and stops tracks when leaving. Peer connections cannot enforce turn-taking against a modified malicious client; an authoritative audio relay would be later infrastructure.

Live media is not recorded by PITCH. Solo practice/coaching clips are local in-memory recordings only. Optional browser speech recognition generates an editable live transcript and may use the browser vendor’s speech service; PITCH does not upload the recording. A user-triggered WebLLM coach downloads Qwen2.5-1.5B-Instruct to a WebGPU-capable device and evaluates the transcript locally. Recording levels, pauses and pace are approximate measurements, not emotion or personality analysis. No paid AI, voice changer or TURN service is provided. STUN-only audio/video may fail on restrictive networks; text participation remains available. Peer connections can reveal network addresses to the other participants; the privacy notice describes this.

## Reports

Set `PITCH_MODERATOR_IDS` to comma-separated IDs of actual approved moderator accounts, obtained from their authenticated `/me`. Until configured, reports are stored but no person can review them in this UI. `GET /api/pitch/reports` lists pending reports for moderators; POST `{id,decision:'upheld'|'dismissed'}` reviews one. Two upheld reports trigger a 24-hour queue ban. This is a prototype queue, not a staffed safety service or comprehensive language filter.

## Playtest

For rated matching, use five accounts in separate browser profiles with the same topic (or Any topic): two contestants and three judges. Join within two minutes, enable audio, finish speaking turns, submit all three ballots, and check both Elo changes and feedback. Two completed judging rounds earn one contestant priority credit. For a two-player playtest, use two accounts with compatible topics, enable the unrated fallback, queue together and wait 15 seconds. Turn on cameras and microphones separately. Automated API tests cover both lifecycles, consent, feedback privacy, concurrent claims, no-Elo practice, and signal size limits; physical device and cross-network media still require a playtest.


## Two-player practice and public spectating

`PitchRoomView.judgingMode` is `judged` or `peer`. POST `/api/pitch/rooms/:code/peer-feedback` accepts `{clarity,persuasiveness,composure,tip}` with scores 1–5 and a constructive tip. Only the two contestants can submit, once each, during the final 60-second feedback window. The round resolves after both submit or the window ends. Incoming feedback stays hidden until resolution. `POST /api/pitch/feedback` also supports these feedback IDs; only the recipient can rate/report a tip. `/history` keeps unrated `peerHistory` separate from rated history and averages. No practice feedback changes Elo, judge reliability or priority credits.

Migrations 0004 and 0005 add private-by-default public-consent fields, peer-match consent/mode and the opponent-feedback table. Existing rounds retain their original judged/private behavior. Signal requests alone accept up to 32 KB JSON / 24,000-character SDP for audio+video negotiation; other API requests retain the 8 KB limit.


## Avatars and opponent chat

`POST /api/pitch/avatar` accepts `{avatar:{avatarEnabled,outfit,accessory,background,skinTone,hairColor}}`, validated against the presets in `shared/avatar.ts`. It changes only the authenticated account. `/me`, leaderboard rows and room participants expose this appearance; unset avatars remain blank. Migration 0006 adds the avatar field, queue topic and chat table.

`GET /api/pitch/rooms/:code/chat` returns `{messages,canSend}` for contestants only. Judges, spectators and outsiders cannot read it. POST `{kind:'message'|'reaction',content,requestId}` sends a message of up to 300 characters or an allowed reaction. Generate a unique request ID for each send; duplicates do not create another message. Twelve new messages per minute are allowed. The existing basic contact/abuse filter applies. Chat closes when a contestant leaves, someone blocks the other, or the round ends. Blocking hides chat in both directions. Previous chat is readable after completion by its contestants. Chat is separate from scoring submissions and is not an Elo input.

Frontend `browserTranscription` and `onDeviceCoaching` capability flags describe optional browser features. Server `aiPractice` and `transcripts` remain false: no server AI or automatic transcript upload is enabled; text is stored only when the user chooses Save practice. The on-device coach needs a manual load, WebGPU, roughly 1 GB download and sufficient GPU memory (model configuration estimates about 1.6 GB). It is experimental and device dependent. Automated tests cover transcription lifecycle, recording cancellation, delivery calculations and prompt boundaries; they do not validate model inference on physical hardware.


## Saved solo practices

Migration 0007 adds `pitch_practice_logs`. POST `/api/pitch/practice` accepts `{id,scenarioId,transcript,feedback,delivery}`. `id` is a client-generated UUID per attempt; the scenario must exist in the catalog. Transcript is 1–6,000 characters, optional feedback at most 2,000, and delivery is null or bounded approximate recording measurements. The server saves a scenario snapshot and timestamps. Repeating an ID updates that account’s existing practice; it cannot move the entry to a different scenario. Client measurements and feedback are self-reported practice data, never rating inputs.

GET `/api/pitch/practice` and `/history.practices` return only the authenticated account’s latest 50 entries. DELETE `/api/pitch/practice/:id` removes only that account’s entry and is safe to repeat. No audio or video is uploaded or stored. The UI makes saving explicit; changes after saving can update the same entry. A new recording or Try again begins a new attempt. Demo profile logs are separate static examples and never inserted into the database.
