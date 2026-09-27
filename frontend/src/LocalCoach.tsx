import { useEffect, useId, useRef, useState } from 'react'
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import type { Delivery } from './delivery'
import { Button } from './design'
import { coachMessages } from './coach-prompt'
import { ReviewHeading } from './PracticeReview'
import { CoachFeedback } from './CoachFeedback'

export function LocalCoach({ transcript, prompt, goal, delivery, disabled, available = true, onFeedbackChange }: { transcript: string; prompt: string; goal: string; delivery: Delivery | null; disabled: boolean; available?: boolean; onFeedbackChange?: (answer: string) => void }) {
  const worker = useRef<Worker | null>(null), engine = useRef<WebWorkerMLCEngine | null>(null), generation = useRef(0)
  const input = JSON.stringify({ transcript, prompt, goal, delivery, disabled })
  const latestInput = useRef(input); latestInput.current = input
  const [status,setStatus] = useState<'idle'|'loading'|'ready'|'evaluating'>('idle')
  const [message,setMessage] = useState(''), [answer,setAnswer] = useState(''), [progress,setProgress] = useState(0)
  const [supported,setSupported] = useState<boolean | null>(null)
  useEffect(()=>{setSupported('gpu' in navigator);return()=>{generation.current++;worker.current?.terminate();worker.current=null;engine.current=null}},[])
  const onFeedback = useRef(onFeedbackChange); onFeedback.current = onFeedbackChange
  const hintId = useId()
  useEffect(()=>{setAnswer('');onFeedback.current?.('')},[input])
  function cancel() { generation.current++;worker.current?.terminate();worker.current=null;engine.current=null;setStatus('idle');setProgress(0);setMessage('Coach stopped. Your response is still here.') }
  async function load() {
    const current=++generation.current;setStatus('loading');setMessage('Preparing the free on-device coach…')
    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
      if(current!==generation.current)return
      const thread=new Worker(new URL('./coach.worker.ts',import.meta.url),{type:'module'});worker.current=thread
      const loaded=await CreateWebWorkerMLCEngine(thread,'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',{initProgressCallback:p=>{if(current===generation.current){setProgress(Math.max(0,Math.min(1,p.progress)));setMessage(p.progress >= 1 ? 'Starting your coach…' : 'Preparing your coach. First setup can take a few minutes.')}},logLevel:'SILENT'},{context_window_size:4096})
      if(current!==generation.current)return
      engine.current=loaded;setStatus('ready');setMessage('Ready when you are.')
    }catch{if(current===generation.current){worker.current?.terminate();worker.current=null;engine.current=null;setStatus('idle');setMessage('This device could not load the AI model. Try a WebGPU-capable desktop browser with free memory. Your recording and transcript still work.')}}
  }
  async function evaluate() {
    if(!engine.current||disabled||transcript.trim().length<30)return
    const current=generation.current, evaluatedInput=latestInput.current;setStatus('evaluating');setAnswer('');onFeedback.current?.('');setMessage('Evaluating your transcript on this device…')
    try {
      const reply=await engine.current.chat.completions.create({messages:coachMessages(prompt,goal,transcript,delivery),max_tokens:240,temperature:.3})
      if(current!==generation.current)return
      if(evaluatedInput!==latestInput.current){setStatus('ready');setMessage('Your response changed. Evaluate the updated transcript for fresh feedback.');return}
      const text=reply.choices[0]?.message.content?.trim()
      if(!text)throw Error('Empty response')
      setAnswer(text);onFeedback.current?.(text);setStatus('ready');setMessage('Feedback ready. Choose one thing to try next.')
    }catch{if(current===generation.current){setStatus('ready');setMessage('Feedback could not finish. Try a shorter transcript or reload the coach.')}}
  }
  const busy=status==='loading'||status==='evaluating'
  const missing = Math.max(0,30-transcript.trim().length)
  const hint = disabled ? 'Finish recording before asking for feedback.' : missing ? `Add a little more detail (${missing} more characters).` : 'Your response is ready for feedback.'
  if (!available) return null
  return <section className="review-step local-coach">
    {answer && <ReviewHeading step={3} title="Your feedback" description="One strength. One improvement. An example to try."
      />}
    {!answer && <div className="coach-setup-heading"><strong>Ready for feedback?</strong></div>}
    <div className="coach-availability">
      <span className={`review-badge ${status==='ready'?'badge-ready':''}`}>{status==='loading'?'Setting up':status==='evaluating'?'Thinking':status==='ready'?'Coach ready':'Free · optional'}</span></div>
    {supported===false ? <p>This browser cannot run the free coach. You can still review your words and delivery above.</p> : <>
      {(status==='idle'||status==='loading') && <p className="coach-setup-note">First setup: about 1 GB to download. Allow a few minutes.</p>}
      <div className="coach-controls">
        {status==='idle' ? <Button disabled={disabled||supported===null} onClick={()=>void load()}>Set up free coach</Button> : status==='ready' ? <>
          <Button aria-describedby={hintId} disabled={disabled||missing>0} onClick={()=>void evaluate()}>Get feedback</Button>
          <Button variant="ghost" onClick={cancel}>Turn coach off</Button>
        </> : <Button variant="secondary" onClick={cancel}>{status==='loading'?'Cancel setup':'Stop feedback'}</Button>}
        {!busy && <span id={hintId} className="coach-action-hint">{hint}</span>}
      </div>
    </>}
    {status==='loading' && <div className="coach-progress"><div><span>Setting up on your device</span><strong>{Math.round(progress*100)}%</strong></div><progress value={progress} max={1} aria-label="Coach setup progress" /></div>}
    {message && <p className="coach-status" role="status">{message}</p>}
    {answer && <CoachFeedback answer={answer} />}
    <details className="review-details">
      <summary>How the free coach works</summary>
      <p>AI reads your transcript and approximate measurements on this device. It does not hear your voice or analyze your face. Feedback is experimental, so check it against what you said.</p>
      <p>The model downloads from Hugging Face and MLC and may be cached by your browser. It needs WebGPU and enough device memory. Your response is not sent to those services.</p>
    </details>
  </section>
}
