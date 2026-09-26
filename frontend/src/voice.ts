import {
  PitchApi,
  type PitchRoomView,
  type Phase,
  type VoiceConfig,
  type VoiceMessage,
} from "../../client/pitch-api"

/** Browser-only live audio. No recording or paid relay. Owned by one mounted round. */
export class LiveAudio {
  private peers = new Map<string, RTCPeerConnection>()
  private pending = new Map<string, RTCIceCandidateInit[]>()
  private stream: MediaStream | null = null
  private controller: AbortController | null = null
  private generation = 0
  private timer?: ReturnType<typeof setTimeout>
  private cursor = 0
  private room: PitchRoomView | null = null
  private config: VoiceConfig | null = null
  private playerId = ""
  private phases: Phase[] = []
  private muted = false
  private blocked = new Set<string>()
  constructor(
    private api: PitchApi,
    private container: HTMLElement,
    private update: (value: string) => void,
  ) {}
  async start(
    room: PitchRoomView,
    playerId: string,
    config: VoiceConfig,
    phases: Phase[],
  ) {
    this.stop()
    const generation = this.generation
    this.controller = new AbortController()
    this.room = room
    this.playerId = playerId
    this.config = config
    this.phases = phases
    const serverOffset = room.serverTime - Date.now()
    try {
      if (!globalThis.RTCPeerConnection)
        throw new Error("This browser does not support live audio.")
      if (room.role === "contestant") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        })
        if (generation !== this.generation) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        this.stream = stream
      }
      this.sync(room, Date.now() + serverOffset)
      for (const member of room.participants.filter(
        (v) =>
          !v.left &&
          v.id !== playerId &&
          (room.role === "contestant" || v.role === "contestant"),
      )) {
        if (generation !== this.generation) return
        const pc = this.peer(member.id)
        if (playerId < member.id) {
          const offer = await pc.createOffer()
          if (generation !== this.generation) return
          await pc.setLocalDescription(offer)
          if (generation !== this.generation) return
          await this.send(member.id, {
            kind: "offer",
            payload: { type: "offer", sdp: pc.localDescription!.sdp },
          })
        }
      }
      if (generation === this.generation) {
        void this.poll(generation)
        this.status()
      }
    } catch (e) {
      if (generation !== this.generation) return
      this.stop()
      throw new Error(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission denied. You can still submit text."
          : `Audio could not start. ${
              e instanceof Error ? e.message : "Use the text fallback."
            }`,
      )
    }
  }
  private peer(id: string) {
    const existing = this.peers.get(id)
    if (existing) return existing
    const pc = new RTCPeerConnection({ iceServers: this.config!.iceServers })
    this.peers.set(id, pc)
    const transceiver = pc.addTransceiver("audio", {
      direction: this.stream ? "sendrecv" : "recvonly",
    })
    if (this.stream)
      void transceiver.sender.replaceTrack(this.stream.getAudioTracks()[0])
    pc.onicecandidate = (event) => {
      if (event.candidate && this.controller)
        void this.send(id, {
          kind: "candidate",
          payload: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment,
          },
        }).catch(() => {})
    }
    pc.onconnectionstatechange = () => this.status()
    pc.ontrack = (event) => {
      if (!this.controller) return
      let audio = this.container.querySelector<HTMLAudioElement>(
        `audio[data-player="${id}"]`,
      )
      if (!audio) {
        audio = document.createElement("audio")
        audio.dataset.player = id
        audio.autoplay = true
        this.container.append(audio)
      }
      audio.srcObject = event.streams[0] || new MediaStream([event.track])
      audio.muted = this.blocked.has(id)
      void audio
        .play()
        .catch(() => this.update("Select “Play audio” to allow sound."))
    }
    return pc
  }
  private async send(id: string, message: VoiceMessage) {
    if (this.controller && this.room)
      await this.api.sendSignal(this.room.code, id, message, {
        signal: this.controller.signal,
      })
  }
  private async poll(generation: number) {
    if (!this.controller || !this.room || generation !== this.generation) return
    try {
      const page = await this.api.signals(this.room.code, this.cursor, {
        signal: this.controller.signal,
      })
      if (generation !== this.generation) return
      for (const signal of page.signals) {
        if (
          !this.room.participants.some(
            (p) => p.id === signal.senderId && !p.left,
          )
        )
          continue
        const pc = this.peer(signal.senderId)
        try {
          if (signal.kind === "candidate") {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.payload)
            else
              this.pending.set(signal.senderId, [
                ...(this.pending.get(signal.senderId) || []),
                signal.payload,
              ])
          } else {
            await pc.setRemoteDescription(signal.payload)
            if (generation !== this.generation) return
            for (const candidate of this.pending.get(signal.senderId) || [])
              await pc.addIceCandidate(candidate)
            this.pending.delete(signal.senderId)
            if (signal.kind === "offer") {
              const answer = await pc.createAnswer()
              if (generation !== this.generation) return
              await pc.setLocalDescription(answer)
              if (generation !== this.generation) return
              await this.send(signal.senderId, {
                kind: "answer",
                payload: { type: "answer", sdp: pc.localDescription!.sdp },
              })
            }
          }
        } catch {
          if (generation === this.generation)
            this.update(
              "Audio connection interrupted. Reconnect audio or use text.",
            )
        }
        if (generation !== this.generation) return
      }
      this.cursor = page.cursor
    } catch (e) {
      if (generation === this.generation)
        this.update(e instanceof Error ? e.message : "Audio interrupted.")
    } finally {
      if (generation === this.generation && this.controller)
        this.timer = setTimeout(() => {
          void this.poll(generation)
        }, this.config!.pollMs)
    }
  }
  sync(room: PitchRoomView, now: number) {
    this.room = room
    if (!this.controller) return
    if (room.status !== "active" || room.left) {
      this.stop()
      return
    }
    let until = room.startedAt
    let speaker: number | null = null
    for (const phase of this.phases) {
      until += phase.seconds * 1000
      if (now < until) {
        speaker = phase.speaker
        break
      }
    }
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled =
        !this.muted && room.role === "contestant" && room.yourSlot === speaker
    })
    for (const [id, pc] of this.peers)
      if (room.participants.find((v) => v.id === id)?.left) {
        pc.close()
        this.peers.delete(id)
        this.container.querySelector(`audio[data-player="${id}"]`)?.remove()
      }
  }
  setMuted(muted: boolean) {
    this.muted = muted
    if (muted) this.stream?.getAudioTracks().forEach((t) => {
        t.enabled = false
      })
  }
  setBlocked(ids: string[]) {
    this.blocked = new Set(ids)
    this.container.querySelectorAll<HTMLAudioElement>("audio").forEach((a) => {
      a.muted = this.blocked.has(a.dataset.player!)
    })
  }
  play() {
    this.container.querySelectorAll("audio").forEach((a) => {
      void a.play().catch(() => {})
    })
  }
  private status() {
    if (this.controller)
      this.update(
        `Audio connected to ${[...this.peers.values()].filter((p) => p.connectionState === "connected").length}/${this.peers.size} peers. Some networks need text fallback.`,
      )
  }
  stop() {
    this.generation++
    this.controller?.abort()
    this.controller = null
    clearTimeout(this.timer)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.peers.forEach((p) => p.close())
    this.peers.clear()
    this.pending.clear()
    this.cursor = 0
    this.container.replaceChildren()
    this.update("Audio is off.")
  }
}
