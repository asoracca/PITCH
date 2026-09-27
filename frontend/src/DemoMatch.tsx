import { useEffect, useState } from "react"
import type { Scenario } from "../../shared/pitch"
import { Button, Icon, SectionTitle, AvatarBadge } from "./design"
import { countdown, initials } from "./model"
import { PracticeMicrophone } from "./PracticeMicrophone"
import type { AvatarLook } from "../../shared/avatar"
import { PlayerLink } from "./PlayerProfiles"
import { demoPlayers, demoScript, demoSteps } from "./demo"

export function DemoMatch({ scenario, name, avatar, onClose }: { scenario: Scenario; name: string; avatar?: AvatarLook | null; onClose: () => void }) {
  const [stage, setStage] = useState({ index: 0, deadline: Date.now() + demoSteps[0].seconds * 1000 })
  const [now, setNow] = useState(Date.now())
  const [draft, setDraft] = useState("")
  const [ending, setEnding] = useState(false)
  const [responses, setResponses] = useState<Record<number, string>>({})
  const finished = stage.index >= demoSteps.length
  const yours = stage.index === 1 || stage.index === 3
  const script = demoScript(scenario)
  function advance() {
    setStage((s) => ({ index: Math.min(s.index + 1, demoSteps.length), deadline: Date.now() + (demoSteps[s.index + 1]?.seconds || 0) * 1000 }))
    setDraft(""); setEnding(false)
  }
  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [finished])
  useEffect(() => {
    if (!finished && !yours && now >= stage.deadline) advance()
  }, [now, stage.deadline, finished, yours])
  return (
    <div className="page-stack">
      <SectionTitle eyebrow="SOLO DEMO · NO ELO" title={finished ? "Demo round complete" : demoSteps[stage.index].title} action={<Button variant="ghost" onClick={onClose}>Exit demo</Button>} />
      <div className="pricing-preview-note"><Icon name="spark" /><div><strong>Simulated round</strong><p>Scripted opponents and results. Not AI. No Elo or history changes.</p></div></div>
      <section className="panel form-stack">
        <span className="capitalize">{scenario.category}</span><h2 className="heading">{scenario.title}</h2><p className="arena-prompt">{scenario.prompt}</p>
        {scenario.positions && <p><strong>Your side:</strong> {scenario.positions[0]}<br /><strong>Demo opponent:</strong> {scenario.positions[1]}</p>}
      </section>
      <div className="matchup-intro">
        <div className="matchup-player"><AvatarBadge name={name} look={avatar} size="xl" /><strong>{name}</strong><span>YOU</span></div>
        <div className="matchup-vs"><strong>VS</strong><span className="countdown">{finished ? "COMPLETE" : countdown(stage.deadline, now)}</span></div>
        <div className="matchup-player"><PlayerLink player={{id:demoPlayers[0].playerId,name:demoPlayers[0].name,avatar:demoPlayers[0].avatar}} className="player-link-stack"><AvatarBadge name="Maya Chen" look={demoPlayers[0].avatar} size="xl" /><strong>{demoPlayers[0].name}</strong></PlayerLink><span>DEMO OPPONENT</span></div>
      </div>
      {!finished && <div className="phase-track">{demoSteps.map((step, i) => <span key={step.title} className={stage.index === i ? "current" : ""}>{step.title}</span>)}</div>}
      {yours && !finished && <section className="panel form-stack">
        <PracticeMicrophone key={stage.index} deadline={stage.deadline} finished={ending || now >= stage.deadline} onStarted={() => {}} transcribing draft={draft} onDraftChange={setDraft} maxLength={1200} onFinished={(text) => { setResponses((r) => ({ ...r, [stage.index]: text.trim() })); advance() }} />
        <Button disabled={ending} onClick={() => setEnding(true)}>{ending ? "Finishing transcript…" : "Finish my turn"} <Icon name="check" /></Button>
      </section>}
      {stage.index >= 2 && <section className="panel form-stack">
        <h2 className="heading">Round responses</h2>
        <article><strong>You · opening</strong><p className="preserve-lines">{responses[1] || "No text response submitted."}</p></article>
        <article><strong>{demoPlayers[0].name} · scripted opening</strong><p>{script.b}</p></article>
        {stage.index >= 4 && <><article><strong>You · reply</strong><p className="preserve-lines">{responses[3] || "No text reply submitted."}</p></article><article><strong>{demoPlayers[0].name} · scripted reply</strong><p>{script.replyB}</p></article></>}
      </section>}
      {(stage.index === 5 || finished) && <section className="panel form-stack">
        <h2 className="heading">{finished ? "Example judge result" : "Simulated judging…"}</h2>
        {finished ? <><p>Example: you win 2–1. This is not a score of your response.</p><div className="live-judge-cards">{demoPlayers.slice(1, 4).map((judge, i) => <div className="panel" key={judge.playerId}><PlayerLink player={{id:judge.playerId,name:judge.name,avatar:judge.avatar}}><AvatarBadge name={judge.name} look={judge.avatar}/><strong>{judge.name}</strong></PlayerLink><small className="demo-badge">DEMO</small><span>Example vote: {i < 2 ? name : demoPlayers[0].name}</span><span>{["Make your main point early.", "Use a specific example.", "Finish with a practical next step."][i]}</span></div>)}</div><strong>Elo unchanged · unrated demonstration</strong></> : <p>The three demo judges will reveal an example result.</p>}
      </section>}
      <div className="hero-actions">{finished ? <><Button onClick={() => { setResponses({}); setDraft(""); setNow(Date.now()); setStage({ index: 0, deadline: Date.now() + 5000 }) }}>Play demo again</Button><Button variant="secondary" onClick={onClose}>Back to Head-to-Head</Button></> : <Button variant="ghost" disabled={ending} onClick={() => yours ? setEnding(true) : advance()}>Skip to next step</Button>}</div>
    </div>
  )
}
