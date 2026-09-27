import type { ReactNode } from 'react'
import { transcriptMetrics, type Delivery } from './delivery'

export function ReviewHeading({ step, title, description, aside }: { step: number; title: string; description: string; aside?: ReactNode }) {
  return <header className="review-heading">
    <span className="review-step-number" aria-hidden="true">{step}</span>
    <div><h3>{title}</h3><p>{description}</p></div>
    {aside && <div className="review-heading-aside">{aside}</div>}
  </header>
}

export function DeliverySummary({ transcript, delivery }: { transcript: string; delivery: Delivery | null }) {
  const metrics = transcriptMetrics(transcript, delivery)
  return <section className="review-step">
    <ReviewHeading step={2} title="Your delivery" description="Estimates, not scores."
      aside={delivery ? <span className="review-badge">{delivery.seconds}s recorded</span> : undefined} />
    <dl className="delivery-grid">
      <div><dt>Words</dt><dd>{metrics.words}</dd><small>In your transcript</small></div>
      <div><dt>Speaking pace</dt><dd className={metrics.wordsPerMinute === null ? 'metric-pending' : ''}>{metrics.wordsPerMinute ?? 'Not ready yet'}</dd><small>{metrics.wordsPerMinute === null ? 'Needs 10+ seconds and 10+ words.' : 'Words per minute'}</small></div>
      <div><dt>Pauses</dt><dd className={!delivery ? 'metric-pending' : ''}>{delivery?.pauses ?? 'Record first'}</dd><small>Pauses of 2+ seconds</small></div>
      <div><dt>Filler words</dt><dd className={!metrics.words ? 'metric-pending' : ''}>{metrics.words ? metrics.fillers : 'Add words first'}</dd><small>“Um,” “uh,” “you know,” “I mean”</small></div>
    </dl>
    <details className="review-details">
      <summary>How to read these numbers</summary>
      <p>Pace includes pauses. Filler counts use the transcript; check it for errors.</p>
      <p>Noise and mic settings affect estimates. Emotion, confidence and accent aren’t measured.</p>
      {delivery && <p>Recording details: sound was detected in {delivery.audiblePercent}% of sampled moments. Volume variation: {delivery.levelRangeDb === null ? 'not enough sound to measure' : `${delivery.levelRangeDb} dB`}.</p>}
    </details>
  </section>
}
