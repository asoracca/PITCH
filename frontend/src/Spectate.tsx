import { useEffect, useState } from "react"
import type { Scenario, SpectatorRound } from "../../shared/pitch"
import type { Pitch } from "./usePitch"
import { Button, Icon, SectionTitle } from "./design"
import { demoScript } from "./demo"
import { countdown } from "./model"

function DemoSpectator({ scenario }: { scenario: Scenario }) {
  const [step, setStep] = useState(0)
  const script = demoScript(scenario)
  const labels = ["Scenario reveal", "Maya’s opening", "Leo’s opening", "Maya’s reply", "Leo’s reply", "Example result"]
  useEffect(() => {
    if (step === 5) return
    const timer = setTimeout(() => setStep((s) => Math.min(s + 1, 5)), 7000)
    return () => clearTimeout(timer)
  }, [step])
  return <div className="panel form-stack">
    <div className="eyebrow">DEMO SPECTATING · SCRIPTED ROUND</div>
    <h3 className="heading">Maya Chen vs Leo Cruz</h3><p>{scenario.prompt}</p>
    <strong role="status">{labels[step]}</strong>
    {step >= 1 && <article><strong>Maya · demo</strong><p>{script.a}</p></article>}
    {step >= 2 && <article><strong>Leo · demo</strong><p>{script.b}</p></article>}
    {step >= 3 && <article><strong>Maya’s reply · demo</strong><p>{script.replyA}</p></article>}
    {step >= 4 && <article><strong>Leo’s reply · demo</strong><p>{script.replyB}</p></article>}
    {step === 5 && <p><strong>Example result: Maya wins 2–1.</strong> These simulated votes do not affect anyone’s Elo.</p>}
    <Button variant="secondary" onClick={() => setStep((s) => s === 5 ? 0 : s + 1)}>{step === 5 ? "Replay demo round" : "Skip to next moment"}</Button>
  </div>
}

export function Spectate({ p }: { p: Pitch }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [rooms, setRooms] = useState<SpectatorRound[]>([])
  const [round, setRound] = useState<SpectatorRound | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const scenario = p.config!.scenarios.find((s) => s.band === p.me!.ageBand)
  useEffect(() => {
    if (!open || selected === "demo") return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    setError("")
    setLoading(true)
    setRound(null)
    async function poll() {
      let again = true
      try {
        if (selected) {
          const value = await p.api.spectate(selected, { signal: controller.signal })
          if (controller.signal.aborted) return
          setRound(value)
          again = value.status === "active" && !value.phase.expired
        } else {
          const value = await p.api.publicRounds({ signal: controller.signal })
          if (controller.signal.aborted) return
          setRooms(value.rooms)
        }
        setError("")
      } catch (e) {
        if (!controller.signal.aborted) {
          setRound(null)
          setRooms([])
          setError(e instanceof Error ? e.message : "Public rounds could not load.")
        }
        again = false
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          if (again) timer = setTimeout(() => { void poll() }, 5000)
        }
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [p.api, open, selected, retry])
  return <section className="panel form-stack">
    <SectionTitle eyebrow={p.queue.status === "waiting" ? "WHILE YOU WAIT" : "WATCH AND LEARN"} title="Spectate Head-to-Head" />
    <p>Watch public rounds in your age group. Your queue keeps running, and your own match opens automatically when it’s ready.</p>
    <Button variant="secondary" onClick={() => { setOpen(!open); setSelected(null) }}>{open ? "Close spectating" : "Watch public rounds"} <Icon name="play" /></Button>
    {open && <>
      <p>Live spectating shows the scenario, round progress, shared text and final result. Spectator audio and video are not available yet.</p>
      {selected && <Button variant="ghost" onClick={() => setSelected(null)}>Back to public rounds</Button>}
      {selected === "demo" && scenario ? <DemoSpectator scenario={scenario} /> : <>
        {loading && <p role="status">Loading public rounds…</p>}
        {error && <div role="status"><p>{error}</p><Button variant="ghost" onClick={() => setRetry((v) => v + 1)}>Retry</Button></div>}
        {selected && round && <section className="form-stack">
          <div className="eyebrow">PUBLIC ROUND · READ ONLY</div>
          <h3 className="heading">{round.participants.filter((v) => v.role === "contestant").map((v) => v.name).join(" vs ")}</h3>
          <p>{round.scenario.prompt}</p>
          <strong role="status">{round.status !== "active" || round.phase.expired ? "Round ended" : `${round.phase.label} · ${countdown(round.phase.deadline, round.serverTime)}`}</strong>
          <p>Text appears after each speaking turn. You cannot vote or send messages to players.</p>
          {round.responses.map((response) => <article key={`${response.playerId}-${response.phase}`}><strong>{round.participants.find((v) => v.id === response.playerId)?.name}</strong><p className="preserve-lines">{response.content}</p></article>)}
          {!round.responses.length && <p>No shared text yet. Players may be using voice.</p>}
          {round.result && <p><strong>{round.status === "cancelled" ? "Round cancelled" : round.result.winnerId ? `${round.participants.find((v) => v.id === round.result!.winnerId)?.name} wins` : round.result.reason === "peer_practice" ? "Practice duel complete · unrated" : "A draw"}</strong></p>}
        </section>}
        {!selected && <>
          {!loading && !rooms.length && <p>No live public rounds right now. Watch the labelled demo below while you wait.</p>}
          <div className="spectate-grid">{rooms.map((value) => <button className="scenario-card" key={value.code} onClick={() => setSelected(value.code)}><span className="eyebrow">LIVE · {value.band}</span><strong>{value.participants.filter((v) => v.role === "contestant").map((v) => v.name).join(" vs ")}</strong><span>{value.scenario.title}</span><small>{value.phase.label}</small></button>)}</div>
        </>}
      </>}
      {!selected && scenario && <button className="scenario-card" onClick={() => setSelected("demo")}><span className="eyebrow">DEMO · FICTIONAL PLAYERS</span><strong>Maya Chen vs Leo Cruz</strong><span>Watch a scripted example round now <Icon name="play" /></span></button>}
    </>}
  </section>
}
