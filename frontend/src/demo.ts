import type { PitchLeaderboard, Scenario } from "../../shared/pitch"

// Fictional display profiles only. Never create login credentials, queue seats or rating events.
export const demoPlayers: PitchLeaderboard["players"] = [
  ["Maya Chen", 1384, 184], ["Leo Cruz", 1316, 152], ["Nora Patel", 1292, 128],
  ["Avery Brooks", 1256, 112], ["Sam Rivera", 1220, 96], ["Zoe Park", 1188, 80],
  ["Kai Morgan", 1164, 64], ["Isla Bennett", 1128, 48], ["Theo Lin", 1096, 32],
  ["Amara Ellis", 1068, 24], ["Riley Quinn", 1040, 16], ["Eli Torres", 1016, 8],
].map(([name, rating, weeklyGain], index) => ({ playerId: `demo-${index + 1}`, name: String(name), rating: Number(rating), weeklyGain: Number(weeklyGain), games: 24 - index, weeklyGames: 12 - Math.floor(index / 2) }))

export function demoScript(scenario: Scenario) {
  const opening: Record<string, string> = {
    career: "I would explain what I can contribute, give one concrete example, and ask what success would look like. Then I would agree on a realistic next step rather than promise more than I can deliver.",
    conflict: "I would describe what happened without blaming anyone, explain its impact, and ask for their perspective. I would suggest one specific change we can both agree to try.",
    money: "I would start with my budget and the trade-offs. I would compare a smaller option with the full cost, explain my limit clearly, and avoid committing before I understand the terms.",
    leadership: "I would ask the team what is blocking progress, make each person's responsibility clear, and agree on a deadline. I would check that everyone has the support they need before we move forward.",
    social: "I would explain how the situation made me feel using a specific example, then listen to the other person's perspective. I would ask for a clear change while leaving room for a compromise.",
  }
  return {
    a: opening[scenario.category] || opening.career,
    b: "I would lead with a question before suggesting a solution. There may be a constraint I haven't understood yet. Once I've listened, I'd explain my own needs and offer two practical options.",
    replyA: "Listening first matters. I would still make my own boundary clear, agree on one small action, and set a time to check whether it helped.",
    replyB: "A clear next step makes sense. I would also ask the other person to explain the agreement in their own words, so we leave with the same expectations.",
  }
}

export const demoSteps = [
  { title: "Scenario reveal", seconds: 5 },
  { title: "Your opening", seconds: 60 },
  { title: "Demo opponent’s opening", seconds: 12 },
  { title: "Your reply", seconds: 20 },
  { title: "Demo opponent’s reply", seconds: 8 },
  { title: "Demo judges are reviewing", seconds: 5 },
] as const
