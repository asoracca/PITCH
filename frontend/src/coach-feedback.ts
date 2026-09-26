export interface FeedbackSection { kind: 'strength' | 'improve' | 'example' | 'notes'; title: string; text: string }

/** Recognize the requested headings, but keep unexpected output intact as notes. */
export function coachFeedback(text: string): FeedbackSection[] {
  const clean = text.trim().replace(/\*\*([^*\n]+)\*\*/g, '$1')
  const headings = [...clean.matchAll(/(?:^|\n)[ \t]*(?:#{1,4}[ \t]*|[-*•][ \t]*|\d+[.)][ \t]*)?(What worked|Strength|Try next|Improve|Example|Try saying)[ \t]*(?::[ \t]*|\r?\n)/gi)]
  const types = (title: string): FeedbackSection['kind'] => /^(what worked|strength)$/i.test(title) ? 'strength' : /^(try next|improve)$/i.test(title) ? 'improve' : 'example'
  if (headings.length !== 3 || new Set(headings.map(h => types(h[1]))).size !== 3 || clean.slice(0, headings[0].index).trim()) {
    return clean ? [{ kind: 'notes', title: 'Coach’s notes', text: clean }] : []
  }
  const sections = headings.map((heading, i) => {
    const kind = types(heading[1])
    return { kind, title: kind === 'strength' ? 'What worked' : kind === 'improve' ? 'Try next' : 'Try saying this',
      text: clean.slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? clean.length).trim() }
  })
  return sections.every(s => s.text) ? sections : [{ kind: 'notes', title: 'Coach’s notes', text: clean }]
}
