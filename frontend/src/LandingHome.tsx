import { useEffect, useState } from 'react'
import { Icon, Logo, type Page, type IconName } from './design'

const stages = ['Student life', 'Find your voice', 'Career-ready']
const ways: { number: string; title: string; copy: string; page: Page; icon: IconName }[] = [
  { number: '01', title: 'A little practice.', copy: 'Pick a real-life scenario. Try your answer out loud, on camera or in writing.', page: 'Practice', icon: 'mic' },
  { number: '02', title: 'A fresh perspective.', copy: 'Go head-to-head, exchange feedback and learn from the way someone else sees it.', page: 'Head-to-Head', icon: 'versus' },
  { number: '03', title: 'Your next chapter.', copy: 'Save your sessions, see your progress and take what you learn into the real world.', page: 'Profile', icon: 'arrow' },
]

export function Home({ onNavigate, onSignIn, signedIn }: { onNavigate: (page: Page) => void; onSignIn: () => void; signedIn: boolean }) {
  const [stage, setStage] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [menu, setMenu] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReducedMotion(preference.matches)
      setPlaying(!preference.matches)
      if (preference.matches) setStage(2)
    }
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!playing || reducedMotion) return
    const timer = window.setInterval(() => setStage(current => (current + 1) % stages.length), 4200)
    return () => window.clearInterval(timer)
  }, [playing, reducedMotion])
  function go(page: Page) { setMenu(false); onNavigate(page) }
  function howItWorks() { setMenu(false); document.getElementById('career-how')?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }) }
  return <div className="career-home">
    <section className="career-hero" aria-labelledby="career-heading">
      <header className="career-nav">
        <Logo onHome={() => go('Home')} />
        <nav className={`career-nav-links ${menu ? 'is-open' : ''}`} aria-label="Home navigation">
          <button onClick={howItWorks}>How it works</button>
          <button onClick={() => go('Practice')}>Practice</button>
          <button onClick={() => go('Head-to-Head')}>Head-to-Head</button>
          <button onClick={() => go('Plans')}>Plans</button>
        </nav>
        <div className="career-nav-actions">
          <button className="career-login" onClick={signedIn ? () => go('Dashboard') : onSignIn}>{signedIn ? 'Dashboard' : 'Sign in'} <Icon name="arrow" size={17} /></button>
          <button className="career-menu" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
        </div>
      </header>

      <div className={`career-scene career-stage-${stage}`} role="img" aria-label="Two college students in casual clothes pass through a PITCH practice studio and emerge in interview-ready outfits.">
        <img className="career-studio" src="/home/career-studio.webp" alt="" width="1536" height="1024" fetchPriority="high" />
        <img className="career-students" src="/home/students.webp" alt="" width="1214" height="1295" />
        <span className="career-studio-sign" aria-hidden="true">PITCH <Icon name="spark" size={16} /></span>
        <img className="career-professionals" src="/home/professionals.webp" alt="" width="1215" height="1295" />
        <span className="career-scene-caption" aria-hidden="true">{stage === 0 ? 'Big dreams. A little practice.' : stage === 1 ? 'Small steps. Stronger voice.' : 'Same you. Ready for what’s next.'}</span>
      </div>

      <div className="career-intro">
        <p className="career-kicker"><span /> YOUR NEXT CHAPTER STARTS HERE</p>
        <h1 id="career-heading">From campus.<br />To <em>career.</em></h1>
        <p className="career-description">Find your voice before the big moment. Practice real conversations, learn with others and show up ready.</p>
        <button className="career-start" onClick={() => go('Practice')}>Let’s get you ready <span><Icon name="arrow" size={23} /></span></button>
        <p className="career-cta-note">One scenario. One minute. A step forward.</p>
      </div>

      <div className="career-story-controls" aria-label="Student to professional story">
        <div className="career-story-stages">{stages.map((label, index) => <button key={label} aria-pressed={stage === index} onClick={() => { setStage(index); setPlaying(false) }}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}</div>
        {!reducedMotion && <button className="career-motion" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause transformation animation' : 'Play transformation animation'}>{playing ? 'Pause' : 'Play'}{!playing && <Icon name="play" size={16} />}</button>}
      </div>
      <button className="career-scroll" onClick={howItWorks}>MEET YOUR NEXT CHAPTER <span>↓</span></button>
    </section>

    <section className="career-how" id="career-how" aria-labelledby="career-how-title">
      <div className="career-section-heading"><p className="career-kicker">A PRACTICE SPACE FOR REAL LIFE</p><h2 id="career-how-title">You don’t have to<br />wing <em>every first.</em></h2><p>The first interview. The tricky conversation. The idea you want to pitch. Give yourself a place to try.</p></div>
      <div className="career-ways">{ways.map(way => <button className="career-way" key={way.number} onClick={() => go(way.page)}><span className="career-way-top"><span>{way.number}</span><Icon name={way.icon} size={27} /></span><h3>{way.title}</h3><p>{way.copy}</p><span className="career-way-link">{way.page === 'Profile' ? 'See your growth' : way.page === 'Practice' ? 'Enter Practice Arena' : 'Meet your next opponent'}<Icon name="arrow" size={20} /></span></button>)}</div>
    </section>

    <section className="career-invite"><p className="career-kicker">SAME YOU. MORE POSSIBILITIES.</p><h2>Your future self<br />will thank you.</h2><button className="career-start" onClick={() => go('Practice')}>Take your first PITCH <span><Icon name="arrow" size={23} /></span></button></section>
    <footer className="career-footer"><Logo onHome={() => { go('Home'); window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }) }} /><span>Practice before it counts.</span><button onClick={() => go('Plans')}>Explore plans <Icon name="arrow" size={16} /></button></footer>
  </div>
}
