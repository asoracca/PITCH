# Figma Make source and integration

Source: https://github.com/CassieYu229/GamifiedCareer-ReadinessPlatform
Imported commit: `55a7221bf88194988519a3895ef3f769b1078d3a` (2026-09-26).

`src/index.css` is the original exported stylesheet. `src/design.tsx` reuses the original layout primitives, Home and character artwork, with sample claims removed or labeled as examples. `App.tsx`, `screens.tsx`, `Match.tsx` and `usePitch.ts` connect real backend data and user actions. `voice.ts` owns browser audio connections and cleanup.

The original export's Figma-only development plugins and `.figma` commands are not required on Vercel or Sites. The portable Vite config uses the same React/Tailwind stack. Root pnpm workspaces provide one locked install and both deployment builds. No database secrets belong here.

AI Coach/video, XP/coins/earned cosmetics, profile editing and badges are not enabled. Solo practice and character styling are explicitly local/unscored experiences. Multiplayer, ratings and peer feedback use the shared backend, with its approved age bands and three-dimension rubric.

Later Make exports must be reviewed and merged into this folder. Keep the connected controller files; do not replace them with the upstream simulation. The upstream Figma repository remains untouched by this integration.
