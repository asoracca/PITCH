import { useEffect, useId, useRef, useState } from 'react'
import { Button, Icon } from './design'
import { PracticeRecording, recordingOff } from './practice-recording'
import { PracticeTranscript, transcriptOff } from './practice-transcript'
import { DeliveryMeter, type Delivery } from './delivery'
import type { PracticeDraft } from '../../shared/pitch'
import { LocalCoach } from './LocalCoach'
import { DeliverySummary, ReviewHeading } from './PracticeReview'

export function PracticeMicrophone({ deadline, finished, onStarted, prompt = 'Describe a challenge, what you did and what you learned.', goal = 'Give a specific example and a clear next step.', coaching = false, draft, onDraftChange, onSave }: {
  deadline: number; finished: boolean; onStarted: () => void; prompt?: string; goal?: string; coaching?: boolean
  draft?: string; onDraftChange?: (text: string) => void; onSave?: (snapshot: Omit<PracticeDraft, 'scenarioId'>) => Promise<void>
}) {
  const controller = useRef<PracticeRecording | null>(null), recognizer = useRef<PracticeTranscript | null>(null), meter = useRef<DeliveryMeter | null>(null), preview = useRef<HTMLVideoElement>(null)
  const mounted = useRef(false)
  const latest = useRef({ deadline, finished, onStarted, onDraftChange }); latest.current = { deadline, finished, onStarted, onDraftChange }
  const [state,setState] = useState(recordingOff), [speech,setSpeech] = useState(transcriptOff), [transcript,setTranscript] = useState(draft || ''), [delivery,setDelivery] = useState<Delivery | null>(null)
  const [feedback,setFeedback] = useState(''), [saving,setSaving] = useState(false), [saved,setSaved] = useState(''), [saveError,setSaveError] = useState('')
  const practiceId = useRef<string|null>(null)
  function updateTranscript(text:string){setTranscript(text);latest.current.onDraftChange?.(text)}
  const [camera,setCamera] = useState(false), [captions,setCaptions] = useState(coaching)
  useEffect(()=>{
    mounted.current=true
    const recording=new PracticeRecording(value=>{if(mounted.current)setState(value)}), recognition=new PracticeTranscript(value=>{if(mounted.current)setSpeech(value)}), measurements=new DeliveryMeter()
    controller.current=recording;recognizer.current=recognition;meter.current=measurements
    const stop=()=>{recording.stop();recognition.abort()};window.addEventListener('pagehide',stop)
    return()=>{mounted.current=false;window.removeEventListener('pagehide',stop);recording.dispose();recognition.abort();measurements.stop();controller.current=null;recognizer.current=null;meter.current=null}
  },[])
  useEffect(()=>{if(finished)controller.current?.stop()},[finished])
  useEffect(()=>{if(speech.text)updateTranscript(speech.text)},[speech.text])
  const recording=state.phase==='recording', requesting=state.phase==='requesting', busy=recording||requesting||state.phase==='stopping'
  const processed = !busy && !speech.listening && !!state.url && !!delivery
  const canReview = !busy && !speech.listening && transcript.trim().length >= 30
  const transcriptId = useId()
  const signature = JSON.stringify({transcript,feedback,delivery})
  async function save(){
    if(!onSave||saving||busy||speech.listening||!transcript.trim())return
    setSaving(true);setSaveError('');practiceId.current ||= crypto.randomUUID();const id=practiceId.current
    try{await onSave({id,transcript,feedback,delivery});if(mounted.current&&practiceId.current===id)setSaved(signature)}catch(e){if(mounted.current)setSaveError(e instanceof Error?e.message:'Could not save. Try again.')}finally{if(mounted.current)setSaving(false)}
  }
  function clear(){practiceId.current=null;setSaved('');setSaveError('');setFeedback('');controller.current?.clear();recognizer.current?.abort();setSpeech({...transcriptOff});updateTranscript('');setDelivery(null);if(preview.current)preview.current.srcObject=null}
  return <section className="practice-microphone" aria-label="Practice microphone">
    <div className="practice-mic-header"><div><strong>Practice with your voice</strong><p>Up to 60 seconds. Video is optional.</p></div><Button variant={recording?'secondary':'primary'} aria-pressed={recording} disabled={state.phase==='stopping'} onClick={()=>{
      if(recording||requesting)controller.current?.stop()
      else {practiceId.current=null;setSaved('');setSaveError('');recognizer.current?.abort();updateTranscript('');setSpeech({...transcriptOff});setDelivery(null);void controller.current?.start(
        ()=>latest.current.deadline&&!latest.current.finished?latest.current.deadline-Date.now():60000,
        ()=>latest.current.onStarted(),{video:camera,onStream:stream=>{meter.current?.start(stream);if(captions)recognizer.current?.start();if(preview.current&&camera){preview.current.srcObject=stream;void preview.current.play().catch(()=>{})}},onStop:()=>{recognizer.current?.stop();const result=meter.current?.stop()||null;if(mounted.current)setDelivery(result);if(preview.current)preview.current.srcObject=null}})}
    }}><Icon name="mic"/>{requesting?'Cancel microphone':recording?'Turn microphone off':state.phase==='stopping'?'Finishing…':'Turn microphone on'}</Button></div>
    <div className="practice-options"><label className="check-label"><input type="checkbox" checked={camera} disabled={busy} onChange={e=>setCamera(e.target.checked)}/>Include video</label>{coaching&&<label className="check-label"><input type="checkbox" checked={captions} disabled={busy} onChange={e=>setCaptions(e.target.checked)}/>Write down my words · English</label>}</div>
    {coaching&&<p className="muted">Transcription may use your browser’s speech service. PITCH does not upload your recording.</p>}
    <p role="status" className={recording?'positive':''}>{state.message||'Microphone off.'}</p>
    <video ref={preview} className="practice-camera" hidden={!camera||!recording} muted autoPlay playsInline aria-label="Your practice camera preview"/>
    {state.url&&<div className="practice-playback">{state.video?<video controls playsInline src={state.url} aria-label="Your recorded practice response"/>:<audio controls src={state.url} aria-label="Your recorded practice response"/>}<Button variant="ghost" onClick={clear}>Delete recording</Button></div>}
    <details className="review-details"><summary>Recording &amp; privacy</summary><p>Recording stays on this page and clears when you leave. Saving a practice keeps only its text, feedback and measurements in your private history. Audio and video are not uploaded. Nothing affects Elo.</p></details>
    {coaching&&<div className="practice-review">
      <section className="review-step">
        <ReviewHeading step={1} title="Your words" description="Check what we heard. You can edit it after recording." aside={<span className="review-badge">{busy || speech.listening ? 'Listening' : 'Editable transcript'}</span>} />
        <label className="review-transcript" htmlFor={transcriptId}>Your response
          <textarea id={transcriptId} value={transcript} readOnly={busy||speech.listening} maxLength={6000} rows={4} onChange={e=>updateTranscript(e.target.value)} placeholder="Speak with the microphone on, or type your response here." />
        </label>
        {speech.interim&&<p className="transcript-interim" aria-live="polite">{speech.interim}</p>}
        {speech.message&&!speech.listening&&!speech.message.startsWith('Live transcription')&&<p className="review-caption" role="status">{speech.message}</p>}
      </section>
      {processed && <DeliverySummary transcript={transcript} delivery={delivery} />}
      <LocalCoach available={canReview} transcript={transcript} prompt={prompt} goal={goal} delivery={delivery} disabled={busy||speech.listening} onFeedbackChange={setFeedback}/>
      {onSave && !busy && !speech.listening && !!transcript.trim() && <footer className="practice-save">
        <div><strong>Keep this practice</strong><p>Save your response and feedback to Profile → Real activity. Video stays on this page.</p></div>
        <Button variant="secondary" disabled={saving||busy||speech.listening||!transcript.trim()||saved===signature} onClick={()=>void save()}>{saving?'Saving…':saved===signature?'Saved to profile':saved?'Update saved practice':'Save practice'}</Button>
        {saveError && <p role="alert">{saveError}</p>}
      </footer>}
    </div>}
  </section>
}
