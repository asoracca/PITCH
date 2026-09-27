import { PracticeLogs } from './PracticeLogs'
import { demoPracticeLogs } from './demo-practices'
import { AvatarCharacter, Button, Icon, Stat, type EquippedItems, type Page } from "./design"
import type { Pitch } from "./usePitch"

export function DemoProfile({ p, equipped, navigate }: { p: Pitch; equipped: EquippedItems; navigate: (page: Page) => void }) {
  const scenarios = p.config?.scenarios.filter((s) => s.band === p.me!.ageBand) || []
  const changes = [16,12,-10,18,14,0,16,12]
  return <div className="page-stack">
    <div className="pricing-preview-note"><Icon name="spark" /><div><strong>Prototype profile · sample activity</strong><p>All activity below is fictional demo data. Switch to Real activity for your saved sessions.</p></div></div>
    <div className="profile-hero"><div className="profile-character"><AvatarCharacter compact {...equipped} /></div><div><div className="eyebrow">PITCH REGULAR · DEMO PROFILE</div><h1 className="display">{p.me!.player.name}</h1><p>Ages {p.me!.ageBand} · Practicing conversations. Building confidence.</p></div><Button onClick={() => navigate("Character")}>Customize character</Button></div>
    <div className="demo-profile-stats">
      <Stat icon="fire" value="500 days" label="Demo streak" tone="orange" />
      <Stat icon="trophy" value="1,742" label="Demo PITCH Elo" tone="purple" />
      <Stat icon="versus" value="312" label="Sample rounds played" tone="cyan" />
      <Stat icon="gavel" value="180" label="Sample rounds judged" tone="lime" />
    </div>
    <div className="profile-grid">
      <section className="panel form-stack"><h2 className="heading">Your growth · demo</h2>{[["Clarity",4.6],["Persuasiveness",4.3],["Composure",4.8]].map(([skill,score]) => <div className="skill-row" key={skill}><span>{skill}</span><div><i style={{width:`${Number(score)*20}%`}} /></div><strong>{score}/5</strong></div>)}<p>184 sample wins · 59% example win rate.</p></section>
      <section className="panel form-stack"><h2 className="heading">Judging activity · demo</h2><p>180 rounds judged · 94/100 sample reliability.</p><p>90 priority credits earned over this example history · 6 shown as available.</p><p>Latest sample judging: interview introductions, a budget disagreement and a team handoff.</p><small>These demo credits cannot be spent in matchmaking.</small></section>
    </div>
    <section className="panel form-stack"><h2 className="heading">500-day streak · demo milestone</h2><p>A sample record of showing up every day to practice or judge.</p><div className="demo-streak" aria-hidden="true">{Array.from({length:35},(_,i)=><span key={i}>✓</span>)}</div><small>Illustrative activity, not tracked account history.</small></section>
    <PracticeLogs entries={demoPracticeLogs(p.me!.ageBand || "18–22")} demo />
    <h2 className="heading">Opponent matches · demo</h2>
    {changes.map((delta,index) => {
      const after = 1742-changes.slice(0,index).reduce((a,b)=>a+b,0)
      return <details className="panel" key={index}><summary>{scenarios[index % (scenarios.length || 1)]?.title || "Practice conversation"}<strong className={delta<0?"negative":"positive"}>{delta>0?"+":""}{delta} sample Elo · {delta>0?"win":delta<0?"loss":"draw"}</strong></summary><p>vs {["Maya Chen","Leo Cruz","Nora Patel","Avery Brooks"][index%4]} · {index===0?"Today":`${index} days ago`} · Example rating: {after-delta} → {after}</p><p>Sample feedback: {['Your opening was clear. Add one concrete example to support your request.','You listened to the concern and offered a practical next step.','Try slowing down and making your main point earlier.'][index%3]}</p><small>Fictional round for the prototype presentation.</small></details>
    })}
  </div>
}
