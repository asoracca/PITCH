import { useEffect, useRef, useState } from 'react'
import { Button } from './design'
import { PlayerLink } from './PlayerProfiles'
import { signed } from './model'
import type { Pitch } from './usePitch'
import type { Page } from './design'

export function RoundHistory({ p, navigate }: { p: Pitch; navigate: (page: Page) => void }) {
  const first = p.history?.rounds
  const [page, setPage] = useState(first)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    request.current?.abort(); request.current = null
    setPage(first); setLoading(false); setError('')
    return () => { request.current?.abort() }
  }, [first])
  async function more() {
    if (!page?.nextCursor || loading) return
    const controller = new AbortController()
    request.current = controller; setLoading(true); setError('')
    try {
      const next = await p.api.roundHistory(page.nextCursor, { signal: controller.signal })
      if (!controller.signal.aborted) setPage(current => ({ ...next, rounds: [...(current?.rounds || []), ...next.rounds.filter(r => !current?.rounds.some(old => old.code === r.code))] }))
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'History unavailable. Retry.') }
    finally { if (!controller.signal.aborted) { setLoading(false); request.current = null } }
  }
  return <details className="history-group"><summary>Round history <span>Automatically saved</span></summary>
    <div className="history-entries">
      {page?.rounds.length ? page.rounds.map(round => <details className="panel" key={round.code}>
        <summary><span>{round.scenario.title}</span><strong className={round.delta == null ? '' : round.delta >= 0 ? 'positive' : 'negative'}>{round.delta == null ? round.result : `${signed(round.delta)} Elo · ${round.result}`}</strong></summary>
        <div className="history-round-meta"><span>{new Date(round.finishedAt).toLocaleString()}</span><span>{round.role === 'judge' ? 'Judge' : 'Contestant'}</span>{round.judgingMode !== 'judged' && <span>Practice duel</span>}</div>
        <p>{round.contestants.map((player, index) => <span key={player.id}>{index > 0 && ' vs '}<PlayerLink player={player}>{player.name}</PlayerLink></span>)}</p>
        <Button variant="secondary" disabled={p.busy || p.queue.status === 'waiting' || p.room?.status === 'active'} onClick={() => { void p.act(async () => { p.acceptRoom(await p.api.room(round.code)); navigate('Head-to-Head') }) }}>View responses & feedback</Button>
      </details>) : <p>No completed rounds yet.</p>}
      {error && <p role="alert">{error}</p>}
      {page?.nextCursor && <Button variant="ghost" disabled={loading} onClick={() => { void more() }}>{loading ? 'Loading…' : 'Load older rounds'}</Button>}
    </div>
  </details>
}
