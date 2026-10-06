/* Install banner — self-contained. Put next to index.html and add in <head>:  <script src="install.js"></script>
   Chrome / Edge / Samsung: one tap installs the app.  Safari (iPhone/iPad): shows the "Add to Home Screen" steps.
   Instagram / WhatsApp / Facebook in-app browsers: tells the user to open the link in a real browser.
   Test any time (ignores "closed" and "already shown"): open  yoursite/?install  */
(function () {
  var KEY = 'portal:instx', DAYS = 3;
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|MicroMessenger|Snapchat|TikTok|Line\//i.test(ua);
  var force = /[?&]install\b/.test(location.search);
  var ev = null, box = null, domReady = false;

  function standalone() {
    return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  }
  function dismissed() {
    if (force) return false;
    try { return Date.now() - (+localStorage.getItem(KEY) || 0) < DAYS * 864e5; } catch (e) { return false; }
  }

  /* the browser event must be caught as early as possible */
  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); ev = e; show(); });
  addEventListener('appinstalled', function () { ev = null; hide(); });

  var css = '#inst{position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top,0px));width:calc(100% - 24px);max-width:456px;z-index:99999;display:flex;align-items:center;gap:6px;padding:7px 7px 7px 9px;border-radius:18px;background:var(--s1,#141417);color:var(--tx,#fff);border:1.5px solid #e5202e;box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 18px rgba(229,32,46,.3);font-family:Outfit,system-ui,sans-serif;animation:instin .4s cubic-bezier(.2,.8,.2,1)}' +
    '@keyframes instin{from{opacity:0;transform:translate(-50%,-16px)}}' +
    '#inst[hidden]{display:none}' +
    '#inst .go{flex:1;min-width:0;display:flex;align-items:center;gap:12px;text-align:left;background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0}' +
    '#inst .ii{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#e5202e;color:#fff;font-size:21px;font-weight:700}' +
    '#inst b{display:block;font-size:15px;font-weight:700}' +
    '#inst small{display:block;color:var(--mu,#9b9ba4);font-size:12.5px;font-weight:500}' +
    '#inst .x{flex:none;width:34px;height:34px;border-radius:50%;background:none;border:0;color:var(--mu,#9b9ba4);font-size:17px;cursor:pointer}' +
    '#instg{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.65);font-family:Outfit,system-ui,sans-serif}' +
    '#instg[hidden]{display:none}' +
    '#instg .c{width:min(100%,380px);padding:22px;border-radius:24px;background:var(--s1,#141417);color:var(--tx,#fff);border:1px solid var(--line,#27272c)}' +
    '#instg h3{font-size:22px;margin:0 0 10px}' +
    '#instg ol{margin:0 0 4px 20px;padding:0;color:var(--mu,#9b9ba4);font-size:15.5px;line-height:1.7}' +
    '#instg ol b{color:var(--tx,#fff)}' +
    '#instg p{margin:0;color:var(--mu,#9b9ba4);font-size:15.5px;line-height:1.6}' +
    '#instg button{margin-top:16px;width:100%;padding:12px;border:0;border-radius:14px;background:#e5202e;color:#fff;font:inherit;font-weight:600;font-size:16px;cursor:pointer}';

  function build() {
    if (box) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    box = document.createElement('div'); box.id = 'inst'; box.hidden = true;
    box.innerHTML = '<button class="go" type="button"><span class="ii">⬇</span><span><b>Install Juster</b><small></small></span></button>' +
      '<button class="x" type="button" aria-label="Close">✕</button>';
    box.querySelector('small').textContent = inApp ? 'Open in your browser to install' : 'Tap to add the app to your device';
    document.body.appendChild(box);

    var g = document.createElement('div'); g.id = 'instg'; g.hidden = true;
    g.innerHTML = '<div class="c"><h3>Install Juster</h3><div id="instb"></div><button type="button">Got it</button></div>';
    document.body.appendChild(g);
    g.querySelector('button').onclick = function () { g.hidden = true; };
    g.onclick = function (e) { if (e.target === g) g.hidden = true; };

    box.querySelector('.x').onclick = function () {
      hide(); try { localStorage.setItem(KEY, Date.now()); } catch (e) {}
    };
    box.querySelector('.go').onclick = go;
  }

  function show() {
    if (!domReady || standalone() || dismissed()) return;
    build(); box.hidden = false;
  }
  function hide() { if (box) box.hidden = true; }

  function guide() {
    var b = document.getElementById('instb');
    if (inApp) b.innerHTML = '<p>This in-app browser can\'t install apps.<br>Tap the <b>⋯</b> / <b>⋮</b> menu at the corner and choose <b>Open in browser</b> (Chrome or Safari), then try again.</p>';
    else if (ios) b.innerHTML = '<ol><li>Tap the <b>Share</b> button (square with an arrow) in Safari.</li><li>Scroll down and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>';
    else if (android) b.innerHTML = '<ol><li>Open the browser menu <b>⋮</b>.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Confirm.</li></ol>';
    else b.innerHTML = '<ol><li>Click the <b>install icon</b> at the right end of the address bar,<br>or open the browser menu.</li><li>Choose <b>Install Juster</b>.</li></ol>';
    document.getElementById('instg').hidden = false;
  }

  function go() {
    if (ev) {
      var e = ev; ev = null;
      e.prompt();
      if (e.userChoice) e.userChoice.then(function (r) { if (r && r.outcome === 'accepted') hide(); });
      return;
    }
    guide();
  }

  function ready() {
    domReady = true;
    if (ev) show();                                        /* the browser already said "installable" */
    else setTimeout(show, 2000);                           /* Safari / others: no event exists, show the guide banner */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
<script>
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
</script>