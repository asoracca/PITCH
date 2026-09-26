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

test('topic choices, blocks, queue expiry and priority credit constrain matches', async t => {
  const f=await setup(t); const adults=await f.group(); const minor=await f.signup('2010-03-05');
  for(let i=0;i<4;i++) await f.ok('queue',adults[i],{mode:i<2?'contestant':'judge',category:'career'});
  await f.ok('queue',minor,{mode:'judge',category:'social'}); assert.equal((await f.ok('queue',adults[0])).status,'waiting');
  assert.equal((await f.api('queue',adults[4],{mode:'priority'})).data.error.code,'NO_PRIORITY_CREDIT');
  await f.sql('INSERT INTO pitch_blocks(player_id,target_id,created_at) VALUES(?,?,?)',adults[0].player.id,adults[4].player.id,Date.now());
  await f.ok('queue',adults[4],{mode:'judge',category:'career'}); assert.equal((await f.ok('queue',adults[0])).status,'waiting');
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
  assert.equal(config.scenarios.length,108); assert.equal(new Set(config.scenarios.map(s=>s.id)).size,108); assert.ok(config.scenarios.every(s=>s.prompt && s.goal && (!s.positions || s.positions.length===2)));
  for (const band of ['14–17','18–22','23+']) assert.equal(config.scenarios.filter(s=>s.band===band).length,36);
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


test('spectating requires unanimous public consent, respects blocks across ages, and cannot participate or refresh seats', async t => {
  const f=await setup(t), users=await f.group(), viewer=await f.signup(), minor=await f.signup('2010-03-05');
  for(let i=0;i<5;i++) await f.ok('queue',users[i],{mode:i<2?'contestant':'judge',allowSpectators:i!==4});
  const privateRoom=(await f.ok('queue',users[0])).room;
  assert.equal(privateRoom.isPublic,false); assert.equal((await f.ok('spectate',viewer)).rooms.length,0);
  assert.equal((await f.api(`spectate/${privateRoom.code}`,viewer)).status,404);
  await f.sql("UPDATE pitch_rooms SET status='cancelled' WHERE id=?",privateRoom.id); await f.sql('DELETE FROM pitch_queue WHERE room_id=?',privateRoom.id);
  for(let i=0;i<5;i++) await f.ok('queue',users[i],{mode:i<2?'contestant':'judge',allowSpectators:true});
  const room=(await f.ok('queue',users[0])).room; assert.equal(room.isPublic,true);
  assert.equal((await f.api('spectate',null)).status,401); assert.equal((await f.api(`spectate/${room.code}`,minor)).status,200);
  await f.ok('queue',viewer,{mode:'contestant'});
  assert.equal((await f.ok('spectate',viewer)).rooms[0].code,room.code);
  assert.equal((await f.ok('queue',viewer)).status,'waiting');
  const a=users.find(u=>u.player.id===room.participants.find(v=>v.slot===0).id);
  await f.phase(room,25); await f.ok(`rooms/${room.code}/response`,a,{phase:1,content:'A private current-turn draft.'});
  assert.equal((await f.ok(`spectate/${room.code}`,viewer)).responses.length,0);
  await f.phase(room,85);
  const before=(await f.sql('SELECT player_id,last_seen FROM pitch_seats WHERE room_id=? ORDER BY slot',room.id)).rows;
  const watched=await f.ok(`spectate/${room.code}`,viewer); assert.equal(watched.responses[0].content,'A private current-turn draft.');
  assert.equal('feedback' in watched,false); assert.equal('ballotSubmitted' in watched,false);
  assert.deepEqual((await f.sql('SELECT player_id,last_seen FROM pitch_seats WHERE room_id=? ORDER BY slot',room.id)).rows,before);
  assert.equal((await f.api(`rooms/${room.code}/response`,viewer,{phase:2,content:'No seat'})).status,404);
  assert.equal((await f.api(`rooms/${room.code}/vote`,viewer,{})).status,404);
  assert.equal((await f.api(`rooms/${room.code}/signals`,viewer)).status,404);
  assert.equal((await f.api(`spectate/${room.code}`,viewer,{})).status,405);
  await f.sql('INSERT INTO pitch_blocks(player_id,target_id,created_at) VALUES(?,?,?)',a.player.id,viewer.player.id,Date.now());
  assert.equal((await f.ok('spectate',viewer)).rooms.length,0); assert.equal((await f.api(`spectate/${room.code}`,viewer)).status,404);
  await f.sql('DELETE FROM pitch_blocks');
  await f.sql('INSERT INTO pitch_blocks(player_id,target_id,created_at) VALUES(?,?,?)',viewer.player.id,a.player.id,Date.now());
  assert.equal((await f.api(`spectate/${room.code}`,viewer)).status,404);
  await f.sql('DELETE FROM pitch_blocks'); await f.phase(room,185);
  for(const judge of users.slice(2)) await f.ok(`rooms/${room.code}/vote`,judge,f.ballot(room,a.player.id));
  const result=await f.ok(`spectate/${room.code}`,viewer); assert.equal(result.status,'finished'); assert.equal(result.result.winnerId,a.player.id);
  assert.equal('ratingChanges' in result.result,false); assert.ok(!JSON.stringify(result).includes('Try a concrete example'));
});

test('two real contestants match after consent and grace, exchange private feedback, and never gain Elo or judge credits', async t => {
  const f=await setup(t), a=await f.signup(), b=await f.signup(), outside=await f.signup();
  const choice={mode:'contestant',allowPeerMatch:true,allowSpectators:true};
  await f.ok('queue',a,choice); await f.ok('queue',b,choice);
  assert.equal((await f.ok('queue',a)).status,'waiting');
  await f.sql('UPDATE pitch_queue SET joined_at=?',Date.now()-16000);
  const queues=await Promise.all([f.ok('queue',a),f.ok('queue',b)]);
  const room=queues.find(q=>q.status==='matched').room;
  assert.equal(room.judgingMode,'peer'); assert.equal(room.isPublic,true); assert.equal(room.participants.length,2);
  assert.equal((await f.ok('queue',b)).room.id,room.id);
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rooms')).rows[0].n,1);
  const feedback={clarity:4,persuasiveness:3,composure:5,tip:'Your example was clear. Try stating your next step earlier.'};
  assert.equal((await f.api(`rooms/${room.code}/peer-feedback`,outside,feedback)).status,404);
  assert.equal((await f.api(`rooms/${room.code}/peer-feedback`,a,feedback)).status,409);
  const speaker=room.participants.find(p=>p.slot===0).id===a.player.id?a:b;
  await f.phase(room,25); await f.ok(`rooms/${room.code}/response`,speaker,{phase:1,content:'I would explain the impact, listen and agree on a next step.'});
  const video={targetId:b.player.id,kind:'offer',payload:{type:'offer',sdp:'v=0\r\nm=video '+ 'x'.repeat(10000)}};
  await f.ok(`rooms/${room.code}/signals`,a,video);
  assert.equal((await f.ok(`rooms/${room.code}/signals`,b)).signals[0].payload.sdp,video.payload.sdp);
  assert.equal((await f.api(`rooms/${room.code}/signals`,a,{...video,payload:{type:'offer',sdp:'x'.repeat(25000)}})).status,400);
  assert.equal((await f.api(`rooms/${room.code}/signals`,a,{...video,payload:{type:'offer',sdp:'x'.repeat(34000)}})).status,413);
  await f.phase(room,185);
  assert.equal((await f.api(`rooms/${room.code}/peer-feedback`,a,{...feedback,clarity:6})).status,400);
  assert.equal((await f.api(`rooms/${room.code}/vote`,a,f.ballot(room,a.player.id))).status,403);
  const first=await f.ok(`rooms/${room.code}/peer-feedback`,a,feedback);
  assert.equal(first.ballotSubmitted,true); assert.equal(first.feedback.length,0); assert.equal(first.result,null);
  assert.equal((await f.ok(`rooms/${room.code}`,b)).feedback.length,0);
  await Promise.all([f.ok(`rooms/${room.code}/peer-feedback`,b,feedback),f.ok(`rooms/${room.code}/peer-feedback`,b,feedback)]);
  const done=await f.ok(`rooms/${room.code}`,a);
  assert.equal(done.status,'finished'); assert.equal(done.result.reason,'peer_practice'); assert.deepEqual(done.result.ratingChanges,[]);
  assert.equal(done.feedback.length,1); assert.equal(done.feedback[0].playerId,a.player.id);
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_peer_feedback')).rows[0].n,2);
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rating_events')).rows[0].n,0);
  const history=await f.ok('history',a); assert.equal(history.history.length,0); assert.equal(history.peerHistory.length,1); assert.equal(history.peerHistory[0].feedback.length,1);
  for(const user of [a,b]) {const me=await f.ok('me',user);assert.equal(me.rating.value,1000);assert.equal(me.rating.games,0);assert.equal(me.priorityCredits,0);assert.equal(me.judge.roundsCompleted,0);}
  const watched=await f.ok(`spectate/${room.code}`,outside);assert.equal(watched.result.reason,'peer_practice');assert.ok(!JSON.stringify(watched).includes(feedback.tip));
  const id=done.feedback[0].ballotId;
  assert.equal((await f.api('feedback',outside,{ballotId:id,value:'helpful'})).status,404);
  await f.ok('feedback',a,{ballotId:id,value:'abusive'});await f.ok('feedback',a,{ballotId:id,value:'abusive'});
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_reports')).rows[0].n,1);
  assert.match((await f.ok('history',a)).peerHistory[0].feedback[0].tip,/hidden/);
});

test('practice matching respects opt-in, blocks and topics; leaving or feedback timeout finishes without penalties', async t => {
  const f=await setup(t), a=await f.signup(), b=await f.signup(), minor=await f.signup('2010-03-05');
  await f.ok('queue',a,{mode:'contestant',allowPeerMatch:true,category:'career'});await f.ok('queue',b,{mode:'contestant',category:'career'});await f.ok('queue',minor,{mode:'contestant',allowPeerMatch:true,category:'social'});
  await f.sql('UPDATE pitch_queue SET joined_at=?',Date.now()-16000);
  assert.equal((await f.ok('queue',a)).status,'waiting');
  await f.ok('queue',b,undefined,'DELETE');await f.ok('queue',b,{mode:'contestant',allowPeerMatch:true,category:'career'});
  await f.sql('UPDATE pitch_queue SET joined_at=?',Date.now()-16000);
  await f.sql('INSERT INTO pitch_blocks(player_id,target_id,created_at) VALUES(?,?,?)',b.player.id,a.player.id,Date.now());
  assert.equal((await f.ok('queue',a)).status,'waiting');
  await f.sql('DELETE FROM pitch_blocks');
  let room=(await f.ok('queue',a)).room;assert.equal(room.judgingMode,'peer');assert.equal(room.isPublic,false);
  await f.ok(`rooms/${room.code}/leave`,a,{});
  assert.equal((await f.ok(`rooms/${room.code}`,b)).status,'cancelled');
  const me=await f.ok('me',a);assert.equal(me.bannedUntil,0);assert.equal(me.rating.games,0);
  for(const user of [a,b]) await f.ok('queue',user,{mode:'contestant',allowPeerMatch:true,category:'career'});
  await f.sql('UPDATE pitch_queue SET joined_at=?',Date.now()-16000);room=(await f.ok('queue',a)).room;
  await f.phase(room,245); const done=await f.ok(`rooms/${room.code}`,a);
  assert.equal(done.status,'finished');assert.equal(done.result.reason,'peer_practice');assert.equal(done.feedback.length,0);
  assert.equal((await f.sql('SELECT COUNT(*) AS n FROM pitch_rating_events')).rows[0].n,0);
});

test('quick play matches friends across ages in their chosen topic', async t => {
  const f=await setup(t), users=[];
  for(const birth of ['2010-01-10','2006-01-10','1990-01-10','2007-01-10','1988-01-10'])users.push(await f.signup(birth));
  for(const user of users)await f.ok('queue',user,{mode:'quick',category:'career',allowPeerMatch:true});
  const room=(await f.ok('queue',users[0])).room;
  assert.equal(room.participants.length,5);assert.equal(room.band,'Mixed ages');assert.equal(room.scenario.category,'career');assert.equal(room.scenario.band,'14–17');
  assert.equal(new Set(room.participants.map(p=>p.ageBand)).size,3);assert.ok(!JSON.stringify(room).includes('birth_date'));
  for(const user of users)assert.equal((await f.ok('queue',user)).room.id,room.id);
  const leaders=await f.ok('leaderboard',users[0]);assert.equal(leaders.band,null);
});

test('specific topics do not cross; any-topic contestants can join a compatible practice duel',async t=>{
  const f=await setup(t),a=await f.signup('1990-01-10'),b=await f.signup('2010-01-10');
  assert.equal((await f.api('queue',a,{mode:'quick',category:'unsupported'})).status,400);
  await f.ok('queue',a,{mode:'contestant',category:'career',allowPeerMatch:true});
  await f.ok('queue',b,{mode:'contestant',category:'social',allowPeerMatch:true});
  await f.sql('UPDATE pitch_queue SET joined_at=?',Date.now()-20000);
  assert.equal((await f.ok('queue',a)).status,'waiting');
  await f.ok('queue',b,undefined,'DELETE');
  await f.ok('queue',b,{mode:'contestant',category:'all',allowPeerMatch:true});
  await f.sql('UPDATE pitch_queue SET joined_at=?',Date.now()-20000);
  const room=(await f.ok('queue',b)).room;
  assert.equal(room.judgingMode,'peer');assert.equal(room.scenario.category,'career');assert.equal(room.participants.length,2);
});

test('saved avatars appear to opponents; chat is private, repeat-safe, filtered and blocked',async t=>{
  const f=await setup(t),users=await f.group(),outsider=await f.signup();
  assert.equal((await f.ok('me',users[0])).avatar,null);
  const avatar={avatarEnabled:true,skinTone:'tan',hairColor:'brown',outfit:'Smart Casual',accessory:'Round Glasses',background:'Midnight Arena'};
  await f.ok('avatar',users[0],{avatar});assert.deepEqual((await f.ok('me',users[0])).avatar,avatar);
  assert.equal((await f.api('avatar',users[0],{avatar:{...avatar,skinTone:'https://invalid.test/image.png'}})).status,400);
  const room=await f.match(users),url=`rooms/${room.code}/chat`;
  assert.deepEqual(room.participants.find(p=>p.id===users[0].player.id).avatar,avatar);
  assert.equal((await f.api(url,outsider)).status,404);assert.equal((await f.api(url,users[2])).status,403);
  const message={kind:'message',content:'Good luck!',requestId:'greeting'};
  assert.equal((await f.api(url,users[2],message)).status,403);
  await Promise.all([f.ok(url,users[0],message),f.ok(url,users[0],message)]);
  let chat=await f.ok(url,users[1]);assert.equal(chat.messages.length,1);assert.equal(chat.messages[0].content,'Good luck!');
  await f.ok(url,users[1],{kind:'reaction',content:'👏',requestId:'applause'});
  assert.equal((await f.ok(url,users[0])).messages.length,2);
  assert.equal((await f.api(url,users[0],{kind:'reaction',content:'invalid',requestId:'bad-reaction'})).status,400);
  assert.equal((await f.api(url,users[0],{kind:'message',content:'You are an idiot',requestId:'bad-message'})).status,400);
  assert.equal((await f.api(url,users[0],{kind:'message',content:'x'.repeat(301),requestId:'too-long'})).status,400);
  await f.ok(`rooms/${room.code}/block`,users[0],{targetId:users[1].player.id});
  for(const user of users.slice(0,2)){chat=await f.ok(url,user);assert.equal(chat.messages.length,0);assert.equal(chat.canSend,false);assert.equal((await f.api(url,user,{...message,requestId:'after-block'})).status,409);}
  await f.ok('avatar',users[0],{avatar:{...avatar,avatarEnabled:false}});assert.equal((await f.ok('me',users[0])).avatar.avatarEnabled,false);
});

test('chat throttles bursts and stops new messages when a round closes',async t=>{
  const f=await setup(t),users=await f.group(),room=await f.match(users),url=`rooms/${room.code}/chat`;
  for(let i=0;i<12;i++)await f.ok(url,users[0],{kind:'message',content:'Ready for this turn.',requestId:`message-${i}`});
  assert.equal((await f.api(url,users[0],{kind:'reaction',content:'👏',requestId:'extra'})).status,429);
  await f.sql("UPDATE pitch_rooms SET status='cancelled' WHERE id=?",room.id);
  const chat=await f.ok(url,users[1]);assert.equal(chat.messages.length,12);assert.equal(chat.canSend,false);
  assert.equal((await f.api(url,users[1],{kind:'message',content:'Too late',requestId:'closed'})).status,409);
});
