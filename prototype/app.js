const $ = id => document.getElementById(id);
const state = { token: sessionStorage.getItem('beef-token'), me: null, queue: null, room: null, busy: false, polling: false, renderKey: '', drafts: new Map(), judgeDrafts: new Map(), offset: 0 };
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function message(text, error = false) { $('notice').textContent = text; $('notice').hidden = !text; $('notice').className = error ? 'error' : ''; }
async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`/api${path}`, { method, headers: { ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return null;
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Please sign in to the private preview, then reload this page.');
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) { state.token = null; state.me = null; state.queue = null; state.room = null; state.renderKey = ''; sessionStorage.removeItem('beef-token'); sessionStorage.removeItem('beef-room'); $('login').hidden = false; $('game').hidden = true; }
    const error = new Error(data.error?.message || 'Please try again.'); error.status = response.status; throw error;
  }
  return data;
}
async function action(work) {
  if (state.busy) return;
  state.busy = true; message(''); document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await work(); } catch (error) { message(error.message, true); }
  finally { state.busy = false; document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}
function selectTab(name) {
  document.querySelectorAll('.tab').forEach(el => { el.hidden = el.id !== name; });
  document.querySelectorAll('[data-tab]').forEach(el => { if (el.dataset.tab === name) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
}
async function refreshMe() {
  state.me = await api('/me'); const { player, rating, priorityTickets } = state.me;
  $('player-name').textContent = player.name;
  $('rating').textContent = `${rating.value} BR${rating.provisional ? ` · Provisional (${rating.games}/5)` : ''}`;
  $('tickets').textContent = `${priorityTickets} priority ticket${priorityTickets === 1 ? '' : 's'}`;
  $('login').hidden = true; $('game').hidden = false;
}
function acceptQueue(queue) {
  state.queue = queue;
  if (queue.serverTime) state.offset = queue.serverTime - Date.now();
  $('waiting').hidden = queue.status !== 'waiting'; $('lobby').hidden = queue.status === 'waiting' || Boolean(state.room);
  if (queue.status === 'waiting') $('queue-description').textContent = `${queue.priority ? 'Priority contestant' : queue.role} · ${queue.format}. Waiting for three available players.`;
  if (queue.status === 'timed_out') { state.queue = null; message('The queue timed out. You can try again or switch roles.'); }
  if (queue.status === 'matched' && queue.room) acceptRoom(queue.room);
  clocks();
}
function preserveDrafts() {
  const form = $('argument-form'); if (form) state.drafts.set(form.dataset.key, form.elements.content.value);
  const judge = $('judge-form'); if (judge) state.judgeDrafts.set(judge.dataset.room, Object.fromEntries(new FormData(judge)));
}
function acceptRoom(room) {
  preserveDrafts(); state.room = room; state.offset = room.serverTime - Date.now();
  sessionStorage.setItem('beef-room', room.code);
  $('room').hidden = false; $('waiting').hidden = true; $('lobby').hidden = true;
  $('topic').textContent = room.topic;
  $('room-meta').textContent = `${room.format} · Room ${room.code} · ${room.phase}`;
  $('role').textContent = room.yourRole === 'judge' ? 'You are the judge. Evaluate both arguments fairly.' : `You are arguing ${room.yourSide.toUpperCase()} the topic.`;
  $('participants').replaceChildren(...room.players.map(p => node('li', `${p.name} · ${p.role === 'judge' ? 'Judge' : p.side}${p.submitted && room.status === 'active' ? ' · Submitted' : ''}`)));
  const key = JSON.stringify([room.id, room.round, room.status, room.arguments, room.verdict]);
  if (key !== state.renderKey) { state.renderKey = key; renderMatch(room); }
  clocks();
}
function labelled(parent, label, name, type = 'text', value = '') {
  const id = `field-${name}`; const title = node('label', label); title.htmlFor = id;
  const field = node(type === 'textarea' ? 'textarea' : 'input'); field.id = id; field.name = name;
  if (type !== 'textarea') field.type = type; field.value = value; field.required = true;
  parent.append(title, field); return field;
}
function renderMatch(room) {
  const content = $('match-content'); content.replaceChildren();
  if (room.arguments.length) {
    content.append(node('h2', 'Arguments'));
    for (const argument of room.arguments) {
      const author = room.players.find(p => p.id === argument.playerId)?.name || 'Contestant';
      const item = node('article', undefined, 'argument');
      item.append(node('strong', `${author} · ${['Opening', 'Rebuttal', 'Closing'][argument.round]}`), node('p', argument.content)); content.append(item);
    }
  }
  if (room.status === 'active') {
    const submitted = room.players.find(p => p.id === state.me.player.id)?.submitted;
    if (room.yourRole === 'judge') content.append(node('p', 'Current-round arguments appear when the round closes.'));
    else if (submitted) content.append(node('p', 'Your argument is submitted. Waiting for the round to close.'));
    else {
      const form = node('form'); form.id = 'argument-form'; form.dataset.key = `${room.id}:${room.round}`;
      const field = labelled(form, `Your ${room.phase} · up to 600 characters`, 'content', 'textarea', state.drafts.get(form.dataset.key) || ''); field.maxLength = 600;
      const button = node('button', 'Submit argument'); button.type = 'submit'; form.append(button);
      form.addEventListener('submit', event => { event.preventDefault(); const text = field.value; action(async () => { acceptRoom(await api(`/rooms/${room.code}/arguments`, { round: room.round, content: text })); }); });
      content.append(form);
    }
  }
  if (room.status === 'judging') {
    if (room.yourRole === 'judge') renderJudge(content, room);
    else content.append(node('p', 'The judge is reviewing your debate. Your result will appear here.'));
  }
  if (room.status === 'finished' && room.verdict) {
    const verdict = room.verdict; const section = node('section', undefined, 'result');
    const winner = room.players.find(p => p.id === verdict.winnerId);
    section.append(node('h2', winner ? `${winner.name} wins` : 'Draw'), node('p', verdict.summary));
    for (const score of verdict.scores) {
      const change = verdict.ratingChanges?.find(r => r.playerId === score.playerId);
      const name = room.players.find(p => p.id === score.playerId)?.name || 'Contestant';
      section.append(node('p', `${name}: ${score.total}/100${change ? ` · ${change.after} BR (${change.delta >= 0 ? '+' : ''}${change.delta})` : ''}`), node('p', score.feedback, 'muted'));
    }
    if (room.yourRole === 'judge') section.append(node('p', 'You earned one priority contestant ticket.'));
    content.append(section); content.append(againButton());
  }
  if (room.status === 'cancelled') { content.append(node('p', 'This match was cancelled. No rating points or tickets were awarded.'), againButton()); }
}
function renderJudge(content, room) {
  const draft = state.judgeDrafts.get(room.id) || {}; const form = node('form'); form.id = 'judge-form'; form.dataset.room = room.id;
  form.append(node('h2', 'Your verdict'), node('p', 'Score each category from 0 to 10. Reasoning and rebuttal count 40% each; clarity counts 20%.'));
  const players = room.players.filter(p => p.role === 'contestant');
  for (const p of players) {
    const set = node('fieldset'); set.append(node('legend', `${p.name} · ${p.side}`)); const grid = node('div', undefined, 'score-grid');
    for (const category of ['reasoning', 'rebuttal', 'clarity']) { const cell = node('div'); const name = `${p.id}-${category}`; const input = labelled(cell, category[0].toUpperCase() + category.slice(1), name, 'number', draft[name] || ''); input.min = '0'; input.max = '10'; input.step = '1'; grid.append(cell); }
    set.append(grid); const feedback = labelled(set, 'Helpful feedback', `${p.id}-feedback`, 'textarea', draft[`${p.id}-feedback`] || ''); feedback.maxLength = 1000; form.append(set);
  }
  labelled(form, 'Explain the result', 'summary', 'textarea', draft.summary || '').maxLength = 1000;
  const button = node('button', 'Submit final verdict'); button.type = 'submit'; form.append(button);
  form.addEventListener('submit', event => { event.preventDefault(); const values = new FormData(form); const scores = players.map(p => ({ playerId: p.id, reasoning: Number(values.get(`${p.id}-reasoning`)), rebuttal: Number(values.get(`${p.id}-rebuttal`)), clarity: Number(values.get(`${p.id}-clarity`)), feedback: values.get(`${p.id}-feedback`), bestQuote: '' }));
    action(async () => { acceptRoom(await api(`/rooms/${room.code}/verdict`, { summary: values.get('summary'), scores })); await refreshMe(); });
  }); content.append(form);
}
function againButton() {
  const button = node('button', 'Back to play'); button.addEventListener('click', () => { state.room = null; state.queue = null; state.renderKey = ''; sessionStorage.removeItem('beef-room'); $('room').hidden = true; $('lobby').hidden = false; }); return button;
}
async function loadRatings() {
  const [board, own] = await Promise.all([api('/leaderboard'), api('/ratings/me?limit=10')]);
  const rows = board.players.map(p => { const row = node('tr'); for (const value of [p.name, `${p.rating}${p.provisional ? ' · Provisional' : ''}`, p.matches, p.wins, p.draws]) row.append(node('td', String(value))); return row; });
  if (!rows.length) { const row = node('tr'), cell = node('td', 'No rated games yet. Complete a public debate to appear here.'); cell.colSpan = 5; row.append(cell); rows.push(row); }
  $('leaderboard').replaceChildren(...rows);
  $('rating-history').replaceChildren(...(own.history.length ? own.history.map(h => node('li', `${h.result} vs ${h.opponentName} · ${h.delta >= 0 ? '+' : ''}${h.delta} → ${h.after} BR`)) : [node('li', 'Your rating history will appear after your first public debate.')]));
}
function clocks() {
  const now = Date.now() + state.offset;
  if (state.queue?.status === 'waiting') $('queue-clock').textContent = `${Math.max(0, Math.ceil((state.queue.expiresAt - now) / 1000))} seconds remaining`;
  $('round-clock').textContent = state.room?.deadline && state.room.status === 'active' ? `${Math.max(0, Math.ceil((state.room.deadline - now) / 1000))}s` : '';
}
async function poll() {
  if (!state.token || state.busy || state.polling || document.hidden) return;
  state.polling = true;
  try {
    if (state.room && ['active', 'judging'].includes(state.room.status)) {
      const previousStatus = state.room.status; let room = await api(`/rooms/${state.room.code}`);
      if (room.status === 'active' && room.deadline <= Date.now() + state.offset) room = await api(`/rooms/${room.code}/advance`, {});
      acceptRoom(room); if (room.status !== previousStatus && ['finished', 'cancelled'].includes(room.status)) await refreshMe();
    } else if (state.queue?.status === 'waiting') acceptQueue(await api('/queue'));
  } catch (error) { message(error.message, true); if (error.status === 410) { state.room = null; $('room').hidden = true; $('lobby').hidden = false; sessionStorage.removeItem('beef-room'); } }
  finally { state.polling = false; }
}
$('login-form').addEventListener('submit', event => { event.preventDefault(); action(async () => { const session = await api('/sessions', { name: $('name').value }); state.token = session.token; sessionStorage.setItem('beef-token', session.token); await refreshMe(); }); });
$('queue-form').addEventListener('submit', event => { event.preventDefault(); action(async () => { acceptQueue(await api('/queue', { mode: $('mode').value, format: $('format').value })); }); });
$('cancel-queue').addEventListener('click', () => action(async () => { acceptQueue(await api('/queue', undefined, 'DELETE')); }));
$('sign-out').addEventListener('click', () => action(async () => { if (state.room && ['active', 'judging'].includes(state.room.status)) throw new Error('Finish your current match before signing out.'); if (state.queue?.status === 'waiting') await api('/queue', undefined, 'DELETE'); await api('/sessions', undefined, 'DELETE'); sessionStorage.removeItem('beef-token'); sessionStorage.removeItem('beef-room'); location.reload(); }));
document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { selectTab(button.dataset.tab); if (button.dataset.tab === 'standings') action(loadRatings); }));
$('refresh-ratings').addEventListener('click', () => action(loadRatings));
async function start() {
  try { await api('/health'); $('connection').textContent = 'Connected · human judging'; }
  catch (error) { $('connection').textContent = 'Setup needed'; message(error.message, true); }
  if (state.token) {
    try { await refreshMe(); const code = sessionStorage.getItem('beef-room'); if (code) acceptRoom(await api(`/rooms/${code}`)); else { const queue = await api('/queue'); if (queue.status !== 'matched' || ['active', 'judging'].includes(queue.room?.status)) acceptQueue(queue); } }
    catch (error) { if (error.status === 401) { state.token = null; sessionStorage.removeItem('beef-token'); sessionStorage.removeItem('beef-room'); } message(error.message, true); }
  }
}
setInterval(clocks, 500); setInterval(poll, 2500); document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); }); start();
