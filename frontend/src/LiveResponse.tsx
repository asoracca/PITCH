import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Icon } from './design'
import { canRespond } from './model'
import { PracticeTranscript, transcriptOff } from './practice-transcript'
import type { Pitch } from './usePitch'
import type { PitchRoomView } from '../../shared/pitch'

export function LiveResponse({ p, room, now, transmitting }: { p: Pitch; room: PitchRoomView; now: number; transmitting: boolean }) {
  const saved = room.responses.find(r => r.playerId === p.me!.player.id && r.phase === room.phase.index)
  const [text, setText] = useState(saved?.content || '')
  const [speech, setSpeech] = useState(transcriptOff)
  const [captions, setCaptions] = useState(true)
  const recognizer = useRef<PracticeTranscript | null>(null)
  const prefix = useRef(''), current = useRef(text)
  const allowed = canRespond(room, now) && !saved
  useEffect(() => {
    const recognition = new PracticeTranscript(value => {
      setSpeech(value)
      if (value.listening && (value.text || value.interim)) {
        const next = [prefix.current, value.text, value.interim].filter(Boolean).join(' ').slice(0,1200)
        current.current = next; setText(next)
      }
    })
    recognizer.current = recognition
    const release = () => recognition.abort()
    window.addEventListener('pagehide',release)
    return () => { window.removeEventListener('pagehide',release); recognition.abort(); recognizer.current = null }
  }, [])
  function start() { prefix.current = current.current; recognizer.current?.start() }
  useEffect(() => {
    if (allowed && transmitting && captions) start()
    else recognizer.current?.stop()
  }, [allowed, transmitting, captions])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!allowed || !current.current.trim()) return
    recognizer.current?.abort()
    await p.act(async () => { p.acceptRoom(await p.api.respond(room.code, room.phase.index, current.current)) })
  }
  return <form className="play-round" onSubmit={event => { void submit(event) }}>
    <div className="round-transcript-controls">
      <label className="check-label"><input type="checkbox" checked={captions} disabled={!allowed} onChange={event => setCaptions(event.target.checked)} />Live transcript · English</label>
      {captions && <Button type="button" variant="secondary" disabled={!allowed} onClick={() => speech.listening ? recognizer.current?.stop() : start()}>{speech.listening ? 'Pause transcription' : 'Start transcription'}</Button>}
      <p role="status">{speech.listening ? 'Listening…' : speech.message ? speech.message.replace('Recording can continue; type your transcript below.', 'Type your response below.').replace('before evaluating.', 'before submitting.') : allowed ? 'Starts on your turn.' : 'Waiting for your turn.'}</p>
    </div>
    <label className="form-stack"><strong>Your response</strong>
      <textarea className="match-response-input" value={text} onChange={event => { current.current = event.target.value; setText(event.target.value) }} maxLength={1200} required readOnly={!allowed || speech.listening} placeholder="Speak or type your response. Pause transcription to edit." />
    </label>
    {captions && <small>Browser transcription. Submit to save.</small>}
    <div className="response-submit"><span>{text.length}/1200 · {saved ? 'Response saved.' : allowed ? 'Submit before time runs out.' : 'Wait for your speaking turn.'}</span><Button type="submit" disabled={p.busy || !allowed || !text.trim()}>Submit response<Icon name="check" /></Button></div>
  </form>
}
