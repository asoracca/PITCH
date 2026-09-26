# Figma Make source and integration

Source: https://github.com/CassieYu229/GamifiedCareer-ReadinessPlatform
Imported commit: `55a7221bf88194988519a3895ef3f769b1078d3a` (2026-09-26).

`src/index.css` is the original exported stylesheet. `src/design.tsx` reuses the original layout primitives, Home and character artwork, with sample claims removed or labeled as examples. `App.tsx`, `screens.tsx`, `Match.tsx` and `usePitch.ts` connect real backend data and user actions. `voice.ts` owns browser audio connections and cleanup.

The original export's Figma-only development plugins and `.figma` commands are not required on Vercel or Sites. The portable Vite config uses the same React/Tailwind stack. Root pnpm workspaces provide one locked install and both deployment builds. No database secrets belong here.

AI Coach/video, XP/coins/earned cosmetics, profile editing and badges are not enabled. Solo practice and character styling are explicitly local/unscored experiences. Multiplayer, ratings and peer feedback use the shared backend, with its approved age bands and three-dimension rubric.

Later Make exports must be reviewed and merged into this folder. Keep the connected controller files; do not replace them with the upstream simulation. The upstream Figma repository remains untouched by this integration.

Debate voice controls: **Enable voice** joins as a listener with the microphone off; contestants choose **Turn microphone on/off** independently. Turning the microphone off releases its device while listening continues. **Disable voice** closes all audio connections. Text responses remain available in either mode. Microphones transmit only during the contestant's speaking turns; judges only listen. Permission denial leaves listening/text usable. Audio is never recorded, and free peer-to-peer connections may need text fallback on restrictive networks. A five-person real-device audio playtest is still required.

`Pricing.tsx` presents the user-approved pricing preview: Free ($0; planned 3 matches/week plus judging credits), PITCH Pro ($6/month or $48/year), and Campus ($10/student/year, 500-seat minimum). The Plans page is public and accessible from the sidebar/header. The user explicitly chose pricing preview only: do not enforce quotas, collect payments, grant paid entitlements, or remove current prototype features. Pro/Campus benefits are planned, not a claim that subscriptions or campus analytics are implemented.

Practice Arena's **Random scenario** selects a different scenario within the signed-in age band and selected category. Manual selection remains available. Switching scenarios resets the timer and keeps per-scenario drafts in memory for the current visit; leaving the page clears them. Nothing from solo practice is uploaded.
