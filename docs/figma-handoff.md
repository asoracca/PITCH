# Figma Make → working PITCH frontend

Design reference: [Gamified Career Readiness Platform](https://www.figma.com/make/DzA4kriF9v04sf6MFGCKTL/Gamified-Career-Readiness-Platform).

**Review status:** the exported React source has been inspected and integrated from [Cassie's repository](https://github.com/CassieYu229/GamifiedCareer-ReadinessPlatform), commit `55a7221bf88194988519a3895ef3f769b1078d3a`. The running frontend is in `frontend/`. This review uses the actual exported source; the live Figma canvas itself was not accessible through the connector.

The supplied layout, colors, typography, navigation, landing page and character artwork are reused. Real account activity remains separate from explicitly labelled demo opponents, sample leaderboard entries and the optional 500-day profile preview. Auth, dashboard, queue, live rounds, scoring, results, profile history, leaderboard, report/block and moderator controls call the shared API. Speaking phases, winners and Elo remain server-authoritative. Navigation and refresh preserve the session; polling remains active while visiting another screen.

The design's five example scoring dimensions are replaced by the agreed three peer rubric dimensions (clarity, persuasiveness and composure, 1–5). Solo practice is unscored, with optional local voice/video recording, browser transcription and approximate delivery measurements. Free WebGPU transcript coaching loads only when requested; it does not hear audio or see faces. Character styles can be saved to the account. Video is available in live rounds; coins/XP/unlocks, general profile editing and earned badges remain follow-up work. Demo results never change real ratings.

## What is ready

- Shared, browser-safe response types in `shared/pitch.ts`.
- A typed client for every current PITCH endpoint in `client/pitch-api.ts`; `beef/src/pitch-api.ts` re-exports it for the Next.js team.
- Live contract discovery: `GET /api/pitch/config` reports `apiVersion: "pitch.v1"`, rules, scenarios and supported capabilities. Use its flags to hide unsupported features. Browser transcription and on-device coaching are optional client capabilities; server AI remains disabled. Google sign-in, password recovery, tournaments and voice effects are not enabled.
- Cancelable queue/room subscriptions, session-error handling, server-controlled results and a full real-database client integration test.
- Automatic deployment from `asoracca/Pitch` branch `backend/quick-match` to the existing Vercel website. GitHub CI checks backend and Next.js builds.

No paid service or second game server is required for this contract.

## Screen connections for the existing product

These connections are implemented in the imported frontend.

| UI interaction | Client method / source of truth |
|---|---|
| Create account / sign in / sign out | `signup`, `login`, `logout`; never store passwords or invent a login success |
| Dashboard rating, judge progress, priority credit | `me`; show real empty states for a new account |
| Scenario list | `config().scenarios`, filtered by the signed-in player's age band |
| Play / contestant / judge / priority | `queue(mode, allowSpectators, allowPeerMatch, category)`; the server selects real opponents with compatible topics across ages |
| Waiting screen | `watchQueue`; handle waiting, expired and matched explicitly |
| Round screen and countdown | `watchRoom`; use `room.phase.deadline` and `room.serverTime`, not a separate client phase schedule |
| Assigned side | `room.yourPosition`; do not randomize again on refresh |
| Submit optional text | `respond(code, phase.index, text)` during your speaking phase |
| Judge scorecard | `vote`; clarity, persuasiveness and composure each 1–5, plus a specific tip for BOTH contestants |
| Result and Elo animation | `room.result.ratingChanges`; animate the saved numbers without calculating a new rating locally |
| Feedback usefulness | `rateFeedback` |
| History / skill averages / category wins | `history`; the statistics cover the most recent 50 rated rounds |
| Save / delete solo practice | `savePractice`, `deletePractice`; private text/feedback/measurements only, never media |
| Weekly leaderboard | `leaderboard`; shared across age groups |
| Report / block / leave | `report`, `block`, `leave`; blocking also needs to mute that user's current audio in the UI |
| Microphone / playback | `voice`, `signals`, `sendSignal`, plus `frontend/src/voice.ts` for live media and `PracticeMicrophone.tsx` for solo recordings |
| Moderator reports | `reports`, `reviewReport`; only display when `me().moderator` is true |

Use the API's three-judge, five-participant model and two judged rounds per priority credit. Keep scripted demo opponents, chat and sample activity clearly labelled and separate from the real queue and ratings. Real-time audio and HTTP state polling are separate: microphone audio does not wait for four-second state polls.

## React wiring example

Create one `PitchApi` per client-side auth provider. Do not share a mutable token in a Next.js server module. `new PitchApi()` uses same-origin `/api/pitch`; this works in the integrated local server and the deployed prototype without exposing database credentials.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { PitchApi, type PitchRoomView } from './pitch-api'; // adjust the relative import

export function Round({ api, code }: { api: PitchApi; code: string }) {
  const [room, setRoom] = useState<PitchRoomView | null>(null);
  const [error, setError] = useState('');
  useEffect(() => api.watchRoom(code, {
    onUpdate: value => { setRoom(value); setError(''); },
    onError: value => setError(value instanceof Error ? value.message : 'Connection lost'),
  }), [api, code]); // cleanup aborts the request and stops future polling
  if (!room) return <p>{error || 'Joining round…'}</p>;
  return <section><h1>{room.scenario.title}</h1><p>{room.yourPosition}</p><p>{error}</p></section>;
}
```

After `signup` or `login`, the client holds the session token in memory. If persistence is desired, save only the returned token/expiry in sessionStorage and restore it into `api.token` on mount, then verify it with `me()`. Clear persisted storage on logout or a 401. A hosting sign-in page produces `HOST_SIGN_IN_REQUIRED`, which is different from a PITCH login error. No hosting bypass key belongs in the browser.

Call `queue(mode)` from a disabled-while-pending button, then subscribe with `watchQueue`. On `matched`, mount the round screen promptly and start `watchRoom` so heartbeats continue. Subscriptions stop on terminal state; unmounting alone does not send a leave or cancel request. Use explicit `cancelQueue` and `leave` for those actions. Stop microphone tracks and peer connections on leaving/unmounting.

Never automatically retry a POST after an ambiguous network failure. Read the current queue/room/profile state first. The API already makes votes, ratings and rewards repeat-safe, but the UI must still avoid concurrent double-click actions.

## What happens when Make connects to GitHub

Figma's standard Make integration creates its own repository and pushes to that repository's default branch. It does **not** connect directly to this existing backend branch. Its synchronization is one-way; later Make pushes can overwrite edits made in the generated repository. See [Figma's official instructions](https://help.figma.com/hc/en-us/articles/35463818346647-Push-from-Figma-Make-to-GitHub).

1. Push the changed Make design to its generated repository.
2. Compare against the recorded upstream commit in `frontend/IMPORT.md`; import the relevant visual changes into `frontend/`. Keep `src/usePitch.ts`, `src/Match.tsx`, shared API types and root server configuration intact unless the reviewed change requires an update.
3. Wire new interactions to real capabilities. Keep any labelled demo mode separate from real opponents and account data. Do not present canned replies as AI.
4. Run `pnpm check` and `pnpm build:vercel` with a local test database; review the scope and the new UI states.
5. Push the integrated result to `asoracca/Pitch` branch `backend/quick-match`. Native Vercel deployment updates the existing project. Publish the matching private Sites version as well.

The first import and build cutover are implemented. Root deployment now serves `frontend/dist`; `prototype/` is retained only as reference. Future Figma export pushes are **not** automatically merged into this integration repository. Do not repoint Vercel at the raw export repository, which has no PITCH API or database configuration.

## Acceptance checks before replacing the skeleton

- Real account creation, login, refresh/resume and logout, with meaningful errors.
- Five compatible accounts match; timed-out queues show a retry option.
- All participants see one server timeline; wrong-turn actions remain rejected.
- Three valid judge ballots yield one result and exactly one Elo update per contestant.
- Reloaded results, history, feedback, leaderboard and priority progress agree.
- Microphone permission denial, restrictive-network failure, disconnect, leave, block and report are handled.
- No browser bundle contains database credentials, hosting credentials or test identities; unsupported capability flags do not render fake working actions.
- The deployed design and API share the expected origin; direct deep links work; the source commit passes GitHub CI and matches Vercel.
