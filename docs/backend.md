# Backend integration

All paths begin with `/api`. JSON bodies require `Content-Type: application/json` and are limited to 8 KB. Times are Unix milliseconds. Errors have `{error: {code, message, requestId}}`.

## Quick game

1. `POST /sessions {"name":"Alex"}` creates a guest. Keep its token private and send `Authorization: Bearer TOKEN` on later requests. Sessions expire after 30 days; the database stores hashed tokens. `DELETE /sessions` revokes yours. These are guest identities, not verified or recoverable accounts.
2. `POST /queue {"mode":"quick","format":"classic"}` enters quick play. With a priority ticket, you enter as a priority contestant; otherwise you join a mixed pool that can fill either role. Explicit choices: `judge`, `contestant`, `priority`. A match requires two different contestants and one different human judge in the same format.
3. Poll `GET /queue` every 2 seconds. Status is `idle`, `waiting`, `matched`, or `timed_out`. Dedicated judges precede mixed judges; priority contestants precede standard contestants, then oldest entrants are preferred. A priority ticket is consumed only on successful matching. Cancelling or timing out costs no ticket.
4. Waiting expires after 120 seconds. Offer a fresh entry, switch to Judge, or leave. Do not promise an instant match when there are insufficient players. `DELETE /queue` cancels a waiting entry; it cannot cancel an assigned match. Cancel before selecting another format/mode.
5. The matched response includes room code, topic, side and role. Public matches randomize topics/sides and start on assignment, with an extra 10-second opening allowance. A separate ready check is follow-up work.
6. Poll `GET /rooms/CODE` every 2 seconds. When the deadline passes, call `POST /rooms/CODE/advance {}`. The server checks timing. Transitions require requests; there is no automatic scheduler.
7. Submit `POST /rooms/CODE/arguments {"round":0,"content":"My argument"}`. One immutable argument per contestant per round, up to 600 characters. An identical retry is safe. Both submissions or the timeout permit advancing. Current opposing arguments stay hidden until the phase closes. Judges cannot submit contestant arguments.
8. After round 2, only the assigned human judge can submit `POST /rooms/CODE/verdict`:

```json
{
  "summary": "The first contestant answered the main objection more directly.",
  "scores": [
    {"playerId":"FIRST_ID","reasoning":8,"rebuttal":8,"clarity":7,"feedback":"Use one example.","bestQuote":""},
    {"playerId":"SECOND_ID","reasoning":7,"rebuttal":6,"clarity":8,"feedback":"Address the opposing claim.","bestQuote":""}
  ]
}
```

Each category is an integer 0–10. The server computes `4 × reasoning + 4 × rebuttal + 2 × clarity`, out of 100; equal totals draw. Quotes must occur in that contestant's transcript or are removed. Players without arguments score zero. Verdict, score records, Beef Rating changes and one judge ticket commit atomically; duplicate verdicts cannot grant extra points or tickets. Completely empty games are cancelled without rewards. AI cannot replace an assigned human judge. See [Beef Rating rules and integration](ratings.md).

## Routes

| Method | Path | Purpose/body |
|---|---|---|
| GET | `/health` | Database readiness and AI configuration; public |
| GET | `/topics` | Topics, formats and rubric; public |
| GET | `/tutorials` | First-match, judging and practice lessons; public |
| POST / DELETE | `/sessions` | Create `{name}` / revoke guest session |
| GET | `/me` | Identity, priority-ticket balance and rating summary |
| GET | `/ratings/rules` | Beef Rating policy and constants; public |
| GET | `/ratings/me?limit=20` | Your rating and latest changes, limit 1–50 |
| POST / GET / DELETE | `/queue` | Join `{mode?,format?}`, poll, cancel waiting |
| GET | `/rooms?limit=20` | Your history, limit 1–50 |
| POST | `/rooms` | Private room `{topicId?,topic?,format?}` |
| POST | `/rooms/CODE/join` | Join waiting room `{}` |
| POST | `/rooms/CODE/start` | Host starts with two available contestants `{}` |
| GET | `/rooms/CODE` | Member-only room state and visible arguments |
| POST | `/rooms/CODE/arguments` | `{round,content}` |
| POST | `/rooms/CODE/advance` | Advance after deadline `{}` |
| POST | `/rooms/CODE/verdict` | Assigned human judge scores |
| POST | `/rooms/CODE/judge` | AI verdict for completed private/practice rounds `{}` |
| POST | `/rooms/CODE/rematch` | Private rematch reserved for prior contestants, sides swapped `{}` |
| POST | `/rooms/CODE/cancel` | Host cancels waiting room `{}` |
| POST | `/practice` | Start AI match `{topicId?,format?}` |
| POST | `/rooms/CODE/bot-turn` | Generate bot argument for current round `{}` |
| GET | `/leaderboard?limit=20` | Beef Rating standings with provisional labels, limit 1–50 |
| GET | `/voice` | ICE settings and voice integration status |
| POST | `/rooms/CODE/signals` | Send `{targetId,kind,payload}` |
| GET | `/rooms/CODE/signals?after=0` | Your incoming signals plus next cursor |

All except health, topics, tutorials, rating rules, service info and session creation require a session. A room code permits joining an available room, not reading private transcripts. Public means random matchmaking, not public transcripts.

## Formats and practice

Opening/rebuttal/closing timers: `classic` 45/45/20 seconds; `blitz` 20/20/10; `extended` 90/60/30. These are simultaneous text phases, not the future PRD's alternating speaking turns. Private custom topics allow 240 characters; public topics always come from the curated library. Open rooms expire after 24 hours.

Private/practice matches use optional AI judging and do not affect standings or earn tickets. Private rematches retain the format and swap sides. Judges cannot create contestant rematches; start a fresh practice match to replay a bot.

For practice, create the match and call `bot-turn` at the start of each phase. The bot sees only completed earlier rounds, never the current hidden human argument. After closing, call `judge`. AI uses server-side credentials, provider timeouts, rate limits, structured verdict validation and database leases against duplicate generation. Slow responses can miss the timer; refresh the room. Failed judging preserves arguments for retry. Without both `OPENAI_API_KEY` and `OPENAI_MODEL`, the API clearly reports configuration unavailable. Live AI quality/availability has not been verified without credentials.

## Voice and frontend

`client/beef-api.ts` provides a fetch helper and response types. It keeps the token in memory. Render all user content as text, never raw HTML. Allow exact frontend origins with `CORS_ORIGINS`. Private Sites hosting also requires Sites sign-in, so a standalone app cannot treat it as an unrestricted public API. Prefer same-origin integration or an authenticated proxy while privately testing.

Voice signaling is implemented; microphone capture, voice-changing DSP, playback/mute and reconnect UI are frontend work. Apply effects using Web Audio/AudioWorklet before attaching tracks to RTCPeerConnection. `voiceChangerImplemented` explicitly returns false. No audio is recorded by this backend.

Send offers/answers as `payload: {type:"offer",sdp:"..."}` or `answer`, and candidates as `RTCIceCandidate.toJSON()`. Only the intended recipient in the same room can retrieve messages. Poll with the returned cursor around every 1.5 seconds. Signals older than 10 minutes are excluded and cleaned on subsequent writes. Configure your STUN/TURN service through `VOICE_ICE_SERVERS`; internet connectivity is not assured without it. Production audio infrastructure and enforceable microphone permissions remain follow-up work.

Back off on 429/503 and while backgrounded. Refresh state on 409, start another match on 410, and create a new session on 401. Do not blindly retry uncertain room-creation requests; inspect history first. Limits: 120 authenticated requests/minute; 20 new sessions/IP/hour; 10 room creations/player/hour; 20 queue joins/player/minute; 60 voice signals/player/minute; additional paid-AI limits. IP-derived keys are hashed. Configure provider spending limits before broad access.

Guest sessions and casual standings do not prevent collusion or new-account evasion. Abandoned judges currently require waiting for room expiry; replacement, verified accounts, report/block and moderation are recorded in the follow-up plan.
