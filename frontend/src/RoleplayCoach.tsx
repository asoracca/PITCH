import { useEffect, useRef, useState } from 'react'
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import { Button, Icon, SectionTitle, type Page } from './design'
import { CoachFeedback } from './CoachFeedback'
import { PracticeTranscript, transcriptOff, recognitionConstructor } from './practice-transcript'
import { roleplays, roleplayOpening, roleplayMessages, guidedReply, type ConversationMessage, type Difficulty, type Personality, type Roleplay } from './roleplay'

export function Coach({ navigate }: { navigate: (page: Page) => void }) {
  const [role, setRole] = useState<Roleplay>(roleplays[0])
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium')
  const [personality, setPersonality] = useState<Personality>('Neutral')
  const [messages, setMessages] = useState<ConversationMessage[]>([{ role: 'assistant', content: roleplayOpening(roleplays[0], 'Medium') }])
  const [draft, setDraft] = useState(''), [feedback, setFeedback] = useState(''), [complete, setComplete] = useState(false)
  const [status, setStatus] = useState<'demo' | 'loading' | 'ready' | 'thinking'>('demo')
  const [progress, setProgress] = useState(0), [notice, setNotice] = useState(''), [speech, setSpeech] = useState(transcriptOff)
  const [voiceSupported, setVoiceSupported] = useState(false), [aiSupported, setAiSupported] = useState(false), [readAloud, setReadAloud] = useState(false)
  const worker = useRef<Worker | null>(null), engine = useRef<WebWorkerMLCEngine | null>(null), generation = useRef(0), mounted = useRef(false)
  const recognition = useRef<PracticeTranscript | null>(null), voicePrefix = useRef(''), voiceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const end = useRef<HTMLDivElement>(null)
  const turn = messages.filter(message => message.role === 'user').length
  const working = status === 'loading' || status === 'thinking'
  useEffect(() => {
    mounted.current = true
    setAiSupported('gpu' in navigator); setVoiceSupported(!!recognitionConstructor())
    recognition.current = new PracticeTranscript(value => { if (!mounted.current) return; setSpeech(value); if (value.text) setDraft((voicePrefix.current + ' ' + value.text).trim().slice(0,1600)) })
    const stop = () => { recognition.current?.abort(); clearTimeout(voiceTimer.current); window.speechSynthesis?.cancel() }
    window.addEventListener('pagehide', stop)
    return () => { mounted.current = false; generation.current++; stop(); window.removeEventListener('pagehide', stop); worker.current?.terminate(); engine.current = null }
  }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }) }, [messages.length, complete])
  function stopVoice() { recognition.current?.abort(); clearTimeout(voiceTimer.current); window.speechSynthesis?.cancel() }
  function reset(nextRole = role, nextDifficulty = difficulty, nextPersonality = personality) {
    stopVoice(); generation.current++; setRole(nextRole); setDifficulty(nextDifficulty); setPersonality(nextPersonality)
    setMessages([{ role: 'assistant', content: roleplayOpening(nextRole, nextDifficulty) }]); setDraft(''); setFeedback(''); setComplete(false); setNotice(''); setSpeech({ ...transcriptOff })
    setStatus(engine.current ? 'ready' : 'demo')
  }
  function stopAI() { generation.current++; worker.current?.terminate(); worker.current = null; engine.current = null; setStatus('demo'); setNotice('Guided demo is ready. Your conversation is still here.') }
  async function loadAI() {
    if (working || !aiSupported) return
    const token = ++generation.current; setStatus('loading'); setNotice('Preparing the free coach on your device…'); setProgress(0)
    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
      if (token !== generation.current) return
      const thread = new Worker(new URL('./coach.worker.ts', import.meta.url), { type: 'module' }); worker.current = thread
      const loaded = await CreateWebWorkerMLCEngine(thread, 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', { initProgressCallback: info => { if (token === generation.current) setProgress(Math.max(0,Math.min(1,info.progress))) }, logLevel: 'SILENT' }, { context_window_size: 4096 })
      if (token !== generation.current) return
      engine.current = loaded; setStatus('ready'); setNotice('On-device AI is ready. Responses stay on this device.')
    } catch { if (token === generation.current) { worker.current?.terminate(); worker.current = null; engine.current = null; setStatus('demo'); setNotice('This device could not load AI. The guided demo still works.') } }
  }
  function speak(text: string) {
    if (!readAloud || !window.speechSynthesis) return
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; window.speechSynthesis.speak(utterance)
  }
  async function send() {
    if (working || complete || speech.listening || !draft.trim()) return
    const text = draft.trim(), next: ConversationMessage[] = [...messages, { role: 'user', content: text }]
    const finalTurn = turn === 2, token = generation.current
    stopVoice(); setNotice('')
    if (!engine.current) {
      const answer = finalTurn ? 'Thanks for practicing with me. Take a moment to reflect on your three responses.' : guidedReply(role, text, turn + 1, difficulty, personality)
      setMessages([...next, { role: 'assistant', content: answer }]); setDraft(''); setComplete(finalTurn); speak(answer); return
    }
    setStatus('thinking')
    const timeout = window.setTimeout(() => { if (token === generation.current) { stopAI(); setNotice('AI took too long. Your draft is safe; send it in guided demo or set up AI again.') } }, 60000)
    try {
      const reply = await engine.current.chat.completions.create({ messages: roleplayMessages(role, difficulty, personality, next, finalTurn), max_tokens: finalTurn ? 240 : 130, temperature: .5 })
      if (token !== generation.current) return
      const answer = reply.choices[0]?.message.content?.trim()
      if (!answer) throw Error('Empty reply')
      setMessages(finalTurn ? next : [...next, { role: 'assistant', content: answer }]); setDraft(''); setComplete(finalTurn); setStatus('ready')
      if (finalTurn) setFeedback(answer); else speak(answer)
    } catch { if (token === generation.current) { setStatus('ready'); setNotice('AI could not reply. Your draft is still here—try again or switch to guided demo.') } }
    finally { window.clearTimeout(timeout) }
  }
  return <div className="page-stack roleplay-page">
    <SectionTitle eyebrow="AI COACH · FREE ON-DEVICE PREVIEW" title="AI Career Coach" action={<span className={`roleplay-status ${status === 'ready' ? 'is-ready' : ''}`}><span />{status === 'thinking' ? 'Thinking…' : status === 'loading' ? 'Setting up AI' : status === 'ready' ? 'AI ready' : 'Guided demo'}</span>} />
    <div className="roleplay-settings">
      <label>Difficulty<select value={difficulty} disabled={working || turn > 0} onChange={event => reset(role, event.target.value as Difficulty, personality)}>{['Easy','Medium','Hard'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Personality<select value={personality} disabled={working || turn > 0} onChange={event => reset(role, difficulty, event.target.value as Personality)}>{['Supportive','Neutral','Direct'].map(value => <option key={value}>{value}</option>)}</select></label>
      <span className="roleplay-mode"><Icon name="target" size={22} /><span>SESSION MODE<strong>{difficulty} · {personality}</strong></span></span>
    </div>
    <div className="roleplay-workspace">
      <aside className="roleplay-roles" aria-label="Choose a roleplay"><p className="eyebrow">CHOOSE A ROLEPLAY</p><h2>Who do you want to practice with?</h2><div>{roleplays.map(option => <button key={option.id} disabled={working} aria-pressed={role.id === option.id} onClick={() => reset(option)}><Icon name={option.icon} /><span><strong>{option.name}</strong><small>{option.subtitle}</small></span><Icon name="arrow" size={16} /></button>)}</div></aside>
      <section className="roleplay-conversation" aria-label={`Conversation with ${role.name}`}>
        <header className="roleplay-chat-head"><Icon name="spark" size={28} /><div><h2>{role.name}</h2><p>{role.subtitle} · {difficulty}</p></div><Button variant="ghost" disabled={working} onClick={() => reset()}>Restart</Button></header>
        <div className="roleplay-messages" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((message,index) => <div key={index} className={`roleplay-message ${message.role}`}><span>{message.role === 'user' ? 'You' : role.name}</span><p>{message.content}</p></div>)}
          {status === 'thinking' && <p className="roleplay-thinking" role="status">Your coach is thinking…</p>}
          {complete && <div className="roleplay-finished"><h3>Session complete</h3>{feedback ? <CoachFeedback answer={feedback} /> : <><p>Guided demo · self-reflection</p><ul><li>Did you give a specific example?</li><li>Did you acknowledge the other person’s perspective?</li><li>Was your next step clear?</li></ul><p className="muted">These are reflection prompts, not AI feedback.</p></>}<Button onClick={() => reset()}>Try another round <Icon name="arrow" /></Button></div>}
          <div ref={end} />
        </div>
        <div className="roleplay-compose">
          {!complete && <><label className="sr-only" htmlFor="roleplay-response">Your response</label><textarea id="roleplay-response" value={draft} readOnly={working || speech.listening} maxLength={1600} rows={3} onChange={event => setDraft(event.target.value)} placeholder="Type what you would say…" />
          {speech.interim && <p className="transcript-interim">{speech.interim}</p>}
          <div className="roleplay-compose-actions"><span>Turn {Math.min(turn+1,3)} of 3</span><Button variant="ghost" disabled={working || !voiceSupported} aria-pressed={speech.listening} onClick={() => { if (speech.listening) { recognition.current?.stop(); clearTimeout(voiceTimer.current) } else { window.speechSynthesis?.cancel(); voicePrefix.current = draft; recognition.current?.start(); voiceTimer.current = setTimeout(() => recognition.current?.stop(),60000) } }}><Icon name="mic" size={18} />{speech.listening ? 'Stop dictation' : 'Use microphone'}</Button><Button disabled={working || speech.listening || !draft.trim()} onClick={() => void send()}>Send response <Icon name="arrow" size={19} /></Button></div></>}
          <label className="check-label roleplay-read"><input type="checkbox" checked={readAloud} onChange={event => { setReadAloud(event.target.checked); if (!event.target.checked) window.speechSynthesis?.cancel() }} />Read coach replies aloud</label>
          {speech.message && <p className="roleplay-notice" role="status">{speech.message}</p>}
          {!voiceSupported && <p className="roleplay-notice">Voice dictation is unavailable in this browser. You can still type.</p>}
        </div>
      </section>
    </div>
    <section className="roleplay-engine" aria-label="Coach options"><div><strong>{status === 'demo' ? 'Try AI on your device' : 'Free on-device AI'}</strong><p>{status === 'demo' ? 'Guided demo uses scripted replies. Optional AI downloads about 1 GB on first setup.' : 'Your conversation stays on this page. Leaving clears it.'}</p></div>{status === 'demo' ? <Button variant="secondary" disabled={!aiSupported} onClick={() => void loadAI()}>Set up free AI</Button> : <Button variant="secondary" onClick={stopAI}>{status === 'loading' ? 'Cancel setup' : status === 'thinking' ? 'Stop response' : 'Use guided demo'}</Button>}{status === 'loading' && <progress value={progress} max={1} aria-label="AI model download progress" />}{notice && <p role="status">{notice}</p>}<details className="review-details"><summary>Voice &amp; AI details</summary><p>Dictation may send audio to your browser’s speech service. Review the text before sending. On-device AI uses WebGPU, downloads its model from Hugging Face and MLC, and can take several minutes to set up. It evaluates words, not your voice or face. Guided demo works without that download.</p></details></section>
    <button className="roleplay-practice-link" onClick={() => navigate('Practice')}>Want a single timed scenario? Open Practice Arena <Icon name="arrow" size={18} /></button>
  </div>
}
