import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve, join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const result = await build({ stdin: { contents: `export * from './src/model'; export { LiveAudio } from './src/voice'; export { Dashboard, Profile, Leaderboard, Coach, Auth } from './src/screens'; export { Match } from './src/Match'; export { createElement } from 'react'; export { renderToStaticMarkup } from 'react-dom/server';`, resolveDir: resolve('frontend'), loader: 'tsx' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, external: ['node:*'] });
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
  assert.match(render(ui.Profile, { p, navigate: () => {}, equipped: {} }), /Your first rated round/);
  assert.match(render(ui.Leaderboard, { p }), /No rated rounds/);
  assert.match(render(ui.Coach, { navigate: () => {} }), /AI COACH · NOT ENABLED/);
});
test('live round renders server participants, judge form and result instead of simulated opponents', () => {
  const contestant = render(ui.Match, { p: { ...p, room } });
  assert.match(contestant, /Taylor/); assert.match(contestant, /Submit response/); assert.doesNotMatch(contestant, /Maya|Sofia|ANALYZING BOTH RESPONSES/);
  const judging = render(ui.Match, { p: { ...p, room: { ...room, role: 'judge', yourSlot: 2, phase: { ...room.phase, key: 'judging', speaker: null } } } });
  assert.match(judging, /Submit scorecard/); assert.match(judging, /persuasiveness/);
});

test('leaving while microphone permission is pending stops the late stream without opening peers', async () => {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const peerDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'RTCPeerConnection');
  let resolveStream; let stopped = 0; let peers = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveStream = resolve; }) } } });
  Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value: class { constructor() { peers++; } } });
  try {
    const audio = new ui.LiveAudio({}, { replaceChildren() {} }, () => {});
    const starting = audio.start(room, 'self', { iceServers: [], pollMs: 2000 }, []);
    audio.stop(); resolveStream({ getTracks: () => [{ stop() { stopped++; } }] }); await starting;
    assert.equal(stopped, 1); assert.equal(peers, 0);
  } finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor); else delete globalThis.navigator;
    if (peerDescriptor) Object.defineProperty(globalThis, 'RTCPeerConnection', peerDescriptor); else delete globalThis.RTCPeerConnection;
  }
});
