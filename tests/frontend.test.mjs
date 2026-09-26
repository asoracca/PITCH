import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const result = await build({ stdin: { contents: `export * from './src/model'; export { LiveAudio } from './src/voice'; export { Dashboard, Profile, Leaderboard, Coach, Auth } from './src/screens'; export { AvatarCharacter, Logo } from './src/design'; export { Match } from './src/Match'; export { PracticeRecording } from './src/practice-recording'; export { Practice } from './src/screens'; export { DemoMatch } from './src/DemoMatch'; export { createElement } from 'react'; export { renderToStaticMarkup } from 'react-dom/server';`, resolveDir: resolve('frontend'), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, external: ['node:*'] });
const temp = mkdtempSync(join(tmpdir(), 'pitch-ui-test-'));
const file = join(temp, 'render.cjs'); writeFileSync(file, result.outputFiles[0].text);
const ui = createRequire(import.meta.url)(file); rmSync(temp, { recursive: true, force: true });
const scenario = { id: 'test', title: 'Discuss a deadline', prompt: 'Negotiate a deadline respectfully.', goal: 'Give a clear next step.', category: 'career', band: '18–22', positions: null };
const now = Date.now();
const room = { code: 'ABCDEF12', id: 'room', status: 'active', band: '18–22', scenario, yourPosition: null, serverTime: now, startedAt: now - 1000, phase: { key: 'opening-a', label: 'Contestant A · opening', speaker: 0, index: 1, seconds: 60, deadline: now + 60000, expired: false }, role: 'contestant', yourSlot: 0, left: false, participants: [{ id: 'self', name: 'Alex', role: 'contestant', slot: 0, left: false, position: null, submitted: false }, { id: 'other', name: 'Taylor', role: 'contestant', slot: 1, left: false, position: null, submitted: false }], responses: [], ballotSubmitted: false, ballotsReceived: 0, result: null, feedback: [] };
const p = { api: {}, session: { player: { id: 'self', name: 'Alex' } }, config: { scenarios: [scenario], rules: { phases: [room.phase] } }, me: { player: { id: 'self', name: 'Alex' }, ageBand: '18–22', rating: { value: 1064, games: 4, provisional: true, placementGamesRemaining: 6 }, judge: { reliability: 79, roundsCompleted: 2, progressToCredit: 0 }, priorityCredits: 1, bannedUntil: 0, blockedPlayers: [] }, history: { history: [], averages: {}, byCategory: [] }, leaders: { band: '18–22', weekStartsAt: now, players: [] }, queue: { status: 'idle', serverTime: now }, room: null, busy: false, act: async () => {}, refresh: async () => {}, join: async () => {} };
const render = (component, props) => ui.renderToStaticMarkup(ui.createElement(component, props));
test('saved sessions reject malformed and expired values; countdown respects server deadlines', () => {
  assert.equal(ui.savedSession('garbage'), null); assert.equal(ui.savedSession(JSON.stringify({ token: 'x', expiresAt: now - 1, player: { id: 'self', name: 'Alex' } }), now), null);
  assert.equal(ui.countdown(now - 1, now), '0:00'); assert.equal(ui.countdown(now + 65000, now), '1:05');
  assert.equal(ui.canRespond(room, now), true); assert.equal(ui.canRespond({ ...room, yourSlot: 1 }, now), false); assert.equal(ui.canRespond(room, now + 60000), false);
});
test('late room polls cannot reverse a finished result or accepted scorecard', () => {
  const finished = { ...room, status: 'finished', serverTime: now + 2 };
  assert.equal(ui.mergeRoom(finished, { ...room, serverTime: now + 5 }), finished);
  assert.equal(ui.mergeRoom({ ...room, ballotSubmitted: true }, { ...room, serverTime: now + 1 }).ballotSubmitted, true);
});
test('connected dashboard, profile and leaderboard render server data and honest empty states', () => {
  const dashboard = render(ui.Dashboard, { p, navigate: () => {}, equipped: {} });
  assert.match(dashboard, /Alex/); assert.match(dashboard, /1064/); assert.doesNotMatch(dashboard, /Jordan|2,450|1,240|12 days|#184/);
  const profile = render(ui.Profile, { p, navigate: () => {}, equipped: {} });
  assert.match(profile, /500 days/); assert.match(profile, /fictional demo data/); assert.match(profile, /Real activity/); assert.match(profile, /No avatar selected/);
  assert.match(render(ui.Leaderboard, { p }), /No rated rounds/);
  assert.match(render(ui.Coach, { navigate: () => {} }), /AI COACH · NOT ENABLED/);
});
test('live round renders server participants, judge form and result instead of simulated opponents', () => {
  const contestant = render(ui.Match, { p: { ...p, room } });
  assert.match(contestant, /Taylor/); assert.match(contestant, /Submit response/); assert.match(contestant, /Connect voice &amp; video/); assert.match(contestant, /Turn microphone on/); assert.match(contestant, /with or without voice/); assert.match(contestant, /Voice &amp; video disabled/); assert.doesNotMatch(contestant, /Maya|Sofia|ANALYZING BOTH RESPONSES/);
  const judging = render(ui.Match, { p: { ...p, room: { ...room, role: 'judge', yourSlot: 2, phase: { ...room.phase, key: 'judging', speaker: null } } } });
  assert.doesNotMatch(judging, /Turn microphone on/); assert.match(judging, /Submit scorecard/); assert.match(judging, /persuasiveness/);
});

async function withAudio(getUserMedia, run) {
  const descriptors = ['navigator', 'RTCPeerConnection'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const peers = [], instances = [], sent = [];
  let latest = { enabled: false, microphone: 'off', transmitting: false };
  class Peer {
    constructor() { this.signalingState = 'stable'; this.connectionState = 'new'; this.senders = {}; peers.push(this); }
    addTransceiver(kind, options) { this.direction = options.direction; const sender = { track: null, replaceTrack: async track => { sender.track = track; } }; this.senders[kind] = sender; if (kind === 'audio') this.sender = sender; return { sender }; }
    async createOffer() { return { type: 'offer', sdp: 'offer' }; }
    async createAnswer() { return { type: 'answer', sdp: 'answer' }; }
    async setLocalDescription(description) { this.localDescription = description; this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable'; }
    async setRemoteDescription(description) { this.remoteDescription = description; this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }
    async addIceCandidate() {}
    close() { this.connectionState = 'closed'; }
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
  Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value: Peer });
  const api = { sendSignal: async (code, id, message) => { sent.push({ id, ...message }); }, signals: async () => ({ signals: [], cursor: 0 }) };
  const container = { replaceChildren() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
  const make = () => { const a = new ui.LiveAudio(api, container, state => { latest = state; }); instances.push(a); return a; };
  try { await run({ make, peers, sent, api, state: () => latest }); }
  finally { instances.forEach(a => a.stop()); for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
}
const voiceConfig = { iceServers: [], pollMs: 2000 };
const phases = [{ seconds: 60, speaker: 0 }, { seconds: 60, speaker: 1 }];
function microphone() {
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  return { track, getTracks: () => [track], getAudioTracks: () => [track] };
}
test('voice starts without a microphone; on/off releases the device and keeps listening and turn gating', async () => {
  const streams = []; let requests = 0;
  await withAudio(async () => { requests++; const stream = microphone(); streams.push(stream); return stream; }, async ({ make, state, peers }) => {
    const audio = make(); await audio.start(room, 'self', voiceConfig, phases);
    assert.equal(requests, 0); assert.equal(state().microphone, 'off'); assert.equal(state().enabled, true);
    await audio.enableMicrophone(); assert.equal(requests, 1); assert.equal(state().transmitting, true); assert.equal(streams[0].track.enabled, true);
    audio.sync(room, room.startedAt + 60001); assert.equal(streams[0].track.enabled, false); assert.equal(state().microphone, 'on');
    audio.disableMicrophone(); assert.equal(streams[0].track.stopped, true); assert.equal(peers[0].sender.track, null); assert.equal(state().enabled, true); assert.notEqual(peers[0].connectionState, 'closed');
    audio.sync(room, room.startedAt + 1); assert.equal(state().transmitting, false);
    await audio.enableMicrophone(); assert.equal(requests, 2);
    audio.sync({ ...room, status: 'finished' }, now); assert.equal(streams[1].track.stopped, true); assert.equal(state().enabled, false); assert.equal(peers[0].connectionState, 'closed');
  });
});
test('cancelled microphone permission and leaving cannot turn a late microphone on', async () => {
  let resolveStream;
  await withAudio(() => new Promise(resolve => { resolveStream = resolve; }), async ({ make, state, peers }) => {
    const audio = make(); await audio.start(room, 'self', voiceConfig, phases);
    let pending = audio.enableMicrophone(); assert.equal(state().microphone, 'requesting'); audio.disableMicrophone();
    const cancelled = microphone(); resolveStream(cancelled); await pending;
    assert.equal(cancelled.track.stopped, true); assert.equal(state().enabled, true); assert.equal(state().microphone, 'off'); assert.equal(peers[0].sender.track, null);
    pending = audio.enableMicrophone(); audio.stop();
    const late = microphone(); resolveStream(late); await pending;
    assert.equal(late.track.stopped, true); assert.equal(state().enabled, false); assert.equal(peers.length, 1);
  });
});
test('denied microphone permission leaves voice listening available, and judges never request a microphone', async () => {
  let requests = 0;
  await withAudio(async () => { requests++; throw new DOMException('Denied', 'NotAllowedError'); }, async ({ make, state, peers }) => {
    const audio = make(); await audio.start(room, 'self', voiceConfig, phases); await audio.enableMicrophone();
    assert.equal(state().enabled, true); assert.equal(state().microphone, 'off'); assert.match(state().message, /still listen and use text/);
    const judge = make(); await judge.start({ ...room, role: 'judge', yourSlot: 2 }, 'self', voiceConfig, phases); await judge.enableMicrophone();
    assert.equal(requests, 1); assert.equal(peers.at(-1).direction, 'recvonly'); assert.equal(state().microphone, 'off');
  });
});
test('both sides can initiate or reconnect voice; simultaneous offers resolve to one answer', async () => {
  await withAudio(async () => microphone(), async ({ make, sent, api, peers }) => {
    api.signals = async () => ({ signals: [{ id: 1, senderId: 'other', kind: 'offer', payload: { type: 'offer', sdp: 'remote-offer' } }], cursor: 1 });
    const audio = make(); await audio.start(room, 'self', voiceConfig, phases); await new Promise(resolve => setImmediate(resolve));
    assert.equal(sent.filter(s => s.kind === 'offer').length, 1); assert.equal(sent.filter(s => s.kind === 'answer').length, 1); assert.equal(peers[0].signalingState, 'stable');
    audio.stop(); await audio.start(room, 'self', voiceConfig, phases); assert.equal(sent.filter(s => s.kind === 'offer').length, 2);
  });
});

test('solo practice exposes a microphone beside text and category cards instead of dropdowns', () => {
  const html = render(ui.Practice, { p });
  assert.match(html, /Turn microphone on/); assert.match(html, /Your practice response/); assert.match(html, /Choose a practice scenario/); assert.doesNotMatch(html, /<select/);
  const demo = render(ui.DemoMatch, { scenario, name: 'Alex', onClose() {} });
  assert.match(demo, /simulated opponents/); assert.match(demo, /never changes your Elo/); assert.match(demo, /Maya Chen/);
});

test('practice recordings release the microphone, create local playback, and cancel late permissions', async () => {
  const descriptors = ['navigator', 'MediaRecorder'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  let grant, latest; const instances = [];
  class Recorder {
    static isTypeSupported(type) { return type === 'audio/mp4'; }
    constructor(stream, options) { this.stream = stream; this.mimeType = options.mimeType; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['sample'], { type: this.mimeType }) }); this.onstop?.(); }); }
  }
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { grant = resolve; }) } } });
  try {
    const recording = new ui.PracticeRecording(value => { latest = value; }); instances.push(recording);
    let pending = recording.start(); const stream = microphone(); grant(stream); await pending;
    assert.equal(latest.phase, 'recording'); recording.stop(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(stream.track.stopped, true); assert.equal(latest.phase, 'idle'); assert.match(latest.url, /^blob:/);
    const url = latest.url; const response = await fetch(url); assert.match(response.headers.get('content-type'), /audio\/mp4/);
    recording.clear(); await assert.rejects(fetch(url)); assert.equal(latest.url, '');
    pending = recording.start(); recording.stop(); const cancelled = microphone(); grant(cancelled); await pending;
    assert.equal(cancelled.track.stopped, true); assert.equal(latest.phase, 'idle'); assert.equal(latest.url, '');
    pending = recording.start(() => 10); const timed = microphone(); grant(timed); await pending;
    await new Promise(resolve => setTimeout(resolve, 25)); assert.equal(timed.track.stopped, true); assert.equal(latest.phase, 'idle');
    pending = recording.start(); recording.dispose(); const late = microphone(); grant(late); await pending; assert.equal(late.track.stopped, true);
  } finally {
    instances.forEach(instance => instance.dispose());
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test('camera starts off, is independent of microphone, and releases devices on cancel, stop and round end', async () => {
  const requests=[];let grant;
  const camera=()=>{const track={kind:'video',enabled:true,stopped:false,stop(){this.stopped=true;}};return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};};
  await withAudio(options=>{requests.push(options);return new Promise(resolve=>{grant=resolve;});},async({make,state,peers})=>{
    const media=make();await media.start(room,'self',voiceConfig,phases);assert.equal(requests.length,0);assert.equal(state().camera,'off');
    let pending=media.enableCamera();assert.equal(state().camera,'requesting');assert.equal(requests[0].audio,false);
    const stream=camera();grant(stream);await pending;assert.equal(state().camera,'on');assert.equal(state().microphone,'off');assert.equal(peers[0].senders.video.track,stream.track);
    media.sync(room,room.startedAt+60001);assert.equal(stream.track.enabled,true);
    media.disableCamera();assert.equal(stream.track.stopped,true);assert.equal(peers[0].senders.video.track,null);assert.equal(state().enabled,true);
    pending=media.enableCamera();media.disableCamera();const late=camera();grant(late);await pending;assert.equal(late.track.stopped,true);assert.equal(state().camera,'off');
    pending=media.enableCamera();const ended=camera();grant(ended);await pending;media.sync({...room,status:'finished'},now);assert.equal(ended.track.stopped,true);assert.equal(state().enabled,false);
    const judge=make();await judge.start({...room,role:'judge',yourSlot:2},'self',voiceConfig,phases);const count=requests.length;await judge.enableCamera();assert.equal(requests.length,count);
  });
});

test('empty avatars, home logo, coaching microphone and unrated feedback are visible', () => {
  assert.doesNotMatch(render(ui.AvatarCharacter, {}), /<svg/);
  assert.match(render(ui.Logo, {}), /href="#Home"/);
  const coach=render(ui.Coach,{navigate(){}});assert.match(coach,/Turn microphone on/);assert.match(coach,/automated scoring are unavailable/);
  const peer=render(ui.Match,{p:{...p,room:{...room,judgingMode:'peer',phase:{...room.phase,key:'judging',index:5}}}});
  assert.match(peer,/Send opponent feedback/);assert.match(peer,/Turn camera on/);assert.match(peer,/does not change Elo/);
});
