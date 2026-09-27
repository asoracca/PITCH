import { MatchSettings, readMatchPreferences, type MatchPreferences } from './MatchSettings'
import { LiveResponse } from "./LiveResponse"
import { PlayerLink } from "./PlayerProfiles"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Button, Icon, SectionTitle, AvatarBadge } from "./design"
import { countdown, canRespond, initials, signed, skills } from "./model"
import { FeedbackButtons, Rules } from "./screens"
import { LiveAudio, audioOff } from "./voice"
import { TOPICS, PITCH_LEAVE_ELO_PENALTY } from "../../shared/pitch"
import { OpponentChat } from "./OpponentChat"
import { LobbyMedia } from "./lobby-media"
import { DemoMatch } from "./DemoMatch"
import { Spectate } from "./Spectate"
import type { Pitch } from "./usePitch"
import type {
  PitchRoomView,
  QueueMode,
  ReportReason,
  Rubric,
  Scenario,
} from "../../shared/pitch"

function useServerNow(serverTime: number) {
  const [clock, setClock] = useState(() => ({
    now: Date.now(),
    offset: (serverTime || Date.now()) - Date.now(),
  }))
  useEffect(() => {
    setClock({
      now: Date.now(),
      offset: (serverTime || Date.now()) - Date.now(),
    })
  }, [serverTime])
  useEffect(() => {
    const id = setInterval(
      () => setClock((c) => ({ ...c, now: Date.now() })),
      500,
    )
    return () => clearInterval(id)
  }, [])
  return clock.now + clock.offset
}
export function Match({ p }: { p: Pitch }) {
  const [category, setCategory] = useState("all")
  const [mode, setMode] = useState<QueueMode>("quick")
  const [demo, setDemo] = useState<Scenario | null>(null)
  const [preferences,setPreferences]=useState(()=>readMatchPreferences(p.me!.player.id))
  const [settingsOpen,setSettingsOpen]=useState(false)
  const allowSpectators=preferences.spectators,allowPeerMatch=preferences.fallback
  const useMic=preferences.microphone,useCamera=preferences.camera
  function savePreferences(value:MatchPreferences){setPreferences(value);try{localStorage.setItem(`pitch.match-settings.${p.me!.player.id}`,JSON.stringify(value))}catch{}}
  const [lobbyMedia] = useState(() => new LobbyMedia())
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const joining = useRef(0)
  useEffect(() => () => { joining.current++; lobbyMedia.stop() }, [lobbyMedia])
  useEffect(() => {
    if (!p.room && p.queue.status !== 'waiting') { lobbyMedia.stop(); setLobbyStream(null) }
  }, [lobbyMedia, p.queue.status, p.room?.code])
  async function findRound() {
    const request = ++joining.current
    setPreparing(true); setMediaError('')
    try {
      const stream = await lobbyMedia.prepare(mode !== 'judge' && useMic, mode !== 'judge' && useCamera)
      if (joining.current !== request) return
      setLobbyStream(stream)
      const joined = await p.join(mode, allowSpectators, allowPeerMatch && mode !== 'judge' && mode !== 'priority', category)
      if (!joined) { lobbyMedia.stop(); setLobbyStream(null) }
    } catch (error) {
      if (joining.current === request) setMediaError(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Permission denied. Allow camera and mic, or switch them off to use text.' : 'Camera or mic unavailable. Switch off the unavailable device and retry.')
    } finally { if (joining.current === request) setPreparing(false) }
  }
  const now = useServerNow(p.queue.serverTime)
  if (p.room) return <Round key={p.room.code} p={p} room={p.room} lobbyMedia={lobbyMedia} />
  if (demo) return <DemoMatch scenario={demo} name={p.me!.player.name} avatar={p.me!.avatar} onClose={() => setDemo(null)} />
  const waiting = p.queue.status === "waiting"
  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="HEAD-TO-HEAD · PEER JUDGED"
        title="One scenario. Two responses."
      />
      {!waiting && <section className="panel demo-invite">
        <div><div className="eyebrow">TRY IT NOW · NO WAIT</div><h2 className="heading">Play a demo match</h2><p>Face a scripted opponent and three simulated judges. Practice with voice or text. No Elo changes.</p></div>
        <Button onClick={() => {
          const scenarios = p.config!.scenarios.filter((s) => s.band === p.me!.ageBand && (category === "all" || s.category === category))
          setDemo(scenarios[Math.floor(Math.random() * scenarios.length)] || null)
        }}>Play with demo players <Icon name="play" /></Button>
      </section>}
      <div className="matchup-intro">
        <div className="matchup-player">
          {waiting && lobbyStream?.getVideoTracks().length ? <div className="lobby-camera"><RemoteVideo stream={lobbyStream} name="Your preview" /></div> : <AvatarBadge name={p.me!.player.name} look={p.me!.avatar} size="xl" />}
          <span>YOU</span>
          <strong>{p.me!.player.name}</strong>
          <small>{p.me!.rating.value} PITCH Elo</small>
        </div>
        <div className="matchup-vs">
          <span>{waiting ? "FINDING YOUR ROUND" : "QUICK PLAY"}</span>
          <strong>VS</strong>
          <small>Two contestants · Judges when available</small>
        </div>
        <div className="matchup-player">
          <div className="avatar avatar-xl avatar-alt">
            <Icon name="user" size={34} />
          </div>
          <span>YOUR NEXT OPPONENT</span>
          <strong>{waiting ? "Searching…" : "Ready when you are"}</strong>
          <small>Matched by topic and skill · all age groups</small>
        </div>
      </div>
      {waiting ? (
        <div className="panel form-stack" role="status">
          <h2 className="heading">Finding your round…</h2>
          <p>{p.queue.status === "waiting" ? p.queue.message : ""}</p>
          <strong className="giant-timer">
            {p.queue.status === "waiting"
              ? countdown(p.queue.expiresAt, now)
              : ""}
          </strong>
          <p>{lobbyStream ? `Ready: ${[lobbyStream.getAudioTracks().length ? 'microphone' : '', lobbyStream.getVideoTracks().length ? 'camera' : ''].filter(Boolean).join(' + ')}. Only you can see this preview.` : 'Text mode. Audio connects when matched.'}</p>
          <Button
            variant="secondary"
            disabled={p.busy}
            onClick={() => {
              void p.act(async () => {
                p.acceptQueue(await p.api.cancelQueue())
              })
            }}
          >
            Cancel queue
          </Button>
        </div>
      ) : (
        <div className="panel form-stack">
          {p.queue.status === "expired" && (
            <p role="status">{p.queue.message}</p>
          )}
          <fieldset className="topic-options"><legend>Choose your topic</legend><div className="category-chips">{TOPICS.map(topic=><button type="button" key={topic.id} className="category-chip" aria-pressed={category===topic.id} onClick={()=>setCategory(topic.id)}>{topic.label}</button>)}</div><small>Any topic matches all categories. Friends: choose the same topic.</small></fieldset>
          <fieldset className="queue-options">
            <legend>Choose how to play</legend>
            {([
              [
                "quick",
                "Quick play",
                "Fill a contestant or judge seat. Priority credits favor a contestant seat.",
              ],
              ["contestant", "Contestant", "Wait for a speaking seat."],
              [
                "judge",
                "Judge",
                "Listen, score and earn progress toward priority.",
              ],
              [
                "priority",
                "Priority contestant",
                `${p.me!.priorityCredits} credits available.`,
              ],
            ] as const).map(([value, label, description]) => (
              <label
                key={value}
                className={`queue-option ${mode === value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="queue-mode"
                  value={value}
                  checked={mode === value}
                  disabled={value === "priority" && !p.me!.priorityCredits}
                  onChange={() => setMode(value)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="match-settings-link"><Button variant="secondary" onClick={()=>setSettingsOpen(true)} disabled={preparing}>Match settings</Button><small>{mode==='judge'?'Listen & score':`${useMic?'Mic on':'Mic off'} · ${useCamera?'Camera on':'Camera off'}`} · {allowSpectators?'Public if everyone agrees':'Private'}</small></div>
          {mediaError && <p role="alert">{mediaError}</p>}
          {p.me!.bannedUntil > Date.now() && (
            <p>
              Queue break until{" "}
              {new Date(p.me!.bannedUntil).toLocaleTimeString()}.
            </p>
          )}
          <Button
            disabled={p.busy || preparing || p.me!.bannedUntil > Date.now()}
            onClick={() => { void findRound() }}
          >
            {preparing ? 'Setting up camera & mic…' : 'Find a round'}
            <Icon name="bolt" />
          </Button>
          {preparing && <Button variant="ghost" onClick={() => { joining.current++; lobbyMedia.stop(); setLobbyStream(null); setPreparing(false) }}>Cancel setup</Button>}
          <details className="review-details"><summary>Matching rules</summary><p>Two contestants; one or three human judges. Optional automated fallback after 30 seconds. No opponent? The queue closes.</p></details>
        </div>
      )}
      {settingsOpen&&<MatchSettings preferences={preferences} onChange={savePreferences} onClose={()=>setSettingsOpen(false)}/>}
      <Spectate p={p} />
      <Rules compact />
    </div>
  )
}

function RemoteVideo({ stream, name }: { stream: MediaStream | null; name: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [needsPlay, setNeedsPlay] = useState(false)
  useEffect(() => {
    const element = video.current!
    let cancelled = false
    setNeedsPlay(false)
    element.srcObject = stream
    if (stream) void element.play().catch(() => { if (!cancelled) setNeedsPlay(true) })
    return () => { cancelled = true; element.pause(); element.srcObject = null }
  }, [stream])
  return <><video ref={video} hidden={!stream} autoPlay playsInline muted aria-label={`${name}'s live camera`} />{stream && needsPlay && <button className="video-play" onClick={() => { void video.current?.play().then(() => setNeedsPlay(false)).catch(() => {}) }}>Play video</button>}</>
}

function AudioControls({
  p,
  room,
  now,
  lobbyMedia,
  onTransmitting,
}: {
  p: Pitch
  room: PitchRoomView
  now: number
  lobbyMedia: LobbyMedia
  onTransmitting: (value: boolean) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLVideoElement>(null)
  const audio = useRef<LiveAudio | null>(null)
  const startRequest = useRef<AbortController | null>(null)
  const latestRoom = useRef(room)
  latestRoom.current = room
  const [state, setState] = useState(audioOff)
  const [error, setError] = useState("")
  const [starting, setStarting] = useState(false)
  const [remoteVideos, setRemoteVideos] = useState<Record<string, MediaStream | null>>({})
  useEffect(() => {
    let mounted = true
    const connection = new LiveAudio(p.api, container.current!, (v) => {
      if (mounted) setState(v)
    }, preview.current ?? undefined, (id, stream) => {
      if (mounted) setRemoteVideos(current => current[id] === stream ? current : { ...current, [id]: stream })
    })
    audio.current = connection
    if (room.status === 'active' && !room.left) void start()
    const release = () => { startRequest.current?.abort(); startRequest.current = null; connection.stop(); setStarting(false) }
    window.addEventListener("pagehide", release)
    return () => {
      window.removeEventListener("pagehide", release)
      mounted = false
      startRequest.current?.abort()
      startRequest.current = null
      connection.stop()
      audio.current = null
    }
  }, [p.api, room.code])
  useEffect(() => {
    audio.current?.sync(room, now)
  }, [room, now])
  useEffect(() => {
    audio.current?.setBlocked(p.me?.blockedPlayers.map((v) => v.id) || [])
  }, [p.me?.blockedPlayers])
  async function start() {
    if (startRequest.current || !audio.current) return
    const request = new AbortController()
    const connection = audio.current
    startRequest.current = request
    setStarting(true)
    setError("")
    try {
      const config = await p.api.voice({ signal: request.signal })
      if (request.signal.aborted || audio.current !== connection) return
      await connection.start(latestRoom.current, p.me!.player.id, config, p.config!.rules.phases, lobbyMedia.take())
    } catch (e) {
      if (!request.signal.aborted)
        setError(e instanceof Error ? e.message : "Voice could not connect. You can still use text.")
    } finally {
      if (startRequest.current === request) {
        startRequest.current = null
        setStarting(false)
      }
    }
  }
  function stop() {
    startRequest.current?.abort()
    startRequest.current = null
    audio.current?.stop()
    setStarting(false)
    setError("")
  }
  const micOn = state.microphone === "on"
  const micPending = state.microphone === "requesting"
  const cameraOn = state.camera === "on"
  const cameraPending = state.camera === "requesting"
  useEffect(() => { onTransmitting(state.transmitting); return () => onTransmitting(false) }, [state.transmitting, onTransmitting])
  const active = room.status === "active" && !room.left
  const players = room.participants.filter(v => v.role === 'contestant').sort((a,b) => a.slot-b.slot)
  return (
    <>
    <div className="matchup-intro live-matchup" aria-label="Contestants">
      {players.map(player => {
        const self = player.id === p.me!.player.id
        const hasVideo = active && (self ? cameraOn : !!remoteVideos[player.id])
        const speaking = active && room.phase.speaker === player.slot
        return <div aria-label={`${player.name}${speaking ? ", speaking now" : ""}`} className={`matchup-player live-player${speaking ? ' is-speaking' : ''}`} key={player.id}>
          <div className="match-camera">
            {self ? <video ref={preview} className="self-video" hidden={!hasVideo} muted autoPlay playsInline aria-label="Your live camera" /> : <RemoteVideo stream={active ? remoteVideos[player.id] ?? null : null} name={player.name} />}
            {!hasVideo && <div className="match-avatar"><AvatarBadge name={player.name} look={player.avatar} size="xl" /><span>{player.left ? 'Left round' : 'Camera off'}</span></div>}
            {hasVideo && <span className="camera-live">LIVE</span>}
          </div>
          <div className="live-player-caption"><PlayerLink player={player}><strong>{player.name}{self ? ' · You' : ''}</strong></PlayerLink><span>{player.left ? 'Left' : speaking ? 'Speaking' : `Contestant ${player.slot ? 'B' : 'A'}`}</span></div>
        </div>
      })}
    </div>
    {active && <section className="audio-controls round-audio" aria-label="Call controls">
      <div className="call-status" role="status"><span className={state.connected ? 'positive' : ''}>{starting || (state.enabled && !state.connected) ? 'Connecting…' : state.enabled ? `Connected · ${state.connected}/${state.participants}` : 'Disconnected'}</span>{room.role==='contestant'&&<small>{state.transmitting ? 'Mic live' : micOn ? 'Mic waits for your turn' : 'Mic off'}</small>}</div>
      <div className="call-buttons">
        {room.role === 'contestant' && <>
          <Button variant="secondary" disabled={!state.enabled || starting} aria-pressed={micOn} onClick={() => micOn || micPending ? audio.current?.disableMicrophone() : void audio.current?.enableMicrophone()}><Icon name="mic"/>{micPending ? 'Cancel mic' : micOn ? 'Mic on' : 'Mic off'}</Button>
          <Button variant="secondary" disabled={!state.enabled || starting} aria-pressed={cameraOn} onClick={() => cameraOn || cameraPending ? audio.current?.disableCamera() : void audio.current?.enableCamera()}>{cameraPending ? 'Cancel camera' : cameraOn ? 'Camera on' : 'Camera off'}</Button>
        </>}
        {state.needsPlayback && <Button onClick={() => void audio.current?.play()}>Enable sound</Button>}
        <Button variant="ghost" onClick={() => state.enabled || starting ? stop() : void start()}>{starting ? 'Cancel' : state.enabled ? 'Disconnect' : 'Connect'}</Button>
      </div>
      {(error || state.message) && <p role="alert">{error || state.message}</p>}
    </section>}
    <div ref={container} className="round-audio-streams" aria-hidden="true" />
    </>
  )
}


function PeerScorecard({ p, room, now }: { p: Pitch; room: PitchRoomView; now: number }) {
  const [feedback, setFeedback] = useState<Rubric>({ clarity: 3, persuasiveness: 3, composure: 3, tip: "" })
  const open = room.role === "contestant" && !room.peerFeedbackSubmitted && (room.status !== "active" || (!room.left && room.phase.key === "judging"))
  const opponent = room.participants.find((person) => person.role === "contestant" && person.id !== p.me!.player.id)
  return <form className="panel form-stack" onSubmit={(event) => {
    event.preventDefault()
    if (open) void p.act(async () => { p.acceptRoom(await p.api.peerFeedback(room.code, feedback)) })
  }}>
    <h2 className="heading">Feedback for {opponent?.name}</h2>
    <p>{room.peerFeedbackSubmitted ? "Feedback saved." : "Private to your opponent · no Elo change"}</p>
    <div className="peer-score-fields">{skills.map((skill) => <label key={skill} className="capitalize">{skill}<select value={feedback[skill]} disabled={!open || p.busy} onChange={(event) => setFeedback({ ...feedback, [skill]: Number(event.target.value) })}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}/5</option>)}</select></label>)}</div>
    <label>One constructive tip<textarea value={feedback.tip} disabled={!open || p.busy} minLength={12} maxLength={400} required onChange={(event) => setFeedback({ ...feedback, tip: event.target.value })} placeholder="Name one thing they did well and one useful next step." /></label>
    <Button type="submit" disabled={!open || p.busy || feedback.tip.trim().length < 12}>Send opponent feedback</Button>
  </form>
}

function Scorecard({
  p,
  room,
  now,
}: {
  p: Pitch
  room: PitchRoomView
  now: number
}) {
  const contestants = room.participants
    .filter((v) => v.role === "contestant")
    .sort((a, b) => a.slot - b.slot)
  const [winner, setWinner] = useState("")
  const empty: Rubric = { clarity: 3, persuasiveness: 3, composure: 3, tip: "" }
  const [scores, setScores] = useState<[Rubric, Rubric]>([
    { ...empty },
    { ...empty },
  ])
  const open =
    room.status === "active" &&
    !room.left &&
    room.phase.key === "judging" &&
    now < room.phase.deadline &&
    !room.phase.expired &&
    !room.ballotSubmitted
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!open) return
    void p.act(async () => {
      p.acceptRoom(
        await p.api.vote(room.code, {
          winnerId: winner,
          a: scores[0],
          b: scores[1],
        }),
      )
    })
  }
  if (room.ballotSubmitted)
    return (
      <div className="panel" role="status">
        <h2 className="heading">Your scorecard is saved.</h2>
        <p>
          Waiting for the other judges. Your vote stays private until the
          result.
        </p>
      </div>
    )
  return (
    <form className="panel form-stack" onSubmit={submit}>
      <SectionTitle
        eyebrow="JUDGE SCORECARD"
        title={open ? "Make your call." : "Listen, then score."}
      />
      <p>
        Scores use a 1–5 scale. Give a constructive tip to both contestants.
        Voting opens after all speaking turns.
      </p>
      <div className="judge-grid">
        {contestants.map((v, i) => (
          <fieldset
            key={v.id}
            className="form-stack"
            disabled={!open || p.busy}
          >
            <legend>{v.name}</legend>
            {skills.map((k) => (
              <label key={k} className="capitalize">
                {k}
                <select
                  value={scores[i][k]}
                  onChange={(e) =>
                    setScores(
                      (current) =>
                        current.map((s, index) =>
                          index === i
                            ? { ...s, [k]: Number(e.target.value) }
                            : s,
                        ) as [Rubric, Rubric],
                    )
                  }
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option value={n} key={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              One specific tip
              <textarea
                value={scores[i].tip}
                minLength={12}
                maxLength={400}
                required
                onChange={(e) =>
                  setScores(
                    (current) =>
                      current.map((s, index) =>
                        index === i ? { ...s, tip: e.target.value } : s,
                      ) as [Rubric, Rubric],
                  )
                }
              />
            </label>
          </fieldset>
        ))}
      </div>
      <label>
        Who made the stronger case?
        <select
          value={winner}
          required
          disabled={!open || p.busy}
          onChange={(e) => setWinner(e.target.value)}
        >
          <option value="">Choose a contestant</option>
          {contestants.map((v) => (
            <option value={v.id} key={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={!open || p.busy}>
        Submit scorecard
        <Icon name="gavel" />
      </Button>
    </form>
  )
}

function Safety({ p, room }: { p: Pitch; room: PitchRoomView }) {
  const [target, setTarget] = useState("")
  const [reason, setReason] = useState<ReportReason>("other")
  const [details, setDetails] = useState("")
  return (
    <details className="panel">
      <summary>Report or block a participant</summary>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault()
          void p.act(async () => {
            await p.api.report(room.code, target, reason, details)
            p.setNotice("Report saved for project moderators.")
          })
        }}
      >
        <label>
          Participant
          <select
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choose a participant</option>
            {room.participants
              .filter((v) => v.id !== p.me!.player.id)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
          >
            {([
              "harassment",
              "unsafe-contact",
              "abusive-feedback",
              "cheating",
              "other",
            ] as const).map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Details
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            required
            minLength={5}
          />
        </label>
        <div className="hero-actions">
          <Button type="submit" disabled={p.busy || !target}>
            Submit report
          </Button>
          <Button
            variant="secondary"
            disabled={
              p.busy ||
              !target ||
              p.me!.blockedPlayers.some((v) => v.id === target)
            }
            onClick={() => {
              void p.act(async () => {
                await p.api.block(room.code, target)
                await p.refresh()
                p.setNotice(
                  "Participant blocked. Their audio is muted and video hidden, and future matching will avoid them.",
                )
              })
            }}
          >
            Block participant
          </Button>
        </div>
        <p>
          Reports need a configured human moderator. For immediate relief, block
          the participant or leave the round.
        </p>
      </form>
    </details>
  )
}

function LeaveRoundDialog({ p, room, open, onClose }: { p: Pitch; room: PitchRoomView; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])
  const rated = room.judgingMode === 'judged'
  const contestant = room.role === 'contestant'
  const loss = Math.min(p.config?.rules.leaveEloPenalty ?? PITCH_LEAVE_ELO_PENALTY, Math.max(0, (p.me?.rating.value ?? 1000) - (p.config?.rules.floor ?? 100)))
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={event => { event.preventDefault(); if (!p.busy) onClose() }}>
    <h2 id="leave-title">Leave this round?</h2>
    <p id="leave-description">{!rated ? 'This ends the practice duel. No Elo change.' : contestant ? `You forfeit and lose ${loss} Elo. A 5–10 minute queue break also applies.` : 'Leaving before scoring costs 10 reliability points and a 5–10 minute queue break. Your Elo stays the same.'}</p>
    {rated && contestant && <div className="leave-elo"><strong>−{loss}</strong><span>Elo</span></div>}
    {p.error && <p role="alert">{p.error}</p>}
    <div className="hero-actions"><Button autoFocus disabled={p.busy} onClick={onClose}>Stay in round</Button><Button variant="secondary" className="leave-round-button" disabled={p.busy} onClick={() => {
      void p.act(async () => { p.acceptRoom(await p.api.leave(room.code)); onClose(); await p.refresh() })
    }}>{p.busy ? 'Leaving…' : 'Leave round'}</Button></div>
  </dialog>
}

function RoundOutcome({ p, room }: { p: Pitch; room: PitchRoomView }) {
  const result = room.result!
  const unrated = !result.ratingChanges.length
  const reason = result.reason === 'insufficient_judges' ? 'Not enough judge scorecards. Elo unchanged.' : result.reason === 'forfeit' ? 'Round ended by forfeit.' : result.reason === 'automated_practice' ? 'Automated text checks. Elo unchanged.' : result.reason === 'peer_practice' ? 'Opponent feedback. Elo unchanged.' : result.reason.replaceAll('_', ' ')
  return <section className="round-outcome" aria-label="Round results">
    <header className="outcome-heading"><div><div className="eyebrow">{unrated ? 'UNRATED' : 'ROUND COMPLETE'}</div><h2 className="heading">{unrated ? 'Round summary' : 'Your results'}</h2><p>{reason}</p></div><span className="outcome-votes"><Icon name="gavel" />{result.voteCount} {result.voteCount === 1 ? 'scorecard' : 'scorecards'}</span></header>
    <div className="outcome-players">{result.scores.map(score => {
      const player = room.participants.find(v => v.id === score.playerId)!
      const change = result.ratingChanges.find(v => v.playerId === score.playerId)
      const checks = result.automatedFeedback?.find(v => v.playerId === score.playerId)
      const winner = result.winnerId === score.playerId
      return <article className={`outcome-player${winner ? ' is-winner' : ''}`} key={score.playerId}>
        <header><PlayerLink player={player}><AvatarBadge name={player.name} look={player.avatar} /><strong>{player.name}{player.id === p.me!.player.id ? ' · You' : ''}</strong></PlayerLink>{winner && <span className="winner-badge"><Icon name="trophy" size={14} />Winner</span>}</header>
        <div className="elo-result">{change ? <><strong className={change.delta >= 0 ? 'positive' : 'negative'}>{signed(change.delta)}<small>Elo</small></strong><span>{change.before}<Icon name="arrow" size={16} />{change.after}</span></> : <span className="elo-unchanged">Elo unchanged</span>}</div>
        {score.averages && !checks && <dl className="outcome-skills">{skills.map(skill => {
          const value = score.averages?.[skill]
          return value == null ? null : <div key={skill}><dt className="capitalize">{skill}</dt><dd><meter min={0} max={5} value={value} aria-label={skill} /><strong>{value.toFixed(1)}<small>/5</small></strong></dd></div>
        })}</dl>}
        {checks && <div className="outcome-checks"><p>{checks.tip}</p><ul>{Object.entries(checks.checks).map(([key, value]) => <li key={key}><span aria-hidden="true">{value ? '✓' : '○'}</span>{key === 'nextStep' ? 'Next step' : key === 'specificity' ? 'Example' : 'Structure'}<span className="check-status">{value ? 'Found' : 'Try adding'}</span></li>)}</ul></div>}
      </article>
    })}</div>
    <div className="round-feedback"><h3>Feedback</h3>{room.feedback.length ? room.feedback.map((feedback,index) => <article className="round-feedback-item" key={`${feedback.ballotId}-${feedback.playerId}`}><div className="feedback-source"><Icon name="gavel" size={18} /><span>{room.judgingMode === 'judged' ? `Judge ${index + 1}` : 'Your opponent'}{room.role === 'judge' ? ` · For ${room.participants.find(v => v.id === feedback.playerId)?.name}` : ''}</span></div><blockquote>{feedback.tip}</blockquote><FeedbackButtons p={p} id={feedback.ballotId} rating={feedback.rating} /></article>) : <p className="feedback-empty">{result.voteCount ? 'No written feedback this round.' : 'No scorecards submitted.'}</p>}</div>
  </section>
}

function Round({ p, room, lobbyMedia }: { p: Pitch; room: PitchRoomView; lobbyMedia: LobbyMedia }) {
  const now = useServerNow(room.serverTime)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [transmitting, setTransmitting] = useState(false)
  const [tab,setTab] = useState('round')
  const active = room.status === "active" && !room.left
  const peer = room.judgingMode !== 'judged'
  const canFeedback = room.role === 'contestant' && (!active || room.phase.key === 'judging')
  const speaker = room.participants.find(v=>v.role==='contestant'&&v.slot===room.phase.speaker)
  const turn = !active ? room.status==='cancelled'?'Round ended':'Round complete' : speaker ? `${speaker.id===p.me!.player.id?'Your':speaker.name+"’s"} ${room.phase.index<3?'opening':'response'}` : room.phase.key==='judging' ? peer?'Exchange feedback':'Judges are scoring' : 'Read the scenario'
  useEffect(()=>{setTab('round')},[room.phase.index,room.status])
  // Completed rounds can receive peer feedback later. Keep that private view current.
  useEffect(()=>{
    if(active)return
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>
    async function poll(){try{const value=await p.api.room(room.code,{signal:controller.signal});if(!controller.signal.aborted)p.acceptRoom(value)}catch{}finally{if(!controller.signal.aborted)timer=setTimeout(()=>void poll(),5000)}}
    timer=setTimeout(()=>void poll(),5000);return()=>{controller.abort();clearTimeout(timer)}
  },[active,p.api,p.acceptRoom,room.code])
  const tabs=[['round',active?(room.phase.key==='judging'?'Feedback':'Your turn'):'Results'],['responses','Responses'],...(canFeedback?[['peer','Peer feedback']]:[]),...(room.role==='contestant'?[['chat','Chat']]:[]),['details','Details']] as const
  return <div className="round-workspace">
    <header className="round-header"><div><span className="eyebrow">{room.role==='judge'?'JUDGING':'HEAD-TO-HEAD'} · {room.code}</span><h1>{turn}</h1></div><div className="round-heading-actions"><strong className="countdown"><Icon name="clock"/>{active?countdown(room.phase.deadline,now):'Saved'}</strong>{active?<Button variant="secondary" className="leave-round-button" onClick={()=>setConfirmLeave(true)}>Leave</Button>:<Button variant="secondary" onClick={p.clearRoom}>Back</Button>}</div></header>
    <section className="round-scenario" aria-label="Scenario"><div><span className="capitalize">{room.scenario.category}</span><strong>{room.scenario.title}</strong></div><p>{room.scenario.prompt}</p>{room.yourPosition&&room.scenario.positions&&<small>Your position: {room.yourPosition}</small>}</section>
    <div className={`round-desk${room.role==='contestant'?' with-chat':''}`}>
      <div className="round-stage">
        <div className="round-media"><AudioControls p={p} room={room} now={now} lobbyMedia={lobbyMedia} onTransmitting={setTransmitting}/></div>
        <div className="round-progress" aria-label="Round progress">{p.config!.rules.phases.map((phase,index)=><span key={phase.key} className={index===room.phase.index?'current':index<room.phase.index?'complete':''} aria-current={index===room.phase.index?'step':undefined} aria-label={`${phase.label}, ${phase.seconds} seconds`} title={`${phase.label} · ${phase.seconds}s`}/>)}<small>{active?`${room.phase.index+1}/6`:'Complete'}</small></div>
        <div className="round-tabs" role="group" aria-label="Round tools">{tabs.map(([id,label])=><button key={id} type="button" className={id==='chat'?'round-chat-tab':''} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}{id==='peer'&&room.peerFeedbackSubmitted?' ✓':''}</button>)}</div>
        <div className="round-tool-panel" tabIndex={0} aria-label={tabs.find(t=>t[0]===tab)?.[1]}>
          <div hidden={tab!=='round'}>{(active?(room.role==='judge'?room.phase.key==='judging'?<Scorecard p={p} room={room} now={now}/>:<div className="round-waiting"><Icon name="gavel"/><h2>Listen to both contestants</h2><p>Your scorecard opens after their responses.</p></div>:peer&&room.phase.key==='judging'?<PeerScorecard p={p} room={room} now={now}/>:room.phase.key==='judging'?<div className="round-waiting"><h2>Judges are scoring</h2><Button onClick={()=>setTab('peer')}>Give peer feedback</Button></div>:<LiveResponse key={room.phase.index} p={p} room={room} now={now} transmitting={transmitting}/>):room.result?<RoundOutcome p={p} room={room}/>:<p>Round ended. Your history is saved.</p>)}</div>
          {tab==='peer'&&canFeedback&&<><PeerScorecard p={p} room={room} now={now}/><section className="received-peer"><h3>From your opponent</h3>{room.peerFeedback?.length?room.peerFeedback.map(feedback=><article key={feedback.ballotId}><blockquote>{feedback.tip}</blockquote><FeedbackButtons p={p} id={feedback.ballotId} rating={feedback.rating}/></article>):<p>No peer feedback yet.</p>}</section></>}
          {tab==='responses'&&<section><h2>Written responses</h2>{room.responses.length?room.responses.map(r=><article className="feedback-card" key={`${r.playerId}-${r.phase}`}><strong>{room.participants.find(v=>v.id===r.playerId)?.name} · {r.phase<3?'Opening':'Response'}</strong><p className="preserve-lines">{r.content}</p></article>):<p>Submitted words appear after each turn.</p>}</section>}
          {tab==='chat'&&<OpponentChat p={p} room={room}/>}
          {tab==='details'&&<><div className="round-details"><strong>{room.isPublic?'Public round':'Private round'} · {peer?'Unrated':'Rated with valid scorecards'}</strong><p>Mic is live in preparation and on your turn. Camera stays on until switched off. Audio and video are not recorded.</p>{room.judgingMode==='automated'&&<p>One automated rubric judge checks submitted text. Not AI; no voice or video assessment.</p>}<h3>Judges</h3>{room.participants.filter(v=>v.role==='judge').map(v=><div className="round-judge" key={v.id}><PlayerLink player={v}><AvatarBadge name={v.name} look={v.avatar}/>{v.name}</PlayerLink><span>{v.left?'Left':v.submitted?'Scored':'Listening'}</span></div>)}{peer&&<p>{room.judgingMode==='automated'?'Automated rubric judge':'Peer feedback'}</p>}</div><Safety p={p} room={room}/></>}
        </div>
      </div>
      {room.role==='contestant'&&<aside className="desk-chat" aria-label="Opponent chat"><OpponentChat p={p} room={room}/></aside>}
    </div>
    <LeaveRoundDialog p={p} room={room} open={active&&confirmLeave} onClose={()=>setConfirmLeave(false)}/>
  </div>
}
