/* Google Classroom inside the SIS page. Read-only, runs in the browser, nothing goes through Code.gs.
   Loaded after script.js: it uses $ mk svg from there, and takes over the SIS menu button (which used to show "Still under development"). */
(function hook(){
  if(typeof show!=='function'||typeof mk!=='function'||typeof svg!=='function')return setTimeout(hook,40);   // wait for script.js

  const CLIENT_ID='259622968598-1c2b6g4nuav5b8gh2eslbugevmou4o0l.apps.googleusercontent.com';
  const SCOPES=['courses.readonly','coursework.me.readonly','courseworkmaterials.readonly','announcements.readonly'].map(s=>'https://www.googleapis.com/auth/classroom.'+s).join(' ');
  const API='https://classroom.googleapis.com/v1/',KD='gc:data2';
  const lg=k=>{try{return localStorage.getItem(k)}catch(e){return null}},ls=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const cached=()=>{try{const d=JSON.parse(lg(KD));return d&&Array.isArray(d.courses)?d:null}catch(e){return null}};
  const put=(...n)=>$('#gc').replaceChildren(...n.filter(Boolean));
  const btn=(c,t,fn)=>{const b=mk('button',c,t);b.type='button';b.onclick=fn;return b};
  const ext=u=>window.open(u,'_blank','noopener');
  const S=p=>`<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICON={refresh:S('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),chev:S('<path d="m9 6 6 6-6 6"/>'),back:S('<path d="m15 6-6 6 6 6"/>'),
    check:S('<path d="m6.5 12.5 3.5 3.5 7.5-8"/>'),alert:S('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16v.01"/>'),clock:S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    file:S('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>')};
  const ic=(cls,name)=>{const s=mk('span',cls);s.innerHTML=ICON[name]||svg(name);return s};

  /* sign-in: Google Identity Services gives a 1-hour access token (no secret, no server) */
  let tok='',exp=0,tc=null,pend=null;
  const settle=(err,t)=>{const p=pend;pend=null;if(p)err?p.no(err):p.ok(t)};
  const client=()=>tc=tc||google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPES,
    callback:r=>{if(r.error)return settle(new Error(r.error));tok=r.access_token;exp=Date.now()+(r.expires_in-60)*1000;settle(null,tok)},
    error_callback:e=>settle(new Error(e.type||'sign-in failed'))});
  const token=()=>new Promise((ok,no)=>{
    if(tok&&Date.now()<exp)return ok(tok);
    if(!window.google||!google.accounts)return no(new Error('Google sign-in did not load. Check your internet.'));
    pend={ok,no};client().requestAccessToken({prompt:lg(KD)?'':'select_account'});     // must start from a tap
  });

  async function api(path,q){
    const r=await fetch(API+path+'?'+new URLSearchParams(q),{headers:{Authorization:'Bearer '+await token()}});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){if(r.status===401)tok='';throw new Error(j.error&&j.error.message||'Error '+r.status)}
    return j;
  }
  async function all(path,key,q={}){
    let out=[],pt='';
    do{const j=await api(path,{...q,pageSize:100,...(pt&&{pageToken:pt})});out=out.concat(j[key]||[]);pt=j.nextPageToken||''}while(pt&&out.length<500);
    return out;
  }
  const due=w=>{const d=w.dueDate,t=w.dueTime;if(!d)return 0;return t?Date.UTC(d.year,d.month-1,d.day,t.hours||0,t.minutes||0):new Date(d.year,d.month-1,d.day,23,59).getTime()};
  const files=ms=>(ms||[]).map(m=>{const x=(m.driveFile&&m.driveFile.driveFile)||m.youtubeVideo||m.link||m.form;return x?{t:x.title||x.url||'Link',u:x.alternateLink||x.url||x.formUrl||''}:null}).filter(x=>x&&x.u);

  async function load(){
    const cs=await all('courses','courses',{studentId:'me',courseStates:'ACTIVE'});
    const out=await Promise.all(cs.map(async c=>{
      const err={},part=(k,path,key,q)=>all(path,key,q).catch(e=>{err[k]=String(e&&e.message||e).slice(0,140);return[]});
      const[w,m,a,s]=await Promise.all([
        part('Assignments',`courses/${c.id}/courseWork`,'courseWork'),
        part('Materials',`courses/${c.id}/courseWorkMaterials`,'courseWorkMaterial'),
        part('Posts',`courses/${c.id}/announcements`,'announcements'),
        part('Submissions',`courses/${c.id}/courseWork/-/studentSubmissions`,'studentSubmissions',{userId:'me'})]);
      const st={};s.forEach(x=>st[x.courseWorkId]=x);
      return{id:c.id,name:c.name,sec:c.section||'',link:c.alternateLink,
        work:w.map(x=>({t:x.title,u:x.alternateLink,due:due(x),done:['TURNED_IN','RETURNED'].includes((st[x.id]||{}).state)})),
        mats:m.map(x=>({t:x.title,u:x.alternateLink,at:Date.parse(x.updateTime)||0,f:files(x.materials)})),
        ann:a.map(x=>{const f=files(x.materials),t=String(x.text||'').trim().split('\n')[0];return{t:(t||(f[0]&&f[0].t)||'Post').slice(0,110),u:x.alternateLink,at:Date.parse(x.updateTime)||0,f}}),err};
    }));
    return{at:Date.now(),courses:out};
  }

  /* helpers for the screens */
  const fmt=t=>new Date(t).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'};
  const late=w=>!w.done&&w.due&&w.due<Date.now();
  const stats=cs=>{let todo=0,miss=0;cs.forEach(c=>c.work.forEach(w=>{if(w.done)return;late(w)?miss++:todo++}));return{todo,miss}};
  const tint=(el,c)=>{let h=0;for(const ch of String(c.id||c.name))h=(h*31+ch.charCodeAt(0))%360;el.style.setProperty('--a',`hsl(${h} 58% 46%)`)};
  const ini=n=>(String(n).replace(/[^A-Za-z0-9\u0600-\u06FF ]/g,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('')||'C').toUpperCase();
  const chips=s=>[s.miss&&mk('span','gc-chip bad',`${s.miss} missing`),s.todo&&mk('span','gc-chip hot',`${s.todo} to do`),!s.miss&&!s.todo&&mk('span','gc-chip ok','All clear')].filter(Boolean);
  const cnt=(k,x)=>x.length&&mk('span','gc-chip',`${x.length} ${k}${x.length>1?'s':''}`);
  const extra=c=>[cnt('material',c.mats),cnt('post',c.ann||[]),Object.keys(c.err||{}).length&&mk('span','gc-chip bad','Load problem')].filter(Boolean);
  const nice=m=>/access_denied/.test(m)?'Access was denied. Your university may block this app, or your account has not been added yet.'
    :/popup/.test(m)?'The sign-in window was closed or blocked. Allow pop-ups for this site and try again.':m;

  /* screens */
  function list(d){
    const t=stats(d.courses),hero=mk('div','gc-hero'),top=mk('div','gc-ht'),l=mk('div','gc-hl');
    l.append(mk('b','','Google Classroom'),mk('small','','Updated '+ago(d.at)));
    const rf=btn('gc-ib','',sync);rf.setAttribute('aria-label','Refresh');rf.innerHTML=ICON.refresh;
    top.append(l,rf);
    const sum=mk('div','gc-sum');sum.append(...chips(t),mk('span','gc-chip',`${d.courses.length} course${d.courses.length===1?'':'s'}`));
    hero.append(top,sum);
    const cards=d.courses.map(c=>{
      const b=btn('gc-c','',()=>course(d,c)),bd=mk('div','gc-cb'),bg=mk('div','gc-bg'),av=mk('span','gc-av',ini(c.name));
      tint(b,c);bg.append(...(c.work.length?chips(stats([c])):[]),...extra(c));if(!bg.children.length)bg.append(mk('span','gc-chip','Nothing posted yet'));
      bd.append(mk('b','',c.name),...(c.sec?[mk('small','',c.sec)]:[]),bg);
      b.append(av,bd,ic('gc-go','chev'));return b;
    });
    put(hero,...(cards.length?cards:[mk('p','gc-empty','No active courses on this account.')]),btn('gc-link','Disconnect Google account',off));
  }

  const wrow=(w,k)=>{
    const r=btn('gc-r','',()=>ext(w.u)),b=mk('div','gc-rb');
    const sub=w.due?({bad:'Was due ',ok:'Done, due '}[k]||'Due ')+fmt(w.due):k==='ok'?'Done':'No due date';
    b.append(mk('b','',w.t),mk('small','',sub));
    r.append(ic('gc-ri '+k,k==='ok'?'check':k==='bad'?'alert':'clock'),b);return r;
  };
  const mrow=m=>{
    const r=btn('gc-r','',()=>ext(m.f.length===1?m.f[0].u:m.u)),b=mk('div','gc-rb');
    const sub=[m.f.length?`${m.f.length} file${m.f.length>1?'s':''}`:'Post',m.at&&new Date(m.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})].filter(Boolean).join(', ');
    b.append(mk('b','',m.t),mk('small','',sub));
    r.append(ic('gc-ri','file'),b);return r;
  };
  function course(d,c,tab='work'){
    const h=mk('div','gc-ch');tint(h,c);
    h.append(mk('small','',c.sec||'Course'),mk('b','',c.name),btn('gc-open','Open in Classroom',()=>ext(c.link)));
    const back=btn('gc-back','',()=>list(d));back.innerHTML=ICON.back+'<span>Courses</span>';
    const tabs=mk('div','gc-tabs');
    [['work','Assignments',c.work.length],['mat','Materials',c.mats.length],['post','Posts',(c.ann||[]).length]].forEach(([k,l,n])=>{
      const b=btn('gc-tab'+(k===tab?' on':''),'',()=>course(d,c,k));b.append(mk('span','',l),mk('i','',String(n)));tabs.append(b)});
    const body=mk('div','gc-list');
    if(tab==='work'){
      [['Missing','bad',c.work.filter(late).sort((a,b)=>b.due-a.due)],
       ['To do','hot',c.work.filter(w=>!w.done&&!late(w)).sort((a,b)=>(a.due||9e15)-(b.due||9e15))],
       ['Done','ok',c.work.filter(w=>w.done).sort((a,b)=>b.due-a.due)]].forEach(([l,k,a])=>{
        if(!a.length)return;const g=mk('div','gc-gh',l);g.append(mk('i','',String(a.length)));body.append(g,...a.map(w=>wrow(w,k)));
      });
      if(!c.work.length)body.append(mk('p','gc-empty','No assignments posted yet.'+(c.mats.length||(c.ann||[]).length?' Check Materials and Posts.':'')));
    }else if(tab==='mat'){
      c.mats.forEach(m=>body.append(mrow(m)));
      if(!c.mats.length)body.append(mk('p','gc-empty','No materials posted yet.'));
    }else{
      (c.ann||[]).slice(0,80).forEach(m=>body.append(mrow(m)));
      if(!(c.ann||[]).length)body.append(mk('p','gc-empty','No posts in the Stream yet.'));
    }
    const bad=Object.entries(c.err||{}),warn=bad.length?mk('div','gc-warn'):null;
    if(warn)warn.append(mk('b','','Some parts could not load'),...bad.map(([k,v])=>mk('small','',k+': '+v)));
    put(back,h,warn,tabs,body);
  }

  async function sync(){
    const l=mk('div','gc-load');l.append(mk('div','gc-spin'),mk('small','','Loading your courses...'));put(l);
    try{const d=await load();ls(KD,JSON.stringify(d));list(d)}catch(e){fail(e)}
  }
  function fail(e){
    const m=String(e&&e.message||e),c=cached(),b=mk('div','gc-err');
    b.append(...[mk('b','','Could not load Classroom'),mk('p','',nice(m)),nice(m)!==m&&mk('code','','Code: '+m)].filter(Boolean));
    put(b,btn('gc-cta','Try again',sync),c&&btn('gc-cta ghost','Show saved copy',()=>list(c)));
  }
  function off(){try{if(tok)google.accounts.oauth2.revoke(tok)}catch(e){}tok='';exp=0;try{localStorage.removeItem(KD)}catch(e){}open()}
  function open(){
    if(!document.querySelector('script[src*="gsi/client"]')){const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;document.head.append(s)}
    const c=cached();if(c)return list(c);
    const i=mk('div','gc-intro');
    i.append(ic('gc-big','cap'),mk('b','','Google Classroom'),
      mk('p','','See your courses, assignments and materials here. The app only reads: it never changes anything in Classroom. Your data is saved on this phone only.'),
      btn('gc-cta','Connect Google Classroom',sync));
    put(i);
  }

  /* the SIS button: script.js shows its "under development" page, then this puts the Classroom page on top */
  const base=window.show;
  window.show=v=>{base(v);if(v==='sis'){$('#wip').hidden=true;$('#sis').hidden=false;open()}};
})();