import { useEffect, useRef, useState } from 'react'
import { Button, Icon } from './design'
import { PracticeRecording, recordingOff } from './practice-recording'
import { PracticeTranscript, transcriptOff } from './practice-transcript'
import { DeliveryMeter, transcriptMetrics, type Delivery } from './delivery'
import { LocalCoach } from './LocalCoach'

export function PracticeMicrophone({ deadline, finished, onStarted, prompt = 'Describe a challenge, what you did and what you learned.', goal = 'Give a specific example and a clear next step.', coaching = false }: {
  deadline: number; finished: boolean; onStarted: () => void; prompt?: string; goal?: string; coaching?: boolean
}) {
  const controller = useRef<PracticeRecording | null>(null), recognizer = useRef<PracticeTranscript | null>(null), meter = useRef<DeliveryMeter | null>(null), preview = useRef<HTMLVideoElement>(null)
  const mounted = useRef(false)
  const latest = useRef({ deadline, finished, onStarted }); latest.current = { deadline, finished, onStarted }
  const [state,setState] = useState(recordingOff), [speech,setSpeech] = useState(transcriptOff), [transcript,setTranscript] = useState(''), [delivery,setDelivery] = useState<Delivery | null>(null)
  const [camera,setCamera] = useState(false), [captions,setCaptions] = useState(coaching)
  useEffect(()=>{
    mounted.current=true
    const recording=new PracticeRecording(value=>{if(mounted.current)setState(value)}), recognition=new PracticeTranscript(value=>{if(mounted.current)setSpeech(value)}), measurements=new DeliveryMeter()
    controller.current=recording;recognizer.current=recognition;meter.current=measurements
    const stop=()=>{recording.stop();recognition.abort()};window.addEventListener('pagehide',stop)
    return()=>{mounted.current=false;window.removeEventListener('pagehide',stop);recording.dispose();recognition.abort();measurements.stop();controller.current=null;recognizer.current=null;meter.current=null}
  },[])
  useEffect(()=>{if(finished)controller.current?.stop()},[finished])
  useEffect(()=>{setTranscript(speech.text)},[speech.text])
  const recording=state.phase==='recording', requesting=state.phase==='requesting', busy=recording||requesting||state.phase==='stopping'
  const metrics=transcriptMetrics(transcript,delivery)
  function clear(){controller.current?.clear();recognizer.current?.abort();setSpeech({...transcriptOff});setTranscript('');setDelivery(null);if(preview.current)preview.current.srcObject=null}
  return <section className="practice-microphone" aria-label="Practice microphone">
    <div className="practice-mic-header"><div><strong>Practice with your voice</strong><p>Record up to 60 seconds, with optional video. Review your words and delivery afterwards.</p></div><Button variant={recording?'secondary':'primary'} aria-pressed={recording} disabled={state.phase==='stopping'} onClick={()=>{
      if(recording||requesting)controller.current?.stop()
      else {recognizer.current?.abort();setTranscript('');setSpeech({...transcriptOff});setDelivery(null);void controller.current?.start(
        ()=>latest.current.deadline&&!latest.current.finished?latest.current.deadline-Date.now():60000,
        ()=>latest.current.onStarted(),{video:camera,onStream:stream=>{meter.current?.start(stream);if(captions)recognizer.current?.start();if(preview.current&&camera){preview.current.srcObject=stream;void preview.current.play().catch(()=>{})}},onStop:()=>{recognizer.current?.stop();const result=meter.current?.stop()||null;if(mounted.current)setDelivery(result);if(preview.current)preview.current.srcObject=null}})}
    }}><Icon name="mic"/>{requesting?'Cancel microphone':recording?'Turn microphone off':state.phase==='stopping'?'Finishing…':'Turn microphone on'}</Button></div>
    <div className="practice-options"><label className="check-label"><input type="checkbox" checked={camera} disabled={busy} onChange={e=>setCamera(e.target.checked)}/>Record camera video too</label>{coaching&&<label className="check-label"><input type="checkbox" checked={captions} disabled={busy} onChange={e=>setCaptions(e.target.checked)}/>Live transcription · English</label>}</div>
    {coaching&&<p className="muted">Live transcription uses your browser’s speech recognition, which may send audio to its speech service. Review the text for mistakes. PITCH does not upload your recording.</p>}
    <p role="status" className={recording?'positive':''}>{state.message||'Microphone off.'}</p>
    <video ref={preview} className="practice-camera" hidden={!camera||!recording} muted autoPlay playsInline aria-label="Your practice camera preview"/>
    {state.url&&<div className="practice-playback">{state.video?<video controls playsInline src={state.url} aria-label="Your recorded practice response"/>:<audio controls src={state.url} aria-label="Your recorded practice response"/>}<Button variant="ghost" onClick={clear}>Delete recording & transcript</Button></div>}
    <small>Recording and transcript stay in this page’s memory. Leaving or changing scenarios clears them. Nothing affects Elo.</small>
    {coaching&&<div className="practice-review form-stack">
      <label>Live transcript · review before feedback<textarea value={transcript} readOnly={busy||speech.listening} maxLength={6000} onChange={e=>setTranscript(e.target.value)} placeholder="Your words appear here as you speak. You can also type or paste a response after recording."/></label>
      {speech.interim&&<p className="muted" aria-live="polite">{speech.interim}</p>}{speech.message&&<p role="status">{speech.message}</p>}
      <div className="delivery-grid"><div><strong>{metrics.words}</strong><span>Transcript words</span></div><div><strong>{metrics.wordsPerMinute??'—'}</strong><span>Estimated words/minute</span></div><div><strong>{delivery?.pauses??'—'}</strong><span>Pauses of about 2s+</span></div><div><strong>{metrics.fillers}</strong><span>Recognized “um”, “uh”, “you know”, “I mean”</span></div></div>
      {delivery&&<p>Recorded {delivery.seconds}s · audible sound in {delivery.audiblePercent}% of sampled moments · level variation {delivery.levelRangeDb??'—'} dB.</p>}
      <small>Approximate delivery measurements, not AI scores. Background noise, microphone settings and missed transcription words affect these numbers. They do not measure emotion, confidence or accent quality.</small>
      <LocalCoach transcript={transcript} prompt={prompt} goal={goal} delivery={delivery} disabled={busy||speech.listening}/>
    </div>}
  </section>
}
