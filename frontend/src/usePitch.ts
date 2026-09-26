import { useCallback, useEffect, useRef, useState } from "react"
import {
  PitchApi,
  type PitchConfig,
  type PitchHistory,
  type PitchLeaderboard,
  type PitchMe,
  type PitchQueue,
  type PitchRoomView,
  type QueueMode,
  type Session,
  type Signup,
} from "../../client/pitch-api"
import { mergeRoom, savedSession } from "./model"

const storageKey = "pitch.session"
function remember(session: Session | null) {
  try {
    if (session) sessionStorage.setItem(storageKey, JSON.stringify(session))
    else sessionStorage.removeItem(storageKey)
  } catch {
    /* In-memory sessions still work when browser storage is unavailable. */
  }
}
export function usePitch() {
  const [api] = useState(() => new PitchApi())
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<PitchMe | null>(null)
  const [config, setConfig] = useState<PitchConfig | null>(null)
  const [history, setHistory] = useState<PitchHistory | null>(null)
  const [leaders, setLeaders] = useState<PitchLeaderboard | null>(null)
  const [queue, setQueue] = useState<PitchQueue>({
    status: "idle",
    serverTime: 0,
  })
  const [room, setRoom] = useState<PitchRoomView | null>(null)
  const [booting, setBooting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const command = useRef(false)
  const clearSession = useCallback(() => {
    api.token = null
    remember(null)
    setSession(null)
    setMe(null)
    setHistory(null)
    setLeaders(null)
    setRoom(null)
    setQueue({ status: "idle", serverTime: 0 })
  }, [api])
  const onError = useCallback(
    (e: unknown) => {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      )
      if (!api.token) clearSession()
    },
    [api, clearSession],
  )
  const acceptRoom = useCallback(
    (next: PitchRoomView) => setRoom((current) => mergeRoom(current, next)),
    [],
  )
  const acceptQueue = useCallback(
    (next: PitchQueue) => {
      setQueue(next)
      if (next.status === "matched") acceptRoom(next.room)
    },
    [acceptRoom],
  )
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const token = api.token
      const [profile, rounds, weekly] = await Promise.all([
        api.me({ signal }),
        api.history({ signal }),
        api.leaderboard({ signal }),
      ])
      if (signal?.aborted || token !== api.token) return
      setMe(profile)
      setHistory(rounds)
      setLeaders(weekly)
    },
    [api],
  )
  const act = useCallback(
    async (work: () => Promise<void>) => {
      if (command.current) return
      command.current = true
      setBusy(true)
      setError("")
      setNotice("")
      try {
        await work()
      } catch (e) {
        onError(e)
      } finally {
        command.current = false
        setBusy(false)
      }
    },
    [onError],
  )
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    void api
      .config({ signal })
      .then((value) => {
        if (!signal.aborted) setConfig(value)
      })
      .catch((e) => {
        if (!signal.aborted) onError(e)
      })
    let stored: Session | null = null
    try {
      stored = savedSession(sessionStorage.getItem(storageKey))
    } catch {
      /* Storage is optional. */
    }
    if (!stored) {
      setBooting(false)
      return () => controller.abort()
    }
    api.token = stored.token
    setSession(stored)
    void (async () => {
      await refresh(signal)
      const q = await api.queue(undefined, { signal })
      if (!signal.aborted) acceptQueue(q)
    })()
      .catch((e) => {
        if (!signal.aborted) onError(e)
      })
      .finally(() => {
        if (!signal.aborted) setBooting(false)
      })
    return () => controller.abort()
  }, [api, refresh, acceptQueue, onError])
  useEffect(() => {
    if (session && queue.status === "waiting")
      return api.watchQueue({ onUpdate: acceptQueue, onError })
  }, [api, session, queue.status, acceptQueue, onError])
  useEffect(() => {
    if (session && room?.status === "active" && !room.left)
      return api.watchRoom(room.code, { onUpdate: acceptRoom, onError })
  }, [api, session, room?.code, room?.status, room?.left, acceptRoom, onError])
  useEffect(() => {
    if (!session || !room || (room.status === "active" && !room.left)) return
    const controller = new AbortController()
    void refresh(controller.signal).catch((e) => {
      if (!controller.signal.aborted) onError(e)
    })
    return () => controller.abort()
  }, [session, room?.code, room?.status, room?.left, refresh, onError])
  // Polling lives above page navigation so visiting a profile never disconnects a live seat.
  useEffect(() => {
    if (
      queue.status !== "waiting" &&
      !(room?.status === "active" && !room.left)
    )
      return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [queue.status, room?.status, room?.left])
  async function authenticate(
    details: Signup | { email: string; password: string },
  ) {
    await act(async () => {
      const next =
        "name" in details
          ? await api.signup(details)
          : await api.login(details.email, details.password)
      remember(next)
      setSession(next)
      await refresh()
      acceptQueue(await api.queue())
    })
  }
  async function join(mode: QueueMode) {
    await act(async () => {
      acceptQueue(await api.queue(mode))
    })
  }
  async function logout() {
    await act(async () => {
      if (queue.status === "waiting") {
        const q = await api.cancelQueue()
        acceptQueue(q)
        if (
          q.status === "matched" &&
          q.room.status === "active" &&
          !q.room.left
        ) {
          setNotice(
            "A round just started. Leave or finish the round before signing out.",
          )
          return
        }
      }
      try {
        await api.logout()
      } finally {
        clearSession()
      }
    })
  }
  return {
    api,
    session,
    me,
    config,
    history,
    leaders,
    queue,
    room,
    booting,
    busy,
    error,
    notice,
    setError,
    setNotice,
    act,
    refresh,
    authenticate,
    join,
    logout,
    acceptRoom,
    acceptQueue,
    clearRoom: () => setRoom(null),
  }
}
export type Pitch = ReturnType<typeof usePitch>
