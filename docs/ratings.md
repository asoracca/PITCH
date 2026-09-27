# PITCH Elo and judging

The current website uses `pitch-elo-v3`. Accounts start at 1,000 Elo. For each contestant, expected score is `1 / (1 + 10 ** ((opponentRating - rating) / 400))`. A win scores 1, draw 0.5, loss 0. The first ten rated rounds use K=32; subsequent rounds use K=16. The new rating is rounded to an integer with a floor of 100. K is per player, so changes can differ when an established contestant faces a provisional contestant.

Equal new contestants normally gain/lose 16. Winning against a stronger opponent earns more. Rubric scores decide a two-judge tie but do not inflate Elo directly. Leaving or disconnecting from a rated round deducts 10 Elo from the forfeiting contestant, limited by the 100-point floor; their opponent receives only 25% of the normal winning change (4 points for two equal provisional players). Cancelled rounds are unrated. Each result and both rating entries are committed in one transaction with stale-snapshot and duplicate guards.

Quick matching starts within 150 Elo and widens by 200 every 20 seconds of waiting. The queue counts down 30 seconds; two compatible contestants who opted in can start an unrated automated-rubric round at that deadline. One poll of grace handles the final match attempt. Topic compatibility and blocks are always respected; age does not split the queue.

Judge reliability is separate from contestant Elo. It starts at 75/100. Agreement with the final winner adds 2, disagreement subtracts 1; recipient feedback adds 1 for helpful, subtracts 1 for unhelpful or 3 for abusive. Leaving before submitting subtracts 10. Values remain 0–100. Higher reliability receives preference for judge seats. This measures prototype consensus/helpfulness, not objective truth or judging expertise.

Two completed, normally judged rounds earn one priority contestant credit. Forfeits and cancelled rounds do not earn judging credits. Explicitly leaving early gives a five-minute queue ban, escalating to ten minutes for repeated leaves within 24 hours.

The weekly leaderboard ranks net Elo earned since Monday 00:00 UTC, shared across age groups, alongside lifetime Elo. The legacy `/api/ratings` routes preserve their earlier Beef rules for compatibility; new frontend code must use `/api/pitch`.

Judges who miss the scoring deadline or lose their connection receive no automatic queue ban. Their absent ballot cannot affect Elo. Peer feedback remains available to contestants after the round without changing ratings.
