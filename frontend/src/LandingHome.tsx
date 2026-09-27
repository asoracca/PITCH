import { useEffect, useState, type CSSProperties } from 'react'
import { Icon, Logo, type Page, type IconName } from './design'

// Negative delays fill the conveyor immediately; reduced motion uses these fixed positions.
const walkers = [
  { x: 42, y: 8, scale: .7, depth: 1 },
  { x: 48, y: 18, scale: .75, depth: 1 },
  { x: 51, y: 29, scale: .82, depth: 1 },
  { x: 55, y: 34, scale: .82, depth: 1 },
  { x: 80.1, y: 54.9, scale: .9, depth: 3 },
  { x: 86.6, y: 64.5, scale: 1, depth: 3 },
  { x: 89.8, y: 74.2, scale: 1.08, depth: 3 },
  { x: 89.2, y: 82, scale: 1.12, depth: 3 },
]
const ways: { number: string; title: string; copy: string; page: Page; icon: IconName }[] = [
  { number: '01', title: 'A little practice.', copy: 'Choose a scenario. Speak, record or type your answer.', page: 'Practice', icon: 'mic' },
  { number: '02', title: 'A fresh perspective.', copy: 'Face an opponent. Exchange feedback and perspectives.', page: 'Head-to-Head', icon: 'versus' },
  { number: '03', title: 'Your next chapter.', copy: 'Save sessions. Track progress. Use what you learn.', page: 'Profile', icon: 'arrow' },
]

export function Home({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(preference.matches)
    }
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  function howItWorks() { document.getElementById('career-how')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }) }
  const go = onNavigate
  return <div className="career-home">
    <section className="career-hero" aria-labelledby="career-heading">
      <div className="career-intro">
        <p className="career-kicker">A LITTLE PRACTICE GOES A LONG WAY</p>
        <h1 id="career-heading">Pitch. Practice. Perform.</h1>
        <p className="career-description">Interviews, pitches, tough conversations.</p>
        <div className="career-hero-actions"><button className="career-start" onClick={() => go('Practice')}>Start practicing <span><Icon name="arrow" size={23} /></span></button><button className="career-how-link" onClick={howItWorks}>How it works</button></div>
      </div>

      <div className="career-artwork" tabIndex={0} role="img" aria-label="A line of illustrated students walks through the PITCH practice studio and emerges in blazers, suits and formal shoes. Focus or hover over the illustration to pause its animation."><div className={`career-scene${!reducedMotion ? ' is-walking' : ''}`}>
        <img className="career-studio" src="/home/career-studio-runway.webp" alt="" width="1536" height="1024" fetchPriority="high" />
        {walkers.map((walker, index) => <div className="career-walker" key={index} aria-hidden="true" style={{
          '--travel-delay': `${-1-index*4}s`, '--step-delay': `${-index*.11}s`, '--person-row': `${index%3*50}%`,
          '--rest-position': `translate(${walker.x}%, ${walker.y}%) scale(${walker.scale})`,
          '--rest-depth': walker.depth, '--sprite-baseline': ['4.3%', '3.6%', '7.4%'][index%3],
          '--professional-baseline': ['3.6%', '3.1%', '6.9%'][index%3],
          '--casual-opacity': walker.depth === 1 ? 1 : 0, '--professional-opacity': walker.depth === 3 ? 1 : 0,
        } as CSSProperties}><div className="career-walker-body"><span className="career-walker-outfit career-walker-casual"><span className="career-walk-sprite" /></span><span className="career-walker-outfit career-walker-professional"><span className="career-walk-sprite" /></span></div></div>)}
        <img className="career-studio-foreground" src="/home/career-studio-runway.webp" alt="" width="1536" height="1024" />
      </div></div>
    </section>

    <section className="career-how" id="career-how" aria-labelledby="career-how-title">
      <div className="career-section-heading"><p className="career-kicker">A PRACTICE SPACE FOR REAL LIFE</p><h2 id="career-how-title">You don’t have to<br />wing <em>every first.</em></h2></div>
      <div className="career-ways">{ways.map(way => <button className="career-way" key={way.number} onClick={() => go(way.page)}><span className="career-way-top"><span>{way.number}</span><Icon name={way.icon} size={27} /></span><h3>{way.title}</h3><p>{way.copy}</p><span className="career-way-link">{way.page === 'Profile' ? 'See your growth' : way.page === 'Practice' ? 'Enter Practice Arena' : 'Meet your next opponent'}<Icon name="arrow" size={20} /></span></button>)}</div>
    </section>

    <section className="career-invite"><p className="career-kicker">SAME YOU. MORE POSSIBILITIES.</p><h2>Your future self<br />will thank you.</h2><button className="career-start" onClick={() => go('Practice')}>Take your first PITCH <span><Icon name="arrow" size={23} /></span></button></section>
    <footer className="career-footer"><Logo onHome={() => { go('Home'); window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }) }} /><button onClick={() => go('Plans')}>Explore plans <Icon name="arrow" size={16} /></button></footer>
  </div>
}
