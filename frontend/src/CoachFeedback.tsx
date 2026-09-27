import { coachFeedback } from './coach-feedback'

export function CoachFeedback({ answer }: { answer: string }) {
  return <div className="coach-feedback" aria-label="Your AI feedback">
    {coachFeedback(answer).map(section => <article className={`coach-feedback-card feedback-${section.kind}`} key={section.kind}>
      <h4>{section.title}</h4>
      {section.kind === 'example' ? <blockquote>{section.text}</blockquote> : <p className="preserve-lines">{section.text}</p>}
    </article>)}
  </div>
}
