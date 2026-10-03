const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const tpl=id=>document.getElementById(id).content.firstElementChild.cloneNode(true);
const fill=(el,o)=>{el.querySelectorAll('[data-f]').forEach(n=>n.textContent=o[n.dataset.f]??'');return el};
const iso=d=>d.toLocaleDateString('sv');
const mins=t=>{const[h,m]=t.split(':');return h*60+ +m};
const clock=t=>{const[h,m]=t.split(':');return (h%12||12)+':'+m+(h<12?' AM':' PM')};
const p2=n=>String(n).padStart(2,'0');
const HOUR0=8,SHOW_END=17,END_H=22,W0=26;    // timeline runs 8 AM → 10 PM; the screen fits 8 AM → 5 PM, later hours need a scroll
let PH=60;                                   // pixels per hour — recalculated in renderTimeline() so 8 AM–5 PM always fits the screen
const Y=m=>m*PH/60;
const GREY='#94a3b8';
const TITLES={home:'Portal',grades:'Grades',schedule:'Schedule',attendance:'Attendance',staff:'Contact Staff',transcript:'Transcript',evaluate:'Evaluate',sis:'SIS',others:'Other Schedules',settings:'Settings',tasks:'Tasks',dev:'About'};
const fresh=()=>({mine:[],seen:[],tasks:[],fb:{r:0,c:''}});
const app=$('#app'),menu=$('#menu'),scrim=$('#scrim');
let D,view='home',sel=new Date(),base,S=fresh();
try{Object.assign(S,JSON.parse(localStorage.getItem('st')))}catch(e){}
const save=()=>{try{localStorage.setItem('st',JSON.stringify(S))}catch(e){}};
const setTheme=()=>{const t=S.theme||'dark';document.documentElement.dataset.theme=t;const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='light'?'#ffffff':'#0a0a0a'}; // the phone's status bar follows the app background
const col=c=>/^[0-9a-f]{3,8}$/i.test(c||'')?'#'+c:(c||GREY);
function info(label){
  const keys=String(label).split('/').map(p=>p.trim().toLowerCase()).map(p=>Object.keys(D.courses).find(k=>k.toLowerCase()===p||(D.courses[k].name||'').toLowerCase()===p));
  if(!keys.length||!keys.every(Boolean))return{label,name:label,colors:[GREY,GREY]};
  const cs=keys.map(k=>col(D.courses[k].color));
  return{label:keys.join(' / '),name:keys.map(k=>D.courses[k].name).join(' / '),colors:[cs[0],cs[1]||cs[0]]};
}
/* the schedule in data.json is per SECTION (1–24): "schedules": {"20":[...]}. Group g owns sections 3g-2 … 3g, e.g. group 7 → 19, 20, 21 */
const sched=()=>(D.schedules||{})[S.section]||[];
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
const item=o=>{const e=fill(tpl('t-item'),o),b=e.querySelector('button');b.hidden=!o.btn;if(o.fn)b.onclick=o.fn;return e};

/* About page: Instagram link (in index.html) + rating with comment */
const RATE=['Tap a star to rate','Needs work','Fair','Good','Great','Excellent'];
const paintStars=()=>{[...$('#stars').children].forEach((b,i)=>b.classList.toggle('on',i<S.fb.r));$('#frate').textContent=RATE[S.fb.r]||RATE[0]};
function renderAbout(){
  const st=$('#stars');
  if(!st.children.length)for(let i=1;i<=5;i++){const b=document.createElement('button');b.textContent='★';b.setAttribute('aria-label',i+(i>1?' stars':' star'));b.onclick=()=>{S.fb.r=i;save();paintStars()};st.append(b)}
  $('#fbtxt').value=S.fb.c||'';paintStars();
}
$('#fbtxt').oninput=e=>{S.fb.c=e.target.value;save()};

/* feedback → Google Sheet + email to the developer (see apps-script/Code.gs). Paste your /exec URL here. */
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
function tasks(){
  const rows=[...S.tasks].sort((a,b)=>a.done-b.done).map(t=>{
    const e=item({ic:t.done?'✓':'○',t:t.t,s:t.c,btn:'Delete',fn:()=>{S.tasks=S.tasks.filter(x=>x!==t);save();tasks()}});
    e.classList.toggle('read',t.done);
    e.onclick=ev=>{if(!ev.target.closest('button')){t.done=!t.done;save();tasks()}};
    return e});
  $('#pl').replaceChildren(item({ic:'+',t:'Add a task',s:'Homework, revision, anything to remember',btn:'Add',
    fn:()=>ask('New task',[{label:'Task'},{label:'Course',type:'select',opts:['General',...Object.keys(D.courses)],val:'General'}]).then(r=>{if(r&&r[0].trim()){S.tasks.unshift({t:r[0].trim(),c:r[1],done:false});save();tasks()}})}),...rows);
}
/* Settings: change group / section */
const pickSection=(g,cur)=>ask('Your section',[{label:`Group ${g} · choose your section`,type:'chips',opts:secsOf(g),val:cur}]);
function changeGroup(){
  ask('Change group',[{label:'Your group (1–8)',type:'chips',opts:[1,2,3,4,5,6,7,8],val:S.group}]).then(async r=>{
    if(!r)return;const g=+r[0],s=await pickSection(g,g===S.group?S.section:'');
    if(!s)return;S.group=g;S.section=+s[0];save();renderHome();settings();toast(`Now in Group ${g} · Section ${S.section}`);
  });
}
function changeSection(){
  pickSection(S.group,S.section).then(r=>{if(!r)return;S.section=+r[0];save();renderHome();settings();toast(`Now in Section ${S.section}`)});
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
  const off=item({ic:'📶',t:'Offline mode',s:'Checking…'});
  offlineState().then(t=>{off.querySelector('small').textContent=t});
  $('#pl').replaceChildren(
    item({ic:'✏️',t:'Name',s:S.name,btn:'Edit',fn:()=>ask('Your name',[{label:'Name',val:S.name}]).then(r=>{if(r&&r[0].trim()){S.name=r[0].trim();save();renderHome();settings()}})}),
    item({ic:'👥',t:'Group',s:`Group ${S.group}`,btn:'Edit',fn:changeGroup}),
    item({ic:'🎓',t:'Section',s:`Section ${S.section}`,btn:'Edit',fn:changeSection}),
    item({ic:'🌓',t:'Theme',s:S.theme==='light'?'White':'Black',btn:'Switch',fn:()=>{S.theme=S.theme==='light'?'dark':'light';save();setTheme();settings()}}),
    off,
    item({ic:'🗑',t:'Reset saved data',s:'Events, read notifications and tasks (name, group and section stay)',btn:'Reset',fn:()=>ask('Reset saved data?',[],'This clears your events and tasks on this device.').then(r=>{if(r){S=Object.assign(fresh(),{name:S.name,group:S.group,section:S.section,theme:S.theme});save();renderHome();settings();toast('Data reset')}})}));
}

function show(v){
  if(v!==view)$('main').scrollTop=0;
  view=v;
  const sec=['home','schedule','dev'].includes(v)?v:['settings','tasks'].includes(v)?'page':'wip';
  $$('.view').forEach(s=>s.hidden=s.id!==sec);
  $$('#menu [data-view]').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
  $('#title').textContent=TITLES[v];$('#act').hidden=v!=='schedule';app.classList.remove('open');
  if(v==='schedule')renderSchedule();else if(v==='settings')settings();else if(v==='tasks')tasks();else if(v==='dev')renderAbout();
}

function notifs(){
  const box=$('#notifs'),n=D.notifications;box.replaceChildren();
  $('#readall').hidden=!n.length;
  if(!n.length){const p=document.createElement('p');p.className='empty';p.textContent="You're all caught up — nothing new right now.";box.append(p);return}
  n.forEach((x,i)=>{const e=fill(tpl('t-notif'),x);e.classList.toggle('read',S.seen.includes(i));
    e.onclick=()=>{if(!S.seen.includes(i))S.seen.push(i);save();notifs()};box.append(e)});
  const u=n.length-S.seen.length;$('#readall').textContent=u?`Read All (${u})`:'All read';
}
function renderHome(){
  $('#hello').textContent=S.name?`Hello, ${S.name}!`:'Hello!';$('#who').textContent=S.name?`${S.name} · Group ${S.group||'–'} · Section ${S.section||'–'}`:'';
  const n=new Date(),s0=new Date(n.getFullYear(),n.getMonth(),n.getDate()-(n.getDay()+1)%7),s1=new Date(s0);
  s1.setDate(s0.getDate()+7);
  const c=D.exams.filter(e=>{const d=new Date(e.date+'T00:00');return d>=s0&&d<s1}).length;
  $('#exn').textContent=c;$('#exl').textContent=c===1?'exam':'exams';
  let next=null;
  for(let i=0;i<7&&!next;i++){
    const d=new Date(n);d.setDate(n.getDate()+i);
    const e=eventsOn(d).find(e=>i>0||mins(e.start)>n.getHours()*60+n.getMinutes());
    if(e)next={...e,when:i===0?'Today':i===1?'Tomorrow':d.toLocaleString('en',{weekday:'long'})};
  }
  $('#nx1').textContent=next?'Next class · '+next.when:'No classes coming up';
  $('#nx2').textContent=next?info(next.course).label+' '+next.title:'Enjoy the break';
  $('#nx3').textContent=next?clock(next.start)+(next.room?' · '+next.room:''):'';
  notifs();
}

/* schedule: weeks are a horizontal scroll-snap strip (swipe left/right) */
const wkStart=d=>{const s=new Date(d.getFullYear(),d.getMonth(),d.getDate());s.setDate(s.getDate()-(s.getDay()+1)%7);return s};
const wkIdx=d=>Math.max(0,Math.min(2*W0,Math.round((wkStart(d)-base)/6048e5)+W0));
const scrollWeek=smooth=>{const w=$('#wk');w.scrollTo({left:wkIdx(sel)*w.clientWidth,behavior:smooth?'smooth':'auto'})};
const markSel=()=>$$('#wk button').forEach(b=>b.classList.toggle('on',b.dataset.d===iso(sel)));
function buildWeeks(){
  base=wkStart(new Date());const wk=$('#wk');wk.replaceChildren();
  for(let i=0;i<=2*W0;i++){
    const p=document.createElement('div');p.className='w';
    for(let j=0;j<7;j++){
      const d=new Date(base);d.setDate(base.getDate()+(i-W0)*7+j);
      const b=fill(tpl('t-day'),{dow:d.toLocaleString('en',{weekday:'short'}).toLowerCase(),num:d.getDate()});
      b.dataset.d=iso(d);b.onclick=()=>{sel=d;markSel();renderTimeline(2)};p.append(b);
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
  const evs=eventsOn(sel),span=END_H-HOUR0,w=$('#tlw'),cs=getComputedStyle(w);
  // pixels per hour: sized so 8 AM → 5 PM exactly fills the visible area; 5 PM → 10 PM sits below (scroll)
  PH=Math.max(44,Math.floor((w.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-2)/(SHOW_END-HOUR0)));
  const tl=$('#tl');tl.replaceChildren();tl.style.height=Y(span*60)+'px';
  for(let h=HOUR0;h<=END_H;h++){
    const r=document.createElement('div');r.className='hr';r.style.top=Y((h-HOUR0)*60)+'px';
    r.innerHTML=`<span>${clock(h+':00').replace(':00','')}</span>`;tl.append(r);
  }
  evs.forEach(e=>{
    const i=info(e.course),own=!!e.date,s=mins(e.start),f=mins(e.end),hp=Y(f-s)-2;
    const el=fill(tpl('t-event'),{course:i.name,time:`${clock(e.start)} – ${clock(e.end)}`,title:e.title,room:e.room});
    el.classList.toggle('own',own);el.classList.toggle('sm',hp<96);el.classList.toggle('xs',hp<50);
    el.style.cssText=`top:${Y(s-HOUR0*60)+1}px;height:${hp}px;--a:${own?'var(--coral)':i.colors[0]};--b:${own?'var(--coral)':i.colors[1]}`;
    el.onclick=()=>own?ask('Delete event?',[],e.course).then(r=>{if(r){S.mine=S.mine.filter(x=>x!==e);save();renderTimeline()}}):toast([e.staff,e.room].filter(Boolean).join(' · ')||i.name);
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
elastic($('main'),()=>$('main .view:not([hidden])'),e=>!e.target.closest('#notifs,.tlw')&&view!=='home'&&view!=='schedule');
elastic($('#notifs'),()=>$('#notifs'));
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
  S.name=name;S.group=g;S.section=s;save();renderHome();show('home');toast(`Welcome, ${name}!`);
}
/* data: data.json (data/data.json or next to index.html) is the only source. Every successful load is cached in localStorage; the cache is used when offline. */
const DATA_KEY='portal:data2';               // (new key: the old cached data was per group, this one is per section)
const valid=d=>d&&d.courses&&d.schedules&&['exams','notifications'].every(k=>Array.isArray(d[k]));
async function loadData(){
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),5000);
    let r=await fetch('data/data.json',{cache:'no-cache',signal:ctl.signal});
    if(!r.ok)r=await fetch('data.json',{cache:'no-cache',signal:ctl.signal});   // also works when data.json sits next to index.html
    clearTimeout(t);
    if(!r.ok)throw 0;const d=await r.json();if(!valid(d))throw 0;
    try{localStorage.setItem(DATA_KEY,JSON.stringify(d))}catch(e){}
    return d;
  }catch(e){
    try{const d=JSON.parse(localStorage.getItem(DATA_KEY));return valid(d)?d:null}catch(e){return null}
  }
}
loadData().then(d=>{
  if(!d){
    $('#hello').textContent="Couldn't load data";
    const p=document.createElement('p');p.className='empty';
    p.textContent='Open the app from a web server (Live Server) and make sure data.json is in the data folder (or next to index.html).';
    $('#notifs').replaceChildren(p);document.documentElement.classList.add('ready');return;
  }
  D=d;setTheme();renderHome();show('home');document.documentElement.classList.add('ready');if(!S.name||!S.group||!S.section)onboard();
});

/* offline support: service-worker.js keeps the app on the phone; when a new version is uploaded the page reloads once */
if('serviceWorker' in navigator){
  const had=!!navigator.serviceWorker.controller;let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!reloading){reloading=true;location.reload()}});
  addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(e=>console.log('Service Worker failed:',e)));
}
