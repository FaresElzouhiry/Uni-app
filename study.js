/* Study Rooms — study.js
   A personal focus room: Pomodoro (25 min study + 5 min break), every finished session is saved,
   and a weekly leaderboard adds up each student's own minutes. Rooms are solo — everyone scores alone.
   The Chat tab lets students talk in General, their group and their section (backend: Chat.gs).

   Needs script.js (S, D, CID, FEEDBACK_URL, toast, ask, svg, go). Safe to load before or after it:
   nothing here touches those at load time, only when the student actually uses the room. */
(function () {
'use strict';

/* ---------- settings ---------- */
const FOCUS = 25, BREAK = 5, LONG = 15, CYCLE = 4;      // minutes · a long break after every 4th focus session
const MIN = 60000, CIRC = 2 * Math.PI * 54;             // ring circumference (r = 54, see the SVG below)
const KEY = 'portal:study', LBKEY = 'portal:study:lb';

/* ---------- الأسماء التجريبية (Demo names) ----------
   عشان الليدربورد ما يبانش فاضي.

   كل سطر = طالب واحد:   [الاسم, الجروب, السكشن, دقايق المذاكرة في الأسبوع]

   الرقم الأخير = إجمالي دقايق الطالب في آخر الأسبوع (يوم الجمعة).
   الأسبوع بيبدأ السبت، وكل يوم الرقم بيزيد شوية لحد ما يوصل يوم الجمعة للرقم اللي كتبته،
   وبعدها مع السبت الجاي بيبدأ من الأول تاني.
   يعني Omar (210 دقيقة) يوم الجمعة بيبقى 3 ساعات ونص — وهو الأعلى.
   الأرقام بتطلع زي بعض عند كل الطلاب (مفيش عشوائي بيختلف من موبايل لموبايل).

   الأسماء دي بتفضل موجودة دايماً في الليدربورد، حتى لو طلاب حقيقيين دخلوا.

   تغيّر حاجة إزاي؟
   • تغيير وقت طالب  → عدّل الرقم الأخير في سطره (210 = 3 ساعات ونص، 180 = 3 ساعات، 120 = ساعتين، 60 = ساعة).
     خلي الرقم يقبل القسمة على 5 (مثلاً 210 أو 145) عشان يطلع مظبوط.
   • تغيير اسم/جروب/سكشن → عدّل الكلام في نفس السطر.
   • مسح طالب → امسح سطره كله.
   • إضافة طالب → انسخ أي سطر والصقه تحته وغيّر بياناته (خلي الفاصلة بعد كل سطر ما عدا الأخير).
   • قفل الأسماء التجريبية كلها → خلي SEED_ON = false. */
const SEED_ON = true;
const SEED = [
  // [الاسم,   جروب, سكشن, دقايق آخر الأسبوع]
  ['Omar',     7, 19, 210],   // 3 ساعات ونص — الأول
  ['Mariam',   3,  8, 160],
  ['Youssef',  7, 21, 145],
  ['Nour',     5, 14, 130],
  ['Ahmed',    1,  2, 115],
  ['Salma',    2,  5, 100],
  ['Karim',    4, 11,  85],
  ['Hana',     8, 23,  70],
  ['Mostafa',  6, 17,  55],
  ['Farida',   7, 19,  40]
];
function rnd(str) {                                               // رقم بين 0 و 1 ثابت لنفس الكلمة (بدون عشوائي حقيقي)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function seedRows() {
  if (!SEED_ON) return [];
  const wk = weekKey(now());
  const day = (new Date().getDay() + 1) % 7;                      // السبت = 0 … الجمعة = 6
  return SEED.map(([n, g, s, goal]) => {
    const w = Array.from({ length: 7 }, (_, i) => 0.5 + rnd(n + wk + i));   // "وزن" كل يوم: يوم يذاكر فيه أكتر ويوم أقل
    const total = w.reduce((a, b) => a + b, 0);
    const upto = w.slice(0, day + 1).reduce((a, b) => a + b, 0);            // مجموع الأيام لحد النهارده
    const m = Math.round(goal * upto / total / 5) * 5;                      // الدقايق لحد النهارده (بتزيد كل يوم)
    return { n, g, s, m, c: Math.max(1, Math.round(m / FOCUS)), me: false };
  }).filter(r => r.m > 0);
}

/* ---------- tiny helpers ---------- */
const $ = s => document.querySelector(s);
const p2 = n => String(n).padStart(2, '0');
const now = () => Date.now();
const el = (t, c, x) => { const n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; };
const ic = n => (typeof svg === 'function' ? svg(n) : '');
const say = m => { if (typeof toast === 'function') toast(m); };
const url = () => (typeof FEEDBACK_URL === 'string' && /^https:\/\//.test(FEEDBACK_URL) ? FEEDBACK_URL : '');
const cid = () => (typeof CID === 'string' ? CID : 'anon');
const me = () => (typeof S === 'object' && S ? S : {});
const courses = () => (typeof D === 'object' && D && D.courses ? Object.keys(D.courses) : []);
const ymd = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const dayKey = ts => ymd(new Date(ts));
const weekKey = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 1) % 7); return ymd(d); };   // weeks start on Saturday, like the Schedule page
const fmt = m => (m >= 60 ? (m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`) : `${m} min`);
const clockStr = ms => { const s = Math.ceil(ms / 1000); return p2(Math.floor(s / 60)) + ':' + p2(s % 60); };
const when = ts => {
  const d = new Date(ts), t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return dayKey(ts) === dayKey(now()) ? t : d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + t;
};
const weekLabel = k => {
  const a = new Date(k + 'T00:00'), b = new Date(a); b.setDate(b.getDate() + 6);
  const f = x => x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return f(a) + ' – ' + f(b);
};
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : now().toString(36) + Math.random().toString(36).slice(2, 10));

/* ---------- saved state (own key, so "Reset saved data" in Settings never wipes the streak) ---------- */
const blank = () => ({ run: null, log: [], pend: [], cyc: 0, subj: 'General', cfg: { anon: false, sound: true } });
let st = blank();
try {
  const o = JSON.parse(localStorage.getItem(KEY));
  if (o && typeof o === 'object') st = Object.assign(blank(), o, { cfg: Object.assign(blank().cfg, o.cfg) });
} catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

let lb = null, lbAt = 0, tab = 'room', scope = 'all', failed = false, failWhy = '', loading = false, tm = 0, lastSid = null;
try { const c = JSON.parse(localStorage.getItem(LBKEY)); if (c && c.ok && c.week === weekKey(now())) lb = c; } catch (e) {}

/* the name that goes on the leaderboard: first name only, or "Anonymous" */
const who = () => (st.cfg.anon ? 'Anonymous' : (String(me().name || '').trim().split(/\s+/)[0] || 'Student').slice(0, 16));
const skipSend = () => { try { return localStorage.getItem('isAdmin') === '1' || new URLSearchParams(location.search).get('admin') === '1'; } catch (e) { return false; } };

/* ---------- network (same Apps Script web app as the feedback box) ---------- */
function post(body) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);   // never hang forever
  return fetch(url(), {
    method: 'POST', mode: 'no-cors', keepalive: true, signal: ctl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ id: cid(), name: who(), group: me().group || '', section: me().section || '' }, body))
  }).finally(() => clearTimeout(t));
}
const ping = (type, min) => { if (url() && !skipSend()) post({ type, min }).catch(() => {}); };

/* finished sessions wait in st.pend until the server has them (so nothing is lost offline) */
let flushing = false;
async function flush() {
  if (flushing || !st.pend.length) return;
  if (skipSend()) { st.pend = []; persist(); return; }
  if (!url()) return;
  flushing = true;
  try {
    while (st.pend.length) {                         // one at a time, oldest first: the server checks that sessions never overlap
      const s = st.pend[0];
      await post({ type: 'study_session', sid: s.sid, ts: s.ts, min: s.m, subj: s.subj });
      st.pend.shift(); persist();
    }
  } catch (e) { /* offline — try again later */ }
  flushing = false;
}

/* ---------- sound ---------- */
let ac = null;
function unlock() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function chime() {
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {}
  if (!st.cfg.sound || !ac) return;
  try {
    [880, 1175].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .22;
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
      o.start(t); o.stop(t + .22);
    });
  } catch (e) {}
}

/* ---------- the timer ----------
   A run is {kind:'focus'|'break'|'long', sid, subj, dur, end}  (or paused: {p:true, left}).
   It stores the END TIMESTAMP, never a counter, so it stays exact when the phone sleeps or the tab is closed. */
const remain = r => (r.p ? r.left : Math.max(0, r.end - now()));

function record(r) {                                  // a focus session reached the end → it counts
  const m = Math.round(r.dur / MIN);
  st.log.unshift({ sid: r.sid, ts: r.end, m, subj: r.subj });
  if (st.log.length > 300) st.log.length = 300;
  st.pend.push({ sid: r.sid, ts: r.end, m, subj: r.subj });
  if (st.pend.length > 100) st.pend.splice(0, st.pend.length - 100);
  flush();
}
function finished(kind, at) {
  const fresh = now() - at < 90000;                   // only make noise for something that just happened
  if (kind === 'focus') { say(`+${FOCUS} min saved ✓  Time for a break`); }
  else say('Break is over — ready for another round?');
  if (fresh) chime();
}
function settle() {                                   // finish everything whose end time has passed (also when the app was closed)
  let changed = false;
  while (st.run && !st.run.p && st.run.end <= now()) {
    const r = st.run; changed = true;
    if (r.kind === 'focus') {
      record(r);
      st.cyc = Math.min(CYCLE, (st.cyc || 0) + 1);
      const long = st.cyc >= CYCLE, d = (long ? LONG : BREAK) * MIN;
      st.run = { kind: long ? 'long' : 'break', sid: uid(), subj: r.subj, dur: d, end: r.end + d };
      finished('focus', r.end);
    } else {
      if (r.kind === 'long') st.cyc = 0;
      st.run = null;
      finished('break', r.end);
    }
  }
  if (changed) persist();
  return changed;
}
function start() {
  if (!st.log.length || now() - st.log[0].ts > 3 * 36e5 || st.cyc >= CYCLE) st.cyc = 0;   // a new study block → the 4 dots start over
  const t = now(), d = FOCUS * MIN;
  st.run = { kind: 'focus', sid: uid(), subj: st.subj || 'General', dur: d, end: t + d };
  persist(); ping('study_start', FOCUS); ensureTick(); paint();
}
function pause() { const r = st.run; r.left = Math.max(0, r.end - now()); r.p = true; delete r.end; persist(); ping('study_stop'); paint(); }
function resume() { const r = st.run; r.end = now() + r.left; r.p = false; delete r.left; persist(); ping('study_start', Math.ceil((r.end - now()) / MIN)); paint(); }
function endBreak() { if (st.run && st.run.kind === 'long') st.cyc = 0; st.run = null; persist(); paint(); }
async function cancelRun() {
  const r = st.run; if (!r || r.kind !== 'focus') return;
  const ok = typeof ask === 'function' ? await ask('Cancel this session?', [], "The time won't be counted.") : true;
  if (!ok || st.run !== r) return;                    // (it may have finished while the dialog was open)
  st.run = null; persist(); ping('study_stop'); paint();
}
function onMain() {
  unlock();
  const r = st.run;
  if (!r) return start();
  if (r.kind !== 'focus') return endBreak();         // "Skip break"
  r.p ? resume() : pause();
}

function ensureTick() { if (!tm) tm = setInterval(tick, 1000); }
function tick() {
  const changed = settle();
  paint();
  if (changed && visible()) { stats(); renderLog(); if (tab === 'board') setTimeout(loadBoard, 1500); }
  if (!st.run && tm) { clearInterval(tm); tm = 0; }
}

/* ---------- stats ---------- */
function streak() {
  const days = new Set(st.log.map(s => dayKey(s.ts)));
  const d = new Date(); d.setHours(12, 0, 0, 0);
  if (!days.has(ymd(d))) d.setDate(d.getDate() - 1);   // nothing yet today → the streak is still alive until tonight
  let n = 0; while (days.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const todayMin = () => { const k = dayKey(now()); return st.log.reduce((a, s) => a + (dayKey(s.ts) === k ? s.m : 0), 0); };
function stats() {
  if (!$('#ss-day')) return;
  const w = weekKey(now()); let wk = 0;
  st.log.forEach(s => { if (weekKey(s.ts) === w) wk += s.m; });
  const k = streak();
  $('#ss-day').textContent = fmt(todayMin());
  $('#ss-wk').textContent = fmt(wk);
  $('#ss-st').textContent = k + (k === 1 ? ' day' : ' days');
}
function renderLog() {
  const box = $('#st-log'); if (!box) return;
  const items = st.log.slice(0, 8);
  if (!items.length) { box.replaceChildren(el('p', 'empty', 'No sessions yet. Your first one starts the streak.')); return; }
  box.replaceChildren(...items.map(s => {
    const e = el('article', 'n st-l'), b = el('span', 'bell'), d = el('div');
    b.innerHTML = ic('ok'); d.append(el('b', '', s.subj || 'General'), el('small', '', `${s.m} min focus`));
    e.append(b, d, el('time', '', when(s.ts))); return e;
  }));
}

/* ---------- painting ---------- */
const visible = () => { const s = $('#study'); return !!s && !s.hidden; };
function tile() {                                      // the Home tile
  const n = $('#stn'); if (!n) return;
  const r = st.run, t = todayMin();
  n.textContent = r ? (r.p ? 'Paused' : (r.kind === 'focus' ? 'Focusing' : 'Break') + ' · ' + clockStr(remain(r))) : (t ? fmt(t) + ' today' : 'Focus & compete');
}
function setArc(p, sid) {
  const a = $('#st-arc'); if (!a) return;
  if (sid !== lastSid) { a.style.transition = 'none'; lastSid = sid; }   // a new run jumps instead of sweeping backwards
  a.style.strokeDashoffset = CIRC * (1 - Math.min(1, Math.max(0, p)));
  if (a.style.transition === 'none') { void a.getBoundingClientRect(); a.style.transition = ''; }
}
function paint() {
  const r = st.run, brk = !!r && r.kind !== 'focus', left = r ? remain(r) : FOCUS * MIN;
  const label = r ? (brk ? (r.kind === 'long' ? 'Long break' : 'Break') : 'Focus') : 'Ready';
  document.title = r && !r.p ? `${clockStr(left)} · ${label}` : 'Portal';
  tile();
  const pill = $('#st-pill');                          // floating timer when you are on another page
  if (!pill) return;                                   // page not built yet
  pill.hidden = !r || visible();
  if (r) {
    pill.classList.toggle('brk', brk);
    pill.querySelector('b').textContent = clockStr(left);
    pill.querySelector('small').textContent = r.p ? 'Paused' : brk ? label : (r.subj || 'Focus');
  }
  if (!visible()) return;

  $('#st-card').className = 'st-card' + (r && !r.p && !brk ? ' run' : '') + (brk ? ' brk' : '');
  $('#st-kind').textContent = r && r.p ? 'Paused' : label;
  $('#st-time').textContent = clockStr(left);
  $('#st-sub').textContent = r ? (brk ? 'Step away from the screen' : (r.subj || 'General')) : `Pomodoro · ${FOCUS} min focus + ${BREAK} min break`;
  setArc(r ? 1 - left / r.dur : 0, r ? r.sid : 'idle');
  $('#st-dots').replaceChildren(...Array.from({ length: CYCLE }, (_, i) => {
    const d = document.createElement('i');
    if (i < st.cyc) d.className = 'd'; else if (i === st.cyc && r && r.kind === 'focus') d.className = 'a';
    return d;
  }));
  const main = $('#st-main'), alt = $('#st-alt');
  main.textContent = !r ? 'Start focus' : brk ? 'Skip break' : r.p ? 'Resume' : 'Pause';
  alt.hidden = !r || brk;
  $('#st-sel').disabled = !!r;
  $('#st-live').textContent = lb && lb.live ? `${lb.live} studying now` : '';
}

function fillSubjects() {
  const s = $('#st-sel'); if (!s) return;
  const opts = ['General', ...courses()];
  s.replaceChildren(...opts.map(o => { const x = document.createElement('option'); x.value = x.textContent = o; return x; }));
  s.value = opts.includes(st.subj) ? st.subj : 'General';
}

/* ---------- leaderboard ----------
   The board ALWAYS draws something: real rows from the server when we have them (fresh or saved),
   and the demo names on top of that. If the server can't be reached you still see the board,
   plus a small message under it explaining what happened. */
function paintBoard() {
  const list = $('#lb-list'), you = $('#lb-me'); if (!list || !you) return;
  const d = lb;
  $('#lb-week').textContent = weekLabel(d ? d.week : weekKey(now()));
  $('#lb-ref').disabled = loading;
  document.querySelectorAll('#st-board .st-seg button').forEach(b => b.classList.toggle('on', b.dataset.s === scope));
  you.replaceChildren();
  if (!url()) {
    $('#lb-live').textContent = '';
    list.replaceChildren(el('p', 'empty', 'The leaderboard is not set up yet.'));
    return;
  }

  const real = d && d.rows ? d.rows : [], total = d && d.total ? d.total : real.length, fake = seedRows();
  $('#lb-live').textContent = d ? (d.live ? `${d.live} studying now` : `${total + fake.length} students this week`) : (loading ? 'Loading…' : '');

  let rows = real.concat(fake).sort((a, b) => b.m - a.m || b.c - a.c);
  if (scope === 'group' && me().group) rows = rows.filter(r => +r.g === +me().group);
  if (!rows.length) list.replaceChildren(el('p', 'empty', scope === 'group' ? 'Nobody in your group has studied this week yet.' : 'Nobody has finished a session this week yet. Be the first!'));
  else list.replaceChildren(...rows.map((r, i) => {
    const e = el('article', 'n lb-r' + (r.me ? ' me' : '')), t = el('div');
    t.append(el('b', '', r.n + (r.me ? ' (you)' : '')), el('small', '', `Group ${r.g || '–'} · Section ${r.s || '–'} · ${r.c} ${r.c === 1 ? 'session' : 'sessions'}`));
    e.append(el('span', 'rk', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)), el('span', 'bell', (r.n || '?').charAt(0).toUpperCase()), t, el('span', 'v', fmt(r.m)));
    return e;
  }));

  if (failed) {
    you.append(el('p', 'lb-you', "Couldn't reach the server, so real students may be missing. Check your connection and tap Refresh."));
    if (failWhy) you.append(el('p', 'lb-you', failWhy));
  }
  if (d) {
    const inList = rows.some(r => r.me);              // your own position, even when you are outside the top list
    if (d.me && !inList) you.append(el('p', 'lb-you', `Your rank this week: #${d.me.rank + fake.filter(f => f.m > d.me.m).length} · ${fmt(d.me.m)}`));
    else if (!d.me) you.append(el('p', 'lb-you', "You haven't finished a session this week yet. Start one to join the board."));
  }
}
async function loadBoard() {
  if (loading) return;
  if (!url()) { paintBoard(); return; }
  loading = true; failed = false; failWhy = ''; paintBoard();
  // make sure my latest session reached the server first — but never wait more than 4 seconds for it
  try { await Promise.race([flush(), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  let stage = 'network';
  try {
    // plain GET with no custom options/headers (a changing number in the link replaces the cache setting)
    const r = await fetch(`${url()}?action=leaderboard&id=${encodeURIComponent(cid())}&_=${now()}`, { signal: ctl.signal });
    stage = 'json';
    const d = await r.json();
    stage = 'reply';
    if (!d || !d.ok) throw new Error((d && d.error) || 'bad response');
    lb = d; lbAt = now();
    try { localStorage.setItem(LBKEY, JSON.stringify(d)); } catch (e) {}
  } catch (e) {
    failed = true;
    failWhy = stage === 'network' ? 'Reason: no answer from the server (the Web App access must be "Anyone", and the link must be the latest deployment).'
      : stage === 'json' ? 'Reason: the server answered with a web page, not data (the leaderboard line is missing in doGet, or the deployment is old).'
      : 'Reason: the server replied with an error — ' + e.message;
    console.warn('Study Rooms: leaderboard failed to load —', e);   // open the browser Console (F12) to see more
  }
  clearTimeout(t); loading = false;
  paintBoard(); paint();
}

/* ---------- chat ----------
   Rooms: General (everyone) · your group · your section. Messages go out as a POST (like the sessions) and come back
   through a light GET poll every few seconds while the Chat tab is open. A message you send shows as "sending" until the
   server returns it; if it never comes back it turns red and you can retry (the server ignores duplicates). */
const CKEY = 'portal:study:chat', MAXLEN = 400;
let cs = { ok: false, muted: [], rep: [], room: 'all' };       // saved on the phone: rules accepted, hidden people, reported messages, last room
try { const o = JSON.parse(localStorage.getItem(CKEY)); if (o && typeof o === 'object') cs = Object.assign(cs, o); } catch (e) {}
if (!Array.isArray(cs.muted)) cs.muted = [];
if (!Array.isArray(cs.rep)) cs.rep = [];
const cpersist = () => { try { localStorage.setItem(CKEY, JSON.stringify(cs)); } catch (e) {} };

const cbox = {}, outbox = [];                                   // cbox[room] = {msgs, last, loaded}
let myUid = '', ctm = 0, cpolling = false, cfail = 0, clast = 0, csel = '', cnew = 0, csent = 0;
const bx = r => cbox[r] || (cbox[r] = { msgs: [], last: 0, loaded: false });
const chatVisible = () => visible() && tab === 'chat';
const hm = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayLabel = ts => {
  const k = dayKey(ts), t = now();
  if (k === dayKey(t)) return 'Today';
  if (k === dayKey(t - 864e5)) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const yes = async (t, s) => (typeof ask === 'function' ? await ask(t, [], s) : confirm(t));

function chRoomList() {
  const g = +me().group || 0, s = +me().section || 0, r = [{ k: 'all', t: 'General' }];
  if (g) r.push({ k: 'g' + g, t: 'Group ' + g });
  if (s) r.push({ k: 's' + s, t: 'Section ' + s });
  return r;
}
function chRooms() {
  const box = $('#ch-rooms'); if (!box) return;
  const rs = chRoomList();
  if (!rs.some(r => r.k === cs.room)) cs.room = 'all';
  box.replaceChildren(...rs.map(r => {
    const b = el('button', r.k === cs.room ? 'on' : '', r.t); b.type = 'button';
    b.onclick = () => { if (cs.room === r.k) return; cs.room = r.k; cpersist(); csel = ''; cnew = 0; chRooms(); chHeader(); chRender(true); chLoop(true); };
    return b;
  }));
  const ta = $('#ch-in'); if (ta) ta.placeholder = 'Message ' + rs.find(r => r.k === cs.room).t + '…';
}
function chHeader() {
  const s = $('#ch-st'); if (!s) return;
  s.className = 'ch-st' + (cfail ? ' off' : '');
  s.textContent = cfail ? 'Offline — retrying…' : bx(cs.room).loaded ? 'Live' : 'Connecting…';
  const u = $('#ch-un'); u.hidden = !cs.muted.length; u.textContent = `Hidden people: ${cs.muted.length} · Show them`;
}
function chNewPill() {
  const p = $('#ch-new'); if (!p) return;
  p.hidden = !cnew; p.textContent = cnew + (cnew === 1 ? ' new message ↓' : ' new messages ↓');
}

/* ----- drawing the messages ----- */
function chRow(x, cont) {
  const r = el('div', 'ch-r' + (x.mine ? ' mine' : '') + (cont ? ' cont' : '') + (x.st === 'sending' ? ' pend' : x.st === 'failed' ? ' fail' : ''));
  if (!x.mine) {
    const a = el('span', 'ch-av' + (cont ? ' sp' : ''), (x.n || '?').charAt(0).toUpperCase());
    a.style.setProperty('--h', hue(x.u || x.n)); r.append(a);
  }
  const w = el('div', 'ch-bw'), b = el('div', 'ch-b');
  if (!x.mine && !cont) {
    const h = el('div', 'ch-h'); h.append(el('b', '', x.n));
    if (x.g || x.s) h.append(el('small', '', `G${x.g || '–'} · S${x.s || '–'}`));
    b.append(h);
  }
  const t = el('p', 'ch-x', x.x); t.dir = 'auto'; b.append(t);       // dir=auto → Arabic lines read right-to-left by themselves
  const tm = el('div', 'ch-t'); tm.append(el('time', '', hm(x.t)));
  if (x.mine) tm.append(el('span', '', x.st === 'sending' ? '…' : x.st === 'failed' ? '!' : '✓'));
  b.append(tm);
  b.onclick = () => { csel = csel === x.key ? '' : x.key; chRender(false); };
  w.append(b);
  if (csel === x.key) w.append(chActs(x));
  r.append(w); return r;
}
function chActs(x) {
  const a = el('div', 'ch-acts');
  const add = (t, f, c) => { const b = el('button', c || '', t); b.type = 'button'; b.onclick = e => { e.stopPropagation(); f(); }; a.append(b); };
  if (x.st === 'failed') {
    add('Retry', () => chRetry(x.o));
    add('Delete', () => { const i = outbox.indexOf(x.o); if (i >= 0) outbox.splice(i, 1); csel = ''; chRender(false); }, 'rd');
    return a;
  }
  add('Copy', () => chCopy(x.x));
  if (!x.mine && x.st === 'ok') { add('Report', () => chReport(x), 'rd'); add('Hide ' + (x.n || 'person'), () => chMute(x)); }
  return a;
}
function chRender(stick) {
  const list = $('#ch-list'); if (!list) return;
  if (!url()) { list.replaceChildren(el('p', 'ch-empty', 'Chat is not set up yet.')); return; }
  const b = bx(cs.room), keep = list.scrollTop, near = list.scrollHeight - list.scrollTop - list.clientHeight < 90, v = [];
  b.msgs.forEach(m => {
    if (cs.muted.includes(m.u) || cs.rep.includes(cs.room + ':' + m.t)) return;
    v.push({ key: 'm' + m.t, mine: !!myUid && m.u === myUid, n: m.n, g: m.g, s: m.s, u: m.u, x: m.x, t: m.t, st: 'ok' });
  });
  outbox.forEach(o => { if (o.room === cs.room) v.push({ key: 'o' + o.k, mine: true, n: who(), u: myUid || 'me', x: o.x, t: o.t0, st: o.st, o }); });
  if (!v.length) { list.replaceChildren(el('p', 'ch-empty', b.loaded ? 'No messages yet.\nSay hi 👋' : 'Loading messages…')); chNewPill(); return; }
  const rows = []; let prev = null;
  v.forEach(x => {
    const sameDay = !!prev && dayKey(prev.t) === dayKey(x.t);
    if (!sameDay) rows.push(el('div', 'ch-day', dayLabel(x.t)));
    rows.push(chRow(x, sameDay && prev.mine === x.mine && prev.u === x.u && x.t - prev.t < 180000));
    prev = x;
  });
  list.replaceChildren(...rows);
  if (stick || near) { list.scrollTop = list.scrollHeight; cnew = 0; } else list.scrollTop = keep;
  chNewPill();
}

/* ----- actions on a message ----- */
async function chCopy(t) {
  try { await navigator.clipboard.writeText(t); say('Copied'); } catch (e) { say("Couldn't copy"); }
  csel = ''; chRender(false);
}
async function chReport(x) {
  if (!(await yes('Report this message?', 'It will be sent to the admin for review.'))) return;
  cs.rep.push(cs.room + ':' + x.t); if (cs.rep.length > 200) cs.rep.shift(); cpersist();
  post({ type: 'chat_report', room: cs.room, t: x.t }).catch(() => {});
  csel = ''; chRender(false); say('Reported — thank you');
}
async function chMute(x) {
  if (!(await yes('Hide messages from ' + x.n + '?', 'You will stop seeing them on this phone. You can undo it any time.'))) return;
  if (!cs.muted.includes(x.u)) cs.muted.push(x.u);
  cpersist(); csel = ''; chHeader(); chRender(false);
}

/* ----- sending ----- */
function chInput() {
  const ta = $('#ch-in'), sb = $('#ch-send'), c = $('#ch-cnt'); if (!ta) return;
  ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  sb.disabled = !ta.value.trim();
  const left = MAXLEN - ta.value.length; c.textContent = left <= 60 ? String(left) : '';
}
function chPost(m) { m.t0 = now(); post({ type: 'chat_send', room: m.room, text: m.x, cmid: m.k }).catch(() => {}); }
function chSend() {
  const ta = $('#ch-in'); if (!ta || !url()) return;
  const x = ta.value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAXLEN);
  if (!x) return;
  if (now() - csent < 1200) { say('Slow down a little'); return; }
  csent = clast = now();
  const m = { k: uid(), room: cs.room, x, t0: csent, st: 'sending' };
  outbox.push(m); ta.value = ''; chInput(); chPost(m); csel = ''; chRender(true);
  setTimeout(chPoll, 1800); setTimeout(chPoll, 4200); setTimeout(chExpire, 31000); chLoop();
}
function chRetry(m) { m.st = 'sending'; chPost(m); csel = ''; chRender(true); setTimeout(chPoll, 2000); setTimeout(chExpire, 31000); }
function chExpire() {                                            // never came back from the server → let the student retry
  let c = false;
  outbox.forEach(o => { if (o.st === 'sending' && now() - o.t0 > 30000) { o.st = 'failed'; c = true; } });
  if (c && chatVisible()) chRender(false);
}

/* ----- receiving ----- */
function chMerge(room, arr) {
  const b = bx(room); let added = 0, others = 0;
  arr.forEach(m => {
    if (b.msgs.some(x => x.t === m.t)) return;
    b.msgs.push(m); added++; if (m.u !== myUid) others++;
    const i = outbox.findIndex(o => o.k === m.k); if (i >= 0) outbox.splice(i, 1);   // my message came back → delivered
  });
  if (added) {
    b.msgs.sort((a, c) => a.t - c.t);
    if (b.msgs.length > 200) b.msgs.splice(0, b.msgs.length - 200);
    b.last = b.msgs[b.msgs.length - 1].t; clast = now();
  }
  return { added, others };
}
async function chPoll() {
  if (cpolling || !url() || !cs.ok || !chatVisible() || document.hidden) return;
  cpolling = true;
  const room = cs.room, b = bx(room), first = !b.loaded, ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${url()}?action=chat&room=${encodeURIComponent(room)}&since=${b.last}&id=${encodeURIComponent(cid())}&_=${now()}`, { signal: ctl.signal });
    const d = await r.json();
    if (!d || !d.ok) throw new Error((d && d.error) || 'bad response');
    cfail = 0; if (d.you) myUid = d.you;
    const res = chMerge(room, d.msgs || []); b.loaded = true;
    chExpire();
    if (room === cs.room && (res.added || first)) {
      const l = $('#ch-list');
      if (res.others && l && l.scrollHeight - l.scrollTop - l.clientHeight >= 90) cnew += res.others;   // you are reading older messages → show the "new" button
      chRender(first);
    }
  } catch (e) { cfail++; console.warn('Study chat: poll failed —', e); }
  clearTimeout(t); cpolling = false; chHeader();
}
const chDelay = () => {                                          // fast while something is happening, slower when the room is quiet
  const idle = now() - clast;
  return (idle < 60000 ? 4000 : idle < 300000 ? 8000 : 15000) * Math.min(4, 1 + cfail);
};
function chLoop(fast) {
  clearTimeout(ctm);
  ctm = setTimeout(async () => {
    if (!chatVisible() || document.hidden || !cs.ok) return;       // stops by itself; it starts again when the chat is opened
    await chPoll(); chLoop();
  }, fast ? 0 : chDelay());
}
function chOpen() {
  $('#ch-rules').hidden = cs.ok; $('#ch-main').hidden = !cs.ok;
  if (!cs.ok) return;
  clast = now(); chRooms(); chHeader(); chRender(true); chLoop(true);
  setTimeout(() => { if (chatVisible()) chRender(true); }, 0);   // the page may only become visible a moment after this call
}

/* ----- look (injected here, so no CSS file has to change) ----- */
const CHAT_CSS = `
#study .st-tabs{display:grid;grid-template-columns:repeat(3,1fr)}
#st-chat{display:flex;flex-direction:column;margin-top:10px;min-height:300px;
  height:calc(100dvh - 156px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - var(--kb,0px))}
#ch-main{flex:1;min-height:0;display:flex;flex-direction:column}
.ch-rooms{flex:none;display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}
.ch-rooms button{flex:none;padding:7px 15px;border-radius:999px;border:1px solid var(--line);background:var(--s1);color:var(--mu);font-size:14px;font-weight:600}
.ch-rooms button.on{background:var(--coral);border-color:var(--coral);color:#fff}
.ch-meta{flex:none;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:0 4px 8px;font-size:12.5px;color:var(--mu)}
.ch-st::before{content:"";display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#18b26b;vertical-align:1px}
.ch-st.off::before{background:var(--coral)}
.ch-un{color:var(--mu);font-size:12.5px;text-decoration:underline}
.ch-wrap{position:relative;flex:1;min-height:0;display:flex}
.ch-list{flex:1;min-width:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;padding:10px 8px;
  border:1px solid var(--line);border-radius:var(--r);background:var(--s1)}
.ch-list>:first-child{margin-top:auto}
.ch-empty{margin:auto;padding:20px;text-align:center;color:var(--mu);font-size:14.5px;white-space:pre-line}
.ch-day{align-self:center;margin:12px 0 4px;padding:3px 12px;border-radius:999px;background:var(--s2);color:var(--mu);font-size:12px;font-weight:600}
.ch-r{display:flex;align-items:flex-start;gap:8px;margin-top:9px}
.ch-r.cont{margin-top:2px}
.ch-r.mine{flex-direction:row-reverse}
.ch-av{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:700;background:hsl(var(--h,0) 42% 36%)}
.ch-av.sp{visibility:hidden}
.ch-bw{display:grid;gap:5px;min-width:0;max-width:80%;justify-items:start}
.ch-r.mine .ch-bw{justify-items:end}
.ch-b{min-width:0;max-width:100%;padding:7px 11px 5px;border-radius:5px 16px 16px 16px;background:var(--s2);color:var(--tx);cursor:pointer;transition:transform .1s}
.ch-b:active{transform:scale(.985)}
.ch-r.cont:not(.mine) .ch-b{border-radius:5px 16px 16px 5px}
.ch-r.mine .ch-b{border-radius:16px 5px 16px 16px;background:var(--coral);color:#fff}
.ch-r.mine.cont .ch-b{border-radius:16px 5px 5px 16px}
.ch-r.pend .ch-b{opacity:.6}
.ch-r.fail .ch-b{background:color-mix(in srgb,var(--coral) 40%,var(--s2));box-shadow:inset 0 0 0 1.5px var(--coral)}
.ch-h{display:flex;align-items:baseline;gap:7px;margin-bottom:2px}
.ch-h b{display:block;font-size:13px;color:var(--coral)}
.ch-h small{color:var(--mu);font-size:11px}
.ch-x{font-size:15px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere;text-align:start}
.ch-t{display:flex;justify-content:flex-end;gap:5px;margin-top:2px;font-size:10.5px;opacity:.65}
.ch-acts{display:flex;flex-wrap:wrap;gap:6px}
.ch-acts button{padding:4px 12px;border-radius:999px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font-size:12.5px;font-weight:600}
.ch-acts .rd{color:var(--coral)}
.ch-new{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);padding:7px 15px;border-radius:999px;background:var(--coral);color:#fff;font-size:13px;font-weight:700;box-shadow:0 6px 18px rgba(229,32,46,.45)}
.ch-bar{flex:none;display:flex;align-items:flex-end;gap:8px;margin-top:10px}
.ch-bar textarea{flex:1;min-width:0;max-height:120px;resize:none;padding:11px 15px;border-radius:22px;border:1.5px solid var(--line);background:var(--s1);color:var(--tx);font:inherit;font-size:16px;line-height:1.3}
.ch-bar textarea:focus{outline:none;border-color:var(--coral)}
.ch-send{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--coral);color:#fff;box-shadow:0 6px 16px rgba(229,32,46,.35)}
.ch-send:disabled{opacity:.35;box-shadow:none}
.ch-cnt{flex:none;text-align:right;padding:2px 8px 0;font-size:11.5px;color:var(--mu)}.ch-cnt:empty{display:none}
.ch-rules{margin:auto 0;display:grid;justify-items:center;gap:10px;text-align:center;padding:24px 18px;border:1px solid var(--line);border-radius:var(--r);background:var(--s1)}
.ch-rules .ic{width:52px;height:52px;border-radius:16px}
.ch-rules h3{font-size:21px}
.ch-rules p{color:var(--mu);font-size:14.5px}
.ch-rules ul{list-style:none;display:grid;gap:9px;padding:0;text-align:left;color:var(--mu);font-size:14.5px;line-height:1.4}
.ch-rules li{display:flex;gap:10px}.ch-rules li::before{content:"•";color:var(--coral);font-weight:700}
`;
function injectCss() {
  if (document.getElementById('st-chat-css')) return;
  const s = document.createElement('style'); s.id = 'st-chat-css'; s.textContent = CHAT_CSS; document.head.append(s);
}

function setTab(t) {
  tab = t;
  $('#st-room').hidden = t !== 'room'; $('#st-board').hidden = t !== 'board'; $('#st-chat').hidden = t !== 'chat';
  document.querySelectorAll('#study .st-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'board') { paintBoard(); if (now() - lbAt > 20000) loadBoard(); }
  if (t === 'chat') chOpen();
}

/* ---------- build the page (injected, so index.html only needs the tile) ---------- */
function toggleRow(icon, title, sub, id) {
  const e = el('article', 'n st-l'), b = el('span', 'bell'), d = el('div'), p = el('button', 'pill');
  b.innerHTML = ic(icon); d.append(el('b', '', title), el('small', '', sub)); p.id = id; p.type = 'button';
  e.append(b, d, p); return e;
}
function build() {
  const main = $('main'); if (!main || $('#study')) return;
  const sec = el('section', 'view'); sec.id = 'study'; sec.hidden = true;
  sec.innerHTML = `
    <div class="st-tabs" role="tablist">
      <button type="button" data-t="room" class="on" role="tab">Focus room</button>
      <button type="button" data-t="board" role="tab">Leaderboard</button>
      <button type="button" data-t="chat" role="tab">Chat</button>
    </div>

    <div id="st-room">
      <div id="st-card" class="st-card">
        <div class="st-top"><span id="st-kind" class="st-kind">Ready</span><span id="st-live" class="st-live"></span></div>
        <div class="st-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="54"/><circle id="st-arc" class="fg" cx="60" cy="60" r="54" transform="rotate(-90 60 60)"/></svg>
          <div class="st-clock"><b id="st-time" role="timer">25:00</b><small id="st-sub"></small></div>
        </div>
        <div id="st-dots" class="st-dots" aria-hidden="true"></div>
        <label class="sel"><span>Subject</span><select id="st-sel" aria-label="Subject"></select></label>
        <div class="st-btns">
          <button id="st-main" type="button" class="cta">Start focus</button>
          <button id="st-alt" type="button" class="cta ghost" hidden>Cancel session</button>
        </div>
      </div>

      <div class="st-stats">
        <div><b id="ss-day">0 min</b><small>Today</small></div>
        <div><b id="ss-wk">0 min</b><small>This week</small></div>
        <div><b id="ss-st">0 days</b><small>Streak</small></div>
      </div>

      <div class="hd"><h2>Recent sessions</h2></div>
      <div id="st-log" class="list"></div>

      <div class="hd"><h2>Room settings</h2></div>
      <div id="st-set" class="list"></div>
    </div>

    <div id="st-board" hidden>
      <div class="lb-head">
        <div><b id="lb-week"></b><small id="lb-live"></small></div>
        <button id="lb-ref" type="button" class="pillo">Refresh</button>
      </div>
      <div class="st-seg">
        <button type="button" data-s="all" class="on">Everyone</button>
        <button type="button" data-s="group">My group</button>
      </div>
      <div id="lb-list" class="list"></div>
      <div id="lb-me"></div>
    </div>

    <div id="st-chat" hidden>
      <div id="ch-rules" class="ch-rules" hidden>
        <span id="ch-ic" class="ic"></span>
        <h3>Study chat</h3>
        <p>A place to ask questions and study together. Before you join:</p>
        <ul>
          <li>Be respectful. No insults, harassment, spam or ads.</li>
          <li>Never share passwords, phone numbers or other private details.</li>
          <li>Other students see your first name, group and section. Turn off “Show my name” in Room settings to appear as Anonymous.</li>
          <li>Any message can be reported. Admins can remove messages and block people.</li>
        </ul>
        <button id="ch-agree" type="button" class="cta">I agree</button>
      </div>
      <div id="ch-main" hidden>
        <div id="ch-rooms" class="ch-rooms"></div>
        <div class="ch-meta"><span id="ch-st" class="ch-st">Connecting…</span><button id="ch-un" type="button" class="ch-un" hidden></button></div>
        <div class="ch-wrap">
          <div id="ch-list" class="ch-list"></div>
          <button id="ch-new" type="button" class="ch-new" hidden></button>
        </div>
        <div class="ch-bar">
          <textarea id="ch-in" rows="1" maxlength="400" dir="auto" enterkeyhint="send" aria-label="Message"></textarea>
          <button id="ch-send" type="button" class="ch-send" aria-label="Send" disabled><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        </div>
        <small id="ch-cnt" class="ch-cnt"></small>
      </div>
    </div>`;
  injectCss();
  main.append(sec);

  const set = $('#st-set');
  set.append(toggleRow('bell', 'Sound', 'A chime when a session ends', 'st-snd'), toggleRow('user', 'Show my name', 'On the leaderboard (first name only)', 'st-anon'));
  const paintSet = () => { $('#st-snd').textContent = st.cfg.sound ? 'On' : 'Off'; $('#st-anon').textContent = st.cfg.anon ? 'Off' : 'On'; };
  $('#st-snd').onclick = () => { st.cfg.sound = !st.cfg.sound; persist(); paintSet(); if (st.cfg.sound) unlock(); };
  $('#st-anon').onclick = () => { st.cfg.anon = !st.cfg.anon; persist(); paintSet(); ping('study_profile'); say(st.cfg.anon ? 'You now appear as Anonymous' : 'Your first name is shown again'); };
  paintSet();

  sec.querySelectorAll('.st-tabs button').forEach(b => b.onclick = () => setTab(b.dataset.t));
  sec.querySelectorAll('.st-seg button').forEach(b => b.onclick = () => { scope = b.dataset.s; paintBoard(); });
  $('#st-main').onclick = onMain;
  $('#st-alt').onclick = cancelRun;
  $('#st-sel').onchange = e => { st.subj = e.target.value; persist(); };
  $('#lb-ref').onclick = loadBoard;

  $('#ch-ic').innerHTML = ic('others');
  $('#ch-agree').onclick = () => { cs.ok = true; cpersist(); chOpen(); };
  $('#ch-un').onclick = () => { cs.muted = []; cpersist(); chHeader(); chRender(false); };
  $('#ch-new').onclick = () => { const l = $('#ch-list'); cnew = 0; chNewPill(); l.scrollTo({ top: l.scrollHeight, behavior: 'smooth' }); };
  $('#ch-list').addEventListener('scroll', e => { const l = e.target; if (cnew && l.scrollHeight - l.scrollTop - l.clientHeight < 90) { cnew = 0; chNewPill(); } });
  $('#ch-in').oninput = chInput;
  $('#ch-in').onkeydown = e => {                                   // computer: Enter sends, Shift+Enter = new line. Phone: Enter = new line, use the arrow
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); chSend(); }
  };
  $('#ch-send').onclick = chSend;
  $('#ch-send').addEventListener('pointerdown', e => e.preventDefault());   // keep the keyboard open when you tap send

  const pill = el('button', 'st-pill'); pill.id = 'st-pill'; pill.type = 'button'; pill.hidden = true; pill.setAttribute('aria-label', 'Open Study Rooms');
  pill.innerHTML = '<span class="dot"></span><b></b><small></small>';
  pill.onclick = () => { if (typeof go === 'function') go('study'); };
  ($('#app') || document.body).append(pill);
}

/* ---------- called by script.js ---------- */
function open() {
  build();                                            // in case the page wasn't ready when this file loaded
  if (!$('#study')) return;
  fillSubjects(); settle(); lastSid = null;
  if (st.run) ensureTick();
  paint(); stats(); renderLog(); setTab(tab);
}

function init() {
  try {
    build();
    settle();
    if (st.run) ensureTick();
    paint(); flush();
  } catch (e) { console.log('Study Rooms:', e); }
}

/* build as soon as the page exists (works whether this file loads in <head> or at the end of <body>) */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
window.Study = { open, tile };

document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); flush(); } });
addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (!document.hidden && chatVisible()) chLoop(true); });
if (window.visualViewport) visualViewport.addEventListener('resize', () => {     // phone keyboard: shrink the chat so the message box stays visible
  const kb = Math.max(0, innerHeight - visualViewport.height - visualViewport.offsetTop);
  document.documentElement.style.setProperty('--kb', kb + 'px');
  if (chatVisible()) { const l = $('#ch-list'); if (l) l.scrollTop = l.scrollHeight; }
});
setInterval(() => { if (visible() && tab === 'board' && !document.hidden) loadBoard(); }, 60000);
if (document.readyState === 'complete') init(); else addEventListener('load', init);
})();