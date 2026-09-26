import { VoiceRoom } from './voice.js';
const app = document.getElementById('app');
let stored; try { stored = JSON.parse(sessionStorage.getItem('pitch.session') || 'null'); } catch { stored = null; }
const state = { session: stored, me: null, page: location.hash.slice(1) || 'play', signup: true, config: null, queue: null, room: null, history: null, leaderboard: null, reports: null, busy: false, polling: false, offset: 0, voiceStatus: 'Audio is off.' };
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
  }
  children.flat(Infinity).forEach(child => { if (child != null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child))); });
  return node;
}
const button = (label, action, className = '', disabled = false) => el('button', { type: 'button', class: className, disabled, onclick: action }, label);
const card = (...children) => el('section', { class: 'card' }, ...children);
const labelField = (label, control) => el('div', { class: 'field' }, el('label', { for: control.id }, label), control);
const input = (id, type = 'text', attrs = {}) => el('input', { id, name: id, type, required: true, ...attrs });
const date = ms => new Date(ms).toLocaleString();
const signed = n => n > 0 ? `+${n}` : String(n);
function notify(message) { const n = document.getElementById('notice'); n.textContent = message; n.style.display = 'block'; clearTimeout(notify.timer); notify.timer = setTimeout(() => { n.style.display = 'none'; }, 8000); }
async function api(path, body, method) {
  const response = await fetch(`/api/pitch/${path}`, { method: method || (body === undefined ? 'GET' : 'POST'), cache: 'no-store', headers: { ...(state.session ? { Authorization: `Bearer ${state.session.token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && state.session) { state.session = null; state.me = null; state.room = null; state.queue = null; sessionStorage.removeItem('pitch.session'); voice.stop(); render(); }
    throw new Error(data.error?.message || 'The request failed. Please try again.');
  }
  return data;
}
const voice = new VoiceRoom(api, message => { state.voiceStatus = message; const n = document.getElementById('voice-status'); if (n) n.textContent = message; });
async function action(fn) { if (state.busy) return; state.busy = true; render(); try { await fn(); } catch (error) { notify(error.message); } finally { state.busy = false; render(); } }
async function refreshMe() { state.me = await api('me'); voice.setBlocked(state.me.blockedPlayers.map(p => p.id)); }
async function loadPage() {
  if (!state.session) return;
  try {
    if (state.page === 'profile') state.history = await api('history');
    if (state.page === 'leaderboard') state.leaderboard = await api('leaderboard');
    if (state.page === 'moderation') state.reports = await api('reports');
  } catch (error) { notify(error.message); }
}
function setRoom(room) {
  const finished = state.room?.status === 'active' && room.status !== 'active';
  state.room = room; state.offset = room.serverTime - Date.now(); voice.sync(room);
  if (finished) { refreshMe().then(render).catch(() => {}); notify(room.status === 'cancelled' ? 'Round ended without enough judges. Elo was unchanged.' : 'Your round is complete. Results and feedback are ready.'); }
}
async function poll() {
  if (!state.session || !state.me || state.polling || state.busy) return; state.polling = true;
  try {
    if (state.room?.status === 'active') setRoom(await api(`rooms/${state.room.code}`));
    else if (state.queue?.status === 'waiting') { state.queue = await api('queue'); if (state.queue.room) { setRoom(state.queue.room); await refreshMe(); } }
    else return;
    render();
  } catch (error) { notify(error.message); } finally { state.polling = false; }
}
function rememberForms() {
  const active = document.activeElement;
  return { focus: active?.id, start: typeof active?.selectionStart === 'number' ? active.selectionStart : null, end: typeof active?.selectionEnd === 'number' ? active.selectionEnd : null,
    openDetails: [...app.querySelectorAll('details[open]')].map(d => d.querySelector('summary')?.textContent), values: [...app.querySelectorAll('form')].flatMap(form => [...form.elements].filter(e => e.name).map(e => ({ key: form.dataset.key, name: e.name, value: e.value, checked: e.checked }))) };
}
function restoreForms(saved) {
  app.querySelectorAll('details').forEach(d => { d.open = saved.openDetails.includes(d.querySelector('summary')?.textContent); });
  for (const form of app.querySelectorAll('form')) for (const element of form.elements) { const value = saved.values.find(v => v.key === form.dataset.key && v.name === element.name); if (value) { element.value = value.value; if ('checked' in element) element.checked = value.checked; } }
  const focus = saved.focus && document.getElementById(saved.focus); if (focus && !focus.disabled) { focus.focus({ preventScroll: true }); if (saved.start !== null && focus.setSelectionRange && ['text','password','search','tel','url'].includes(focus.type) || (focus?.tagName === 'TEXTAREA' && saved.start !== null)) { try { focus.setSelectionRange(saved.start, saved.end); } catch {} } }
}
function render() {
  const saved = rememberForms(); const nav = document.getElementById('nav');
  const pages = [['play','Play'],['profile','My progress'],['leaderboard','Leaderboard'],['guide','How it works']]; if (state.me?.moderator) pages.push(['moderation','Reports']);
  nav.replaceChildren(...pages.filter(([id]) => state.session || id === 'play' || id === 'guide').map(([id,title]) => el('a', { href: `#${id}`, 'aria-current': state.page === id ? 'page' : null }, title)), state.session ? button('Sign out', () => action(async () => {
    if (state.room?.status === 'active' && !confirm('Leaving an unfinished round can cause a loss and a 5/10-minute queue ban. Sign out?')) return;
    if (state.room?.status === 'active') await api(`rooms/${state.room.code}/leave`, {});
    else if (state.queue?.status === 'waiting') await api('queue', undefined, 'DELETE');
    await api('logout', {}); voice.stop(); state.session = null; state.me = null; state.room = null; state.queue = null; sessionStorage.removeItem('pitch.session');
  }), '', state.busy) : document.createTextNode(''));
  if (state.page === 'guide') app.replaceChildren(guide());
  else if (!state.session) app.replaceChildren(auth());
  else if (!state.me) app.replaceChildren(el('p', {}, 'Loading your profile…'));
  else if (state.page === 'profile') app.replaceChildren(progress());
  else if (state.page === 'leaderboard') app.replaceChildren(leaderboard());
  else if (state.page === 'moderation') app.replaceChildren(moderation());
  else app.replaceChildren(play());
  restoreForms(saved); tick();
}
function auth() {
  const form = el('form', { 'data-key': state.signup ? 'signup' : 'login', onsubmit: event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    action(async () => { const session = await api(state.signup ? 'signup' : 'login', { ...data, acceptedConduct: data.acceptedConduct === 'on' }); state.session = session; sessionStorage.setItem('pitch.session', JSON.stringify(session)); await refreshMe(); state.page = 'play'; location.hash = 'play'; if (state.me.activeRoom) setRoom(await api(`rooms/${state.me.activeRoom}`)); });
  } });
  if (state.signup) form.append(labelField('Display name', input('name', 'text', { maxlength: 24, autocomplete: 'nickname' })));
  form.append(labelField('Email', input('email', 'email', { autocomplete: 'email', maxlength: 254 })), labelField('Password · at least 12 characters', input('password', 'password', { minlength: 12, maxlength: 128, autocomplete: state.signup ? 'new-password' : 'current-password' })));
  if (state.signup) form.append(labelField('Birth date · private, used for your age band', input('birthDate', 'date')), el('p', { class: 'small muted' }, 'Ages 14–17, 18–22 and 23+ play separately. Use your real birth date.'), el('label', { class: 'check' }, input('acceptedConduct', 'checkbox'), el('span', {}, 'I agree to the ', el('a', { href: '#guide' }, 'code of conduct and prototype privacy notice'), '.')));
  form.append(el('button', { type: 'submit', class: 'primary', disabled: state.busy }, state.busy ? 'Please wait…' : state.signup ? 'Create account' : 'Sign in'));
  return el('div', {}, el('p', { class: 'eyebrow' }, 'Interviews · Pitches · Hard conversations'), el('h1', {}, 'Practice before it counts.'), el('p', { class: 'lead' }, 'Face the same scenario as another player. Get scored by three peers. Leave with one thing to try next time.'), el('section', { class: 'card auth' }, el('h2', {}, state.signup ? 'Join the prototype' : 'Welcome back'), form, el('p', { class: 'small muted' }, 'Email is used for sign-in. Email verification and password-recovery emails are not enabled in this playtest.'), button(state.signup ? 'Already have an account? Sign in' : 'Create an account', () => { state.signup = !state.signup; render(); })));
}
function play() {
  if (state.room) return round(state.room);
  const me = state.me; const banned = me.bannedUntil > Date.now();
  const content = el('div', {}, el('p', { class: 'eyebrow' }, `Welcome, ${me.player.name} · Ages ${me.ageBand || 'outside prototype range'}`), el('h1', {}, 'Your next real-world rep.'), el('p', { class: 'lead' }, 'Two contestants. Three judges. One scenario. About four minutes.'), el('div', { class: 'grid' }, card(el('div', { class: 'stat' }, me.rating.value), el('p', {}, `PITCH Elo${me.rating.provisional ? ` · ${me.rating.placementGamesRemaining} placement rounds left` : ''}`)), card(el('div', { class: 'stat' }, me.priorityCredits), el('p', {}, `Priority credits · ${me.judge.progressToCredit}/2 judged rounds toward the next`)), card(el('div', { class: 'stat' }, `${me.judge.reliability}/100`), el('p', {}, 'Judge reliability'))));
  if (banned) content.append(el('p', { class: 'warning' }, `Your queue break ends ${date(me.bannedUntil)}. Leaving again within 24 hours increases the break to 10 minutes.`));
  if (state.queue?.status === 'waiting') content.append(card(el('h2', {}, state.queue.priority ? 'In the priority queue' : 'Finding your round'), el('p', {}, state.queue.message), el('p', { class: 'timer', id: 'queue-clock' }), el('p', { class: 'small muted' }, `Your role: ${state.queue.mode}. Keep this page open.`), button('Cancel queue', () => action(async () => { state.queue = await api('queue', undefined, 'DELETE'); }), '', state.busy)));
  else {
    const join = mode => action(async () => { state.queue = await api('queue', { mode }); if (state.queue.room) { setRoom(state.queue.room); await refreshMe(); } });
    content.append(card(el('h2', {}, 'Start a quick round'), state.queue?.status === 'expired' ? el('p', { class: 'warning' }, state.queue.message) : null, button('Quick play', () => join('quick'), 'primary', banned || state.busy || !me.ageBand), el('p', { class: 'muted small' }, 'Quick play uses a priority credit when you have one. Otherwise, it places you where you are needed.'), el('div', { class: 'row' }, button('Play as contestant', () => join('contestant'), '', banned || state.busy), button('Judge a round', () => join('judge'), '', banned || state.busy), button('Use priority credit', () => join('priority'), '', banned || !me.priorityCredits || state.busy)), el('p', { class: 'small muted' }, 'We try for up to two minutes. Five compatible people in the same age band must be online; no AI fills empty seats.')));
  }
  content.append(card(el('h3', {}, 'Make peer feedback useful'), el('p', {}, 'Score clarity, persuasiveness and composure from 1–5. Give both contestants one specific, respectful tip. Complete two judged rounds to earn one priority credit.')));
  return content;
}
async function startAudio(room) { await voice.start(room, state.me.player.id, await api('voice')); voice.setBlocked(state.me.blockedPlayers.map(p => p.id)); }
function round(room) {
  const active = room.status === 'active'; const people = room.participants; const name = id => people.find(p => p.id === id)?.name || 'Contestant';
  const content = el('div', {}, el('div', { class: 'row between' }, el('p', { class: 'eyebrow' }, `${room.scenario.category} · Ages ${room.band} · Round ${room.code}`), el('span', { class: 'tag' }, room.role === 'judge' ? 'You are judging' : `You are contestant ${room.yourSlot === 0 ? 'A' : 'B'}`)), el('h1', {}, room.scenario.title), card(el('p', { class: 'lead' }, room.scenario.prompt), el('p', {}, el('strong', {}, 'Your goal: '), room.yourPosition || room.scenario.goal)));
  if (active) {
    content.append(card(el('div', { class: 'row between' }, el('h2', {}, room.phase.label), el('span', { class: 'timer', id: 'round-clock' })), el('p', { class: 'small muted' }, room.phase.key === 'reveal' ? 'Read the scenario and prepare. Both contestants face the same challenge.' : room.phase.key === 'judging' ? 'Each judge independently selects a winner and gives both contestants feedback.' : 'Only the current speaker’s microphone is enabled. Listen respectfully during the other turns.'), el('div', { class: 'grid' }, people.map(p => el('div', { class: `person ${p.slot === room.phase.speaker && p.role === 'contestant' ? 'speaking' : ''}` }, el('strong', {}, `${p.name}${p.id === state.me.player.id ? ' (you)' : ''}`), el('div', { class: 'small' }, `${p.role === 'judge' ? `Judge ${p.slot - 1}` : `Contestant ${p.slot === 0 ? 'A' : 'B'}`}${p.left ? ' · left' : p.submitted ? ' · submitted' : ''}`))))));
    if (!room.left) content.append(card(el('h3', {}, 'Round audio'), el('div', { class: 'row' }, button(voice.running ? 'Reconnect audio' : room.role === 'judge' ? 'Listen to the round' : 'Enable microphone', () => action(() => startAudio(room)), '', state.busy), voice.running && room.role === 'contestant' ? button(voice.muted ? 'Unmute my microphone' : 'Mute my microphone', () => { voice.muted = !voice.muted; voice.sync(room, Date.now() + state.offset); render(); }) : null, voice.running ? button('Play audio', () => voice.play()) : null, voice.running ? button('Turn audio off', () => { voice.stop(); render(); }) : null), el('p', { id: 'voice-status', class: 'small muted' }, state.voiceStatus), el('p', { class: 'small muted' }, 'Audio is not recorded. Direct browser audio may fail on restrictive networks; use text responses if needed.')));
    if (!room.left && room.role === 'contestant' && room.phase.speaker === room.yourSlot) {
      const submitted = room.responses.some(r => r.playerId === state.me.player.id && r.phase === room.phase.index);
      if (!submitted) {
        const form = el('form', { 'data-key': `response-${room.code}-${room.phase.index}`, onsubmit: e => { e.preventDefault(); const data = new FormData(e.currentTarget); action(async () => setRoom(await api(`rooms/${room.code}/response`, { phase: room.phase.index, content: data.get('response') }))); } }, labelField('Optional text response · useful if audio fails', el('textarea', { id: 'response', name: 'response', maxlength: 1200, required: true })), el('button', { type: 'submit', class: 'primary', disabled: state.busy }, 'Submit response'));
        content.append(card(form));
      } else content.append(el('p', { class: 'success' }, 'Text response submitted. Your speaking timer continues.'));
    }
    if (room.role === 'judge' && room.phase.key === 'judging' && !room.left) content.append(room.ballotSubmitted ? card(el('h2', {}, 'Your scorecard is saved'), el('p', {}, `Waiting for the other judges · ${room.ballotsReceived} scorecards submitted.`)) : judgeForm(room));
    if (room.left) content.append(el('p', { class: 'warning' }, 'You left this round. You can still see its result when it finishes.'));
    content.append(button('Leave round', () => action(async () => { if (!room.ballotSubmitted && !room.left && !confirm('Leaving before you finish causes a 5/10-minute queue ban. Contestants also forfeit the round. Leave?')) return; setRoom(await api(`rooms/${room.code}/leave`, {})); voice.stop(); await refreshMe(); if (state.room.status !== 'active' || room.ballotSubmitted || room.left) { state.room = null; state.queue = null; } }), 'danger', state.busy));
  } else {
    const result = room.result;
    content.append(card(el('h2', {}, room.status === 'cancelled' ? 'Round cancelled · no Elo change' : result.winnerId ? `${name(result.winnerId)} wins` : 'A draw'), el('p', {}, ({majority:'Decided by the judges’ majority vote.',rubric_tiebreak:'Judge votes tied; the higher rubric total decided the result.',draw:'Votes and rubric totals tied.',forfeit:'A contestant left. The winner receives one quarter of the normal Elo gain.',insufficient_judges:'At least two complete scorecards are needed. No rating or priority credits were issued.'})[result.reason]), el('div', { class: 'grid' }, result.scores.map(score => card(el('h3', {}, name(score.playerId)), el('p', {}, score.averages ? Object.entries(score.averages).map(([k,v]) => `${k}: ${v}/5`).join(' · ') : 'No rubric scores'), result.ratingChanges.find(c => c.playerId === score.playerId) ? el('p', { class: 'stat' }, `${result.ratingChanges.find(c => c.playerId === score.playerId).after} (${signed(result.ratingChanges.find(c => c.playerId === score.playerId).delta)})`) : null))), room.feedback.map(f => feedbackCard(f, name(f.playerId))), button('Back to play', () => action(async () => { state.room = null; state.queue = null; voice.stop(); await refreshMe(); }), 'primary', state.busy)));
  }
  if (room.responses.length) content.append(card(el('h2', {}, 'Submitted text responses'), room.responses.map(r => el('div', { class: 'tip' }, el('strong', {}, `${name(r.playerId)} · ${r.phase < 3 ? 'opening' : 'response'}`), el('p', {}, r.content)))));
  if (room.scenario.positions) content.append(card(el('h3', {}, 'Assigned positions'), people.filter(p => p.role === 'contestant').map(p => el('p', {}, `${p.name}: ${p.position}`))));
  content.append(safetyForm(room)); return content;
}
function judgeForm(room) {
  const form = el('form', { 'data-key': `judge-${room.code}`, onsubmit: e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); const score = prefix => ({ clarity: +data[`${prefix}-clarity`], persuasiveness: +data[`${prefix}-persuasiveness`], composure: +data[`${prefix}-composure`], tip: data[`${prefix}-tip`] }); action(async () => setRoom(await api(`rooms/${room.code}/vote`, { winnerId: data.winnerId, a: score('a'), b: score('b') }))); } });
  form.append(el('h2', {}, 'Your independent scorecard'), el('p', {}, 'Pick the stronger response to the scenario. Score the response, not the person or their accent.'), labelField('Winner', el('select', { id: 'winnerId', name: 'winnerId', required: true }, el('option', { value: '' }, 'Choose a contestant'), room.participants.filter(p => p.role === 'contestant').map(p => el('option', { value: p.id }, p.name)))));
  room.participants.filter(p => p.role === 'contestant').forEach(p => { const prefix = p.slot ? 'b' : 'a'; form.append(el('fieldset', {}, el('legend', {}, p.name), el('div', { class: 'grid' }, ['clarity','persuasiveness','composure'].map(metric => labelField(metric[0].toUpperCase() + metric.slice(1), el('select', { id: `${prefix}-${metric}`, name: `${prefix}-${metric}`, required: true }, el('option', { value: '' }, 'Score 1–5'), [1,2,3,4,5].map(n => el('option', { value: n }, `${n} / 5`)))))), labelField('Try this next time… · specific feedback, 12–400 characters', el('textarea', { id: `${prefix}-tip`, name: `${prefix}-tip`, minlength: 12, maxlength: 400, required: true })))); });
  form.append(el('button', { type: 'submit', class: 'primary', disabled: state.busy }, 'Submit final scorecard')); return card(form);
}
function feedbackCard(f, name) {
  return el('div', { class: 'tip' }, el('strong', {}, `Feedback for ${name}`), el('p', {}, f.tip), f.playerId === state.me.player.id && !f.rating ? el('div', { class: 'row' }, ['helpful','unhelpful','abusive'].map(value => button(value[0].toUpperCase() + value.slice(1), () => action(async () => { await api('feedback', { ballotId: f.ballotId, value }); if (state.room) setRoom(await api(`rooms/${state.room.code}`)); if (state.page === 'profile') state.history = await api('history'); notify('Feedback rating saved.'); }), '', state.busy))) : f.rating ? el('small', {}, `Rated ${f.rating}`) : null);
}
function safetyForm(room) {
  const form = el('form', { 'data-key': `safety-${room.code}`, onsubmit: e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); action(async () => { await api(`rooms/${room.code}/report`, data); notify('Report saved for moderator review.'); }); } },
    labelField('Participant', el('select', { id: 'targetId', name: 'targetId', required: true }, el('option', { value: '' }, 'Choose a participant'), room.participants.filter(p => p.id !== state.me.player.id).map(p => el('option', { value: p.id }, p.name)))),
    labelField('Reason', el('select', { id: 'reason', name: 'reason', required: true }, ['harassment','unsafe-contact','abusive-feedback','cheating','other'].map(s => el('option', { value: s }, s.replaceAll('-', ' '))))),
    labelField('What happened?', el('textarea', { id: 'details', name: 'details', maxlength: 1000, required: true })), el('div', { class: 'row' }, el('button', { type: 'submit', disabled: state.busy }, 'Send report'), button('Block selected participant', () => action(async () => { const targetId = form.elements.targetId.value; if (!targetId) throw new Error('Choose a participant first.'); await api(`rooms/${room.code}/block`, { targetId }); await refreshMe(); notify('Blocked: their audio is muted and you will not be matched together again.'); }), 'danger', state.busy)));
  return card(el('details', {}, el('summary', {}, 'Report or block a participant'), el('p', { class: 'small muted' }, 'Blocking mutes their audio and prevents future matching. Reports are stored for human review; there is no live moderator in the room.'), form));
}
function progress() {
  const d = state.history;
  return el('div', {}, el('h1', {}, 'My progress'), el('p', { class: 'lead' }, 'Specific feedback to use in your next conversation.'), !d ? el('p', {}, 'Loading…') : el('div', {}, el('div', { class: 'grid' }, Object.entries(d.averages).map(([k,v]) => card(el('h3', {}, k[0].toUpperCase() + k.slice(1)), el('div', { class: 'stat' }, v == null ? '—' : `${v}/5`)))), el('p', { class: 'small muted' }, 'Based on feedback from your most recent 50 rated rounds. Feedback reported abusive is excluded.'), card(el('h2', {}, 'Win rate by scenario'), d.byCategory.map(c => el('p', {}, `${c.category}: ${c.winRate === null ? 'No rounds yet' : `${c.winRate}% · ${c.wins}/${c.games} wins`}`))), d.history.length ? d.history.map(r => card(el('h3', {}, r.scenario.title), el('p', { class: 'small muted' }, `${date(r.finishedAt)} · ${r.result} · Elo ${r.after} (${signed(r.delta)})`), r.feedback.map(f => feedbackCard({ ...f, playerId: state.me.player.id }, state.me.player.name)))) : card(el('p', {}, 'Complete your first round to start collecting feedback.'))));
}
function leaderboard() {
  const d = state.leaderboard;
  return el('div', {}, el('h1', {}, 'This week’s progress'), !d ? el('p', {}, 'Loading…') : card(el('p', {}, `Ages ${d.band} · Week beginning ${date(d.weekStartsAt)}. Ranked by Elo earned this week.`), d.players.length ? el('div', { class: 'scroll' }, el('table', {}, el('thead', {}, el('tr', {}, ['Rank','Player','Weekly gain','Elo','Rounds'].map(h => el('th', {}, h)))), el('tbody', {}, d.players.map((p,i) => el('tr', {}, [i+1,p.name,signed(p.weeklyGain),p.rating,p.weeklyGames].map(v => el('td', {}, v))))))) : el('p', {}, 'No completed rounds in this age band this week.')));
}
function moderation() {
  return el('div', {}, el('h1', {}, 'Reports for review'), !state.me.moderator ? el('p', {}, 'Moderator access is required.') : !state.reports ? el('p', {}, 'Loading…') : state.reports.reports.length ? state.reports.reports.map(r => card(el('h3', {}, `${r.targetName} · ${r.reason}`), el('p', { class: 'small muted' }, `Round ${r.roomCode} · ${date(r.createdAt)}`), el('p', {}, r.details), el('div', { class: 'row' }, ['upheld','dismissed'].map(decision => button(decision === 'upheld' ? 'Uphold report' : 'Dismiss report', () => action(async () => { state.reports = await api('reports', { id: r.id, decision }); }), '', state.busy))))) : card(el('p', {}, 'No pending reports.')));
}
function guide() {
  return el('article', { class: 'rules' }, el('h1', {}, 'How PITCH works'), card(el('h2', {}, 'One scenario. Five people.'), el('ol', {}, el('li', {}, 'Quick play finds two contestants and three judges in the same age band. Queue attempts expire after two minutes.'), el('li', {}, 'Read the scenario for 20 seconds. Contestants each have a 60-second opening, followed by a 20-second response each.'), el('li', {}, 'Judges have 60 seconds to pick a winner, score clarity, persuasiveness and composure from 1–5, and write a specific tip for both people.'), el('li', {}, 'A majority vote wins. With two judges, tied votes use the total rubric score; a tied total is a draw. Fewer than two scorecards means no Elo result.'))), card(el('h2', {}, 'Ratings and priority'), el('p', {}, 'PITCH Elo starts at 1000. The first 10 rated rounds use K=32, then K=16. Beating a stronger opponent earns more. Judging does not change contestant Elo.'), el('p', {}, 'Every two completed judged rounds earns one priority credit. It moves you ahead in the contestant queue, but cannot create missing players.'), el('p', {}, 'Judge reliability starts at 75/100. Agreement with the final winner adds 2 points; disagreement subtracts 1. Helpful feedback adds 1, unhelpful subtracts 1, and an abusive rating subtracts 3. Reliability and wait time help assign judge seats.'), el('p', {}, 'Leaving or losing contact for 60 seconds causes a 5-minute queue break, or 10 minutes after a repeat within 24 hours. Judges lose 10 reliability points. Contestants forfeit; the remaining contestant gets one quarter of the usual Elo gain.')), card(el('h2', {}, 'Code of conduct'), el('ul', {}, el('li', {}, 'Respect people. Critique the response, not identity, appearance, accent, or background.'), el('li', {}, 'Use your real birth date. Ages 14–17, 18–22 and 23+ do not share rounds. Age information is self-reported, not identity-verified.'), el('li', {}, 'Do not share contact details, ask for private contact, threaten, harass, or coordinate votes.'), el('li', {}, 'Use report and block if something is wrong. Two upheld reports cause a 24-hour queue suspension. Reports need a configured human moderator; this prototype has no live moderation.'), el('li', {}, 'Written tips use a basic insult, profanity and contact-detail filter. It will not catch all harmful language.'))), card(el('h2', {}, 'Prototype privacy and terms'), el('p', {}, 'This is an experimental peer-practice website. Scores are peer opinions and do not predict hiring or professional outcomes. Use it for a supervised team playtest.'), el('p', {}, 'We store your display name, email, birth date, password hash, game results, submitted text, peer feedback, blocks and reports. Email and birth date are private account information; participants see your display name and age band. Weekly leaderboards stay within your age band.'), el('p', {}, 'Audio travels directly between browsers, is not recorded by this website, and stops when the round ends. Peer connections can reveal network addresses to other participants. A public STUN service assists connection setup; restrictive networks may prevent audio.'), el('p', {}, 'Text responses and feedback are stored for your history. Reports are available to configured project moderators. Session tokens stay in this browser tab until sign-out or expiry. Prototype records remain in the project database until the project operator removes them; contact the person who invited you to request deletion.'), el('p', {}, 'Email verification, password-recovery emails, AI judging, video, direct messages, and paid voice relays are not enabled. Keep a unique password and do not submit sensitive personal or employer information.')));
}
function tick() {
  const now = Date.now() + state.offset;
  const clock = document.getElementById('round-clock');
  if (clock && state.room) { const remaining = Math.max(0, Math.ceil((state.room.phase.deadline - now) / 1000)); clock.textContent = `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`; }
  const queueClock = document.getElementById('queue-clock'); if (queueClock && state.queue) queueClock.textContent = `${Math.max(0, Math.ceil((state.queue.expiresAt - Date.now())/1000))}s remaining`;
  if (voice.running && state.room) voice.sync(state.room, now);
}
window.addEventListener('hashchange', async () => { state.page = location.hash.slice(1) || 'play'; render(); await loadPage(); render(); });
window.addEventListener('beforeunload', e => { if (state.room?.status === 'active' && !state.room.ballotSubmitted && !state.room.left) { e.preventDefault(); e.returnValue = ''; } });
setInterval(poll, 4000); setInterval(tick, 250);
(async () => { try { state.config = await api('config'); if (state.session) { await refreshMe(); if (state.me.activeRoom) setRoom(await api(`rooms/${state.me.activeRoom}`)); await loadPage(); } } catch (error) { notify(error.message); } render(); })();
