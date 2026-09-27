export interface TranscriptState { text: string; interim: string; listening: boolean; message: string }
export const transcriptOff: TranscriptState = { text: '', interim: '', listening: false, message: '' }
type Result = { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
export function recognitionConstructor(): (new () => Recognition) | undefined {
  const browser = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return browser.SpeechRecognition || browser.webkitSpeechRecognition
}
/** Browser recognition may use the browser vendor's speech service; no PITCH upload. */
export class PracticeTranscript {
  private recognition: Recognition | null = null
  private state = { ...transcriptOff }
  private running = false
  private generation = 0
  private retry?: ReturnType<typeof setTimeout>
  private finishTimer?: ReturnType<typeof setTimeout>
  private retries = 0
  constructor(private update: (value: TranscriptState) => void) {}
  private emit(change: Partial<TranscriptState>) { this.state = { ...this.state, ...change }; this.update(this.state) }
  start() {
    this.abort(); this.state = { ...transcriptOff }; this.retries = 0
    if (!recognitionConstructor()) { this.emit({ message: 'Live transcription is unavailable in this browser. Type or paste your response below for feedback.' }); return }
    this.running = true; this.listen(this.generation)
  }
  private listen(generation: number) {
    if (!this.running || generation !== this.generation) return
    const Recognition = recognitionConstructor()!
    const recognition = new Recognition(), prefix = this.state.text
    this.recognition = recognition
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      if (generation !== this.generation) return
      let text = '', interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) text += result[0].transcript + ' '
        else interim += result[0].transcript + ' '
      }
      this.retries = 0
      this.emit({ text: (prefix + ' ' + text).trim().slice(0,6000), interim: interim.trim().slice(0,1500) })
    }
    recognition.onerror = (event) => {
      if (generation !== this.generation) return
      if (event.error === 'no-speech') return
      this.running = false
      this.emit({ listening: false, message: event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Speech recognition permission was denied. Recording can continue; type your transcript below.' : 'Live transcription stopped. Check browser speech settings or type your response below.' })
    }
    recognition.onend = () => {
      if (generation !== this.generation) return
      clearTimeout(this.finishTimer)
      this.recognition = null
      this.keepPendingWords()
      this.emit({ listening: false, interim: '', ...(this.running ? {} : {message: this.state.message.startsWith('Live transcription ·') ? (this.state.text ? 'Transcript ready. Review your words.' : 'No speech detected. Try again or type your response.') : this.state.message}) })
      if (this.running && ++this.retries <= 3) this.retry = setTimeout(() => this.listen(generation), 300)
      else if (this.running) { this.running = false; this.emit({ message: 'Transcription paused after repeated interruptions. Type missing words below or try a new recording.' }) }
    }
    try { recognition.start(); this.emit({ listening: true, message: 'Live transcription · English. Review it for mistakes before evaluating.' }) }
    catch { this.running = false; this.emit({ listening: false, message: 'Transcription could not start. You can still record and type your response.' }) }
  }
  private keepPendingWords() {
    if(this.state.interim)this.emit({text: [this.state.text,this.state.interim].filter(Boolean).join(' ').slice(0,6000),interim: ''})
  }
  stop() {
    this.running = false; clearTimeout(this.retry)
    try { this.recognition?.stop() } catch { this.abort() }
    if(this.recognition)this.finishTimer = setTimeout(() => { this.keepPendingWords(); this.abort() }, 1500)
  }
  abort() {
    this.generation++; this.running = false; clearTimeout(this.retry); clearTimeout(this.finishTimer)
    if (this.recognition) { this.recognition.onresult = null; this.recognition.onerror = null; this.recognition.onend = null; this.recognition.abort() }
    this.recognition = null
    this.emit({ listening: false, interim: '' })
  }
}
