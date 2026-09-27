import { PlayerLink } from "./PlayerProfiles"
import { demoPlayers } from "./demo"
import { PracticeLogs } from './PracticeLogs'
import { demoPracticeLogs } from './demo-practices'
import { AvatarCharacter, Button, Icon, Stat, type EquippedItems, type Page } from "./design"
import type { Pitch } from "./usePitch"

export function DemoProfile({ p, equipped, navigate }: { p: Pitch; equipped: EquippedItems; navigate: (page: Page) => void }) {
  const scenarios = p.config?.scenarios.filter((s) => s.band === p.me!.ageBand) || []
  const changes = [16,12,-10,18,14,0,16,12]
  return <div className="page-stack">
    <div className="pricing-preview-note"><Icon name="spark" /><div><strong>Prototype profile · sample activity</strong><p>Fictional activity. Choose Real activity for your saved sessions.</p></div></div>
    <div className="profile-hero"><div className="profile-character"><AvatarCharacter compact {...equipped} /></div><div><div className="eyebrow">PITCH REGULAR · DEMO PROFILE</div><h1 className="display">{p.me!.player.name}</h1><p>Ages {p.me!.ageBand}</p></div><Button onClick={() => navigate("Character")}>Customize character</Button></div>
    <div className="demo-profile-stats">
      <Stat icon="trophy" value="1,742" label="Demo PITCH Elo" tone="purple" />
      <Stat icon="versus" value="312" label="Sample rounds played" tone="cyan" />
      <Stat icon="gavel" value="180" label="Sample rounds judged" tone="lime" />
    </div>
    <div className="profile-grid">
      <section className="panel form-stack"><h2 className="heading">Your growth · demo</h2>{[["Clarity",4.6],["Persuasiveness",4.3],["Composure",4.8]].map(([skill,score]) => <div className="skill-row" key={skill}><span>{skill}</span><div><i style={{width:`${Number(score)*20}%`}} /></div><strong>{score}/5</strong></div>)}<p>184 wins · 59% win rate · demo</p></section>
      <section className="panel demo-judging" aria-labelledby="demo-judging-title">
        <header className="demo-judging-heading"><h2 id="demo-judging-title" className="heading">Judging activity</h2><span className="demo-badge">DEMO</span></header>
        <dl className="demo-judging-stats">
          <div className="demo-judge-stat"><dt><Icon name="gavel" size={17}/>Rounds judged</dt><dd>180</dd></div>
          <div className="demo-judge-stat" data-tone="purple"><dt><Icon name="target" size={17}/>Reliability</dt><dd>94<span>/100</span></dd></div>
          <div className="demo-judge-stat" data-tone="orange"><dt><Icon name="bolt" size={17}/>Credits earned</dt><dd>90</dd></div>
          <div className="demo-judge-stat"><dt><Icon name="star" size={17}/>Credits remaining</dt><dd>6</dd></div>
        </dl>
        <p className="demo-judging-note">Demo credits · not spendable</p>
        <div className="demo-judging-topics"><span>Recent topics</span><ul aria-label="Recent judging topics"><li>Interviews</li><li>Budgeting</li><li>Team handoffs</li></ul></div>
      </section>
    </div>
    <PracticeLogs entries={demoPracticeLogs(p.me!.ageBand || "18–22")} demo />
    <details className="history-group"><summary>Opponent matches <span>{changes.length} demo rounds</span></summary><div className="history-entries">
    {changes.map((delta,index) => {
      const after = 1742-changes.slice(0,index).reduce((a,b)=>a+b,0)
      return <details className="panel" key={index}><summary>{scenarios[index % (scenarios.length || 1)]?.title || "Practice conversation"}<strong className={delta<0?"negative":"positive"}>{delta>0?"+":""}{delta} sample Elo · {delta>0?"win":delta<0?"loss":"draw"}</strong></summary><p><PlayerLink player={{id:demoPlayers[index%4].playerId,name:demoPlayers[index%4].name}}>vs {demoPlayers[index%4].name}</PlayerLink> · {index===0?"Today":`${index} days ago`} · Example rating: {after-delta} → {after}</p><p>Sample feedback: {['Your opening was clear. Add one concrete example to support your request.','You listened to the concern and offered a practical next step.','Try slowing down and making your main point earlier.'][index%3]}</p></details>
    })}</div></details>
  </div>
}
