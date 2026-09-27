export interface Delivery { seconds: number; samples: number; audiblePercent: number; pauses: number; levelRangeDb: number | null }
export function summarizeDelivery(levels: number[], seconds: number): Delivery {
  let audible = 0, pause = 0, pauses = 0, heard = false
  const voiced: number[] = []
  for (const level of levels) {
    if (level > 0.012) { audible++; voiced.push(20*Math.log10(level)); if (heard && pause >= 20) pauses++; heard = true; pause = 0 }
    else if (heard) pause++
  }
  voiced.sort((a,b)=>a-b)
  return { seconds: Math.round(seconds*10)/10, samples: levels.length, audiblePercent: levels.length ? Math.round(audible/levels.length*100) : 0, pauses,
    levelRangeDb: voiced.length > 10 ? Math.round(voiced[Math.floor(voiced.length*.9)]-voiced[Math.floor(voiced.length*.1)]) : null }
}
export function transcriptMetrics(text: string, delivery: Delivery | null) {
  const words = text.trim().match(/\b[\p{L}\p{N}]+(?:['’][\p{L}]+)?\b/gu)?.length || 0
  return { words, wordsPerMinute: delivery && delivery.seconds >= 10 && words >= 10 ? Math.round(words/delivery.seconds*60) : null,
    fillers: text.match(/\b(um+|uh+|erm+|you know|i mean)\b/gi)?.length || 0 }
}
/** Approximate recording measurements, never emotion, accent or personality assessment. */
export class DeliveryMeter {
  private context?: AudioContext
  private timer?: ReturnType<typeof setInterval>
  private levels: number[] = []
  private started = 0
  start(stream: MediaStream) {
    this.stop(); this.levels = []; this.started = performance.now()
    try {
      this.context = new AudioContext()
      const analyser = this.context.createAnalyser(); analyser.fftSize = 2048
      this.context.createMediaStreamSource(stream).connect(analyser)
      const data = new Float32Array(analyser.fftSize)
      void this.context.resume().catch(()=>{})
      this.timer = setInterval(() => { if (this.context?.state !== 'running') return; analyser.getFloatTimeDomainData(data); this.levels.push(Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length)) },100)
    } catch { this.context = undefined }
  }
  stop(): Delivery | null {
    clearInterval(this.timer); if (this.context) void this.context.close().catch(()=>{}); this.context = undefined
    return this.started && this.levels.length ? summarizeDelivery(this.levels,(performance.now()-this.started)/1000) : null
  }
}
