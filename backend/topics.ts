export const TOPICS = [
  { id: 'cereal-soup', category: 'food', text: 'Cereal is soup.' },
  { id: 'pineapple-pizza', category: 'food', text: 'Pineapple belongs on pizza.' },
  { id: 'hotdog-sandwich', category: 'food', text: 'A hot dog is a sandwich.' },
  { id: 'breakfast-dinner', category: 'food', text: 'Breakfast food is better at dinner.' },
  { id: 'book-movie', category: 'culture', text: 'The book is always better than the movie.' },
  { id: 'spoilers', category: 'culture', text: 'Spoilers make stories more enjoyable.' },
  { id: 'group-projects', category: 'campus', text: 'Group projects should be optional.' },
  { id: 'morning-classes', category: 'campus', text: 'Classes should never start before 10 a.m.' },
  { id: 'cats-dogs', category: 'everyday', text: 'Cats make better roommates than dogs.' },
  { id: 'voice-notes', category: 'everyday', text: 'Voice notes are better than text messages.' },
  { id: 'sleep-socks', category: 'everyday', text: 'Sleeping with socks on is superior.' },
  { id: 'superpower', category: 'what-if', text: 'Teleportation is a better superpower than time travel.' },
] as const;
export const PHASES = ['opening', 'rebuttal', 'closing'] as const;
export const ROUND_SECONDS = [45, 45, 20] as const;
export const FORMATS = {
  classic: { name: 'Classic', roundSeconds: [45, 45, 20] },
  blitz: { name: 'Blitz', roundSeconds: [20, 20, 10] },
  extended: { name: 'Extended', roundSeconds: [90, 60, 30] },
} as const;
export type Format = keyof typeof FORMATS;
export const TUTORIALS = [
  { id: 'first-match', title: 'Your first match', steps: ['Tap Quick game to enter a flexible queue.', 'Public matches assign a topic and opposite sides at random.', 'Build your case in the opening, answer your opponent in the rebuttal, and finish with a closing statement.', 'The assigned human judge scores reasoning, rebuttal, and clarity.'] },
  { id: 'judging', title: 'Judge a match, earn priority', steps: ['Choose Judge to referee two contestants.', 'Read or listen to both sides. Judge the arguments, not whether you agree.', 'Submit one explained verdict after the closing round.', 'Completing a public match as judge earns one priority contestant ticket, used when you are matched.'] },
  { id: 'practice', title: 'Practice with the AI bot', steps: ['Choose a topic and format.', 'The bot receives the opposite side and the same word limits.', 'Complete all three rounds for AI feedback.', 'Practice matches never affect the public leaderboard or priority tickets.'] },
] as const;
