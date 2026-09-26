# PITCH Elo and judging

The current website uses `pitch-elo-v2`. Accounts start at 1,000 Elo. For each contestant, expected score is `1 / (1 + 10 ** ((opponentRating - rating) / 400))`. A win scores 1, draw 0.5, loss 0. The first ten rated rounds use K=32; subsequent rounds use K=16. The new rating is rounded to an integer with a floor of 100. K is per player, so changes can differ when an established contestant faces a provisional contestant.

Equal new contestants normally gain/lose 16. Winning against a stronger opponent earns more. Rubric scores decide a two-judge tie but do not inflate Elo directly. A forfeiting contestant takes the normal loss; their opponent receives only 25% of the normal winning change (4 points for two equal provisional players). Cancelled rounds are unrated. Each result and both rating entries are committed in one transaction with stale-snapshot and duplicate guards.

Quick matching starts within 150 Elo and widens by 200 every 20 seconds of waiting. The 120-second queue deadline remains enforced. Compatible age bands and blocks are always respected.

Judge reliability is separate from contestant Elo. It starts at 75/100. Agreement with the final winner adds 2, disagreement subtracts 1; recipient feedback adds 1 for helpful, subtracts 1 for unhelpful or 3 for abusive. Leaving before submitting subtracts 10. Values remain 0–100. Higher reliability receives preference for judge seats. This measures prototype consensus/helpfulness, not objective truth or judging expertise.

Two completed, normally judged rounds earn one priority contestant credit. Forfeits and cancelled rounds do not earn judging credits. Leaving gives a five-minute queue ban, escalating to ten minutes for repeated leaves within 24 hours.

The weekly leaderboard ranks net Elo earned since Monday 00:00 UTC, separated by age band, alongside lifetime Elo. The legacy `/api/ratings` routes preserve their earlier Beef rules for compatibility; new frontend code must use `/api/pitch`.
