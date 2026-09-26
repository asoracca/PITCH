import { PitchApi, PitchApiError } from '../build/client/pitch-api.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { migrate } from '../scripts/migrate-libsql.mjs';
import { libsqlDatabase } from '../build/node/libsql.js';
import { makeHandler } from '../build/node/vercel-handler.js';

async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), 'pitch-test-'));
  const url = `file:${join(dir, 'db.sqlite')}`; const client = createClient({ url }); await migrate(client);
  t.after(async () => { client.close(); await rm(dir, { recursive: true, force: true }); });
  const DB = libsqlDatabase(client); const settings = { TURSO_DATABASE_URL: url, BEEF_LOCAL_DATABASE: '1' };
  const handler = makeHandler(settings, () => ({ client, DB }));
  const sql = (query, ...args) => client.execute({ sql: query, args });
  async function api(path, user, body, method) {
    const response = await handler(new Request(`https://pitch.test/api/index?__beef_path=${encodeURIComponent(`pitch/${path}`)}`, {
      method: method || (body === undefined ? 'GET' : 'POST'), headers: { ...(user ? { authorization: `Bearer ${user.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body),
    })); return { status: response.status, data: await response.json() };
  }
  async function ok(...args) { const r = await api(...args); assert.ok(r.status < 300, JSON.stringify(r)); return r.data; }
  let count = 0;
  async function signup(birthDate = '2006-01-10') { count++; return ok('signup', null, { email: `player${count}@example.test`, password: 'test-only-passphrase-2026', name: `Player ${count}`, birthDate, acceptedConduct: true }); }
  async function group() { const users = []; for (let i=0;i<5;i++) users.push(await signup()); return users; }
  async function match(users) { for (let i=0;i<5;i++) await ok('queue', users[i], { mode: i<2 ? 'contestant' : 'judge' }); const queued = await ok('queue', users[0]); assert.equal(queued.status, 'matched'); return queued.room; }
  async function phase(room, seconds) { await sql('UPDATE pitch_rooms SET started_at=? WHERE id=?', Date.now() - seconds * 1000, room.id); await sql('UPDATE pitch_seats SET last_seen=? WHERE room_id=?', Date.now(), room.id); }
  function ballot(room, winnerId, a = 4, b = 3) { return { winnerId, a: { clarity: a, persuasiveness: a, composure: a, tip: 'Try a concrete example before your main request.' }, b: { clarity: b, persuasiveness: b, composure: b, tip: 'Try stating your desired next step more clearly.' } }; }
  return { sql, api, ok, signup, group, match, phase, ballot, settings, client, DB, handler };
}

test('Pitch signup enforces age, conduct, private credentials, login and revocation', async t => {
  const f=await setup(t); const base={name:'A',email:'a@example.test',password:'a-long-test-password',birthDate:'2020-01-01',acceptedConduct:true};
  assert.equal((await f.api('signup',null,base)).data.error.code,'AGE_GATE');
  assert.equal((await f.api('signup',null,{...base,birthDate:'2006-02-30'})).data.error.code,'AGE_GATE');
  assert.equal((await f.api('signup',null,{...base,birthDate:'2006-01-01',acceptedConduct:false})).data.error.code,'CONDUCT_REQUIRED');
  const u=await f.signup(); const me=await f.ok('me',u); assert.equal(me.ageBand,'18–22'); assert.equal(me.rating.value,1000);
  assert.ok(!JSON.stringify(me).includes('birth_date')); assert.ok(!JSON.stringify(me).includes('password')); assert.ok(!JSON.stringify(me).includes('@'));
  const saved=(await f.sql('SELECT * FROM pitch_accounts')).rows[0]; assert.notEqual(saved.password_hash,'test-only-passphrase-2026');
  assert.equal((await f.api('login',null,{email:saved.email,password:'incorrect-password'})).status,401);
  const logged=await f.ok('login',null,{email:saved.email,password:'test-only-passphrase-2026'}); assert.equal(logged.player.id,u.player.id);
  await f.ok('logout',logged,{}); assert.equal((await f.api('me',logged)).status,401);
});

test('five-person round enforces turns, private ballots, majority and exactly-once Elo on libSQL', async t => {
  const f=await setup(t), users=await f.group(), room=await f.match(users); const outside=await f.signup();
  assert.equal(room.participants.length,5); assert.equal((await f.api(`rooms/${room.code}`,outside)).status,404);
  const aId=room.participants.find(p=>p.slot===0).id, bId=room.participants.find(p=>p.slot===1).id;
  const a=users.find(u=>u.player.id===aId), b=users.find(u=>u.player.id===bId); const judges=users.slice(2);
  assert.equal((await f.api(`rooms/${room.code}/vote`,judges[0],f.ballot(room,aId))).data.error.code,'VOTING_CLOSED');
  await f.phase(room,25);
  assert.equal((await f.api(`rooms/${room.code}/response`,b,{phase:1,content:'Wrong turn'})).status,409);
  await f.ok(`rooms/${room.code}/response`,a,{phase:1,content:'My example shows a measurable improvement.'});
  assert.equal((await f.ok(`rooms/${room.code}`,b)).responses.length,0);
  await f.phase(room,85); await f.ok(`rooms/${room.code}/response`,b,{phase:2,content:'I would state the problem and offer an option.'});
  await f.phase(room,145); await f.ok(`rooms/${room.code}/response`,a,{phase:3,content:'I would ask what concerns remain.'});
  await f.phase(room,165); await f.ok(`rooms/${room.code}/response`,b,{phase:4,content:'I would suggest testing the smaller option.'});
  await f.phase(room,185);
  const first=await f.ok(`rooms/${room.code}/vote`,judges[0],f.ballot(room,aId)); assert.equal(first.result,null); assert.equal(first.feedback.length,0);
  const bad=f.ballot(room,aId); bad.a.tip='You are an idiot'; assert.equal((await f.api(`rooms/${room.code}/vote`,judges[1],bad)).data.error.code,'FEEDBACK_FILTERED');
  assert.equal((await f.api(`rooms/${room.code}/vote`,a,f.ballot(room,aId))).status,403);
  await f.ok(`rooms/${room.code}/vote`,judges[1],f.ballot(room,aId));
  await Promise.all([f.ok(`rooms/${room.code}/vote`,judges[2],f.ballot(room,bId)),f.ok(`rooms/${room.code}/vote`,judges[2],f.ballot(room,bId))]);
  const done=await f.ok(`rooms/${room.code}`,a); assert.equal(done.status,'finished'); assert.equal(done.result.winnerId,aId); assert.equal(done.feedback.length,3);
  assert.equal((await f.ok('me',a)).rating.value,1016); assert.equal((await f.ok('me',b)).rating.value,984);
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rating_events')).rows[0].n,2);
  assert.equal((await f.ok('me',judges[0])).judge.progressToCredit,1); assert.equal((await f.ok('me',judges[0])).priorityCredits,0);
  const firstHistory=await f.ok('history',a); assert.equal(firstHistory.history.length,1); assert.equal(firstHistory.history[0].feedback.length,3);
  assert.equal((await f.ok('leaderboard',a)).players[0].playerId,aId);
  await f.ok('feedback',a,{ballotId:done.feedback[0].ballotId,value:'helpful'});
  const reliability=(await f.ok('me',judges[0])).judge.reliability;
  await f.ok('feedback',a,{ballotId:done.feedback[0].ballotId,value:'helpful'}); assert.equal((await f.ok('me',judges[0])).judge.reliability,reliability);
  assert.equal((await f.api('feedback',outside,{ballotId:done.feedback[0].ballotId,value:'helpful'})).status,404);
  const next=await f.match(users); await f.phase(next,185); const winner=next.participants.find(p=>p.slot===0).id;
  for (const j of judges) await f.ok(`rooms/${next.code}/vote`,j,f.ballot(next,winner));
  for (const j of judges) assert.equal((await f.ok('me',j)).priorityCredits,1);
});

test('age bands, blocks, queue expiry and priority credit prevent unsafe or invalid matches', async t => {
  const f=await setup(t); const adults=await f.group(); const minor=await f.signup('2010-03-05');
  for(let i=0;i<4;i++) await f.ok('queue',adults[i],{mode:i<2?'contestant':'judge'});
  await f.ok('queue',minor,{mode:'judge'}); assert.equal((await f.ok('queue',adults[0])).status,'waiting');
  assert.equal((await f.api('queue',adults[4],{mode:'priority'})).data.error.code,'NO_PRIORITY_CREDIT');
  await f.sql('INSERT INTO pitch_blocks(player_id,target_id,created_at) VALUES(?,?,?)',adults[0].player.id,adults[4].player.id,Date.now());
  await f.ok('queue',adults[4],{mode:'judge'}); assert.equal((await f.ok('queue',adults[0])).status,'waiting');
  await f.sql('UPDATE pitch_queue SET expires_at=? WHERE player_id=?',Date.now()-1,adults[0].player.id);
  assert.equal((await f.ok('queue',adults[0])).status,'expired');
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rooms')).rows[0].n,0);
});

test('judge leave, rubric tiebreak, escalating bans and forfeits use the new rules', async t => {
  const f=await setup(t), users=await f.group(); let room=await f.match(users); const aId=room.participants.find(p=>p.slot===0).id;
  await f.ok(`rooms/${room.code}/leave`,users[4],{}); let me=await f.ok('me',users[4]); assert.equal(me.judge.reliability,65); assert.ok(me.bannedUntil>Date.now()+295000);
  assert.equal((await f.api('queue',users[4],{mode:'judge'})).data.error.code,'QUEUE_BANNED');
  await f.phase(room,185); await f.ok(`rooms/${room.code}/vote`,users[2],f.ballot(room,aId,5,2));
  const bId=room.participants.find(p=>p.slot===1).id; await f.ok(`rooms/${room.code}/vote`,users[3],f.ballot(room,bId,5,2));
  let done=await f.ok(`rooms/${room.code}`,users[0]); assert.equal(done.result.reason,'rubric_tiebreak'); assert.equal(done.result.winnerId,aId);
  await f.sql('UPDATE pitch_profiles SET banned_until=0 WHERE player_id=?',users[4].player.id);
  room=await f.match(users); await f.ok(`rooms/${room.code}/leave`,users[4],{}); me=await f.ok('me',users[4]); assert.ok(me.bannedUntil>Date.now()+595000);
  const loser=users[0], winner=users[1]; const before=(await f.ok('me',winner)).rating.value;
  await Promise.all([f.ok(`rooms/${room.code}/leave`,loser,{}),f.ok(`rooms/${room.code}/leave`,loser,{})]);
  done=await f.ok(`rooms/${room.code}`,winner); assert.equal(done.result.reason,'forfeit'); assert.equal(done.result.winnerId,winner.player.id);
  assert.ok((await f.ok('me',winner)).rating.value-before<=5); assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rating_events WHERE room_id=?',room.id)).rows[0].n,2);
});

test('missing judges cancels unrated; signal and moderation access stay scoped to participants', async t => {
  const f=await setup(t), users=await f.group(), room=await f.match(users), outsider=await f.signup();
  const signal={targetId:users[2].player.id,kind:'offer',payload:{type:'offer',sdp:'test-audio-sdp'}};
  await f.ok(`rooms/${room.code}/signals`,users[0],signal);
  assert.equal((await f.ok(`rooms/${room.code}/signals`,users[2])).signals.length,1);
  assert.equal((await f.ok(`rooms/${room.code}/signals`,users[3])).signals.length,0);
  assert.equal((await f.api(`rooms/${room.code}/signals`,outsider,signal)).status,404);
  await f.ok(`rooms/${room.code}/report`,users[0],{targetId:users[1].player.id,reason:'harassment',details:'A test report for moderator review.'});
  assert.equal((await f.api('reports',users[0])).status,403); f.settings.PITCH_MODERATOR_IDS=users[4].player.id;
  const reports=await f.ok('reports',users[4]); assert.equal(reports.reports.length,1);
  await f.ok('reports',users[4],{id:reports.reports[0].id,decision:'upheld'});
  await f.ok(`rooms/${room.code}/block`,users[0],{targetId:users[1].player.id});
  assert.equal((await f.ok('me',users[0])).blockedPlayers.length,1);
  await f.phase(room,245); const done=await f.ok(`rooms/${room.code}`,users[0]); assert.equal(done.status,'cancelled');
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rating_events')).rows[0].n,0);
  assert.equal((await f.api(`rooms/${room.code}/signals`,users[0],signal)).status,409);
});


test('latest scenarios stay age-scoped and assigned sides are retained in room snapshots', async t => {
  const f=await setup(t), config=await f.ok('config');
  assert.equal(config.scenarios.length,36);
  for (const band of ['14–17','18–22','23+']) assert.equal(config.scenarios.filter(s=>s.band===band).length,12);
  const older=await f.signup('1990-01-01'); assert.equal((await f.ok('me',older)).ageBand,'23+');
  const users=await f.group(), room=await f.match(users);
  assert.equal(room.scenario.band,'18–22');
  const scenario=config.scenarios.find(s=>s.band==='18–22'&&s.positions);
  await f.sql('UPDATE pitch_rooms SET scenario_json=?,scenario_id=? WHERE id=?',JSON.stringify(scenario),'future-catalog-changed',room.id);
  for (const user of users.slice(0,2)) {
    const shown=await f.ok(`rooms/${room.code}`,user), seat=shown.participants.find(p=>p.id===user.player.id);
    assert.equal(shown.scenario.id,scenario.id);
    assert.equal(shown.yourPosition,scenario.positions[seat.slot]);
    assert.equal(seat.position,scenario.positions[seat.slot]);
  }
});


test('frontend client drives the real signup, queue, voice signaling, judging and feedback flow', async t => {
  const f=await setup(t);
  const clients=Array.from({length:5},()=>new PitchApi('https://pitch.test',(input,init)=>f.handler(new Request(input,init))));
  const config=await clients[0].config(); assert.equal(config.apiVersion,'pitch.v1');
  assert.equal(config.capabilities.humanJudging,true); assert.equal(config.capabilities.aiPractice,false);
  const sessions=[];
  for (let i=0;i<5;i++) sessions.push(await clients[i].signup({name:`Frontend ${i}`,email:`frontend-${i}@example.test`,password:'frontend-test-password',birthDate:'2006-01-01',acceptedConduct:true}));
  assert.equal((await clients[0].me()).rating.value,1000);
  for (let i=0;i<5;i++) await clients[i].queue(i<2?'contestant':'judge');
  const matched=await clients[0].queue();assert.equal(matched.status,'matched');const room=matched.room;
  assert.equal(room.participants.length,5);assert.equal((await clients[0].voice()).recording,false);
  await clients[0].sendSignal(room.code,sessions[1].player.id,{kind:'offer',payload:{type:'offer',sdp:'test-session-description'}});
  const signals=await clients[1].signals(room.code);assert.equal(signals.signals[0].senderId,sessions[0].player.id);
  const aId=room.participants.find(p=>p.slot===0).id, a=clients[sessions.findIndex(s=>s.player.id===aId)];
  await f.phase(room,25);await a.respond(room.code,1,'A concrete example of how I can contribute.');
  assert.equal((await a.room(room.code)).responses.length,1);
  await f.phase(room,185);
  for (const judge of clients.slice(2)) await judge.vote(room.code,f.ballot(room,aId));
  const finished=await a.room(room.code);assert.equal(finished.status,'finished');assert.equal(finished.result.winnerId,aId);
  assert.equal((await a.history()).history[0].code,room.code);assert.equal((await a.leaderboard()).players[0].playerId,aId);
  await a.rateFeedback(finished.feedback[0].ballotId,'helpful');
  await clients[0].report(room.code,sessions[1].player.id,'other','Integration test report for the moderator queue.');
  await clients[0].block(room.code,sessions[1].player.id);
  assert.ok((await clients[0].me()).blockedPlayers.some(p=>p.id===sessions[1].player.id));
  await assert.rejects(clients[0].reports(),e=>e instanceof PitchApiError&&e.code==='MODERATOR_REQUIRED');
  await clients[0].logout();assert.equal(clients[0].token,null);
  await clients[0].login('frontend-0@example.test','frontend-test-password');assert.equal((await clients[0].me()).player.id,sessions[0].player.id);
  await clients[0].queue('judge');assert.equal((await clients[0].cancelQueue()).status,'idle');
});
