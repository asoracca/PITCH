# Beef Rating v1

Beef Rating is the website prototype's contestant skill metric. It is inspired by opponent strength and early rating adjustment in [Chess.com's rating system](https://support.chess.com/en/articles/8566476-how-do-ratings-work-on-chess-com). Chess.com uses Glicko, including rating deviation. Beef uses its own simpler Elo policy; these ratings are not comparable to chess ratings and do not implement Glicko or inactivity-based uncertainty.

## Rules

- Everyone starts at **1,000 BR**. Their first **five rated games** are placements; show a “Provisional” label until all five finish.
- Only completed public matches with the assigned human judge count. All three timer formats share one pool for this prototype.
- The existing debate rubric determines the result: reasoning 40%, rebuttal 40%, clarity 20%. Equal totals draw.
- Win = 1, draw = 0.5, loss = 0. Larger score margins do not award extra rating points; this reduces incentives to inflate a judge's scores.
- Private debates, bot practice, judging, cancelled games and completely empty games do not change contestant ratings. A valid completed public game with only one active contestant still uses the result; the absent contestant's debate score is zero.
- There is no inactivity decay or streak bonus. Judging earns a priority ticket separately.

For each contestant, using both ratings **before** the result:

```text
expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400))
K = 40 for the first five rated games; 24 thereafter
change = round(K × (result - expected))
newRating = max(100, rating + change)
```

Rounding is to the nearest integer, with halves away from zero. Each player's own placement status sets their K, so the two changes can differ when only one player is provisional. The floor can also prevent a full deduction. Actual `delta` always equals `after - before`. A draw counts toward placements even when the rating does not move.

| Before | Result | Change during placements |
|---|---|---|
| 1,000 vs 1,000 | Win | +20 |
| 1,000 vs 1,000 | Loss | −20 |
| 800 vs 1,200 | Win | +36 |
| 1,200 vs 800 | Win | +4 |
| 800 vs 1,200 | Draw | +16 |

Two established 1,000-rated players exchange 12 points for a decisive result. These are fixed examples, not promised changes for every match.

## Website integration

Use the existing session bearer token. All paths below start with `/api`.

- `GET /ratings/rules` returns the public, versioned policy (`br-v1`).
- `GET /me` adds `rating: {value, games, provisional, placementGamesRemaining, version}`. New players read as 1,000 with zero games.
- `GET /ratings/me?limit=20` returns the same rating plus the requesting player's latest changes. Limit is 1–50. Each entry includes `roomId`, `roomCode`, `format`, `opponentId`, `opponentName`, `opponentRating`, `before`, `after`, `delta`, `gamesAfter`, `result`, `expectedScore`, `k`, `version`, and `createdAt`.
- Finished public rooms expose `verdict.ratingChanges`, one entry per contestant. Display the entry with `playerId === yourPlayerId`, for example **1,020 BR (+20)**. Entries also expose `gamesBefore`, `gamesAfter`, `provisional`, and the inputs used for calculation. Old, private and practice verdicts may omit `ratingChanges`; treat that as unrated, not zero points awarded.
- `GET /leaderboard` now returns `ranking: "beef_rating"`, `ratingVersion: "br-v1"`, and players sorted by rating, then rated games, then player ID. Rows include `rating`, `provisional`, `matches`, `wins`, `losses`, `draws` and `averageScore`. Show the provisional label; the prototype includes players after their first rated game. Match statistics cover games rated under this system.

The server calculates all changes. Clients cannot submit ratings, deltas or winner IDs. Refresh on `409 RATING_CHANGED` and retry the verdict; an already finished match returns the saved result without another award. Matchmaking still respects role, earned priority and waiting order; rating-based opponent selection is future work.

## Persistence and limits

The additive migration creates `player_ratings` and `rating_events` without rewriting existing players or match records. Games completed before this feature are left unchanged; everyone starts the new rating pool at 1,000. There is no retroactive replay or reset of prior results.

A single D1 transaction saves the verdict, score records, both rating events, updated ratings and judge ticket. The room claim compares the pre-match rating snapshots; a competing or stale request cannot overwrite newer ratings. Each player/match and each player/game number can have only one rating event. A failed write rolls back the whole transaction.

This is a prototype rating attached to guest identities. Creating a new session creates a fresh identity; sessions are not recoverable accounts. Collusion detection, repeated-opponent restrictions, appeals/corrections, independent judges and separate Fair Play standing remain follow-up work. Do not treat the prototype leaderboard as a fraud-resistant competitive ranking.
