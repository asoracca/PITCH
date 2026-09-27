# PITCH prototype check · September 26, 2026

This is a targeted check of the current prototype, not a guarantee that every browser, device or possible workflow is bug-free. No production users or credentials were exported. All account and data changes used the local test database.

## Confirmed bugs fixed

| Issue | What happened | Fix |
| --- | --- | --- |
| Head-to-Head topics looked unclickable | The category state changed, but its selected style was missing. | The selected topic now has a cyan highlight and keeps its accessible pressed state. The chosen category was verified in the queue request. |
| Solo demo did not transcribe speech | The recorder was mounted without transcription or a connection to the response field. | Browser transcription is enabled by default, with live words in the editable response field. |
| Final words could disappear | A turn change unmounted the recorder before speech recognition finished. | Finishing or timing out waits for the final transcript, with a bounded fallback for pending words. |
| Speech errors were hidden | A text filter suppressed unsupported-browser and speech-service error messages. | These messages are now visible. The app no longer inserts “Voice response practiced locally” as a response. |
| Denied microphone permission erased typed work | Starting a microphone request cleared the response before permission was granted. | Existing text survives denied or cancelled permission. A successfully started new recording replaces the response. |
| Dashboard category cards ignored the category | Every card opened Practice with the default filter. | The selected category now carries into Practice. “View all” restores all categories. |
| Section titles were not semantic headings | Titles looked like headings but were generic elements. | Shared section titles now use heading elements for screen-reader navigation. |

## Verified

- All 60 automated tests passed, including authentication, topic matching, one/three human judges, two-minute unrated fallback, ratings, saved practices, public-round permissions, friends, blocking and server adapters.
- Frontend regression tests passed again after final edits. Both project type checks and the production build passed.
- Browser checks: visible topic selection, queue/cancel, solo demo live text, manual and timed turn completion, practice save/history/delete, and all three guided-coach turns.
- Ten routes rendered at 390px and 1440px without horizontal scrolling or browser exceptions.
- Wardrobe: all 24 allowed options, Randomize, Reset, save/reload, remove/reload and reduced motion passed. Existing avatar schema and save endpoint are unchanged. No dependencies were added.

Speech tests used simulated recognition events and a synthetic microphone stream. They verify the app wiring, timing and error handling, not real-world recognition accuracy or the user's Safari settings.

## Remaining prototype limits

- Live transcription depends on browser speech support, permissions and the browser vendor's service. Actual speech on Safari and other devices still needs an in-person check.
- Real multiplayer voice/video is separate from solo-demo transcription. Live multiplayer voice does not automatically become a submitted written response.
- Voice/video connections across different networks have not been verified by this browser audit.
- Optional on-device AI requires WebGPU, memory and an initial model download of about 1 GB. Actual model loading and generation were not exercised in this audit. The guided coach uses scripted replies.
- Solo demo opponents, judges, results and sample profile activity remain clearly labelled simulations. The automated fallback judge uses a text rubric and does not award Elo.
- Saved practice logs retain text, feedback and delivery measurements. Recordings are temporary, and the coach does not evaluate vocal emotion or faces.
