const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const tpl=id=>document.getElementById(id).content.firstElementChild.cloneNode(true);
const fill=(el,o)=>{el.querySelectorAll('[data-f]').forEach(n=>n.textContent=o[n.dataset.f]??'');return el};
const iso=d=>d.toLocaleDateString('sv');
const mins=t=>{const[h,m]=t.split(':');return h*60+ +m};
const clock=t=>{const[h,m]=t.split(':');return (h%12||12)+':'+m+(h<12?' AM':' PM')};
const p2=n=>String(n).padStart(2,'0');
const hm=m=>p2(Math.floor(m/60))+':'+p2(m%60);                                   // 585 → "09:45"
const dur=m=>{const h=Math.floor(m/60),r=m%60;return h?(r?`${h}h ${r}m`:`${h}h`):`${r} min`};
const HOUR0=8,SHOW_END=17,END_H=22,W0=26;    // timeline runs 8 AM → 10 PM; the screen fits 8 AM → 5 PM, later hours need a scroll
let PH=60;                                   // pixels per hour — recalculated in renderTimeline() so 8 AM–5 PM always fits the screen
const Y=m=>m*PH/60;
const GREY='#94a3b8';
const TITLES={home:'Portal',grades:'Grades',schedule:'Schedule',attendance:'Attendance',staff:'Contact Staff',transcript:'Transcript',evaluate:'Evaluate',sis:'SIS',others:'Other Schedules',settings:'Settings',tasks:'Tasks',exams:'Exams',dev:'About'};
const fresh=()=>({mine:[],seen:[],tasks:[],fb:{r:0,c:''},oth:{g:0,s:0}});
const app=$('#app'),menu=$('#menu'),scrim=$('#scrim');
let D,view='home',sel=new Date(),base,S=fresh();
try{Object.assign(S,JSON.parse(localStorage.getItem('st')))}catch(e){}
const save=()=>{try{localStorage.setItem('st',JSON.stringify(S))}catch(e){}};
const setTheme=()=>{const t=S.theme||'dark';document.documentElement.dataset.theme=t;const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='light'?'#ffffff':'#0a0a0a'}; // the phone's status bar follows the app background

/* icons: one place, used by the menu, tiles, lists and the "coming soon" pages */
const IC={
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
  grades:'<path d="M5 20v-9M12 20V4M19 20v-6"/>',
  schedule:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  others:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c0-3.4 2.6-5.4 6-5.4s6 2 6 5.4"/><path d="M16 5.6a3.1 3.1 0 0 1 0 5.8M18 14.9c1.9.7 3 2.4 3 5.1"/>',
  attendance:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
  staff:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  transcript:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  evaluate:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  settings:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  about:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.01"/>',
  tasks:'<rect x="4" y="4" width="16" height="16" rx="5"/><path d="m8.5 12.3 2.4 2.4 4.6-5.2"/>',
  exams:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  bell:'<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  cap:'<path d="m3 9 9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.4 2.2 3 5 3s5-1.6 5-3v-4.5"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  wifi:'<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0"/><path d="M12 19.5v.01"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  ok:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
  circle:'<circle cx="12" cy="12" r="9"/>'
};
const svg=n=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||IC.about}</svg>`;
$$('[data-ic]').forEach(b=>b.insertAdjacentHTML('afterbegin',svg(b.dataset.ic)));
$$('[data-svg]').forEach(n=>n.innerHTML=svg(n.dataset.svg));

const col=c=>/^[0-9a-f]{3,8}$/i.test(c||'')?'#'+c:(c||GREY);
/* readable text on a course colour: dark text on light colours, white on dark ones */
const lum=c=>{let h=String(c).replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');const n=parseInt(h.slice(0,6),16);if(isNaN(n))return .5;
  const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255)};
const fg=cs=>cs.reduce((a,c)=>a+lum(c),0)/cs.length>.25?'#141414':'#fff';
function info(label){
  const keys=String(label).split('/').map(p=>p.trim().toLowerCase()).map(p=>Object.keys(D.courses).find(k=>k.toLowerCase()===p||(D.courses[k].name||'').toLowerCase()===p));
  if(!keys.length||!keys.every(Boolean))return{label,name:label,colors:[GREY,GREY]};
  const cs=keys.map(k=>col(D.courses[k].color));
  return{label:keys.join(' / '),name:keys.map(k=>D.courses[k].name).join(' / '),colors:[cs[0],cs[1]||cs[0]]};
}
/* the schedule in data.json is per SECTION (1–24): "schedules": {"20":[...]}. Group g owns sections 3g-2 … 3g, e.g. group 7 → 19, 20, 21 */
const schedOf=s=>(D.schedules||{})[s]||[];
const sched=()=>schedOf(S.section);
const APP_VERSION='6';
const secsOf=g=>[1,2,3].map(i=>(g-1)*3+i);   // group g → its 3 sections (group 7 → 19, 20, 21)
const eventsOn=d=>[...sched().filter(e=>e.day===d.getDay()),...S.mine.filter(e=>e.date===iso(d))].sort((a,b)=>mins(a.start)-mins(b.start));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.id);toast.id=setTimeout(()=>t.classList.remove('show'),2600)}

/* dialog: ask(title, fields, text) → Promise of values, or null if cancelled */
function ask(title,fields=[],text='',lock=false){return new Promise(res=>{
  const d=$('#dlg'),f=d.querySelector('form'),q=v=>String(v??'').replace(/"/g,'&quot;');
  f.innerHTML='<h3></h3><p></p>'+fields.map((x,i)=>x.type==='chips'
    ?`<div class="fs"><span>${x.label}</span><div class="chips2">${x.opts.map(o=>`<label class="chip"><input type="radio" name="f${i}" value="${o}" required${o==x.val?' checked':''}><span>${o}</span></label>`).join('')}</div></div>`
    :`<label>${x.label}`+(x.type==='select'
      ?`<select name="f${i}">${x.opts.map(o=>`<option${o==x.val?' selected':''}>${o}</option>`).join('')}</select>`
      :`<input name="f${i}" type="${x.type||'text'}" value="${q(x.val)}" required>`)+'</label>').join('')
    +`<div class="btns">${lock?'':'<button value="no" formnovalidate>Cancel</button>'}<button value="ok" class="ok">OK</button></div>`;
  f.querySelector('h3').textContent=title;f.querySelector('p').textContent=text;
  d.onclose=()=>res(d.returnValue==='ok'?fields.map((_,i)=>f.elements['f'+i].value):null);
  d.oncancel=lock?e=>e.preventDefault():null;d.returnValue='';d.showModal();
})}
const item=o=>{const e=fill(tpl('t-item'),o),b=e.querySelector('button');b.hidden=!o.btn;if(o.fn)b.onclick=o.fn;if(o.svg)e.querySelector('.bell').innerHTML=svg(o.svg);return e};
const mk=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n};

/* tap on a class in the schedule → details sheet (name, type, time, room, staff) */
function detail(e){
  const i=info(e.course),d=$('#dlg'),f=d.querySelector('form');
  const head=mk('div','dhead');head.style.cssText=`--a:${i.colors[0]};--b:${i.colors[1]};--fg:${fg(i.colors)}`;
  head.append(mk('small','',[i.label!==i.name?i.label:'',e.title].filter(Boolean).join(' · ')),mk('h3','',i.name));
  const dl=mk('dl','det');
  [['Time',`${clock(e.start)} – ${clock(e.end)} (${dur(mins(e.end)-mins(e.start))})`],['Room',e.room||'Not announced yet'],['Staff',e.staff||'Not listed yet']].forEach(([k,v])=>{
    const r=mk('div');r.append(mk('dt','',k),mk('dd','',v));dl.append(r);
  });
  const ok=mk('button','ok','Close');ok.value='no';
  const b=mk('div','btns');b.append(ok);
  d.onclose=null;d.oncancel=null;d.returnValue='';
  f.replaceChildren(head,dl,b);d.showModal();
}

/* About page: Instagram link (in index.html) + rating with comment */
const RATE=['Tap a star to rate','Needs work','Fair','Good','Great','Excellent'];
const paintStars=()=>{[...$('#stars').children].forEach((b,i)=>b.classList.toggle('on',i<S.fb.r));$('#frate').textContent=RATE[S.fb.r]||RATE[0]};
function renderAbout(){
  const st=$('#stars');
  if(!st.children.length)for(let i=1;i<=5;i++){const b=document.createElement('button');b.textContent='★';b.setAttribute('aria-label',i+(i>1?' stars':' star'));b.onclick=()=>{S.fb.r=i;save();paintStars()};st.append(b)}
  $('#fbtxt').value=S.fb.c||'';paintStars();
}
$('#fbtxt').oninput=e=>{S.fb.c=e.target.value;save()};
$('#share').onclick=async()=>{
  const u=location.origin+location.pathname.replace(/index\.html$/,'');
  try{if(navigator.share)await navigator.share({title:'Uni Hub',text:'My university schedule, in one app',url:u});else{await navigator.clipboard.writeText(u);toast('Link copied')}}catch(e){}
};

/* feedback AND the visit counter → your Google Sheet (see apps-script/Code.gs). Paste your /exec URL here. */
const FEEDBACK_URL='https://script.google.com/macros/s/AKfycbxDPsehWjjW9CBbc9GDijsPSOJ8g4ZjehgT0sA4k1aJ7jrQayWoY_wZptu-J4xcJB_J/exec';
$('#fbsend').onclick=async()=>{
  const r=S.fb.r,c=$('#fbtxt').value.trim(),btn=$('#fbsend');
  if(!r)return toast('Pick a star rating first');
  if(!FEEDBACK_URL||FEEDBACK_URL.startsWith('PASTE'))return toast('Feedback is not set up yet');
  btn.disabled=true;btn.textContent='Sending…';
  try{
    await fetch(FEEDBACK_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({rating:r,comment:c,name:S.name||'',group:S.group||'',ua:navigator.userAgent})});
    S.fb={r:0,c:''};save();renderAbout();toast('Thank you! Your feedback was sent ✓');
  }catch(e){toast('No internet — try again')}
  btn.disabled=false;btn.textContent='Send feedback';
};

/* Tasks */
function tasks(){
  const rows=[...S.tasks].sort((a,b)=>a.done-b.done).map(t=>{
    const e=item({svg:t.done?'ok':'circle',t:t.t,s:t.c,btn:'Delete',fn:()=>{S.tasks=S.tasks.filter(x=>x!==t);save();tasks()}});
    e.classList.toggle('read',t.done);
    e.onclick=ev=>{if(!ev.target.closest('button')){t.done=!t.done;save();tasks()}};
    return e});
  $('#pl').replaceChildren(item({svg:'plus',t:'Add a task',s:'Homework, revision, anything to remember',btn:'Add',
    fn:()=>ask('New task',[{label:'Task'},{label:'Course',type:'select',opts:['General',...Object.keys(D.courses)],val:'General'}]).then(r=>{if(r&&r[0].trim()){S.tasks.unshift({t:r[0].trim(),c:r[1],done:false});save();tasks()}})}),...rows);
}

/* Exams: data.json → "exams":[{"course":"Physics (1)","title":"Midterm","date":"2026-11-10","start":"10:00","end":"11:30","room":"B8-G-41"}] */
function exams(){
  const box=$('#pl'),list=[...D.exams].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if(!list.length){const p=mk('p','empty',"No exams announced yet. They'll show up here as soon as they're added.");box.replaceChildren(p);return}
  const t0=new Date(new Date().toDateString());
  box.replaceChildren(...list.map(x=>{
    const d=new Date(x.date+'T00:00'),left=Math.round((d-t0)/864e5),i=info(x.course||'');
    const when=isNaN(d)?x.date:d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const e=item({svg:'exams',t:x.title||i.name||'Exam',s:[x.title&&i.name,when,x.start&&clock(x.start),x.room].filter(Boolean).join(' · '),
      r:isNaN(left)?'':left<0?'Passed':left===0?'Today':left===1?'Tomorrow':`in ${left} days`});
    e.classList.toggle('read',left<0);return e;
  }));
}

/* Settings: change group / section */
const pickSection=(g,cur)=>ask('Your section',[{label:`Group ${g} · choose your section`,type:'chips',opts:secsOf(g),val:cur}]);
function changeGroup(){
  ask('Change group',[{label:'Your group (1–8)',type:'chips',opts:[1,2,3,4,5,6,7,8],val:S.group}]).then(async r=>{
    if(!r)return;const g=+r[0],s=await pickSection(g,g===S.group?S.section:'');
    if(!s)return;S.group=g;S.section=+s[0];save();track('ping');renderHome();settings();toast(`Now in Group ${g} · Section ${S.section}`);
  });
}
function changeSection(){
  pickSection(S.group,S.section).then(r=>{if(!r)return;S.section=+r[0];save();track('ping');renderHome();settings();toast(`Now in Section ${S.section}`)});
}
/* offline status shown in Settings */
async function offlineState(){
  if(!window.isSecureContext||!('serviceWorker' in navigator))return 'Not available — open the site with https://';
  try{
    const reg=await navigator.serviceWorker.getRegistration();
    if(!reg||!reg.active)return 'Not ready yet — stay online for a few seconds, then reopen the app';
    const k=(await caches.keys()).find(x=>x.startsWith('portal-')),n=k?(await (await caches.open(k)).keys()).length:0;
    return navigator.serviceWorker.controller&&n>=4?'Ready — the app works without internet ✓':'Almost — close the app and open it once more while online';
  }catch(e){return 'Not available on this browser'}
}
function settings(){
  const mode=['fullscreen','standalone','minimal-ui'].find(m=>matchMedia(`(display-mode: ${m})`).matches)||'browser tab';
  const off=item({svg:'wifi',t:'Offline mode',s:'Checking…'}),info_=item({svg:'about',t:'App info',s:`Version ${APP_VERSION} · opened as: ${mode}`});
  offlineState().then(t=>{off.querySelector('small').textContent=t});
  $('#pl').replaceChildren(
    item({svg:'user',t:'Name',s:S.name,btn:'Edit',fn:()=>ask('Your name',[{label:'Name',val:S.name}]).then(r=>{if(r&&r[0].trim()){S.name=r[0].trim();save();renderHome();settings()}})}),
    item({svg:'others',t:'Group',s:`Group ${S.group}`,btn:'Edit',fn:changeGroup}),
    item({svg:'cap',t:'Section',s:`Section ${S.section}`,btn:'Edit',fn:changeSection}),
    item({svg:'moon',t:'Theme',s:S.theme==='light'?'White':'Black',btn:'Switch',fn:()=>{S.theme=S.theme==='light'?'dark':'light';save();setTheme();settings()}}),
    off,
    info_,
    item({svg:'trash',t:'Reset saved data',s:'Events, read notifications and tasks (name, group and section stay)',btn:'Reset',fn:()=>ask('Reset saved data?',[],'This clears your events and tasks on this device.').then(r=>{if(r){S=Object.assign(fresh(),{name:S.name,group:S.group,section:S.section,theme:S.theme});save();renderHome();settings();toast('Data reset')}})}));
}

function show(v){
  if(v!==view)$('main').scrollTop=0;
  view=v;
  const sec=['home','schedule','dev','others'].includes(v)?v:['settings','tasks','exams'].includes(v)?'page':'wip';
  $$('.view').forEach(s=>s.hidden=s.id!==sec);
  $$('#menu [data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
  $('#title').textContent=TITLES[v];$('#act').hidden=v!=='schedule';app.classList.remove('open');
  if(sec==='wip'){$('#wipt').textContent=TITLES[v]||'';$('#wipi').innerHTML=svg(IC[v]?v:'about')}
  if(v==='home')renderHome();else if(v==='schedule')renderSchedule();else if(v==='settings')settings();else if(v==='tasks')tasks();else if(v==='exams')exams();else if(v==='dev')renderAbout();else if(v==='others')fillOthers();
}

/* ---------- HOME ---------- */
function notifs(){
  const box=$('#notifs'),n=D.notifications;box.replaceChildren();
  $('#readall').hidden=!n.length;
  if(!n.length){box.append(mk('p','empty',"You're all caught up — nothing new right now."));return}
  n.forEach((x,i)=>{const e=fill(tpl('t-notif'),x);e.querySelector('.bell').innerHTML=svg('bell');e.classList.toggle('read',S.seen.includes(i));
    e.onclick=()=>{if(!S.seen.includes(i))S.seen.push(i);save();notifs()};box.append(e)});
  const u=n.length-S.seen.length;$('#readall').textContent=u?`Read All (${u})`:'All read';
}
const greet=()=>{const h=new Date().getHours();return h<5?'Hello':h<12?'Good morning':h<18?'Good afternoon':'Good evening'};
/* the class happening now, or the next one in the coming 7 days (your own events count too) */
function nextClass(){
  const n=new Date(),nm=n.getHours()*60+n.getMinutes();
  for(let i=0;i<7;i++){
    const d=new Date(n);d.setDate(n.getDate()+i);
    const evs=eventsOn(d);
    if(i===0){
      const cur=evs.find(e=>mins(e.start)<=nm&&nm<mins(e.end));
      if(cur)return{e:cur,i,d,now:true,nm};
      const nx=evs.find(e=>mins(e.start)>nm);
      if(nx)return{e:nx,i,d,now:false,nm};
    }else if(evs.length)return{e:evs[0],i,d,now:false,nm};
  }
  return null;
}
/* the live part of Home (hero + today list) — refreshed every 30 s */
function renderLive(){
  const nx=nextClass(),pb=$('#nxp');
  if(!nx){
    $('#nx1').textContent='No classes coming up';$('#nx2').textContent='Enjoy the break';$('#nx3').textContent='';$('#nxc').hidden=true;pb.hidden=true;
  }else{
    const{e,i,d,now,nm}=nx,s=mins(e.start),f=mins(e.end);
    $('#nx1').textContent=now?'Happening now':'Next class';
    $('#nxc').hidden=false;
    $('#nxc').textContent=now?`ends in ${dur(f-nm)}`:i===0?`in ${dur(s-nm)}`:i===1?'Tomorrow':d.toLocaleDateString('en-GB',{weekday:'long'});
    $('#nx2').textContent=info(e.course).name;
    $('#nx3').textContent=[e.title,`${clock(e.start)} – ${clock(e.end)}`,e.room].filter(Boolean).join(' · ');
    pb.hidden=!now;pb.firstElementChild.style.width=(now?Math.round((nm-s)/(f-s)*100):0)+'%';
  }
  const n=new Date(),nm=n.getHours()*60+n.getMinutes(),evs=eventsOn(n),box=$('#tdy');
  box.replaceChildren();
  const tot=evs.reduce((a,e)=>a+mins(e.end)-mins(e.start),0);
  $('#tsum').textContent=evs.length?`${evs.length} ${evs.length>1?'classes':'class'} · ${dur(tot)}`:'';
  if(!evs.length){box.append(mk('p','empty','No classes today.'));return}
  let marked=false;
  evs.forEach(e=>{
    const s=mins(e.start),f=mins(e.end),own=!!e.date,i=info(e.course);
    const st=nm>=f?'done':nm>=s?'now':!marked?(marked=true,'next'):'';
    const el=fill(tpl('t-tday'),{s:clock(e.start),e:clock(e.end),course:i.name,meta:[e.title,e.room].filter(Boolean).join(' · '),st:st==='now'?'Now':st==='next'?'Next':st==='done'?'Done':''});
    el.classList.add('is-'+(st||'later'));el.style.setProperty('--a',own?'var(--coral)':i.colors[0]);
    el.onclick=()=>go('schedule');box.append(el);
  });
}
function renderHome(){
  const n=new Date();
  $('#hello').textContent=S.name?`${greet()}, ${S.name}`:greet();
  $('#gdate').textContent=n.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
  $('#gchip').textContent=S.group&&S.section?`Group ${S.group} · Section ${S.section}`:'';
  $('#ini').textContent=(S.name||'?').trim().charAt(0).toUpperCase();
  $('#wn').textContent=S.name||'';$('#wg').textContent=S.group?`Group ${S.group} · Section ${S.section||'–'}`:'';
  const s0=new Date(n.getFullYear(),n.getMonth(),n.getDate()-(n.getDay()+1)%7),s1=new Date(s0);
  s1.setDate(s0.getDate()+7);
  const c=D.exams.filter(e=>{const d=new Date(e.date+'T00:00');return d>=s0&&d<s1}).length,open=S.tasks.filter(t=>!t.done).length;
  $('#exs').textContent=c?`${c} this week`:'None this week';
  $('#tkn').textContent=open?`${open} open`:S.tasks.length?'All done':'Add your first';
  renderLive();notifs();
}
setInterval(()=>{if(D&&view==='home')renderLive()},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&D&&view==='home')renderLive()});

/* ---------- OTHER SCHEDULES ---------- */
const GROUPS=[1,2,3,4,5,6,7,8],DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],DORD=[6,0,1,2,3,4,5];
let othDay=null;                              // null → today's tab if that section has classes today, otherwise "All"
function fillOthers(){
  const o=S.oth||(S.oth={g:0,s:0}),g=GROUPS.includes(+o.g)?+o.g:(+S.group||1),secs=secsOf(g).filter(s=>s!==+S.section);   // never your own section
  o.g=g;if(!secs.includes(+o.s))o.s=0;
  $('#og').innerHTML=GROUPS.map(x=>`<option value="${x}"${x===g?' selected':''}>Group ${x}</option>`).join('');
  $('#os').innerHTML=`<option value=""${o.s?'':' selected'} disabled>Choose</option>`+secs.map(s=>`<option value="${s}"${s===+o.s?' selected':''}>Section ${s}</option>`).join('');
  $('#ohint').textContent=g===+S.group?`This is your group — your own section (${S.section}) isn't listed here, it's on the Schedule page.`:'';
  renderOthDays();
}
$('#og').onchange=e=>{S.oth={g:+e.target.value,s:0};othDay=null;save();fillOthers()};
$('#os').onchange=e=>{S.oth.s=+e.target.value;othDay=null;save();renderOthDays()};
function ocard(e){
  const i=info(e.course),el=fill(tpl('t-oc'),{s:clock(e.start),e:clock(e.end),course:i.name,title:e.title,len:dur(mins(e.end)-mins(e.start)),room:e.room,staff:e.staff});
  el.querySelector('.bd').style.cssText=`--a:${i.colors[0]};--b:${i.colors[1]};--fg:${fg(i.colors)}`;
  return el;
}
function renderOthDays(){
  const o=S.oth,tabs=$('#odays'),list=$('#olist'),sum=$('#osum');
  tabs.replaceChildren();list.replaceChildren();sum.replaceChildren();sum.hidden=true;
  if(!o.s){tabs.hidden=true;list.append(mk('p','empty','Pick a group and a section to see their week, day by day.'));return}
  const evs=schedOf(o.s);
  if(!evs.length){tabs.hidden=true;list.append(mk('p','empty',"The schedule for this section isn't available yet."));return}
  const days=DORD.filter(x=>x<5||evs.some(e=>e.day===x)),cnt=x=>evs.filter(e=>e.day===x).length,td=new Date().getDay();
  let d=othDay;if(d!=='all'&&!days.includes(d))d=cnt(td)?td:'all';
  sum.hidden=false;sum.append(mk('b','',`Group ${o.g} · Section ${o.s}`),mk('small','',`${evs.length} classes a week`));
  tabs.hidden=false;
  [['all','All',evs.length],...days.map(x=>[x,DOW[x].slice(0,3),cnt(x)])].forEach(([k,l,n])=>{
    const b=mk('button','dtab'+(k===d?' on':'')+(n?'':' off'));b.append(mk('span','',l),mk('b','',n));
    b.onclick=()=>{othDay=k;renderOthDays()};tabs.append(b);
  });
  (d==='all'?days:[d]).forEach(x=>{
    const ds=evs.filter(e=>e.day===x).sort((a,b)=>mins(a.start)-mins(b.start));
    if(d==='all'&&!ds.length)return;
    const h=mk('div','dh');
    h.append(mk('b','',DOW[x]),mk('small','',ds.length?`${ds.length} ${ds.length>1?'classes':'class'} · ${clock(ds[0].start)} – ${clock(hm(Math.max(...ds.map(e=>mins(e.end)))))}`:'No classes'));
    list.append(h);
    if(!ds.length)list.append(mk('p','empty','Nothing scheduled on this day.'));
    ds.forEach(e=>list.append(ocard(e)));
  });
}

/* ---------- SCHEDULE: weeks are a horizontal scroll-snap strip (swipe left/right) ---------- */
const wkStart=d=>{const s=new Date(d.getFullYear(),d.getMonth(),d.getDate());s.setDate(s.getDate()-(s.getDay()+1)%7);return s};
const wkIdx=d=>Math.max(0,Math.min(2*W0,Math.round((wkStart(d)-base)/6048e5)+W0));
const scrollWeek=smooth=>{const w=$('#wk');w.scrollTo({left:wkIdx(sel)*w.clientWidth,behavior:smooth?'smooth':'auto'})};
const markSel=()=>$$('#wk button').forEach(b=>b.classList.toggle('on',b.dataset.d===iso(sel)));
function buildWeeks(){
  base=wkStart(new Date());const wk=$('#wk');wk.replaceChildren();const today=iso(new Date());
  for(let i=0;i<=2*W0;i++){
    const p=document.createElement('div');p.className='w';
    for(let j=0;j<7;j++){
      const d=new Date(base);d.setDate(base.getDate()+(i-W0)*7+j);
      const b=fill(tpl('t-day'),{dow:d.toLocaleString('en',{weekday:'short'}).toLowerCase(),num:d.getDate()});
      b.dataset.d=iso(d);if(b.dataset.d===today)b.classList.add('tod');b.onclick=()=>{sel=d;markSel();renderTimeline(2)};p.append(b);
    }
    wk.append(p);
  }
  let t;wk.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(()=>{
    if(!wk.clientWidth)return;const i=Math.round(wk.scrollLeft/wk.clientWidth);
    if(i===wkIdx(sel))return;
    const d=new Date(base);d.setDate(base.getDate()+(i-W0)*7+(sel.getDay()+1)%7);
    sel=d;markSel();renderTimeline(2);
  },90)});
}
function renderSchedule(){
  if(!base)buildWeeks();
  $('#nosch').hidden=sched().length>0;
  markSel();scrollWeek(false);renderTimeline(1);
}
function renderTimeline(focus){
  $('#title').textContent=sel.toLocaleString('en',{month:'long'});
  const evs=eventsOn(sel),span=END_H-HOUR0;
  /* one-line summary of the selected day, above the timeline */
  const ds=$('#dsum');ds.replaceChildren(mk('b','',sel.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})),
    mk('span','',evs.length?`${evs.length} ${evs.length>1?'classes':'class'} · ${clock(evs[0].start)} – ${clock(hm(Math.max(...evs.map(e=>mins(e.end)))))}`:'No classes'));
  const w=$('#tlw'),cs=getComputedStyle(w);
  // pixels per hour: sized so 8 AM → 5 PM exactly fills the visible area; 5 PM → 10 PM sits below (scroll)
  PH=Math.max(44,Math.floor((w.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-2)/(SHOW_END-HOUR0)));
  const tl=$('#tl');tl.replaceChildren();tl.style.height=Y(span*60)+'px';
  for(let h=HOUR0;h<=END_H;h++){
    const r=document.createElement('div');r.className='hr';r.style.top=Y((h-HOUR0)*60)+'px';
    r.innerHTML=`<span>${clock(h+':00').replace(':00','')}</span>`;tl.append(r);
  }
  evs.forEach(e=>{
    const i=info(e.course),own=!!e.date,s=mins(e.start),f=mins(e.end),hp=Y(f-s)-2,cl=own?['#e5202e']:i.colors;
    const el=fill(tpl('t-event'),{course:i.name,time:`${clock(e.start)} – ${clock(e.end)}`,title:e.title,room:e.room});
    el.classList.toggle('own',own);el.classList.toggle('sm',hp<96);el.classList.toggle('xs',hp<50);
    el.style.cssText=`top:${Y(s-HOUR0*60)+1}px;height:${hp}px;--a:${cl[0]};--b:${cl[cl.length-1]};--fg:${fg(cl)}`;
    el.onclick=()=>own?ask('Delete event?',[],e.course).then(r=>{if(r){S.mine=S.mine.filter(x=>x!==e);save();renderTimeline()}}):detail(e);
    tl.append(el);
  });
  const n=new Date(),top=Y(n.getHours()*60+n.getMinutes()-HOUR0*60);
  if(iso(n)===iso(sel)&&top>=0&&top<=Y(span*60)){const l=document.createElement('div');l.className='now';l.style.top=top+'px';tl.append(l)}
  if(focus)focusTimeline(focus===2);
}
function focusTimeline(smooth){
  // 8 AM always stays at the top; hours after 5 PM are reached by scrolling
  $('#tlw').scrollTo({top:0,behavior:smooth?'smooth':'auto'});
}
const goToday=()=>{sel=new Date();markSel();scrollWeek(true);renderTimeline(2)};
async function addEvt(def={}){
  const r=await ask('Add event',[{label:'Title',val:def.t},{label:'Date',type:'date',val:def.d||iso(sel)},{label:'Start time',type:'time',val:def.s||'14:00'},{label:'End time',type:'time',val:def.e||'15:00'}]);
  if(!r)return;const[t,date,s,e]=r,again=msg=>{toast(msg);return addEvt({t,d:date,s,e})};
  if(mins(e)<=mins(s))return again('End time must be after the start time');
  if(mins(s)<HOUR0*60||mins(e)>END_H*60)return again('Pick times between 8:00 AM and 10:00 PM');
  S.mine.push({course:t.trim()||'Event',title:'Personal',date,start:s,end:e,room:''});
  save();sel=new Date(date+'T00:00');markSel();scrollWeek(true);renderTimeline(2);
}
setInterval(()=>{if(view==='schedule')renderTimeline()},60000);
addEventListener('resize',()=>{if(view==='schedule')renderTimeline()});
/* Today and + react to a tap, a swipe/drag over them, or a wheel scroll */
function swipe(el,fn){
  let p=null,fired=false,w0=0;
  el.addEventListener('pointerdown',e=>{p={x:e.clientX,y:e.clientY};fired=false});
  el.addEventListener('pointermove',e=>{if(p&&!fired&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>10){fired=true;fn()}});
  ['pointerup','pointercancel'].forEach(t=>el.addEventListener(t,()=>p=null));
  el.addEventListener('click',()=>{if(fired){fired=false;return}fn()});
  el.addEventListener('wheel',e=>{e.preventDefault();if(Date.now()-w0>500){w0=Date.now();fn()}},{passive:false});
}
swipe($('#today'),goToday);swipe($('#add'),addEvt);

/* sidebar: swipe right anywhere (or tap ☰) to open; swipe left / tap the backdrop to close */
let dr=null,tapAt=0;
function dn(e){
  const o=app.classList.contains('open'),r=app.getBoundingClientRect();
  if(!o&&(e.target.closest('#wk')||e.clientX-r.left>r.width/2))return;
  dr={x:e.clientX,y:e.clientY,o,w:menu.offsetWidth+30,on:false,p:0,lx:e.clientX,lt:performance.now(),v:0};
}
function mv(e){
  if(!dr)return;const dx=e.clientX-dr.x,dy=e.clientY-dr.y,t=performance.now();
  if(!dr.on){
    if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy))return;
    if(!dr.o&&dx<0){dr=null;return}
    dr.on=true;app.setPointerCapture(e.pointerId);
  }
  dr.v=(e.clientX-dr.lx)/Math.max(1,t-dr.lt);dr.lx=e.clientX;dr.lt=t;
  dr.p=Math.max(0,Math.min(dr.w,(dr.o?dr.w:0)+dx));
  menu.style.transition=scrim.style.transition='none';menu.style.transform=`translateX(${dr.p-dr.w}px)`;scrim.style.opacity=dr.p/dr.w;
}
function up(e,cancel){
  if(!dr)return;const d=dr;dr=null;
  menu.style.transition=menu.style.transform=scrim.style.transition=scrim.style.opacity='';
  if(d.on)app.classList.toggle('open',d.v>.35?true:d.v<-.35?false:d.p>d.w*(d.o?.7:.3));
  else if(!cancel&&e.target.closest('#burger'))app.classList.toggle('open');
  else if(!cancel&&e.target.closest('#scrim'))app.classList.remove('open');
  else if(!cancel){                                   // tap on a sidebar item → open it immediately
    const b=e.target.closest('#menu [data-view]');
    if(b&&D){tapAt=Date.now();go(b.dataset.view)}
  }
}
app.onpointerdown=dn;app.onpointermove=mv;app.onpointerup=e=>up(e,0);app.onpointercancel=e=>up(e,1);
$('#burger').onclick=e=>{if(!e.detail)app.classList.toggle('open')}; // keyboard

let gt=0;
function go(v){
  app.classList.remove('open');
  if(v===view)return;
  const m=$('main'),id=++gt;
  m.classList.remove('in');m.classList.add('out');
  setTimeout(()=>{
    if(id!==gt)return;
    show(v);m.classList.remove('out');void m.offsetWidth;m.classList.add('in');
  },130);
}
$('#readall').onclick=()=>{if(D){S.seen=D.notifications.map((_,i)=>i);save();notifs()}};
document.addEventListener('click',e=>{
  const v=e.target.closest('[data-view]');if(!v||!D)return;
  if(v.closest('#menu')&&Date.now()-tapAt<600)return;   // already handled on pointerup
  go(v.dataset.view);
});

/* soft rubber-band at the top/bottom of scrollable areas */
function elastic(sc,tg,ok){
  const MAX=64;let last=0,raw=0,on=false,wt;
  const edges=()=>({top:sc.scrollTop<=0,bot:sc.scrollTop+sc.clientHeight>=sc.scrollHeight-1,can:sc.scrollHeight>sc.clientHeight+1});
  const put=(t,px)=>{t.style.transform=px?`translateY(${px}px)`:''};
  sc.addEventListener('touchstart',e=>{
    if(ok&&!ok(e)){on=false;return}
    on=true;raw=0;last=e.touches[0].clientY;const t=tg();if(t)t.style.transition='none';
  },{passive:true});
  sc.addEventListener('touchmove',e=>{
    if(!on)return;const y=e.touches[0].clientY,d=y-last;last=y;
    const{top,bot,can}=edges(),t=tg();if(!can||!t)return;
    if(raw===0&&!((d>0&&top)||(d<0&&bot)))return;
    raw+=d;if((top&&raw<0)||(bot&&raw>0))raw=0;
    const s=Math.sign(raw);put(t,s*MAX*(1-Math.exp(-Math.abs(raw)/(MAX*2))));
    if(raw&&e.cancelable)e.preventDefault();
  },{passive:false});
  const end=()=>{
    on=false;const t=tg();if(!t||!raw)return;raw=0;
    t.style.transition='transform .5s cubic-bezier(.2,.9,.25,1)';put(t,0);
  };
  sc.addEventListener('touchend',end);sc.addEventListener('touchcancel',end);
  sc.addEventListener('wheel',e=>{
    const t=tg(),{top,bot,can}=edges();if(!t||!can)return;
    if((e.deltaY<0&&top)||(e.deltaY>0&&bot)){
      t.style.transition='transform .12s ease-out';put(t,e.deltaY<0?10:-10);
      clearTimeout(wt);wt=setTimeout(()=>{t.style.transition='transform .45s cubic-bezier(.2,.9,.25,1)';put(t,0)},110);
    }
  },{passive:true});
}
elastic($('main'),()=>$('main .view:not([hidden])'),e=>!e.target.closest('.tlw')&&view!=='schedule');   // Home now scrolls as one page
elastic($('.tlw'),()=>$('#tl'));

async function onboard(name=S.name||'',grp=S.group||'',sec=''){
  if(!S.name||!S.group){                      // step 1: name + group (skipped when they are already saved)
    const r=await ask('Welcome 👋',[{label:'Your name',val:name},{label:'Your group (1–8)',type:'chips',opts:[1,2,3,4,5,6,7,8],val:grp}],"You can change your group and section later from Settings.",true);
    name=r[0].trim();grp=r[1];
    if(!name||!/^[1-8]$/.test(grp)){toast('Enter your name and choose a group');return onboard(name,grp,sec)}
  }
  const g=+grp,opts=secsOf(g);                // step 2: your tutorial section inside that group
  const r2=await ask('Your section',[{label:`Group ${g} · choose your section`,type:'chips',opts,val:opts.includes(+sec)?sec:''}],"You can change it later from Settings.",true);
  const s=+r2[0];
  if(!opts.includes(s)){toast('Choose your section');return onboard(name,grp,sec)}
  S.name=name;S.group=g;S.section=s;save();track('ping');renderHome();show('home');toast(`Welcome, ${name}!`);
}
/* data: data.json (data/data.json or next to index.html) is the only source. Every successful load is cached in localStorage; the cache is used when offline. */
const DATA_KEY='portal:data2';               // (new key: the old cached data was per group, this one is per section)
const valid=d=>d&&d.courses&&d.schedules&&['exams','notifications'].every(k=>Array.isArray(d[k]));
const cachedData=()=>{try{const d=JSON.parse(localStorage.getItem(DATA_KEY));return valid(d)?d:null}catch(e){return null}};
/* data.json lives in data/ or next to index.html. Each answer must be REAL json (a host that answers every unknown address with index.html is skipped). */
async function fetchData(){
  const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),8000);
  try{
    for(const u of ['data/data.json','data.json']){
      try{
        const r=await fetch(u,{cache:'no-cache',signal:ctl.signal});if(!r.ok)continue;
        const d=await r.json();
        if(valid(d)){try{localStorage.setItem(DATA_KEY,JSON.stringify(d))}catch(e){}return d}
      }catch(e){if(ctl.signal.aborted)break}
    }
  }finally{clearTimeout(t)}
  return null;
}
/* visit counter: tells the Google Sheet who is online — an anonymous id, group, section, app/website. No name is sent. */
const CID=(()=>{try{let c=localStorage.getItem('portal:cid');if(!c){c=crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('portal:cid',c)}return c}catch(e){return 'anon'}})();
let lastSent=0;
function track(type){
  if(!FEEDBACK_URL||FEEDBACK_URL.startsWith('PASTE')||['localhost','127.0.0.1'].includes(location.hostname))return;   // your own testing on Live Server isn't counted
  const ua=navigator.userAgent,inApp=matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone;
  lastSent=Date.now();
  fetch(FEEDBACK_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({type,id:CID,source:inApp?'App':'Website',group:S.group||'',section:S.section||'',
      device:/Android/.test(ua)?'Android':/iPhone|iPad|iPod/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'Mac':'Other'})}).catch(()=>{});
}
setInterval(()=>{if(document.visibilityState==='visible')track('ping')},90000);           // "still here" while the app is open
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')track(Date.now()-lastSent>30*60000?'visit':'ping')});
function boot(d){
  D=d;setTheme();show('home');document.documentElement.classList.add('ready');track('visit');
  if(!S.name||!S.group||!S.section)onboard();
}
/* start instantly from the copy saved on the phone, then quietly look for a newer data.json in the background */
const saved=cachedData();
if(saved){
  boot(saved);
  fetchData().then(d=>{
    if(!d||JSON.stringify(d)===JSON.stringify(D))return;
    D=d;renderHome();if(view==='schedule')renderSchedule();else if(view==='others')fillOthers();
  });
}else{
  fetchData().then(d=>{
    if(d)return boot(d);
    $('#hello').textContent="Couldn't load data";
    $('#notifs').replaceChildren(mk('p','empty','Open the app from a web server (Live Server / your site) and make sure data.json is in the data folder (or next to index.html).'));
    document.documentElement.classList.add('ready');
  });
}

/* offline support: service-worker.js keeps the app on the phone (a new version is used the next time the app opens) */
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(e=>console.log('Service Worker failed:',e)));