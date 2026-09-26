import {
  PitchApi,
  type PitchRoomView,
  type Phase,
  type VoiceConfig,
  type VoiceMessage,
} from "../../client/pitch-api"

export interface AudioState {
  enabled: boolean
  microphone: "off" | "requesting" | "on"
  camera: "off" | "requesting" | "on"
  transmitting: boolean
  connected: number
  participants: number
  needsPlayback: boolean
  message: string
}

export const audioOff: AudioState = {
  enabled: false, microphone: "off", camera: "off", transmitting: false,
  connected: 0, participants: 0, needsPlayback: false, message: "",
}

interface Peer {
  pc: RTCPeerConnection
  sender: RTCRtpSender
  videoSender: RTCRtpSender
  ignoreOffer: boolean
}

/** One round's optional audio. Listening never requests access to the microphone. */
export class LiveAudio {
  private peers = new Map<string, Peer>()
  private pending = new Map<string, RTCIceCandidateInit[]>()
  private stream: MediaStream | null = null
  private cameraStream: MediaStream | null = null
  private controller: AbortController | null = null
  private generation = 0
  private micRequest = 0
  private cameraRequest = 0
  private timer?: ReturnType<typeof setTimeout>
  private cursor = 0
  private cursorRoom = ""
  private room: PitchRoomView | null = null
  private config: VoiceConfig | null = null
  private playerId = ""
  private phases: Phase[] = []
  private serverOffset = 0
  private blocked = new Set<string>()
  private state = { ...audioOff }
  constructor(
    private api: PitchApi,
    private container: HTMLElement,
    private update: (value: AudioState) => void,
    private preview?: HTMLVideoElement,
  ) {}

  private emit(change: Partial<AudioState>) {
    if (Object.entries(change).every(([key, value]) => this.state[key as keyof AudioState] === value)) return
    this.state = { ...this.state, ...change }
    this.update(this.state)
  }

  async start(room: PitchRoomView, playerId: string, config: VoiceConfig, phases: Phase[]) {
    this.stop()
    if (room.status !== "active" || room.left) throw new Error("This round has ended.")
    const generation = this.generation
    this.controller = new AbortController()
    this.room = room
    this.playerId = playerId
    this.config = config
    this.phases = phases
    this.serverOffset = room.serverTime - Date.now()
    // Keep the received cursor when reconnecting to this round; don't replay old answers.
    if (this.cursorRoom !== room.code) this.cursor = 0
    this.cursorRoom = room.code
    try {
      if (!globalThis.RTCPeerConnection) throw new Error("This browser does not support live voice.")
      for (const member of room.participants.filter(
        (v) => !v.left && v.id !== playerId && (room.role === "contestant" || v.role === "contestant"),
      )) {
        if (generation !== this.generation) return
        const { pc } = this.peer(member.id)
        // Either side can reconnect, even when the other side is already listening.
        const offer = await pc.createOffer()
        if (generation !== this.generation) return
        await pc.setLocalDescription(offer)
        if (generation !== this.generation) return
        await this.send(member.id, { kind: "offer", payload: { type: "offer", sdp: pc.localDescription!.sdp } })
      }
      if (generation === this.generation) {
        this.emit({ enabled: true })
        this.status()
        void this.poll(generation)
      }
    } catch (e) {
      if (generation !== this.generation) return
      this.stop()
      throw new Error(e instanceof Error ? e.message : "Voice could not connect. You can still use text.")
    }
  }

  async enableMicrophone() {
    if (!this.controller || !this.state.enabled || this.room?.role !== "contestant" || this.state.microphone !== "off") return
    const generation = this.generation
    const request = ++this.micRequest
    this.emit({ microphone: "requesting", message: "Allow microphone access to speak." })
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable in this browser.")
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
      })
      // A cancelled permission prompt must never turn the microphone on later.
      if (generation !== this.generation || request !== this.micRequest) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      stream.getAudioTracks().forEach((t) => { t.enabled = false })
      this.stream = stream
      const track = stream.getAudioTracks()[0]
      if (!track) throw new Error("No microphone was found.")
      track.onended = () => {
        if (this.stream === stream) {
          this.disableMicrophone()
          this.emit({ message: "Microphone disconnected. Connect it and turn it on again." })
        }
      }
      await Promise.all([...this.peers.values()].map(({ sender }) => sender.replaceTrack(track)))
      if (generation !== this.generation || request !== this.micRequest) return
      this.emit({ microphone: "on", message: "" })
      this.sync(this.room!, Date.now() + this.serverOffset)
    } catch (e) {
      if (generation !== this.generation || request !== this.micRequest) return
      this.disableMicrophone()
      this.emit({ message: e instanceof DOMException && e.name === "NotAllowedError"
        ? "Microphone permission denied. You can still listen and use text. Allow microphone access in your browser to try again."
        : `${e instanceof Error ? e.message : "Microphone could not start."} You can still listen and use text.` })
    }
  }

  disableMicrophone() {
    this.micRequest++
    this.stream?.getTracks().forEach((t) => { t.enabled = false; t.stop() })
    this.stream = null
    for (const { sender } of this.peers.values()) void sender.replaceTrack(null).catch(() => {})
    this.emit({ microphone: "off", transmitting: false, message: "" })
  }

  async enableCamera() {
    if (!this.controller || !this.state.enabled || this.room?.role !== "contestant" || this.state.camera !== "off") return
    const generation = this.generation, request = ++this.cameraRequest
    this.emit({ camera: "requesting", message: "Allow camera access to share video with this round’s participants." })
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this browser.")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 24 } } })
      if (generation !== this.generation || request !== this.cameraRequest) { stream.getTracks().forEach((track) => track.stop()); return }
      this.cameraStream = stream
      const track = stream.getVideoTracks()[0]
      if (!track) throw new Error("No camera was found.")
      track.onended = () => { if (this.cameraStream === stream) { this.disableCamera(); this.emit({ message: "Camera disconnected. Turn it on again to retry." }) } }
      await Promise.all([...this.peers.values()].map(({ videoSender }) => videoSender.replaceTrack(track)))
      if (generation !== this.generation || request !== this.cameraRequest) return
      if (this.preview) { this.preview.srcObject = stream; void this.preview.play().catch(() => {}) }
      this.emit({ camera: "on", message: "" })
    } catch (error) {
      if (generation !== this.generation || request !== this.cameraRequest) return
      this.disableCamera()
      this.emit({ message: error instanceof DOMException && error.name === "NotAllowedError" ? "Camera permission denied. Voice and text are still available." : `${error instanceof Error ? error.message : "Camera could not start."} Voice and text are still available.` })
    }
  }

  disableCamera() {
    this.cameraRequest++
    this.cameraStream?.getTracks().forEach((track) => { track.enabled = false; track.stop() })
    this.cameraStream = null
    if (this.preview) this.preview.srcObject = null
    for (const { videoSender } of this.peers.values()) void videoSender.replaceTrack(null).catch(() => {})
    this.emit({ camera: "off", message: "" })
  }

  private peer(id: string): Peer {
    const existing = this.peers.get(id)
    if (existing) return existing
    const generation = this.generation
    const pc = new RTCPeerConnection({ iceServers: this.config!.iceServers })
    // Reserve the sending channel so microphone on/off doesn't interrupt listening.
    const { sender } = pc.addTransceiver("audio", { direction: this.room!.role === "contestant" ? "sendrecv" : "recvonly" })
    const { sender: videoSender } = pc.addTransceiver("video", { direction: this.room!.role === "contestant" ? "sendrecv" : "recvonly" })
    const peer = { pc, sender, videoSender, ignoreOffer: false }
    this.peers.set(id, peer)
    if (this.stream) void sender.replaceTrack(this.stream.getAudioTracks()[0]).catch(() => {})
    if (this.cameraStream) void videoSender.replaceTrack(this.cameraStream.getVideoTracks()[0]).catch(() => {})
    pc.onicecandidate = (event) => {
      if (event.candidate && this.controller && generation === this.generation)
        void this.send(id, { kind: "candidate", payload: {
          candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex, usernameFragment: event.candidate.usernameFragment,
        } }).catch(() => {})
    }
    pc.onconnectionstatechange = () => { if (generation === this.generation) this.status() }
    pc.ontrack = (event) => {
      if (!this.controller || generation !== this.generation) return
      if (event.track.kind === "video") {
        this.container.querySelector(`figure[data-player="${id}"]`)?.remove()
        const tile = document.createElement("figure"), video = document.createElement("video"), caption = document.createElement("figcaption")
        tile.dataset.player = id
        video.dataset.player = id
        video.autoplay = true; video.playsInline = true; video.muted = true
        video.srcObject = new MediaStream([event.track])
        caption.textContent = this.room?.participants.find((person) => person.id === id)?.name || "Contestant"
        tile.append(video, caption); this.container.append(tile)
        const visibility = () => { tile.hidden = event.track.muted || event.track.readyState === "ended" || this.blocked.has(id) }
        event.track.onmute = visibility; event.track.onunmute = visibility; event.track.onended = visibility
        visibility()
        void video.play().catch(() => { if (generation === this.generation) this.emit({ needsPlayback: true }) })
        return
      }
      let audio = this.container.querySelector<HTMLAudioElement>(`audio[data-player="${id}"]`)
      if (!audio) {
        audio = document.createElement("audio")
        audio.dataset.player = id
        audio.autoplay = true
        this.container.append(audio)
      }
      audio.srcObject = new MediaStream([event.track])
      audio.muted = this.blocked.has(id)
      void audio.play().catch(() => {
        if (generation === this.generation) this.emit({ needsPlayback: true })
      })
    }
    return peer
  }

  private async send(id: string, message: VoiceMessage) {
    if (this.controller && this.room)
      await this.api.sendSignal(this.room.code, id, message, { signal: this.controller.signal })
  }

  private async poll(generation: number) {
    if (!this.controller || !this.room || generation !== this.generation) return
    try {
      const page = await this.api.signals(this.room.code, this.cursor, { signal: this.controller.signal })
      if (generation !== this.generation) return
      for (const signal of page.signals) {
        const member = this.room.participants.find((p) => p.id === signal.senderId && !p.left)
        if (!member || (this.room.role === "judge" && member.role === "judge")) continue
        const peer = this.peer(signal.senderId)
        const { pc } = peer
        try {
          if (signal.kind === "candidate") {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.payload)
            else this.pending.set(signal.senderId, [...(this.pending.get(signal.senderId) || []), signal.payload])
          } else {
            // Deterministic polite/impolite roles resolve simultaneous joins/reconnects.
            const collision = signal.kind === "offer" && pc.signalingState !== "stable"
            peer.ignoreOffer = collision && this.playerId < signal.senderId
            if (peer.ignoreOffer) { this.pending.delete(signal.senderId); continue }
            if (signal.kind === "answer" && pc.signalingState !== "have-local-offer") continue
            await pc.setRemoteDescription(signal.payload)
            if (generation !== this.generation) return
            for (const candidate of this.pending.get(signal.senderId) || []) {
              await pc.addIceCandidate(candidate).catch(() => {})
              if (generation !== this.generation) return
            }
            this.pending.delete(signal.senderId)
            if (signal.kind === "offer") {
              const answer = await pc.createAnswer()
              if (generation !== this.generation) return
              await pc.setLocalDescription(answer)
              if (generation !== this.generation) return
              await this.send(signal.senderId, { kind: "answer", payload: { type: "answer", sdp: pc.localDescription!.sdp } })
            }
          }
        } catch {
          if (generation === this.generation && signal.kind !== "candidate")
            this.emit({ message: "Voice connection interrupted. Reconnect voice or use text." })
        }
        if (generation !== this.generation) return
      }
      this.cursor = page.cursor
    } catch (e) {
      if (generation === this.generation) this.emit({ message: e instanceof Error ? e.message : "Voice interrupted." })
    } finally {
      if (generation === this.generation && this.controller)
        this.timer = setTimeout(() => { void this.poll(generation) }, this.config!.pollMs)
    }
  }

  sync(room: PitchRoomView, now: number) {
    if (room.serverTime !== this.room?.serverTime) this.serverOffset = room.serverTime - Date.now()
    this.room = room
    if (!this.controller) return
    if (room.status !== "active" || room.left) { this.stop(); return }
    let until = room.startedAt
    let speaker: number | null = null
    for (const phase of this.phases) {
      until += phase.seconds * 1000
      if (now < until) { speaker = phase.speaker; break }
    }
    const transmitting = this.state.microphone === "on" && room.role === "contestant" && room.yourSlot === speaker
    this.stream?.getAudioTracks().forEach((t) => { t.enabled = transmitting })
    this.emit({ transmitting })
    for (const [id, { pc }] of this.peers) {
      if (room.participants.find((v) => v.id === id)?.left) {
        this.peers.delete(id)
        this.pending.delete(id)
        pc.close()
        this.container.querySelector(`audio[data-player="${id}"]`)?.remove()
        this.container.querySelector(`figure[data-player="${id}"]`)?.remove()
      }
    }
    this.status()
  }

  setBlocked(ids: string[]) {
    this.blocked = new Set(ids)
    this.container.querySelectorAll<HTMLAudioElement>("audio").forEach((a) => { a.muted = this.blocked.has(a.dataset.player!) })
    this.container.querySelectorAll<HTMLElement>("figure").forEach((tile) => {
      const track = (tile.querySelector("video")?.srcObject as MediaStream | null)?.getVideoTracks()[0]
      tile.hidden = this.blocked.has(tile.dataset.player!) || !track || track.muted || track.readyState === "ended"
    })
  }

  async play() {
    const generation = this.generation
    const results = await Promise.allSettled([...this.container.querySelectorAll<HTMLMediaElement>("audio,video")].map((a) => a.play()))
    if (generation === this.generation) this.emit({ needsPlayback: results.some((r) => r.status === "rejected") })
  }

  private status() {
    if (!this.controller) return
    this.emit({ connected: [...this.peers.values()].filter(({ pc }) => pc.connectionState === "connected").length, participants: this.peers.size })
  }

  stop() {
    this.generation++
    this.controller?.abort()
    this.controller = null
    clearTimeout(this.timer)
    this.disableMicrophone()
    this.disableCamera()
    this.peers.forEach(({ pc }) => pc.close())
    this.peers.clear()
    this.pending.clear()
    this.container.replaceChildren()
    this.emit({ ...audioOff })
  }
}
