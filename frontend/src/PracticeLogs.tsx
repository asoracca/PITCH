import { useState } from 'react'
import type { PracticeLog } from '../../shared/pitch'
import { Button } from './design'
import { CoachFeedback } from './CoachFeedback'
import { transcriptMetrics } from './delivery'

export function PracticeLogs({ entries, demo = false, onDelete }: { entries: PracticeLog[]; demo?: boolean; onDelete?: (id:string) => Promise<void> }) {
  const [pending,setPending] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('')
  async function remove(id:string) {
    if(!onDelete||busy)return
    setBusy(true);setError('')
    try{await onDelete(id);setPending('')}catch(e){setError(e instanceof Error?e.message:'Could not delete this practice.')}finally{setBusy(false)}
  }
  return <section className="practice-logs form-stack">
    <header className="activity-heading"><div><h2 className="heading">Saved practices{demo?' · demo':''}</h2><p>{demo?'Sample solo sessions for your presentation.':'Your latest 50 saved responses. Only you can see them.'}</p></div><span className="review-badge">{entries.length} sessions</span></header>
    {error&&<p role="alert">{error}</p>}
    {entries.length ? entries.map(entry=><details className="panel practice-log" key={entry.id}>
      <summary><span className="activity-kind">SOLO{demo?' · DEMO':''}</span><span className="activity-title">{entry.scenario.title}</span><span className="activity-date">{new Date(entry.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span></summary>
      <div className="practice-log-body">
        <p className="activity-meta">{entry.delivery?`${entry.delivery.seconds}s · `:''}{transcriptMetrics(entry.transcript,entry.delivery).words} words · {entry.feedback?(demo?'Sample feedback':'AI feedback saved'):'Response saved'} · Unrated</p>
        <p>{entry.scenario.prompt}</p>
        <h3>Your response</h3><blockquote className="preserve-lines">{entry.transcript}</blockquote>
        {entry.feedback&&<CoachFeedback answer={entry.feedback}/>}
        {!demo&&onDelete&&<div className="hero-actions">{pending===entry.id?<><span>Delete this saved practice?</span><Button variant="secondary" disabled={busy} onClick={()=>void remove(entry.id)}>{busy?'Deleting…':'Delete'}</Button><Button variant="ghost" disabled={busy} onClick={()=>setPending('')}>Keep it</Button></>:<Button variant="ghost" onClick={()=>setPending(entry.id)}>Delete log</Button>}</div>}
      </div>
    </details>) : <div className="panel"><p>Use “Save practice” after a solo session. Your response and feedback will appear here.</p></div>}
  </section>
}
