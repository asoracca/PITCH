# Figma Make source and integration

Source: https://github.com/CassieYu229/GamifiedCareer-ReadinessPlatform
Imported commit: `55a7221bf88194988519a3895ef3f769b1078d3a` (2026-09-26).

`src/index.css` is the original exported stylesheet. `src/design.tsx` reuses the original layout primitives, Home and character artwork, with sample claims removed or labeled as examples. `App.tsx`, `screens.tsx`, `Match.tsx` and `usePitch.ts` connect real backend data and user actions. `voice.ts` owns browser audio/video connections and cleanup.

The original export's Figma-only development plugins and `.figma` commands are not required on Vercel or Sites. The portable Vite config uses the same React/Tailwind stack. Root pnpm workspaces provide one locked install and both deployment builds. No database secrets belong here.

Optional on-device transcript coaching is available; XP/coins/earned cosmetics, general profile editing and earned badges are not enabled. Solo practice remains unscored, and avatars can be saved to the account. Multiplayer, ratings and peer feedback use the shared backend, with its approved age bands and three-dimension rubric.

Later Make exports must be reviewed and merged into this folder. Keep the connected controller files; do not replace them with the upstream simulation. The upstream Figma repository remains untouched by this integration.

Head-to-Head media controls: **Connect voice & video** joins with microphone and camera off. Contestants independently choose **Turn microphone on/off** and **Turn camera on/off**; judges watch and listen without publishing tracks. Microphones transmit only during speaking turns; enabled cameras stay visible until turned off. **Disconnect voice & video**, navigation and round end release devices and connections. Camera cancellation also releases late permission grants. No live media is recorded by PITCH. Text remains usable if permissions are denied or free STUN-only connections fail on restrictive networks. Real-device audio/video playtests are still required.

`Pricing.tsx` presents the user-approved pricing preview: Free ($0; planned 3 matches/week plus judging credits), PITCH Pro ($6/month or $48/year), and Campus ($10/student/year, 500-seat minimum). The Plans page is public and accessible from the sidebar/header. The user explicitly chose pricing preview only: do not enforce quotas, collect payments, grant paid entitlements, or remove current prototype features. Pro/Campus benefits are planned, not a claim that subscriptions or campus analytics are implemented.

Practice Arena's **Random scenario** selects a different scenario within the signed-in age band and selected category. Manual selection remains available. Switching scenarios resets the timer and keeps per-scenario drafts in memory for the current visit; leaving the page clears them. Nothing from solo practice is uploaded.

Practice now offers category chips, searchable scenario cards and 72 scenarios (24 per age band). The original 36 PRD prompts are preserved; `backend/pitch/extra-scenarios.ts` adds 36 user-requested prototype prompts. `PracticeMicrophone.tsx` records up to 60 seconds in memory through MediaRecorder, allows local playback/deletion, releases the microphone on stop/finish/navigation, and discards recordings when changing scenarios. This solo recording is separate from unrecorded multiplayer audio.

`demo.ts` contains 12 explicitly fictional display profiles. The leaderboard defaults to the labelled demo view only when real rankings are empty; its Real players tab always shows actual API results. No fake login credentials or rating events are created. Head-to-Head's **Play with demo players** runs a local scripted demonstration with a simulated opponent, three sample judges and an illustrative result, never AI evaluation or real Elo. **Watch public rounds** includes a labelled scripted spectator demo when nobody is playing.

Live spectating is read-only text/progress/results, without audio or video. Queue entrants can opt in to sharing their display names, finished-turn text and results with spectators across age groups. Every participant must opt in (five in a judged round, two in a practice duel); existing/private rounds remain private. Block relationships are checked in both directions, current-turn drafts and private judging feedback stay hidden, and watching never refreshes a seat or changes ratings. Queue polling stays active during spectating, and a match automatically replaces the spectator screen.


Two-player fallback is opt-in through `allowPeerMatch`; both contestants must wait 15 seconds. Five-person judged matching takes precedence. Duels use the same speaking timeline followed by a 60-second opponent-feedback window. Feedback is submitted once and revealed on completion, stored in `pitch_peer_feedback`, and returned separately in `history.peerHistory`; it never creates Elo events or judging credits. Leaving ends a duel without penalties.

Profile opens a clearly labelled demo activity view: 500-day streak, sample round history, judging and scores. **Real activity** shows unchanged API account records. The demo is presentation-only and its credits cannot enter matchmaking. Avatars start empty; **Create my avatar**, skin-tone/hair-color swatches, outfits and accessories preview locally and can be saved to the account. **Remove avatar** clears the visible character. Both PITCH logos return Home.

The coaching page also has local voice recording/playback through `PracticeMicrophone`. It provides optional browser transcription and on-device text feedback, without automated scores. No paid AI service is configured.


The practice review uses three short steps: Your words, Your delivery, Your feedback. Technical information is collapsed by default. One response field serves typing and transcription. Choosing Save practice stores response text, optional generated feedback and measurements; media stays in memory. Profile → Real activity shows private saved practices and automatic opponent matches. Profile → Demo profile includes fictional practice logs and named example opponents.

The crossed cream-and-cyan microphone logo was recreated from the user-supplied screenshot on 2026-09-26 as `public/pitch-mark.svg`, replacing the letter P in the shared Home link and the browser icon. This is a screenshot-based recreation, not an import from a newly verified Figma export. The previous upstream repository URL returned 404 when checked; future upstream changes still require a reviewed import.
