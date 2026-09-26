# Figma Make → working PITCH frontend

Design reference: [Gamified Career Readiness Platform](https://www.figma.com/make/DzA4kriF9v04sf6MFGCKTL/Gamified-Career-Readiness-Platform).

**Review status:** the design itself has not yet been inspected. Browser policy verification blocked access and a Figma connection is pending. The integration kit below covers the implemented PRD. It does not certify that every screen or interaction in the Figma file is implemented.

## What is ready

- Shared, browser-safe response types in `shared/pitch.ts`.
- A typed client for every current PITCH endpoint in `client/pitch-api.ts`; `beef/src/pitch-api.ts` re-exports it for the Next.js team.
- Live contract discovery: `GET /api/pitch/config` reports `apiVersion: "pitch.v1"`, rules, scenarios and supported capabilities. Use its flags to hide unsupported features. AI, Google sign-in, password recovery, video, tournaments and voice effects are not currently enabled.
- Cancelable queue/room subscriptions, session-error handling, server-controlled results and a full real-database client integration test.
- Automatic deployment from `asoracca/Pitch` branch `backend/quick-match` to the existing Vercel website. GitHub CI checks backend and Next.js builds.

No paid service or second game server is required for this contract.

## Screen connections for the existing product

This maps implemented behavior; it is not a claim about what the unseen Figma file contains.

| UI interaction | Client method / source of truth |
|---|---|
| Create account / sign in / sign out | `signup`, `login`, `logout`; never store passwords or invent a login success |
| Dashboard rating, judge progress, priority credit | `me`; show real empty states for a new account |
| Scenario list | `config().scenarios`, filtered by the signed-in player's age band |
| Play / contestant / judge / priority | `queue(mode)`; do not select an opponent or generate a match in the browser |
| Waiting screen | `watchQueue`; handle waiting, expired and matched explicitly |
| Round screen and countdown | `watchRoom`; use `room.phase.deadline` and `room.serverTime`, not a separate client phase schedule |
| Assigned side | `room.yourPosition`; do not randomize again on refresh |
| Submit optional text | `respond(code, phase.index, text)` during your speaking phase |
| Judge scorecard | `vote`; clarity, persuasiveness and composure each 1–5, plus a specific tip for BOTH contestants |
| Result and Elo animation | `room.result.ratingChanges`; animate the saved numbers without calculating a new rating locally |
| Feedback usefulness | `rateFeedback` |
| History / skill averages / category wins | `history`; the statistics cover the most recent 50 rated rounds |
| Weekly leaderboard | `leaderboard`; respects age bands |
| Report / block / leave | `report`, `block`, `leave`; blocking also needs to mute that user's current audio in the UI |
| Microphone / playback | `voice`, `signals`, `sendSignal`, plus `prototype/voice.js` as the existing browser implementation |
| Moderator reports | `reports`, `reviewReport`; only display when `me().moderator` is true |

Use the API's three-judge, five-participant model and two judged rounds per priority credit. Do not keep hardcoded demo scores, fake queue opponents, AI claims or simulated winners in the integrated UI. Real-time audio and HTTP state polling are separate: microphone audio does not wait for four-second state polls.

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

1. Finish the design interactions and export/push from Make. Send the generated repository link.
2. Inspect the actual generated framework, screens, data models and fake/demo state. Import the frontend into `asoracca/Pitch` without replacing the root backend, migrations, secrets configuration or teammate server.
3. Connect its actions to the client above and review any design/API gaps. Layout and visual labels can change freely; new persistence or game rules require backend implementation.
4. Select that frontend's real build output for Vercel and test its routes, assets and content-security policy. Currently `vercel.json` still serves `prototype/`. Merely adding files under `beef/` or another folder does not replace the live UI.
5. Run a five-person integrated playtest, then push the reviewed integration to `backend/quick-match`. Vercel automatically builds and deploys that push.

The deployment cutover is deliberately pending until the exported code is available. Do not point the live project at an empty folder or remove the API rewrite. If the export uses Vite or Next.js, choose the corresponding build after inspection; do not assume a framework from a screenshot or URL.

Future design exports need to be imported/merged into the integrated branch. A separate Make export repository is not automatically synchronized with this backend repository. Do not edit or enable another hosting project just to make a preview look connected.

## Acceptance checks before replacing the skeleton

- Real account creation, login, refresh/resume and logout, with meaningful errors.
- Five compatible accounts match; timed-out queues show a retry option.
- All participants see one server timeline; wrong-turn actions remain rejected.
- Three valid judge ballots yield one result and exactly one Elo update per contestant.
- Reloaded results, history, feedback, leaderboard and priority progress agree.
- Microphone permission denial, restrictive-network failure, disconnect, leave, block and report are handled.
- No browser bundle contains database credentials, hosting credentials or test identities; unsupported capability flags do not render fake working actions.
- The deployed design and API share the expected origin; direct deep links work; the source commit passes GitHub CI and matches Vercel.
