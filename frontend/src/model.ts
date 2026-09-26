import type { PitchRoomView, Session } from "../../shared/pitch"

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "P"
  )
}
export function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`
}
export function countdown(deadline: number, now: number) {
  const s = Math.max(0, Math.ceil((deadline - now) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}
export function savedSession(
  value: string | null,
  now = Date.now(),
): Session | null {
  try {
    const s = JSON.parse(value || "null")
    return s &&
      typeof s.token === "string" &&
      s.token.length > 0 &&
      typeof s.expiresAt === "number" &&
      s.expiresAt > now &&
      typeof s.player?.id === "string" &&
      typeof s.player?.name === "string"
      ? s
      : null
  } catch {
    return null
  }
}
/** A delayed poll must not undo an accepted ballot, submitted text or a final result. */
export function mergeRoom(
  current: PitchRoomView | null,
  incoming: PitchRoomView,
): PitchRoomView {
  if (!current || current.code !== incoming.code) return incoming
  if (
    current.serverTime > incoming.serverTime ||
    (current.status !== "active" && incoming.status === "active")
  )
    return current
  return {
    ...incoming,
    ballotSubmitted: current.ballotSubmitted || incoming.ballotSubmitted,
    left: current.left || incoming.left,
  }
}
export function canRespond(room: PitchRoomView, now: number) {
  return (
    room.status === "active" &&
    !room.left &&
    room.role === "contestant" &&
    room.phase.speaker === room.yourSlot &&
    now < room.phase.deadline &&
    !room.phase.expired
  )
}
export const skills = ["clarity", "persuasiveness", "composure"] as const
