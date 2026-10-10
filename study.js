/* Study Rooms — study.js
   A personal focus room: Pomodoro (25 min study + 5 min break), every finished session is saved,
   and a weekly leaderboard adds up each student's own minutes. Rooms are solo — everyone scores alone.

   Needs script.js (S, D, CID, FEEDBACK_URL, toast, ask, svg, go). Safe to load before or after it:
   nothing here touches those at load time, only when the student actually uses the room. */
(function () {
'use strict';

/* ---------- settings ---------- */
const FOCUS = 25, BREAK = 5, LONG = 15, CYCLE = 4;      // minutes · a long break after every 4th focus session
const MIN = 60000, CIRC = 2 * Math.PI * 54;             // ring circumference (r = 54, see the SVG below)
const KEY = 'portal:study', LBKEY = 'portal:study:lb';

/* ---------- demo names (so the leaderboard never looks empty) ----------
   Set SEED_ON to false to remove them. They also leave on their own: the board always shows 10 names in total,
   so every real student who joins pushes one demo name out (the strongest first). Minutes grow through the week. */
const SEED_ON = true;
const SEED = [                                        // [first name, group, section, minutes over a full week] — highest first
  ['Omar', 7, 19, 1850], ['Mariam', 3, 8, 1625], ['Youssef', 7, 21, 1450], ['Nour', 5, 14, 1300], ['Ahmed', 1, 2, 1125],
  ['Salma', 2, 5, 975], ['Karim', 4, 11, 825], ['Hana', 8, 23, 650], ['Mostafa', 6, 17, 475], ['Farida', 7, 19, 300]
];
function seedRows(realCount) {
  const need = SEED_ON ? Math.max(0, SEED.length - realCount) : 0;
  if (!need) return [];
  const frac = (((new Date().getDay() + 1) % 7) + 1) / 7;   // Saturday = 1/7 … Friday = 7/7
  return SEED.slice(SEED.length - need).map(([n, g, s, w]) => {
    const m = Math.max(25, Math.round(w * frac / 25) * 25);  // whole 25-minute sessions
    return { n, g, s, m, c: m / 25, me: false };
  });
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

let lb = null, lbAt = 0, tab = 'room', scope = 'all', failed = false, loading = false, tm = 0, lastSid = null;
try { const c = JSON.parse(localStorage.getItem(LBKEY)); if (c && c.ok && c.week === weekKey(now())) lb = c; } catch (e) {}

/* the name that goes on the leaderboard: first name only, or "Anonymous" */
const who = () => (st.cfg.anon ? 'Anonymous' : (String(me().name || '').trim().split(/\s+/)[0] || 'Student').slice(0, 16));
const skipSend = () => { try { return localStorage.getItem('isAdmin') === '1' || new URLSearchParams(location.search).get('admin') === '1'; } catch (e) { return false; } };

/* ---------- network (same Apps Script web app as the feedback box) ---------- */
function post(body) {
  return fetch(url(), {
    method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ id: cid(), name: who(), group: me().group || '', section: me().section || '' }, body))
  });
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
  const w = weekKey(now()); let wk = 0;
  st.log.forEach(s => { if (weekKey(s.ts) === w) wk += s.m; });
  const k = streak();
  $('#ss-day').textContent = fmt(todayMin());
  $('#ss-wk').textContent = fmt(wk);
  $('#ss-st').textContent = k + (k === 1 ? ' day' : ' days');
}
function renderLog() {
  const box = $('#st-log'), items = st.log.slice(0, 8);
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
  const a = $('#st-arc');
  if (sid !== lastSid) { a.style.transition = 'none'; lastSid = sid; }   // a new run jumps instead of sweeping backwards
  a.style.strokeDashoffset = CIRC * (1 - Math.min(1, Math.max(0, p)));
  if (a.style.transition === 'none') { void a.getBoundingClientRect(); a.style.transition = ''; }
}
function paint() {
  const r = st.run, brk = !!r && r.kind !== 'focus', left = r ? remain(r) : FOCUS * MIN;
  const label = r ? (brk ? (r.kind === 'long' ? 'Long break' : 'Break') : 'Focus') : 'Ready';
  const pill = $('#st-pill');                          // floating timer when you are on another page
  pill.hidden = !r || visible();
  if (r) {
    pill.classList.toggle('brk', brk);
    pill.querySelector('b').textContent = clockStr(left);
    pill.querySelector('small').textContent = r.p ? 'Paused' : brk ? label : (r.subj || 'Focus');
  }
  document.title = r && !r.p ? `${clockStr(left)} · ${label}` : 'Portal';
  tile();
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
  const s = $('#st-sel'), opts = ['General', ...courses()];
  s.replaceChildren(...opts.map(o => { const x = document.createElement('option'); x.value = x.textContent = o; return x; }));
  s.value = opts.includes(st.subj) ? st.subj : 'General';
}

/* ---------- leaderboard ---------- */
function paintBoard() {
  const d = lb, list = $('#lb-list'), you = $('#lb-me');
  $('#lb-week').textContent = weekLabel(d ? d.week : weekKey(now()));
  $('#lb-live').textContent = d ? (d.live ? `${d.live} studying now` : `${(d.total || 0) + seedRows(d.total || 0).length} students this week`) : '';
  $('#lb-ref').disabled = loading;
  document.querySelectorAll('#st-board .st-seg button').forEach(b => b.classList.toggle('on', b.dataset.s === scope));
  you.replaceChildren();
  if (!url()) { list.replaceChildren(el('p', 'empty', 'The leaderboard is not set up yet.')); return; }
  if (!d) { list.replaceChildren(el('p', 'empty', failed ? "Couldn't load the leaderboard. Check your connection and tap Refresh." : 'Loading…')); return; }

  const real = d.rows || [], fake = seedRows(d.total || real.length);
  let rows = real.concat(fake).sort((a, b) => b.m - a.m || b.c - a.c);
  if (scope === 'group' && me().group) rows = rows.filter(r => +r.g === +me().group);
  if (!rows.length) list.replaceChildren(el('p', 'empty', scope === 'group' ? 'Nobody in your group has studied this week yet.' : 'Nobody has finished a session this week yet. Be the first!'));
  else list.replaceChildren(...rows.map((r, i) => {
    const e = el('article', 'n lb-r' + (r.me ? ' me' : '')), t = el('div');
    t.append(el('b', '', r.n + (r.me ? ' (you)' : '')), el('small', '', `Group ${r.g || '–'} · Section ${r.s || '–'} · ${r.c} ${r.c === 1 ? 'session' : 'sessions'}`));
    e.append(el('span', 'rk', i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1)), el('span', 'bell', (r.n || '?').charAt(0).toUpperCase()), t, el('span', 'v', fmt(r.m)));
    return e;
  }));

  const inList = rows.some(r => r.me);                // your own position, even when you are outside the top list
  if (d.me && !inList) you.append(el('p', 'lb-you', `Your rank this week: #${d.me.rank + fake.filter(f => f.m > d.me.m).length} · ${fmt(d.me.m)}`));
  else if (!d.me) you.append(el('p', 'lb-you', "You haven't finished a session this week yet. Start one to join the board."));
}
async function loadBoard() {
  if (loading) return;
  if (!url()) { paintBoard(); return; }
  loading = true; failed = false; paintBoard();
  await flush();                                       // make sure my latest session reached the server first
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${url()}?action=leaderboard&id=${encodeURIComponent(cid())}`, { cache: 'no-store', signal: ctl.signal });
    const d = await r.json();
    if (!d || !d.ok) throw new Error('bad response');
    lb = d; lbAt = now();
    try { localStorage.setItem(LBKEY, JSON.stringify(d)); } catch (e) {}
  } catch (e) { failed = true; }
  clearTimeout(t); loading = false;
  paintBoard(); paint();
}

function setTab(t) {
  tab = t;
  $('#st-room').hidden = t !== 'room'; $('#st-board').hidden = t !== 'board';
  document.querySelectorAll('#study .st-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'board') { paintBoard(); if (now() - lbAt > 20000) loadBoard(); }
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
      <p class="lead">Ranking counts finished focus sessions only, from Saturday to Friday. Only your first name is shown.</p>
    </div>`;
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

  const pill = el('button', 'st-pill'); pill.id = 'st-pill'; pill.type = 'button'; pill.hidden = true; pill.setAttribute('aria-label', 'Open Study Rooms');
  pill.innerHTML = '<span class="dot"></span><b></b><small></small>';
  pill.onclick = () => { if (typeof go === 'function') go('study'); };
  ($('#app') || document.body).append(pill);
}

/* ---------- called by script.js ---------- */
function open() {
  fillSubjects(); settle(); lastSid = null;
  if (st.run) ensureTick();
  paint(); stats(); renderLog(); setTab(tab);
}

function init() {
  try {
    settle();
    if (st.run) ensureTick();
    paint(); flush();
  } catch (e) { console.log('Study Rooms:', e); }
}

build();
window.Study = { open, tile };

document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); flush(); } });
addEventListener('online', flush);
setInterval(() => { if (visible() && tab === 'board' && !document.hidden) loadBoard(); }, 60000);
if (document.readyState === 'complete') init(); else addEventListener('load', init);
})();