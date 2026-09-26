import { useState } from "react"
import { Button, Icon, type Page } from "./design"

export function Pricing({ navigate }: { navigate: (page: Page) => void }) {
  const [annual, setAnnual] = useState(false)
  return (
    <div className="page-stack pricing-page">
      <div className="pricing-heading">
        <div className="eyebrow">PITCH PLANS</div>
        <h1 className="display">Find your next level.</h1>
        <p>Start practicing for free. Explore what’s planned for Pro and Campus.</p>
      </div>
      <div className="pricing-preview-note">
        <Icon name="spark" />
        <div><strong>Pricing preview</strong><p>The prototype stays free. These plans and match limits are not active yet, and no payment is collected.</p></div>
      </div>
      <div className="plan-billing" role="group" aria-label="PITCH Pro billing period">
        <Button variant={annual ? "ghost" : "secondary"} aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</Button>
        <Button variant={annual ? "secondary" : "ghost"} aria-pressed={annual} onClick={() => setAnnual(true)}>Yearly · save $24</Button>
      </div>
      <div className="pricing-grid">
        <article className="panel plan-card">
          <div className="eyebrow">FOR STUDENTS</div>
          <h2 className="heading">Free</h2>
          <div className="plan-price"><strong>$0</strong><span>to get started</span></div>
          <p>Build confidence, one round at a time.</p>
          <dl className="plan-features">
            <div><dt>Matches</dt><dd>3 per week, plus credits earned by judging</dd></div>
            <div><dt>Scenarios</dt><dd>Core library</dd></div>
            <div><dt>Feedback</dt><dd>Match score</dd></div>
          </dl>
          <Button variant="secondary" onClick={() => navigate("Practice")}>Continue free <Icon name="arrow" /></Button>
          <small>The weekly limit is not enforced in this prototype.</small>
        </article>
        <article className="panel plan-card plan-featured">
          <div className="eyebrow">FOR STUDENTS SERIOUS ABOUT RECRUITING</div>
          <h2 className="heading">PITCH Pro</h2>
          <div className="plan-price" aria-live="polite"><strong>{annual ? "$48" : "$6"}</strong><span>/{annual ? "year" : "month"}</span></div>
          <p>{annual ? "$4 per month, billed yearly when available." : "Or $48 per year — save $24."}</p>
          <dl className="plan-features">
            <div><dt>Matches</dt><dd>Unlimited</dd></div>
            <div><dt>Scenarios</dt><dd>Premium packs: interviews, negotiation and networking</dd></div>
            <div><dt>Feedback</dt><dd>Full score history and skill progress</dd></div>
          </dl>
          <Button disabled>PITCH Pro · coming soon</Button>
          <small>Preview only. Subscriptions are not available yet.</small>
        </article>
        <article className="panel plan-card">
          <div className="eyebrow">FOR UNIVERSITY CAREER CENTERS</div>
          <h2 className="heading">Campus</h2>
          <div className="plan-price"><strong>$10</strong><span>/student/year</span></div>
          <p>500-seat minimum.</p>
          <dl className="plan-features">
            <div><dt>Matches</dt><dd>Unlimited for every student</dd></div>
            <div><dt>Scenarios</dt><dd>Custom scenarios built with the career center and its employer partners</dd></div>
            <div><dt>Feedback</dt><dd>Career-center dashboard with cohort analytics</dd></div>
          </dl>
          <Button variant="secondary" disabled>Campus · coming soon</Button>
          <small>Preview only. Campus plans are not available yet.</small>
        </article>
      </div>
      <p className="pricing-footer">Keep using the prototype’s current features for free while we build PITCH.</p>
    </div>
  )
}
