import { useEffect, useState, type CSSProperties } from 'react'
import { Icon, Logo, type Page, type IconName } from './design'

// Negative delays fill the conveyor immediately; reduced motion uses these fixed positions.
const walkers = [
  { x: 42, y: 8, scale: .7, depth: 1 },
  { x: 48, y: 18, scale: .75, depth: 1 },
  { x: 51, y: 29, scale: .82, depth: 1 },
  { x: 55, y: 34, scale: .82, depth: 1 },
  { x: 78, y: 55, scale: .9, depth: 3 },
  { x: 85, y: 63, scale: 1, depth: 3 },
  { x: 93, y: 71, scale: 1.08, depth: 3 },
  { x: 102, y: 80, scale: 1.15, depth: 3 },
]
const ways: { number: string; title: string; copy: string; page: Page; icon: IconName }[] = [
  { number: '01', title: 'A little practice.', copy: 'Pick a real-life scenario. Try your answer out loud, on camera or in writing.', page: 'Practice', icon: 'mic' },
  { number: '02', title: 'A fresh perspective.', copy: 'Go head-to-head, exchange feedback and learn from the way someone else sees it.', page: 'Head-to-Head', icon: 'versus' },
  { number: '03', title: 'Your next chapter.', copy: 'Save your sessions, see your progress and take what you learn into the real world.', page: 'Profile', icon: 'arrow' },
]

export function Home({ onNavigate, onSignIn, signedIn }: { onNavigate: (page: Page) => void; onSignIn: () => void; signedIn: boolean }) {
  const [menu, setMenu] = useState(false)
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
  useEffect(() => {
    if (!menu) return
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setMenu(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menu])
  function go(page: Page) { setMenu(false); onNavigate(page) }
  function howItWorks() { setMenu(false); document.getElementById('career-how')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }) }
  return <div className="career-home">
      <button className="career-menu" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} aria-controls="career-navigation" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
      {menu && <button className="career-nav-backdrop" aria-label="Close navigation" onClick={() => setMenu(false)} />}
      <aside className={`career-nav ${menu ? 'is-open' : ''}`} id="career-navigation">
        <Logo onHome={() => go('Home')} />
        <nav className="career-nav-links" aria-label="Home navigation">
          <button onClick={howItWorks}><Icon name="grid" />How it works</button>
          <button onClick={() => go('Practice')}><Icon name="play" />Practice</button>
          <button onClick={() => go('Head-to-Head')}><Icon name="versus" />Head-to-Head</button>
          <button onClick={() => go('Plans')}><Icon name="star" />Plans</button>
        </nav>
        <div className="career-nav-actions">
          <button className="career-login" onClick={signedIn ? () => go('Dashboard') : onSignIn}>{signedIn ? 'Dashboard' : 'Sign in'} <Icon name="arrow" size={17} /></button>
        </div>
      </aside>

    <section className="career-hero" aria-labelledby="career-heading">
      <div className="career-intro">
        <p className="career-kicker">A LITTLE PRACTICE GOES A LONG WAY</p>
        <h1 id="career-heading">Practice real conversations.<br /><em>Build real confidence.</em></h1>
        <p className="career-description">Interviews, pitches, tough conversations.<br />Try them here. Get feedback. Show up ready.</p>
        <button className="career-start" onClick={() => go('Practice')}>Start practicing <span><Icon name="arrow" size={23} /></span></button>
        <p className="career-cta-note">One scenario. One minute. Your next step.</p>
      </div>

      <div className="career-artwork" tabIndex={0} role="img" aria-label="A line of illustrated people walks through the PITCH practice studio. Focus or hover over the illustration to pause its animation."><div className={`career-scene${!reducedMotion ? ' is-walking' : ''}`}>
        <img className="career-studio" src="/home/career-studio-branded.webp" alt="" width="1536" height="1024" fetchPriority="high" />
        {walkers.map((walker, index) => <div className="career-walker" key={index} aria-hidden="true" style={{
          '--travel-delay': `${-1-index*4}s`, '--step-delay': `${-index*.11}s`, '--person-row': `${index%3*50}%`,
          '--rest-position': `translate(${walker.x}%, ${walker.y}%) scale(${walker.scale})`,
          '--rest-depth': walker.depth, '--sprite-baseline': ['4.3%', '3.6%', '7.4%'][index%3],
        } as CSSProperties}><div className="career-walker-body"><span className="career-walk-sprite" /></div></div>)}
        <img className="career-studio-foreground" src="/home/career-studio-branded.webp" alt="" width="1536" height="1024" />
      </div></div>
    </section>

    <section className="career-how" id="career-how" aria-labelledby="career-how-title">
      <div className="career-section-heading"><p className="career-kicker">A PRACTICE SPACE FOR REAL LIFE</p><h2 id="career-how-title">You don’t have to<br />wing <em>every first.</em></h2><p>The first interview. The tricky conversation. The idea you want to pitch. Give yourself a place to try.</p></div>
      <div className="career-ways">{ways.map(way => <button className="career-way" key={way.number} onClick={() => go(way.page)}><span className="career-way-top"><span>{way.number}</span><Icon name={way.icon} size={27} /></span><h3>{way.title}</h3><p>{way.copy}</p><span className="career-way-link">{way.page === 'Profile' ? 'See your growth' : way.page === 'Practice' ? 'Enter Practice Arena' : 'Meet your next opponent'}<Icon name="arrow" size={20} /></span></button>)}</div>
    </section>

    <section className="career-invite"><p className="career-kicker">SAME YOU. MORE POSSIBILITIES.</p><h2>Your future self<br />will thank you.</h2><button className="career-start" onClick={() => go('Practice')}>Take your first PITCH <span><Icon name="arrow" size={23} /></span></button></section>
    <footer className="career-footer"><Logo onHome={() => { go('Home'); window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }) }} /><span>Practice before it counts.</span><button onClick={() => go('Plans')}>Explore plans <Icon name="arrow" size={16} /></button></footer>
  </div>
}
