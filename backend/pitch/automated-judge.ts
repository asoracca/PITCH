/** Transparent prototype checks on submitted text. No AI, audio inference or Elo. */
export function assessText(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const unique = new Set(words.map(word => word.toLowerCase().replace(/[^a-z0-9]/g,''))).size
  const enough = words.length >= 12 && unique >= 8
  const checks = {
    clarity: enough && /[.!?]/.test(text),
    specificity: enough && /\b(for example|for instance|when|because|result|last|yesterday|project|\d+)\b/i.test(text),
    nextStep: enough && /\b(i will|i would|i can|i could|let's|let us|could we|can we|next|plan|agree|follow up|by friday|tomorrow)\b/i.test(text),
  }
  const total = Object.values(checks).filter(Boolean).length
  const tip = !enough ? 'Add a few sentences explaining your response.' : !checks.specificity ? 'Give one concrete example to support your point.' : !checks.nextStep ? 'Finish with a clear action or request.' : !checks.clarity ? 'Use complete sentences to make your response easier to follow.' : 'You included an example and a next step. Check that both fit the scenario.'
  return { checks, total, tip, hasText: words.length > 0 }
}
export function automatedResult(aId: string, bId: string, responses: { player_id: string; content: string }[]) {
  const assessed = [aId,bId].map(playerId => ({ playerId, ...assessText(responses.filter(r => r.player_id === playerId).map(r => r.content).join('\n')) }))
  const winnerId = assessed.every(a => a.hasText) && assessed[0].total !== assessed[1].total ? (assessed[0].total > assessed[1].total ? aId : bId) : null
  return { winnerId, voteCount: 1, reason: 'automated_practice', ratingChanges: [], ratingVersion: 'unrated',
    scores: assessed.map(a => ({ playerId: a.playerId, votes: a.playerId === winnerId ? 1 : 0, averages: null })),
    automatedFeedback: assessed.map(({playerId,checks,tip}) => ({ playerId, checks, tip })),
  }
}
