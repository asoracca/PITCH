/** Owns the local preview until a round takes over its tracks. */
export class LobbyMedia {
  private stream: MediaStream | null = null
  private request = 0

  async prepare(audio: boolean, video: boolean): Promise<MediaStream | null> {
    this.stop()
    const request = this.request
    if (!audio && !video) return null
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera and microphone are unavailable. You can still use text.')
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      video: video ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15, max: 24 } } : false,
    })
    if (request !== this.request) { stream.getTracks().forEach(track => track.stop()); return null }
    this.stream = stream
    return stream
  }

  take() { const stream = this.stream; this.stream = null; return stream }

  stop() {
    this.request++
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
  }
}
