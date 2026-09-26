export interface RecordingState {
  phase: "idle" | "requesting" | "recording" | "stopping"
  url: string
  message: string
}
export const recordingOff: RecordingState = { phase: "idle", url: "", message: "" }

/** In-memory recording only: no uploads, storage or external speech services. */
export class PracticeRecording {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private generation = 0
  private disposed = false
  private timer?: ReturnType<typeof setTimeout>
  private state = { ...recordingOff }
  constructor(private update: (state: RecordingState) => void) {}

  private emit(change: Partial<RecordingState>) {
    this.state = { ...this.state, ...change }
    if (!this.disposed) this.update(this.state)
  }

  async start(remaining: () => number = () => 60000, started: () => void = () => {}) {
    if (this.disposed || this.state.phase !== "idle") return
    const generation = ++this.generation
    this.emit({ phase: "requesting", message: "Allow microphone access to record your response." })
    try {
      if (!globalThis.MediaRecorder || !navigator.mediaDevices?.getUserMedia)
        throw new Error("Voice recording is unavailable in this browser. You can still type your response.")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      if (generation !== this.generation || this.disposed) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      this.stream = stream
      const duration = Math.min(60000, Math.max(0, remaining()))
      if (!duration) {
        this.releaseMicrophone()
        this.emit({ phase: "idle", message: "This practice has finished. Try again to record a response." })
        return
      }
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64000 })
      this.recorder = recorder
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => {
        if (generation === this.generation && event.data.size) chunks.push(event.data)
      }
      recorder.onstop = () => {
        if (generation !== this.generation || this.disposed) return
        this.releaseMicrophone()
        this.recorder = null
        const clip = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "audio/webm" })
        this.emit({ phase: "idle", url: clip.size ? URL.createObjectURL(clip) : "", message: clip.size ? "Recording ready. Play it back below." : "No audio was captured. Try recording again." })
      }
      recorder.onerror = () => {
        if (generation !== this.generation) return
        this.clear()
        this.emit({ message: "Recording stopped unexpectedly. Your microphone is off; you can try again or use text." })
      }
      stream.getAudioTracks().forEach((track) => { track.onended = () => this.stop() })
      recorder.start(1000)
      if (this.state.url) URL.revokeObjectURL(this.state.url)
      this.emit({ phase: "recording", url: "", message: "Microphone on · recording your response" })
      this.timer = setTimeout(() => this.stop(), duration)
      started()
    } catch (error) {
      if (generation !== this.generation || this.disposed) return
      this.releaseMicrophone()
      this.recorder = null
      this.emit({ phase: "idle", message: error instanceof DOMException && error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow it in your browser’s website settings, then try again. You can still use text."
        : error instanceof Error ? error.message : "The microphone could not start. You can still use text." })
    }
  }

  private releaseMicrophone() {
    clearTimeout(this.timer)
    this.stream?.getTracks().forEach((track) => { track.enabled = false; track.stop() })
    this.stream = null
  }

  stop() {
    if (this.state.phase === "requesting") {
      this.generation++
      this.emit({ phase: "idle", message: "Microphone off." })
    } else if (this.recorder?.state === "recording" || this.recorder?.state === "paused") {
      this.emit({ phase: "stopping", message: "Preparing your recording…" })
      this.recorder.stop()
    }
    this.releaseMicrophone()
  }

  clear() {
    this.generation++
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop()
    this.recorder = null
    this.releaseMicrophone()
    if (this.state.url) URL.revokeObjectURL(this.state.url)
    this.emit({ ...recordingOff })
  }

  dispose() { this.disposed = true; this.clear() }
}
