export class VoiceRoom {
  constructor(api, update) { this.api = api; this.update = update; this.peers = new Map(); this.pending = new Map(); this.cursor = 0; this.running = false; this.muted = false; this.blocked = new Set(); }
  async start(room, playerId, config) {
    this.stop(); this.room = room; this.playerId = playerId; this.config = config; this.running = true;
    try {
      if (room.role === 'contestant') this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!this.running) { this.stream?.getTracks().forEach(t => t.stop()); return; }
      this.sync(room);
      for (const member of room.participants.filter(p => !p.left && p.id !== playerId && (room.role === 'contestant' || p.role === 'contestant'))) {
        const pc = this.peer(member.id);
        if (playerId < member.id) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await this.send(member.id, 'offer', pc.localDescription.toJSON()); }
      }
      this.timer = setInterval(() => this.poll(), config.pollMs); await this.poll(); this.status();
    } catch (error) { this.stop(); throw new Error(error.name === 'NotAllowedError' ? 'Microphone permission was denied. You can still use the text response box.' : `Audio could not start: ${error.message}`); }
  }
  peer(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: this.config.iceServers }); this.peers.set(id, pc);
    const transceiver = pc.addTransceiver('audio', { direction: this.stream ? 'sendrecv' : 'recvonly' });
    if (this.stream) transceiver.sender.replaceTrack(this.stream.getAudioTracks()[0]);
    pc.onicecandidate = e => { if (e.candidate && this.running) this.send(id, 'candidate', e.candidate.toJSON()).catch(() => {}); };
    pc.onconnectionstatechange = () => this.status();
    pc.ontrack = e => {
      let audio = document.getElementById(`audio-${id}`);
      if (!audio) { audio = document.createElement('audio'); audio.id = `audio-${id}`; audio.autoplay = true; document.getElementById('remote-audio').append(audio); }
      audio.srcObject = e.streams[0] || new MediaStream([e.track]); audio.muted = this.blocked.has(id);
      audio.play().catch(() => this.update('Click “Play audio” to allow sound in this browser.'));
    };
    return pc;
  }
  async send(targetId, kind, payload) { if (this.running) return this.api(`rooms/${this.room.code}/signals`, { targetId, kind, payload }); }
  async poll() {
    if (!this.running || this.polling) return; this.polling = true;
    try {
      const data = await this.api(`rooms/${this.room.code}/signals?after=${this.cursor}`);
      if (!this.running) return;
      for (const signal of data.signals) {
        if (!this.room.participants.some(p => p.id === signal.senderId && !p.left)) continue;
        const pc = this.peer(signal.senderId);
        try {
          if (signal.kind === 'candidate') {
            if (pc.remoteDescription) await pc.addIceCandidate(signal.payload);
            else this.pending.set(signal.senderId, [...(this.pending.get(signal.senderId) || []), signal.payload]);
          } else {
            await pc.setRemoteDescription(signal.payload);
            for (const candidate of this.pending.get(signal.senderId) || []) await pc.addIceCandidate(candidate);
            this.pending.delete(signal.senderId);
            if (signal.kind === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); await this.send(signal.senderId, 'answer', pc.localDescription.toJSON()); }
          }
        } catch { this.update('Audio connection interrupted. Use “Reconnect audio” or submit text.'); }
      }
      this.cursor = data.cursor;
    } catch (error) { if (this.running) this.update(error.message); }
    finally { this.polling = false; }
  }
  sync(room, serverTime = room.serverTime) {
    this.room = room;
    if (!this.running) return;
    if (room.status !== 'active' || room.left) { this.stop(); return; }
    const elapsed = serverTime - room.startedAt;
    const speaker = elapsed >= 20000 && elapsed < 80000 ? 0 : elapsed < 140000 && elapsed >= 80000 ? 1 : elapsed >= 140000 && elapsed < 160000 ? 0 : elapsed >= 160000 && elapsed < 180000 ? 1 : null;
    this.stream?.getAudioTracks().forEach(t => { t.enabled = !this.muted && room.yourSlot === speaker; });
    for (const [id, pc] of this.peers) if (room.participants.find(p => p.id === id)?.left) { pc.close(); this.peers.delete(id); document.getElementById(`audio-${id}`)?.remove(); }
  }
  play() { document.querySelectorAll('#remote-audio audio').forEach(a => a.play().catch(() => {})); }
  setBlocked(ids) { this.blocked = new Set(ids); document.querySelectorAll('#remote-audio audio').forEach(a => { a.muted = this.blocked.has(a.id.slice(6)); }); }
  status() { if (this.running) this.update(`Audio: ${[...this.peers.values()].filter(p => p.connectionState === 'connected').length}/${this.peers.size} peer connections. ${this.config.relayConfigured ? '' : 'Some networks may need text fallback.'}`); }
  stop() { this.running = false; clearInterval(this.timer); this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; this.peers.forEach(p => p.close()); this.peers.clear(); this.pending.clear(); this.cursor = 0; document.getElementById('remote-audio').replaceChildren(); this.update('Audio is off.'); }
}
