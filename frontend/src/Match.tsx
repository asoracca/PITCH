import { PlayerLink } from "./PlayerProfiles"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Button, Icon, SectionTitle, AvatarBadge } from "./design"
import { countdown, canRespond, initials, signed, skills } from "./model"
import { FeedbackButtons, Rules } from "./screens"
import { LiveAudio, audioOff } from "./voice"
import { TOPICS } from "../../shared/pitch"
import { OpponentChat } from "./OpponentChat"
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
  const [allowSpectators, setAllowSpectators] = useState(false)
  const [allowPeerMatch, setAllowPeerMatch] = useState(true)
  const now = useServerNow(p.queue.serverTime)
  if (p.room) return <Round key={p.room.code} p={p} room={p.room} />
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
          <AvatarBadge name={p.me!.player.name} look={p.me!.avatar} size="xl" />
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
          {mode !== "judge" && mode !== "priority" && <label className="check-label"><input type="checkbox" checked={allowPeerMatch} onChange={(event) => setAllowPeerMatch(event.target.checked)} /><span>After 2 minutes without judges: one automated rubric judge, no Elo. Exchange feedback too.</span></label>}
          <label className="check-label"><input type="checkbox" checked={allowSpectators} onChange={(event) => setAllowSpectators(event.target.checked)} /><span>Allow spectators to see names, text and results if everyone agrees. Audio and video stay private.</span></label>
          {p.me!.bannedUntil > Date.now() && (
            <p>
              Queue break until{" "}
              {new Date(p.me!.bannedUntil).toLocaleTimeString()}.
            </p>
          )}
          <Button
            disabled={p.busy || p.me!.bannedUntil > Date.now()}
            onClick={() => {
              void p.join(mode, allowSpectators, allowPeerMatch && mode !== "judge" && mode !== "priority", category)
            }}
          >
            Find a round
            <Icon name="bolt" />
          </Button>
          <details className="review-details"><summary>Matching rules</summary><p>Two contestants; one or three human judges. Optional automated fallback after 2 minutes. No opponent after 2½ minutes? The queue closes.</p></details>
        </div>
      )}
      <Spectate p={p} />
      <Rules compact />
    </div>
  )
}

function AudioControls({
  p,
  room,
  now,
}: {
  p: Pitch
  room: PitchRoomView
  now: number
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
  useEffect(() => {
    let mounted = true
    const connection = new LiveAudio(p.api, container.current!, (v) => {
      if (mounted) setState(v)
    }, preview.current!)
    audio.current = connection
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
      await connection.start(latestRoom.current, p.me!.player.id, config, p.config!.rules.phases)
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
  return (
    <section className="panel audio-controls" aria-label="Voice, microphone and camera">
      <div>
        <h2 className="heading">Talk, type or turn your camera on.</h2>
        <p>Connect to listen or watch. Mic and camera start off; text stays available.</p>
        <div className="voice-state" role="status" aria-live="polite">
          <strong>{starting ? "Connecting voice & video…" : state.enabled ? "Voice & video connected" : "Voice & video disabled"}</strong>
          {state.enabled && <span>{state.connected} of {state.participants} participants connected</span>}
          {room.role === "contestant" && <span className={state.transmitting ? "positive" : ""}>
            {micPending ? "Waiting for microphone permission…" : state.transmitting ? "Microphone on · your turn to speak" : micOn ? "Microphone on · muted until your turn" : "Microphone off"}
          </span>}
          {room.role === "contestant" && <span>{cameraPending ? "Waiting for camera permission…" : cameraOn ? "Camera on · visible to this room’s participants" : "Camera off"}</span>}
          {(error || state.message) && <span>{error || state.message}</span>}
        </div>
        <p>
          {room.role === "judge" ? "As a judge, you can watch and listen without using a microphone or camera." : "Your voice is shared only during your speaking turns. Your camera stays visible until you turn it off."} Live audio and video are not recorded by PITCH.
        </p>
      </div>
      <div className="hero-actions">
        <Button
          variant={state.enabled ? "secondary" : "primary"}
          aria-pressed={state.enabled}
          disabled={room.status !== "active" || room.left}
          onClick={() => {
            if (state.enabled || starting) stop()
            else void start()
          }}
        >
          {starting ? "Cancel connection" : state.enabled ? "Disconnect voice & video" : "Connect voice & video"}
        </Button>
        {room.role === "contestant" && (
          <Button
            variant={micOn ? "secondary" : "primary"}
            disabled={!state.enabled || starting}
            aria-pressed={micOn}
            onClick={() => {
              if (micOn || micPending) audio.current?.disableMicrophone()
              else void audio.current?.enableMicrophone()
            }}
          >
            <Icon name="mic" />
            {micPending ? "Cancel microphone" : micOn ? "Turn microphone off" : "Turn microphone on"}
          </Button>
        )}
        {room.role === "contestant" && <Button variant={cameraOn ? "secondary" : "primary"} disabled={!state.enabled || starting} aria-pressed={cameraOn} onClick={() => {
          if (cameraOn || cameraPending) audio.current?.disableCamera()
          else void audio.current?.enableCamera()
        }}>{cameraPending ? "Cancel camera" : cameraOn ? "Turn camera off" : "Turn camera on"}</Button>}
        {state.needsPlayback && <Button variant="secondary" onClick={() => { void audio.current?.play() }}>Play audio & video</Button>}
        {state.enabled && <Button variant="ghost" disabled={starting} onClick={() => { void start() }}>Reconnect voice & video</Button>}
      </div>
      {state.enabled && <p>Everyone must connect to listen or watch. Reconnect if needed, or use text.</p>}
      <figure className="local-camera" hidden={!cameraOn}><video ref={preview} muted autoPlay playsInline aria-label="Your camera preview" /><figcaption>You · camera on</figcaption></figure>
      <div ref={container} className="media-streams" />
    </section>
  )
}

function ResponseForm({
  p,
  room,
  now,
}: {
  p: Pitch
  room: PitchRoomView
  now: number
}) {
  const [text, setText] = useState("")
  const submitted = room.responses.some(
    (r) => r.playerId === p.me!.player.id && r.phase === room.phase.index,
  )
  const allowed = canRespond(room, now)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (allowed && !submitted)
      void p.act(async () => {
        p.acceptRoom(await p.api.respond(room.code, room.phase.index, text))
      })
  }
  return (
    <form className="play-round" onSubmit={submit}>
      <label className="form-stack">
        <strong>Your text response · with or without voice</strong>
        <textarea
          className="match-response-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1200}
          required
          readOnly={!allowed || submitted}
          placeholder="Make your case clearly. Be specific about what you would say and do."
        />
      </label>
      <div className="response-submit">
        <span>
          {text.length}/1200 ·{" "}
          {submitted
            ? "Response saved."
            : allowed
              ? "One submission during this speaking turn."
              : "Wait for your speaking turn."}
        </span>
        <Button
          type="submit"
          disabled={p.busy || !allowed || submitted || !text.trim()}
        >
          Submit response
          <Icon name="check" />
        </Button>
      </div>
    </form>
  )
}

function PeerScorecard({ p, room, now }: { p: Pitch; room: PitchRoomView; now: number }) {
  const [feedback, setFeedback] = useState<Rubric>({ clarity: 3, persuasiveness: 3, composure: 3, tip: "" })
  const open = room.phase.key === "judging" && now < room.phase.deadline && !room.phase.expired && !room.ballotSubmitted
  const opponent = room.participants.find((person) => person.id !== p.me!.player.id)
  return <form className="panel form-stack" onSubmit={(event) => {
    event.preventDefault()
    if (open) void p.act(async () => { p.acceptRoom(await p.api.peerFeedback(room.code, feedback)) })
  }}>
    <h2 className="heading">Feedback for {opponent?.name}</h2>
    <p>{room.ballotSubmitted ? "Your feedback is saved. It will be shared when the round ends." : "After the speaking turns, give your opponent three scores and one useful tip. This does not change Elo."}</p>
    {skills.map((skill) => <label key={skill} className="capitalize">{skill}<select value={feedback[skill]} disabled={!open || p.busy} onChange={(event) => setFeedback({ ...feedback, [skill]: Number(event.target.value) })}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}/5</option>)}</select></label>)}
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

function Round({ p, room }: { p: Pitch; room: PitchRoomView }) {
  const now = useServerNow(room.serverTime)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const active = room.status === "active" && !room.left
  const automated = room.judgingMode === "automated"
  const peer = room.judgingMode === "peer" || automated
  const players = room.participants
    .filter((v) => v.role === "contestant")
    .sort((a, b) => a.slot - b.slot)
  const winner = room.participants.find((v) => v.id === room.result?.winnerId)
  return (
    <div className="page-stack playable-match">
      <div className="match-titlebar">
        <div>
          <div className="eyebrow">
            ROOM {room.code} ·{" "}
            {room.role === "judge" ? "YOU ARE JUDGING" : "YOU ARE A CONTESTANT"}
          </div>
          <h1 className="display">
            {room.left
              ? "You left the round."
              : room.status === "cancelled"
                ? "Round cancelled."
                : room.status === "finished"
                  ? peer ? "Practice duel complete!" : winner
                    ? `${winner.name} wins!`
                    : "A draw."
                  : room.phase.label}
          </h1>
        </div>
        <span className="countdown">
          <Icon name="clock" />
          {active ? countdown(room.phase.deadline, now) : "ROUND CLOSED"}
        </span>
      </div>
      <div className="matchup-intro">
        {players.map((v, i) => (
          <div className="matchup-player" key={v.id}>
            <PlayerLink player={v} className="player-link-stack"><AvatarBadge name={v.name} look={v.avatar} size="xl" /><strong>{v.name}</strong></PlayerLink>
            <span>
              CONTESTANT {i ? "B" : "A"}
              {v.id === p.me!.player.id ? " · YOU" : ""}
            </span>
            <small>{v.ageBand ? `Ages ${v.ageBand}` : ""}</small>
            <small>
              {v.left
                ? "Left round"
                : active && room.phase.speaker === v.slot
                  ? "Speaking now"
                  : v.position || "Ready"}
            </small>
          </div>
        ))}
        <div className="matchup-vs match-center">
          <span>{room.band}</span>
          <strong>VS</strong>
          <small>{automated ? "One automated judge · unrated" : peer ? "Two-player practice · unrated" : `${room.participants.filter(v => v.role === 'judge').length} human judge${room.participants.filter(v => v.role === 'judge').length === 1 ? '' : 's'}`}</small>
        </div>
      </div>
      <div className="scenario-reveal">
        <div>
          <span className="capitalize">{room.scenario.category}</span>
          <h2 className="heading">{room.scenario.title}</h2>
          <p className="arena-prompt">{room.scenario.prompt}</p>
          <p>{room.scenario.goal}</p>
          {room.yourPosition && (
            <strong>Your assigned position: {room.yourPosition}</strong>
          )}
        </div>
      </div>
      {active && <p>{room.isPublic ? "Public round: viewers can follow shared text and results." : "Private round: only its participants can view it."}</p>}
      {peer && <div className="pricing-preview-note"><Icon name="versus" /><div><strong>{automated ? "Automated rubric judge · text only" : "Two-player practice · no judges needed"}</strong><p>{automated ? "Free text checks: structure, examples, next steps. Not AI; no audio or video assessment. " : "Take your turns, then give each other feedback. "}No Elo or judging credits.</p></div></div>}
      <OpponentChat p={p} room={room} />
      <div className="live-judge-cards">
        {automated && <div className="panel"><Icon name="gavel" /><strong>Automated rubric judge</strong><span>{room.result ? 'Text checks complete' : '1 stand-in · submit text during your turn'}</span></div>}
        {room.participants
          .filter((v) => v.role === "judge")
          .map((v) => (
            <div className="panel" key={v.id}>
              <PlayerLink player={v}><AvatarBadge name={v.name} look={v.avatar}/><strong>{v.name}</strong></PlayerLink><Icon name="gavel"/>
              <span>
                {v.left
                  ? "Left round"
                  : v.submitted
                    ? "Scorecard received"
                    : "Listening / scoring"}
              </span>
            </div>
          ))}
      </div>
      {active && (
        <>
          <div className="phase-track">
            {p.config!.rules.phases.map((phase, i) => (
              <span
                className={i === room.phase.index ? "current" : ""}
                key={phase.key}
              >
                {peer && i === 5 ? "Opponent feedback" : phase.label} · {phase.seconds}s
              </span>
            ))}
          </div>
          {now >= room.phase.deadline && (
            <p role="status">Waiting for the server’s next phase…</p>
          )}
          <AudioControls p={p} room={room} now={now} />
          {peer && room.phase.key === "judging" ? <PeerScorecard p={p} room={room} now={now} /> : room.role === "contestant" ? (
            <ResponseForm key={room.phase.index} p={p} room={room} now={now} />
          ) : (
            <Scorecard p={p} room={room} now={now} />
          )}
        </>
      )}
      <section className="panel">
        <SectionTitle title="Written responses" />
        <p>
          Responses become visible to other players after each speaking turn.
        </p>
        {room.responses.length ? (
          room.responses.map((r) => (
            <article className="feedback-card" key={`${r.playerId}-${r.phase}`}>
              <strong>
                {room.participants.find((v) => v.id === r.playerId)?.name} ·{" "}
                {p.config!.rules.phases[r.phase]?.label}
              </strong>
              <p className="preserve-lines">{r.content}</p>
            </article>
          ))
        ) : (
          <p>No text responses shared yet. Players may be using live audio.</p>
        )}
      </section>
      {room.result && (
        <section className="game-results">
          <div className="result-banner">
            <Icon name="trophy" />
            <span>
              {peer ? "UNRATED PRACTICE" : room.status === "cancelled"
                ? "UNRATED"
                : winner
                  ? "ROUND COMPLETE"
                  : "DRAW"}
            </span>
            <p>
              {room.result.voteCount} {automated ? "automated judge · Elo unchanged" : peer ? "opponent feedback submissions · Elo unchanged" : `scorecards · ${room.result.reason.replaceAll("_", " ")}`}
            </p>
          </div>
          {peer && !room.feedback.length && <p>No opponent feedback was submitted before this round ended.</p>}
          <div className="final-score-grid">
            {room.result.scores.map((score) => {
              const change = room.result!.ratingChanges.find(
                (c) => c.playerId === score.playerId,
              )
              return (
                <div className="panel" key={score.playerId}>
                  <h2 className="heading">
                    {players.find((v) => v.id === score.playerId)?.name}
                  </h2>
                  {change ? (
                    <p className={change.delta >= 0 ? "positive" : "negative"}>
                      {signed(change.delta)} Elo · {change.before} →{" "}
                      {change.after}
                    </p>
                  ) : (
                    <p>No Elo change</p>
                  )}
                  {!automated && skills.map((k) => (
                    <p className="capitalize" key={k}>
                      {k}: {score.averages?.[k] ?? "—"}/5
                    </p>
                  ))}
                  {automated && room.result?.automatedFeedback?.filter(f => f.playerId === score.playerId).map(f => <div key={f.playerId}><p>{f.tip}</p><ul className="automated-checks">{Object.entries(f.checks).map(([key,value]) => <li key={key}>{value ? '✓' : '—'} {key === 'nextStep' ? 'Clear next step' : key === 'specificity' ? 'Specific example' : 'Sentence structure'}</li>)}</ul><small>Simple text checks, not a skill score.</small></div>)}
                </div>
              )
            })}
          </div>
          {room.feedback.map((f) => (
            <div className="panel" key={f.ballotId}>
              <p className="feedback-quote">“{f.tip}”</p>
              <FeedbackButtons p={p} id={f.ballotId} rating={f.rating} />
            </div>
          ))}
        </section>
      )}
      <Safety p={p} room={room} />
      {active ? (
        <div className="panel">
          {confirmLeave ? (
            <>
              <p>
                {peer ? "Leaving ends this unrated duel for both players. Your Elo stays the same." : "Leaving applies a queue break. Contestants forfeit; judges lose reliability."}
              </p>
              <div className="hero-actions">
                <Button
                  variant="secondary"
                  disabled={p.busy}
                  onClick={() => {
                    void p.act(async () => {
                      p.acceptRoom(await p.api.leave(room.code))
                      await p.refresh()
                    })
                  }}
                >
                  Leave round
                </Button>
                <Button onClick={() => setConfirmLeave(false)}>
                  Stay in round
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
              Leave round…
            </Button>
          )}
        </div>
      ) : (
        <Button onClick={p.clearRoom}>
          Back to matchmaking
          <Icon name="arrow" />
        </Button>
      )}
    </div>
  )
}
