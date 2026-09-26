import { useEffect, useRef, useState } from 'react'
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm'
import type { Delivery } from './delivery'
import { Button } from './design'
import { coachMessages } from './coach-prompt'

export function LocalCoach({ transcript, prompt, goal, delivery, disabled }: { transcript: string; prompt: string; goal: string; delivery: Delivery | null; disabled: boolean }) {
  const worker = useRef<Worker | null>(null), engine = useRef<WebWorkerMLCEngine | null>(null), generation = useRef(0)
  const input = JSON.stringify({ transcript, prompt, goal, delivery, disabled })
  const latestInput = useRef(input); latestInput.current = input
  const [status,setStatus] = useState<'idle'|'loading'|'ready'|'evaluating'>('idle')
  const [message,setMessage] = useState(''), [answer,setAnswer] = useState(''), [progress,setProgress] = useState(0)
  const [supported,setSupported] = useState<boolean | null>(null)
  useEffect(()=>{setSupported('gpu' in navigator);return()=>{generation.current++;worker.current?.terminate();worker.current=null;engine.current=null}},[])
  useEffect(()=>{setAnswer('')},[input])
  function cancel() { generation.current++;worker.current?.terminate();worker.current=null;engine.current=null;setStatus('idle');setProgress(0);setMessage('Stopped. Your transcript is still here.') }
  async function load() {
    const current=++generation.current;setStatus('loading');setMessage('Preparing the free on-device coach…')
    try {
      const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm')
      if(current!==generation.current)return
      const thread=new Worker(new URL('./coach.worker.ts',import.meta.url),{type:'module'});worker.current=thread
      const loaded=await CreateWebWorkerMLCEngine(thread,'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',{initProgressCallback:p=>{if(current===generation.current){setProgress(Math.max(0,Math.min(1,p.progress)));setMessage(p.text)}},logLevel:'SILENT'},{context_window_size:4096})
      if(current!==generation.current)return
      engine.current=loaded;setStatus('ready');setMessage('Coach ready. Review the transcript, then ask for feedback.')
    }catch{if(current===generation.current){worker.current?.terminate();worker.current=null;engine.current=null;setStatus('idle');setMessage('This device could not load the AI model. Try a WebGPU-capable desktop browser with free memory. Your recording and transcript still work.')}}
  }
  async function evaluate() {
    if(!engine.current||disabled||transcript.trim().length<30)return
    const current=generation.current, evaluatedInput=latestInput.current;setStatus('evaluating');setAnswer('');setMessage('Evaluating your transcript on this device…')
    try {
      const reply=await engine.current.chat.completions.create({messages:coachMessages(prompt,goal,transcript,delivery),max_tokens:350,temperature:.3})
      if(current!==generation.current)return
      if(evaluatedInput!==latestInput.current){setStatus('ready');setMessage('Your response changed. Evaluate the updated transcript for fresh feedback.');return}
      const text=reply.choices[0]?.message.content?.trim()
      if(!text)throw Error('Empty response')
      setAnswer(text);setStatus('ready');setMessage('AI feedback · experimental. Check it against what you actually said.')
    }catch{if(current===generation.current){setStatus('ready');setMessage('Feedback could not finish. Try a shorter transcript or reload the coach.')}}
  }
  const busy=status==='loading'||status==='evaluating'
  return <section className="local-coach form-stack">
    <h3 className="heading">AI feedback · on your device</h3>
    <p>Free, optional AI feedback on your words. The first load downloads a model of roughly 1 GB from Hugging Face and MLC and may take several minutes. The model can be cached by your browser. Your transcript and recording are not sent to this AI service.</p>
    <p>This coach reads the transcript and approximate delivery measurements. It does not hear your voice or analyze your face.</p>
    {supported===false?<p>On-device AI needs WebGPU, which this browser does not expose. You can still record, review your transcript and use the delivery measurements.</p>:<div className="hero-actions">{status==='idle'?<Button disabled={disabled||supported===null} onClick={()=>void load()}>Load free AI coach</Button>:status==='ready'?<><Button disabled={disabled||transcript.trim().length<30} onClick={()=>void evaluate()}>Evaluate my response</Button><Button variant="ghost" onClick={cancel}>Unload coach</Button></>:<Button variant="secondary" onClick={cancel}>{status==='loading'?'Cancel download':'Stop evaluation'}</Button>}</div>}
    {status==='loading'&&<progress value={progress} max={1} aria-label="AI model download progress"/>}
    {message&&<p role="status">{message}</p>}
    {!busy&&transcript.trim().length<30&&<small>Add at least 30 characters to the transcript to evaluate it.</small>}
    {answer&&<div className="coach-answer preserve-lines">{answer}</div>}
  </section>
}
