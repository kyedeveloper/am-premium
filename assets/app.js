const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LS = {
  hist:'ves-hist', seq:'ves-seq', sound:'ves-sound', acc:'ves-acc', theme:'ves-theme',
  seen:'ves-seen', idmode:'ves-idmode', dl:'ves-dl', dlq:'ves-dlq', mail:'ves-mail',
  mprov:'ves-mprov', ann:'ves-ann', maint:'ves-maint', vfs:'ves-vfs',
  mgset:'ves-mgset', mgprog:'ves-mgprog', mgdone:'ves-mgd', mgfav:'ves-mgfav'
};
const ACCS = ['violet','pink','mint','amber','sky'];
let soundOn = localStorage.getItem(LS.sound) === '1';
let actx = null;

/* ---------- util ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const jread = async r => { const t = await r.text(); try { return JSON.parse(t); } catch { return {}; } };

function toast(msg, kind = 'sy') {
  const ic = { ok:'fa-circle-check', er:'fa-circle-exclamation', sy:'fa-circle-info' };
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `<i class="fa-solid ${ic[kind] || ic.sy}"></i><span></span>`;
  el.querySelector('span').textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function beep(kind) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = 'sine';
    const seq = kind === 'ok' ? [660, 880] : kind === 'er' ? [330, 220] : [520];
    let t = actx.currentTime;
    seq.forEach(f => { o.frequency.setValueAtTime(f, t); t += .1; });
    g.gain.setValueAtTime(.07, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, t + .12);
    o.start(); o.stop(t + .14);
  } catch {}
}

function saveFile(name, data, type = 'text/plain') {
  const b = new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function copyText(t) {
  navigator.clipboard.writeText(t).then(() => toast('Disalin.', 'ok')).catch(() => toast('Gagal salin.', 'er'));
}

async function apiLab(action, body, path) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 22000);
  try {
    const r = await fetch(path || ('/api/lab?action=' + action), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}), signal: ctrl.signal
    });
    const d = await jread(r);
    if (!r.ok || d.status !== 'success') throw new Error(d.message || ('HTTP ' + r.status));
    return d;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Server kelamaan diem.');
    throw e;
  } finally { clearTimeout(to); }
}

function busy(btn, on, text) {
  if (!btn) return;
  btn.disabled = on;
  const sp = btn.querySelector('span');
  if (!sp) return;
  if (on) { sp.dataset.old = sp.textContent; sp.textContent = text || 'Proses...'; }
  else if (sp.dataset.old) sp.textContent = sp.dataset.old;
}

/* ---------- tema & suara ---------- */
function paintTheme() {
  const dark = document.documentElement.dataset.theme !== 'light';
  $('#themeBtn').innerHTML = `<i class="fa-solid ${dark ? 'fa-moon' : 'fa-sun'}"></i>`;
}
function setTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem(LS.theme, t); paintTheme(); }
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
$('#setTheme').onclick = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

function paintSound() {
  $('#soundBtn').setAttribute('aria-pressed', soundOn);
  $('#soundBtn').innerHTML = `<i class="fa-solid ${soundOn ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>`;
}
$('#soundBtn').onclick = () => { soundOn = !soundOn; localStorage.setItem(LS.sound, soundOn ? '1' : '0'); paintSound(); beep('sy'); };

function setAccent(a) {
  document.documentElement.dataset.acc = a;
  localStorage.setItem(LS.acc, a);
  $$('[data-acc]').forEach(b => b.setAttribute('aria-pressed', b.dataset.acc === a));
}
$$('[data-acc]').forEach(b => b.onclick = () => setAccent(b.dataset.acc));

/* ---------- sheet ---------- */
function openSheet(id) {
  $$('.overlay.open').forEach(o => o.classList.remove('open'));
  const s = document.getElementById(id);
  if (!s) return;
  s.classList.add('open');
  document.body.classList.add('locked');
  if (id === 'authSheet') acReset();
}
function closeSheet(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (!$$('.overlay.open').length) document.body.classList.remove('locked');
}
$$('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) closeSheet(o.id); });
  o.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeSheet(o.id));
});

/* ---------- nav ---------- */
const nav = $('#nav');
addEventListener('scroll', () => {
  nav.classList.toggle('solid', scrollY > 40);
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  $('#scrollBar').style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
  mgOnScroll();
}, { passive: true });

$('#burger').onclick = () => $('#mobileMenu').classList.toggle('open');
$$('.links a').forEach(a => a.onclick = () => gotoView('home'));

function scrollToTerminal() {
  gotoView('home');
  setTimeout(() => $('#terminal').scrollIntoView({ behavior: 'smooth' }), 60);
}
$('#navStart').onclick = scrollToTerminal;
$('#heroStart').onclick = scrollToTerminal;
$$('[data-go]').forEach(b => b.onclick = () => gotoView(b.dataset.go));
$('#guideGo').onclick = () => { closeSheet('guideSheet'); scrollToTerminal(); };
$('#welcomeGo').onclick = () => { closeSheet('welcomeSheet'); gotoView('lab'); };

/* ---------- router ---------- */
const VIEWS = ['home','lab','manga','music','akun'];
let labTab = 'dl';

function gotoView(v) {
  if (!VIEWS.includes(v)) v = 'home';
  document.body.dataset.view = v;
  $$('[data-pane]').forEach(p => p.classList.toggle('on', p.dataset.pane === v));
  $$('#dock button, #floatNav button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  if (v === 'lab') labGo(labTab);
  if (v === 'akun') { ME ? openAccount() : paintAkunGuest(); }
  if (v === 'manga') mgBoot();
  if (v === 'music') muBoot();
}
$$('#dock button, #floatNav button').forEach(b => b.onclick = () => gotoView(b.dataset.view));

/* ---------- lab slider ---------- */
const knob = $('#labSwitch .knob');
function labGo(tab) {
  labTab = tab;
  const idx = ['dl','mail','shell'].indexOf(tab);
  knob.style.transform = `translateX(${idx * 100}%)`;
  $$('#labSwitch button').forEach(b => b.classList.toggle('on', b.dataset.lab === tab));
  $$('[data-lab]').forEach(p => { if (p.classList.contains('pane')) p.classList.toggle('on', p.dataset.lab === tab); });
  if (tab === 'mail') mailBoot();
  if (tab === 'dl') renderDlHist();
  if (tab === 'shell') setTimeout(() => $('#shInput').focus(), 140);
}
$$('#labSwitch button').forEach(b => b.onclick = () => labGo(b.dataset.lab));

/* geser / swipe */
(() => {
  let x0 = null;
  const st = $('#labStage');
  st.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
  st.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 60) {
      const i = ['dl','mail','shell'].indexOf(labTab);
      labGo(['dl','mail','shell'][clamp(i + (dx < 0 ? 1 : -1), 0, 2)]);
    }
    x0 = null;
  });
})();

/* ---------- palette ---------- */
const ACTIONS = [
  { t:'Buka terminal', s:'nav', i:'fa-terminal', f:() => { closePalette(); scrollToTerminal(); } },
  { t:'Manga', s:'media', i:'fa-book-open', f:() => { closePalette(); gotoView('manga'); } },
  { t:'Musik', s:'media', i:'fa-music', f:() => { closePalette(); gotoView('music'); } },
  { t:'Downloader', s:'lab', i:'fa-download', f:() => { closePalette(); gotoView('lab'); labGo('dl'); } },
  { t:'Temp mail', s:'lab', i:'fa-envelope', f:() => { closePalette(); gotoView('lab'); labGo('mail'); } },
  { t:'Shell', s:'lab', i:'fa-code', f:() => { closePalette(); gotoView('lab'); labGo('shell'); } },
  { t:'Akun', s:'akun', i:'fa-user', f:() => { closePalette(); accClick(); } },
  { t:'Upgrade', s:'akun', i:'fa-crown', f:() => { closePalette(); openSheet('upgradeSheet'); } },
  { t:'Riwayat inject', s:'fitur', i:'fa-clock-rotate-left', f:() => { closePalette(); openSheet('historySheet'); } },
  { t:'Antrian massal', s:'fitur', i:'fa-layer-group', f:() => { closePalette(); openSheet('queueSheet'); } },
  { t:'Panduan', s:'info', i:'fa-book', f:() => { closePalette(); openSheet('guideSheet'); } },
  { t:'QR halaman', s:'info', i:'fa-qrcode', f:() => { closePalette(); openQr(); } },
  { t:'Ganti tema', s:'setelan', i:'fa-moon', f:() => { closePalette(); setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); } }
];
let palSel = 0, palFiltered = ACTIONS;

function renderPal() {
  const q = $('#palInput').value.toLowerCase().trim();
  palFiltered = ACTIONS.filter(a => (a.t + ' ' + a.s).toLowerCase().includes(q));
  palSel = 0;
  $('#palList').innerHTML = palFiltered.length
    ? palFiltered.map((a, i) => `<div class="pal-item${i === 0 ? ' sel' : ''}" data-i="${i}"><i class="fa-solid ${a.i}"></i> ${a.t}<span class="sub">${a.s}</span></div>`).join('')
    : '<div class="pal-item">Tidak ada.</div>';
  $$('.pal-item[data-i]').forEach(el => {
    el.onmouseenter = () => { palSel = +el.dataset.i; paintPal(); };
    el.onclick = () => palFiltered[+el.dataset.i].f();
  });
}
const paintPal = () => $$('.pal-item[data-i]').forEach(el => el.classList.toggle('sel', +el.dataset.i === palSel));

function openPalette() {
  $('#palette').classList.add('open');
  document.body.classList.add('locked');
  $('#palInput').value = '';
  renderPal();
  setTimeout(() => $('#palInput').focus(), 60);
}
function closePalette() {
  $('#palette').classList.remove('open');
  if (!$$('.overlay.open').length) document.body.classList.remove('locked');
}
$('#palHint').onclick = openPalette;
$('#palInput').addEventListener('input', renderPal);
$('#palette').addEventListener('click', e => { if (e.target.id === 'palette') closePalette(); });

addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('#palette').classList.contains('open') ? closePalette() : openPalette();
    return;
  }
  if (e.key === 'Escape') {
    closePalette();
    $$('.overlay.open').forEach(o => o.classList.remove('open'));
    document.body.classList.remove('locked');
  }
  if ($('#palette').classList.contains('open')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = clamp(palSel + 1, 0, palFiltered.length - 1); paintPal(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); palSel = clamp(palSel - 1, 0, palFiltered.length - 1); paintPal(); }
    if (e.key === 'Enter' && palFiltered[palSel]) { e.preventDefault(); palFiltered[palSel].f(); }
  }
});

/* ---------- reveal & counter ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .14 });
$$('.reveal').forEach(el => io.observe(el));

const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, target = +el.dataset.count, suf = el.dataset.suffix || '';
  let n = 0; const step = Math.max(1, Math.ceil(target / 38));
  const t = setInterval(() => {
    n += step;
    if (n >= target) { n = target; clearInterval(t); }
    el.textContent = n + suf;
  }, 26);
  cio.unobserve(el);
}), { threshold: .6 });
$$('[data-count]').forEach(el => cio.observe(el));

/* ---------- typed ---------- */
(() => {
  const words = ['> magic link dispatch_', '> oob validator_', '> manga reader_', '> temp mail inbox_'];
  const el = $('#typed');
  if (reduce) { el.textContent = words[0]; return; }
  let wi = 0, ci = 0, del = false;
  (function tick() {
    const w = words[wi];
    el.textContent = w.slice(0, ci);
    if (!del && ci < w.length) { ci++; setTimeout(tick, 55); }
    else if (!del) { del = true; setTimeout(tick, 1500); }
    else if (ci > 0) { ci--; setTimeout(tick, 26); }
    else { del = false; wi = (wi + 1) % words.length; setTimeout(tick, 240); }
  })();
})();

$('#sessId').textContent = Math.random().toString(36).slice(2, 8).toUpperCase();
setInterval(() => { $('#pingLive').textContent = (10 + Math.floor(Math.random() * 14)) + 'ms'; }, 3200);

/* ---------- faq ---------- */
$('#faqBox').addEventListener('click', e => {
  const btn = e.target.closest('.faq-q');
  if (!btn) return;
  const item = btn.parentElement, a = item.querySelector('.faq-a');
  const open = item.classList.contains('open');
  $$('.faq-item').forEach(it => { it.classList.remove('open'); it.querySelector('.faq-a').style.maxHeight = '0px'; });
  if (!open) { item.classList.add('open'); a.style.maxHeight = a.scrollHeight + 'px'; }
});

/* ---------- log ---------- */
function showLog(text, kind = 'sy') {
  const box = $('#statusLog');
  box.hidden = false;
  const lbl = { sy:'[SYS]', ok:'[OK]', er:'[ERR]' }[kind];
  const row = document.createElement('div');
  row.className = 'log-row';
  const d = new Date();
  const t = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  row.innerHTML = `<span>[${t}]</span> <span class="p ${kind}">${lbl}</span> <span class="m"></span>`;
  row.querySelector('.m').textContent = text;
  $('#logText').appendChild(row);
  box.scrollTop = box.scrollHeight;
}
$('#logClear').onclick = () => { $('#logText').innerHTML = ''; $('#statusLog').hidden = true; };

/* ---------- API docs ---------- */
let apiOpen = false;
$('#apiToggle').onclick = () => { apiOpen = !apiOpen; $('#apiDocs').classList.toggle('open', apiOpen); };
$$('.tab').forEach(t => t.onclick = () => {
  $$('.tab').forEach(x => x.classList.remove('on'));
  t.classList.add('on');
  $$('pre.code').forEach(p => p.hidden = p.dataset.lang !== t.dataset.lang);
});
$('#apiCopy').onclick = () => {
  const pre = $$('pre.code').find(p => !p.hidden);
  copyText(pre.innerText);
};

/* ---------- order id ---------- */
let idMode = localStorage.getItem(LS.idmode) || 'rand';
function setIdMode(m) {
  idMode = m;
  localStorage.setItem(LS.idmode, m);
  $$('#idSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
}
$$('#idSeg button').forEach(b => b.onclick = () => setIdMode(b.dataset.mode));
const nextSeq = inc => {
  let n = parseInt(localStorage.getItem(LS.seq) || '1', 10);
  if (inc) { n++; localStorage.setItem(LS.seq, String(n)); }
  return String(n).padStart(5, '0');
};
const buildOrderId = p => idMode === 'seq' ? p + nextSeq(false) : p + Math.floor(Math.random() * 90000 + 10000);

/* ---------- history ---------- */
const readHist = () => { try { return JSON.parse(localStorage.getItem(LS.hist) || '[]'); } catch { return []; } };
function writeHist(h) { localStorage.setItem(LS.hist, JSON.stringify(h.slice(0, 60))); paintStats(); }

function paintStats() {
  const h = readHist(), today = new Date().toDateString();
  $('#stOk').textContent = h.filter(x => x.status === 'ok' && new Date(x.ts).toDateString() === today).length;
  $('#stEr').textContent = h.filter(x => x.status === 'er' && new Date(x.ts).toDateString() === today).length;
  $('#stAll').textContent = h.length;
  $('#hCount').textContent = h.length;
}
function pushHist(e) { const h = readHist(); h.unshift(e); writeHist(h); paintHistory(); }

function paintHistory() {
  const h = readHist(), box = $('#historyList');
  if (!h.length) { box.innerHTML = '<div class="q-empty">Belum ada riwayat.</div>'; return; }
  box.innerHTML = h.map(x =>
    `<div class="h-row"><span class="i ${x.status === 'ok' ? 'ok' : 'er'}"><i class="fa-solid ${x.status === 'ok' ? 'fa-check' : 'fa-xmark'}"></i></span><span class="txt"><b></b><small></small></span></div>`
  ).join('');
  $$('#historyList .h-row').forEach((row, i) => {
    row.querySelector('b').textContent = h[i].email;
    row.querySelector('small').textContent = h[i].orderId;
  });
}
$('#histClear').onclick = () => { localStorage.removeItem(LS.hist); paintStats(); paintHistory(); };
$('#histExport').onclick = () => {
  const h = readHist();
  if (!h.length) return toast('Kosong.', 'er');
  const rows = [['email','order','status','waktu'], ...h.map(x => [x.email, x.orderId, x.status, new Date(x.ts).toISOString()])];
  saveFile('riwayat.csv', rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n'), 'text/csv');
};

/* ---------- queue ---------- */
let queue = [];
function paintQueue() {
  const box = $('#queueList');
  $('#qCount').textContent = queue.length;
  if (!queue.length) { box.innerHTML = '<div class="q-empty">Kosong.</div>'; return; }
  box.innerHTML = queue.map(q =>
    `<div class="q-row ${q.st}"><span class="st"><i class="fa-solid ${q.st === 'sent' ? 'fa-check' : q.st === 'fail' ? 'fa-xmark' : 'fa-clock'}"></i></span><span class="em"></span></div>`
  ).join('');
  $$('#queueList .em').forEach((el, i) => el.textContent = queue[i].email);
}
$('#queueLoad').onclick = () => {
  const list = [...new Set($('#queueInput').value.split(/[\n,;\s]+/).map(s => s.trim()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))].slice(0, 30);
  if (!list.length) return toast('Tidak ada email valid.', 'er');
  queue = list.map(e => ({ email: e, st: 'pending' }));
  $('#queueInput').value = '';
  paintQueue();
};
$('#queueClear').onclick = () => { queue = []; paintQueue(); };

$('#btnRunQueue').onclick = async () => {
  if (!queue.length) return toast('Antrian kosong.', 'er');
  const btn = $('#btnRunQueue');
  btn.disabled = true;
  for (const item of queue) {
    if (item.st !== 'pending') continue;
    item.st = 'sending'; paintQueue();
    try {
      const r = await fetch('/api/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: item.email }) });
      item.st = r.ok ? 'sent' : 'fail';
    } catch { item.st = 'fail'; }
    paintQueue();
    await new Promise(r => setTimeout(r, 1200));
  }
  btn.disabled = false;
  toast('Antrian selesai.', 'ok');
};
$('#btnQueue').onclick = () => openSheet('queueSheet');
$('#btnHistory').onclick = () => openSheet('historySheet');
$('#btnQuickMail').onclick = () => { gotoView('lab'); labGo('mail'); };

/* ---------- QR ---------- */
function openQr() {
  openSheet('qrSheet');
  $('#qrUrl').textContent = location.href;
  const box = $('#qrBox');
  box.innerHTML = '';
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
  s.onload = () => { box.innerHTML = ''; new QRCode(box, { text: location.href, width: 170, height: 170 }); };
  s.onerror = () => box.innerHTML = '<span style="color:#a00;font-size:.7rem">QR gagal</span>';
  document.head.appendChild(s);
}
$('#qrChip').onclick = openQr;
$('#qrCopy').onclick = () => copyText(location.href);

/* ---------- inject flow ---------- */
function setStep(n) {
  $('#stp1').className = 'stp' + (n === 1 ? ' on' : ' done');
  $('#stp2').className = 'stp' + (n === 2 ? ' on' : '');
  $('#progFill').style.width = (n === 1 ? 50 : 100) + '%';
}
function resetForm(manual) {
  $('#step1').hidden = false;
  $('#step2').hidden = true;
  $('#linkInput').value = '';
  $('#validChip').className = 'valid-chip';
  $('#statusLog').hidden = true;
  $('#logText').innerHTML = '';
  setStep(1);
  if (manual) toast('Direset.', 'sy');
}
$('#btnAbort').onclick = () => resetForm(true);

function extractOobCode(u) {
  if (!u) return null;
  try {
    let c = u.replace(/&amp;/g, '&').trim();
    try { c = decodeURIComponent(c); } catch {}
    try {
      const x = new URL(c);
      let code = x.searchParams.get('oobCode');
      if (!code) {
        const n = x.searchParams.get('link') || x.searchParams.get('q') || x.searchParams.get('url');
        if (n) { try { code = new URL(n).searchParams.get('oobCode'); } catch {} }
      }
      if (code) return code.replace(/[^a-zA-Z0-9_-]/g, '');
    } catch {}
    const m = c.match(/oobCode=([a-zA-Z0-9_-]+)/i);
    return m ? m[1] : null;
  } catch { return null; }
}

$('#linkInput').addEventListener('input', () => {
  const raw = $('#linkInput').value.trim();
  const chip = $('#validChip'), btn = $('#btnInject');
  if (!raw) { chip.className = 'valid-chip'; btn.disabled = false; return; }
  const code = extractOobCode(raw);
  if (code) {
    chip.className = 'valid-chip show good';
    chip.textContent = `oobCode valid · ${code.length} karakter`;
    btn.disabled = false;
  } else {
    chip.className = 'valid-chip show bad';
    chip.textContent = 'oobCode tidak ditemukan';
    btn.disabled = true;
  }
});

$('#btnSend').onclick = async () => {
  const email = $('#emailInput').value.trim();
  const btn = $('#btnSend');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('#emailErr').classList.add('show'); beep('er');
    return toast('Email tidak valid.', 'er');
  }
  $('#emailErr').classList.remove('show');
  busy(btn, true, 'Mengirim...');
  try {
    const r = await fetch('/api/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const d = await jread(r);
    if (r.ok && d.status === 'success') {
      $('#targetBuyerDisplay').textContent = email;
      $('#step1').hidden = true;
      $('#step2').hidden = false;
      setStep(2);
      beep('ok');
      toast('Magic link terkirim.', 'ok');
    } else {
      showLog(d.message || 'Gagal.', 'er');
      toast('Gagal kirim.', 'er');
    }
  } catch { toast('Jaringan error.', 'er'); }
  finally { busy(btn, false); }
};

$('#btnInject').onclick = () => {
  if (!ME) { openSheet('authSheet'); return toast('Login dulu.', 'er'); }
  const email = $('#emailInput').value.trim();
  const oob = extractOobCode($('#linkInput').value.trim());
  if (!oob) return toast('oobCode tidak ada.', 'er');
  const orderId = buildOrderId($('#orderIdInput').value.trim() || 'VIP-');
  $('#cfEmail').textContent = email;
  $('#cfOrder').textContent = orderId;
  $('#cfOob').textContent = oob.slice(0, 14) + '…';
  $('#confirmSheet').dataset.orderId = orderId;
  $('#confirmSheet').dataset.oob = oob;
  openSheet('confirmSheet');
};

function iload(on, pct) {
  const el = $('#injectLoad');
  if (!on) { el.classList.remove('open'); return; }
  el.classList.add('open');
  const p = Math.min(96, pct || 8);
  $('#iloadFill').style.width = p + '%';
  $('#iloadPct').textContent = Math.round(p);
}

$('#cfRun').onclick = async () => {
  const email = $('#emailInput').value.trim();
  const sheet = $('#confirmSheet');
  const orderId = sheet.dataset.orderId, oob = sheet.dataset.oob;
  closeSheet('confirmSheet');
  const btn = $('#btnInject');
  busy(btn, true, 'Menginject...');
  iload(true, 10);
  const t = setInterval(() => {
    const cur = Number($('#iloadPct').textContent) || 10;
    if (cur < 92) iload(true, cur + Math.max(1, (92 - cur) * .08));
  }, 220);
  try {
    const r = await fetch('/api/inject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, oobCode: oob, orderId }) });
    const d = await jread(r);
    if (r.ok && d.status === 'success') {
      pushHist({ email, orderId: d.orderId || orderId, status: 'ok', ts: Date.now() });
      beep('ok');
      $('#successEmail').textContent = email;
      $('#successOrderId').textContent = d.orderId || orderId;
      openSheet('successSheet');
      burst();
    } else {
      pushHist({ email, orderId, status: 'er', ts: Date.now() });
      beep('er');
      toast(d.message || 'Inject gagal.', 'er');
    }
  } catch { toast('Jaringan error.', 'er'); }
  finally {
    clearInterval(t);
    iload(true, 100);
    setTimeout(() => iload(false), 380);
    busy(btn, false);
  }
};
$('#successDone').onclick = () => { closeSheet('successSheet'); resetForm(false); };
$('#receiptBtn').onclick = () => saveFile('struk.txt', [
  'VESPERA — BUKTI',
  'Email: ' + $('#successEmail').textContent,
  'Order: ' + $('#successOrderId').textContent,
  'Waktu: ' + new Date().toLocaleString('id-ID'),
  'Status: SUCCESS'
].join('\n'));

function burst() {
  if (reduce) return;
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const colors = ['#fbbf24','#8b5cf6','#f472b6','#fff','#34d399'];
  const parts = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2, y: innerHeight / 2.4,
    vx: (Math.random() - .5) * 11, vy: (Math.random() - .85) * 11,
    s: 2 + Math.random() * 4, c: colors[Math.floor(Math.random() * colors.length)], life: 1
  }));
  let f = 0;
  (function a() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => {
      p.vy += .17; p.x += p.vx; p.y += p.vy; p.life -= .008;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s * 1.6);
    });
    if (++f < 170) requestAnimationFrame(a);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ---------- akun ---------- */
let ME = null, QUOTA = null, pollTimer = null;

function paintAccount() {
  const btn = $('#accBtn');
  if (!ME) {
    $('#accLabel').textContent = 'Masuk';
    btn.classList.remove('premium');
    $('#quotaTxt').textContent = 'login dulu';
    $('#quotaMeter').style.width = '0%';
    return;
  }
  $('#accLabel').textContent = ME.owner ? 'Owner' : ME.premium ? 'Premium' : ME.email.split('@')[0].slice(0, 10);
  btn.classList.toggle('premium', !!(ME.premium || ME.owner));
  $('#quotaTxt').textContent = (ME.owner || ME.premium) ? 'unlimited' : `${QUOTA?.used ?? 0}/${QUOTA?.limit ?? 20}`;
  $('#quotaMeter').style.width = (ME.owner || ME.premium) ? '100%' : ((QUOTA?.used ?? 0) / (QUOTA?.limit ?? 20) * 100) + '%';
}

async function loadMe() {
  try {
    const r = await fetch('/api/auth/me', { cache: 'no-store' });
    const d = await jread(r);
    ME = d.user || null; QUOTA = d.quota || null;
  } catch { ME = null; }
  paintAccount();
  checkMaint();
  if (document.body.dataset.view === 'akun') { ME ? openAccount() : paintAkunGuest(); }
}

function accClick() { ME ? gotoView('akun') : openSheet('authSheet'); }
$('#accBtn').onclick = accClick;
$('#guestLogin').onclick = () => openSheet('authSheet');
$('#priceFree').onclick = () => openSheet('authSheet');
$('#pricePrem').onclick = () => openSheet('upgradeSheet');
$('#quotaUp').onclick = () => openSheet('upgradeSheet');
$('#acUpgrade').onclick = () => openSheet('upgradeSheet');

let authMode = 'code', otpEmail = '', resendTimer = null;
$('#acModeToggle').onclick = () => {
  authMode = authMode === 'code' ? 'pass' : 'code';
  $('#authCodeFlow').hidden = authMode !== 'code';
  $('#authPassFlow').hidden = authMode !== 'pass';
  $('#acModeToggle').textContent = authMode === 'code' ? 'Masuk pakai password' : 'Masuk pakai kode';
};
function acReset() {
  clearInterval(resendTimer);
  otpEmail = '';
  $('#acStep1').hidden = false;
  $('#acStep2').hidden = true;
  $('#acEmailCode').value = '';
  $('#acCode').value = '';
}
$('#acChangeBtn').onclick = acReset;

function startCooldown() {
  let l = 60;
  clearInterval(resendTimer);
  $('#acResendBtn').disabled = true;
  resendTimer = setInterval(() => {
    l--;
    $('#acResendBtn').textContent = 'Kirim ulang (' + l + 's)';
    if (l <= 0) { clearInterval(resendTimer); $('#acResendBtn').disabled = false; $('#acResendBtn').textContent = 'Kirim ulang'; }
  }, 1000);
}

async function sendOtp(isResend) {
  const email = (isResend ? otpEmail : $('#acEmailCode').value).trim().toLowerCase();
  const err = isResend ? $('#acCodeErr') : $('#acSendErr');
  const btn = isResend ? $('#acResendBtn') : $('#acSendBtn');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Email tidak valid.'; err.classList.add('show'); return; }
  busy(btn, true, 'Kirim...');
  try {
    const r = await fetch('/api/auth/request-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const d = await jread(r);
    if (r.ok && d.status === 'success') {
      otpEmail = email;
      $('#acTarget').textContent = email;
      $('#acStep1').hidden = true;
      $('#acStep2').hidden = false;
      startCooldown();
      toast('Kode terkirim.', 'ok');
    } else { err.textContent = d.message || 'Gagal.'; err.classList.add('show'); }
  } catch { err.textContent = 'Jaringan error.'; err.classList.add('show'); }
  finally { busy(btn, false); }
}
$('#acSendBtn').onclick = () => sendOtp(false);
$('#acResendBtn').onclick = () => sendOtp(true);

async function verifyOtp() {
  const code = $('#acCode').value.replace(/\D/g, '');
  const err = $('#acCodeErr'), btn = $('#acVerifyBtn');
  if (code.length !== 6) { err.textContent = 'Harus 6 digit.'; err.classList.add('show'); return; }
  busy(btn, true, 'Verifikasi...');
  try {
    const r = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: otpEmail, code }) });
    const d = await jread(r);
    if (r.ok && d.status === 'success') {
      ME = d.user; QUOTA = d.quota;
      paintAccount(); closeSheet('authSheet');
      toast('Masuk.', 'ok');
      if (document.body.dataset.view === 'akun') openAccount();
    } else { err.textContent = d.message || 'Kode salah.'; err.classList.add('show'); }
  } catch { err.textContent = 'Jaringan error.'; err.classList.add('show'); }
  finally { busy(btn, false); }
}
$('#acCode').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value.length === 6) verifyOtp();
});

$('#tabLogin').onclick = () => { $('#authSheet').dataset.mode = 'login'; $('#tabLogin').classList.add('on'); $('#tabReg').classList.remove('on'); };
$('#tabReg').onclick = () => { $('#authSheet').dataset.mode = 'reg'; $('#tabReg').classList.add('on'); $('#tabLogin').classList.remove('on'); };

$('#authSubmit').onclick = async () => {
  const mode = $('#authSheet').dataset.mode || 'login';
  const email = $('#authEmail').value.trim(), pass = $('#authPass').value;
  const err = $('#authErr'), btn = $('#authSubmit');
  if (!email || pass.length < 6) { err.textContent = 'Email valid + password 6+.'; err.classList.add('show'); return; }
  busy(btn, true, 'Proses...');
  try {
    const r = await fetch('/api/auth/' + (mode === 'login' ? 'login' : 'register'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) });
    const d = await jread(r);
    if (r.ok && d.status === 'success') {
      ME = d.user; QUOTA = d.quota;
      paintAccount(); closeSheet('authSheet');
      toast('Berhasil.', 'ok');
    } else { err.textContent = d.message || 'Gagal.'; err.classList.add('show'); }
  } catch { err.textContent = 'Jaringan error.'; err.classList.add('show'); }
  finally { busy(btn, false); }
};

function paintAkunGuest() { $('#akunGuest').hidden = false; $('#akunBody').hidden = true; }

async function openAccount() {
  if (!ME) return paintAkunGuest();
  $('#akunGuest').hidden = true;
  $('#akunBody').hidden = false;
  $('#acEmail').textContent = ME.email;
  $('#acPlan').textContent = ME.owner ? 'Owner' : ME.premium ? 'Premium' : 'Free';
  $('#acQuota').textContent = (ME.premium || ME.owner) ? 'unlimited' : `${QUOTA?.used ?? 0}/${QUOTA?.limit ?? 20}`;
  paintCacheSize();
  const ok = readHist().filter(x => x.status === 'ok').length;
  const unlocked = ME.premium || ME.owner || ok >= 25;
  $('#apiLockArea').hidden = unlocked;
  $('#apiInputArea').hidden = !unlocked;
  if (unlocked) $('#acApiKey').value = ME.apiKey || '';
  else $('#apiProgressText').textContent = ok + '/25';
  $('#acAdmin').hidden = !ME.owner;
  if (ME.owner) adminLoad();
}

async function adminLoad() {
  try {
    const r = await fetch('/api/admin/stats');
    const d = await jread(r);
    $('#adUsers').textContent = d.totalUsers ?? '—';
    $('#adToday').textContent = d.injectToday ?? '—';
  } catch {}
  $('#maintBtnTxt').textContent = localStorage.getItem(LS.maint) === '1' ? 'Matikan Maintenance' : 'Aktifkan Maintenance';
}
$('#adGrant').onclick = async () => {
  const email = $('#adEmail').value.trim();
  if (!email) return;
  const r = await fetch('/api/admin/grant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, days: 30 }) });
  const d = await jread(r);
  toast(d.message || 'Selesai.', r.ok ? 'ok' : 'er');
};
$('#adAnnounce').onclick = async () => {
  const t = $('#adAnnounceInput').value.trim();
  if (!t) return;
  localStorage.setItem(LS.ann, t);
  renderAnn(t);
  try { await fetch('/api/admin/announcement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) }); } catch {}
};
$('#adAnnounceClear').onclick = async () => {
  localStorage.removeItem(LS.ann); renderAnn('');
  try { await fetch('/api/admin/announcement', { method: 'DELETE' }); } catch {}
};
function renderAnn(t) {
  $('#globalAnnouncement').hidden = !t;
  if (t) $('#announcementText').textContent = t;
}
$('#announceClose').onclick = () => { $('#globalAnnouncement').hidden = true; };

$('#btnToggleMaint').onclick = async () => {
  const next = localStorage.getItem(LS.maint) !== '1';
  localStorage.setItem(LS.maint, next ? '1' : '0');
  try { await fetch('/api/admin/maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) }); } catch {}
  $('#maintBtnTxt').textContent = next ? 'Matikan Maintenance' : 'Aktifkan Maintenance';
  checkMaint();
  toast(next ? 'Maintenance aktif.' : 'Maintenance mati.', next ? 'er' : 'ok');
};
function checkMaint() {
  if (localStorage.getItem(LS.maint) === '1') {
    openSheet('maintenanceSheet');
    $('#maintOwnerBypass').hidden = !(ME && ME.owner);
  } else closeSheet('maintenanceSheet');
  renderAnn(localStorage.getItem(LS.ann) || '');
}
$('#maintBypass').onclick = () => closeSheet('maintenanceSheet');

$('#acLogout').onclick = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  ME = null; QUOTA = null;
  paintAccount(); paintAkunGuest();
  toast('Keluar.', 'sy');
};
$('#acKeyCopy').onclick = () => copyText($('#acApiKey').value);
$('#acKeyNew').onclick = async () => {
  const ok = readHist().filter(x => x.status === 'ok').length;
  if (!ME.premium && !ME.owner && ok < 25) return toast('Butuh 25 sukses inject.', 'er');
  const r = await fetch('/api/auth/key', { method: 'POST' });
  const d = await jread(r);
  if (d.apiKey) { ME.apiKey = d.apiKey; $('#acApiKey').value = d.apiKey; toast('API key dibuat.', 'ok'); }
  else toast(d.message || 'Gagal.', 'er');
};

$('#payBtn').onclick = async () => {
  if (!ME) { closeSheet('upgradeSheet'); return openSheet('authSheet'); }
  const btn = $('#payBtn');
  busy(btn, true, 'Invoice...');
  try {
    const r = await fetch('/api/payment/create', { method: 'POST' });
    const d = await jread(r);
    if (!r.ok || d.status !== 'success') { busy(btn, false); return toast(d.message || 'Gagal.', 'er'); }
    $('#payArea').innerHTML = `<img src="${esc(d.qrisImage)}" alt="QRIS" style="width:100%;max-width:200px;display:block;margin:0 auto .4rem;border-radius:10px;background:#fff;padding:.3rem"><p class="center mono">Total Rp${esc(String(d.total))}</p>`;
    btn.innerHTML = '<span>Menunggu pembayaran...</span>';
    btn.disabled = true;
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const s = await jread(await fetch('/api/payment/status?id=' + encodeURIComponent(d.invoiceId)));
        if (s.paid) {
          clearInterval(pollTimer);
          await loadMe();
          closeSheet('upgradeSheet');
          toast('Premium aktif!', 'ok');
          burst();
        }
      } catch {}
    }, 4000);
  } catch { busy(btn, false); toast('Gagal.', 'er'); }
};

/* ---------- settings ---------- */
const localKeys = () => Object.keys(localStorage).filter(k => k.startsWith('ves-'));
const cacheBytes = () => localKeys().reduce((n, k) => n + (localStorage.getItem(k) || '').length, 0);
function paintCacheSize() {
  const b = cacheBytes(), el = $('#cacheSize');
  if (el) el.textContent = b > 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B';
}
$('#clearCache').onclick = () => {
  localKeys().filter(k => ![LS.sound, LS.acc, LS.theme, LS.seen].includes(k)).forEach(k => localStorage.removeItem(k));
  paintCacheSize(); shClear(); renderDlHist();
  toast('Cache dibersihkan.', 'ok');
};
$('#exportLocal').onclick = () => {
  const d = {};
  localKeys().forEach(k => d[k] = localStorage.getItem(k));
  saveFile('data.json', JSON.stringify(d, null, 2), 'application/json');
};

/* ---------- SHELL ---------- */
const HOME = '/home/vespera';
let cwd = HOME, shHistory = [], shHIdx = -1;

const seedFs = () => ({ '/':{d:1}, '/home':{d:1}, '/home/vespera':{d:1}, '/home/vespera/README.md':{f:1,c:'# vespera lab\n'}, '/tmp':{d:1} });
const fsLoad = () => { try { return JSON.parse(localStorage.getItem(LS.vfs)) || seedFs(); } catch { return seedFs(); } };
const fsSave = f => localStorage.setItem(LS.vfs, JSON.stringify(f));

function norm(p) {
  if (!p) return cwd;
  const b = p.startsWith('/') ? p : cwd + '/' + p;
  const o = [];
  b.split('/').forEach(s => { if (!s || s === '.') return; if (s === '..') o.pop(); else o.push(s); });
  return '/' + o.join('/');
}

function shOut(t, c) {
  const b = $('#shOut');
  const d = document.createElement('div');
  d.className = 'ln ' + (c || '');
  d.textContent = t;
  b.appendChild(d);
  b.scrollTop = b.scrollHeight;
}
function shClear() { $('#shOut').innerHTML = ''; }
function paintPrompt() { $('#shPrompt').textContent = 'vespera:' + cwd.replace(HOME, '~') + '$'; }

const SH = {
  help() { shOut('ls cd pwd mkdir touch cat echo rm bash node python3 curl dl mail clear reset', 'sy'); },
  pwd() { shOut(cwd); },
  whoami() { shOut('vespera'); },
  date() { shOut(new Date().toString()); },
  clear() { shClear(); },
  reset() { fsSave(seedFs()); cwd = HOME; paintPrompt(); shOut('filesystem reset.', 'sy'); },
  ls(a) {
    const fs = fsLoad(), p = norm(a[0]);
    if (!fs[p]) return shOut('tidak ada', 'er');
    Object.keys(fs).filter(k => k.startsWith(p === '/' ? '/' : p + '/') && k !== p && !k.slice(p.length + 1).includes('/'))
      .forEach(k => shOut(k.split('/').pop() + (fs[k].d ? '/' : ''), fs[k].d ? 'u' : ''));
  },
  cd(a) {
    const p = norm(a[0] || HOME);
    if (!fsLoad()[p]) return shOut('tidak ada', 'er');
    cwd = p; paintPrompt();
  },
  mkdir(a) { if (!a[0]) return; const fs = fsLoad(); fs[norm(a[0])] = { d:1 }; fsSave(fs); shOut('ok', 'ok'); },
  touch(a) { if (!a[0]) return; const fs = fsLoad(); fs[norm(a[0])] = { f:1, c:'' }; fsSave(fs); shOut('ok', 'ok'); },
  cat(a) { const fs = fsLoad(), p = norm(a[0]); if (!fs[p]) return shOut('tidak ada', 'er'); shOut(fs[p].c || '(kosong)'); },
  rm(a) { const fs = fsLoad(), p = norm(a[0]); Object.keys(fs).forEach(k => { if (k === p || k.startsWith(p + '/')) delete fs[k]; }); fsSave(fs); shOut('dihapus', 'ok'); },
  echo(a, raw) {
    const m = raw.match(/^echo\s+(.*?)\s*>>?\s*(\S+)$/);
    if (m) {
      const fs = fsLoad(), p = norm(m[2]);
      fs[p] = { f:1, c: (fs[p] ? fs[p].c + '\n' : '') + m[1] };
      fsSave(fs);
      return shOut('ditulis', 'ok');
    }
    shOut(raw.replace(/^echo\s*/, ''));
  },
  async curl(a) {
    if (!a[0]) return;
    try { const d = await apiLab('net', { url: a[0] }); shOut('HTTP ' + d.code, 'sy'); shOut(d.body.slice(0, 2500)); }
    catch (e) { shOut(e.message, 'er'); }
  },
  dl(a) { if (!a[0]) return; gotoView('lab'); labGo('dl'); $('#dlUrl').value = a[0]; runDl(); },
  mail() { gotoView('lab'); labGo('mail'); },
  async run(a, raw) {
    const m = raw.match(/^(bash|sh|node|python3|py)\s+(\S+)/);
    if (!m) return shOut('pakai: node <file>', 'er');
    const fs = fsLoad(), p = norm(m[2]);
    if (!fs[p]) return shOut('tidak ada', 'er');
    try {
      const d = await apiLab('exec', { lang: m[1], files: [{ name: p.split('/').pop(), content: fs[p].c }] });
      if (d.stdout) shOut(d.stdout);
      if (d.stderr) shOut(d.stderr, 'er');
      shOut('[exit ' + d.code + ']', 'dim');
    } catch (e) { shOut(e.message, 'er'); }
  }
};

async function shRun(line) {
  shOut('vespera:~$ ' + line, 'dim');
  const parts = line.trim().split(/\s+/);
  const cmd = parts.shift();
  if (!cmd) return;
  shHistory.push(line);
  const fn = SH[cmd];
  if (!fn) return shOut(cmd + ': tidak dikenal', 'er');
  try { await fn(parts, line.trim()); } catch (e) { shOut(e.message, 'er'); }
}
$('#shInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const v = e.target.value; e.target.value = ''; if (v.trim()) shRun(v); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); if (!shHistory.length) return; shHIdx = shHIdx < 0 ? shHistory.length - 1 : Math.max(0, shHIdx - 1); e.target.value = shHistory[shHIdx]; }
  if (e.key === 'ArrowDown') { e.preventDefault(); if (shHIdx < 0) return; shHIdx = Math.min(shHistory.length - 1, shHIdx + 1); e.target.value = shHistory[shHIdx]; }
  if (e.key === 'Tab') {
    e.preventDefault();
    const v = e.target.value.trim();
    if (!v) return;
    const hit = Object.keys(SH).filter(k => k.startsWith(v));
    if (hit.length === 1) e.target.value = hit[0] + ' ';
    else if (hit.length > 1) shOut(hit.join('  '), 'dim');
  }
});
$('#shClear').onclick = shClear;
$('#shHelp').onclick = () => SH.help();
$('#shReset').onclick = () => SH.reset();
paintPrompt();
shOut('vespera-sh 2.0 · ketik help', 'sy');

/* ---------- DOWNLOADER ---------- */
let dlFmt = 'mp4';
const dlHref = (u, name) => {
  if (typeof u !== 'string') return u;
  if (!u.startsWith('/api/lab?action=proxy')) return u;
  return u.includes('dl=1') ? u : u + '&dl=1&name=' + encodeURIComponent(String(name || 'media').replace(/[^\w.\-]+/g, '_'));
};
$$('#dlFmtSeg button').forEach(b => b.onclick = () => {
  dlFmt = b.dataset.dlfmt;
  $$('#dlFmtSeg button').forEach(x => x.classList.toggle('on', x === b));
});
$('#dlPaste').onclick = async () => {
  try { $('#dlUrl').value = (await navigator.clipboard.readText()).trim(); } catch { toast('Clipboard ditolak.', 'er'); }
};
const readDlHist = () => { try { return JSON.parse(localStorage.getItem(LS.dl) || '[]'); } catch { return []; } };
function renderDlHist() {
  const h = readDlHist(), box = $('#dlHist');
  if (!box) return;
  if (!h.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="label" style="margin:.9rem 0 .3rem"><span>Terakhir</span></div>' + h.map((x, i) =>
    `<div class="dl-item"><div class="meta"><b>${esc(x.title || x.url)}</b><small>${esc(x.fmt)}</small></div><button class="tool-btn" data-i="${i}"><i class="fa-solid fa-rotate"></i></button></div>`
  ).join('');
  $$('#dlHist .tool-btn').forEach(b => b.onclick = () => { $('#dlUrl').value = h[+b.dataset.i].url; runDl(); });
}
async function runDl(url) {
  url = url || $('#dlUrl').value.trim();
  if (!/^https?:\/\//i.test(url)) return toast('URL tidak valid.', 'er');
  const btn = $('#dlBtn'), box = $('#dlRes');
  busy(btn, true, 'Mencari...');
  box.innerHTML = '<div class="q-empty">mencari…</div>';
  try {
    const d = await apiLab('dl', { url, format: dlFmt });
    box.innerHTML =
      (d.title ? `<div class="note">${esc(d.title)}</div>` : '') +
      (d.items || []).map(i =>
        `<div class="dl-item">${d.thumb ? `<img class="thumb" src="${esc(d.thumb)}" loading="lazy">` : '<span class="thumb"></span>'}<div class="meta"><b>${esc(i.label)}</b><small>${esc(i.provider)} · ${esc(i.type)}</small></div><a class="dl" href="${esc(dlHref(i.url, i.label))}" target="_blank" rel="noopener"><i class="fa-solid fa-download"></i></a></div>`
      ).join('');
    const h = readDlHist();
    h.unshift({ url, title: d.title || '', fmt: dlFmt, ts: Date.now() });
    localStorage.setItem(LS.dl, JSON.stringify(h.slice(0, 12)));
    renderDlHist();
  } catch (e) {
    box.innerHTML = `<div class="q-empty" style="color:var(--bad)">${esc(e.message)}</div>`;
  } finally { busy(btn, false); }
}
$('#dlBtn').onclick = () => runDl();

/* antrian unduhan */
let dlq = [];
function paintDlq() {
  const box = $('#dlQueue');
  if (!dlq.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="label" style="margin:.7rem 0 .3rem"><span>Antrian link</span></div>' +
    dlq.map((u, i) => `<div class="dl-item"><div class="meta"><b>${esc(u)}</b></div><button class="tool-btn" data-x="${i}"><i class="fa-solid fa-xmark"></i></button></div>`).join('') +
    `<button class="btn btn-soft btn-block btn-sm" id="dlRunAll" style="margin-top:.3rem"><i class="fa-solid fa-play"></i> Proses semua</button>`;
  $$('#dlQueue [data-x]').forEach(b => b.onclick = () => { dlq.splice(+b.dataset.x, 1); paintDlq(); });
  const ra = $('#dlRunAll');
  if (ra) ra.onclick = async () => {
    ra.disabled = true;
    for (const u of [...dlq]) { await runDl(u); }
    dlq = []; paintDlq();
  };
}
$('#dlAddQueue').onclick = () => {
  const u = $('#dlUrl').value.trim();
  if (!/^https?:\/\//i.test(u)) return toast('URL tidak valid.', 'er');
  if (dlq.includes(u)) return toast('Sudah ada.', 'sy');
  dlq.push(u); $('#dlUrl').value = ''; paintDlq();
  toast('Masuk antrian.', 'ok');
};

$('#rsBtn').onclick = async () => {
  const url = $('#rsUrl').value.trim();
  if (!/^https?:\/\//i.test(url)) return toast('URL tidak valid.', 'er');
  const box = $('#rsRes');
  box.innerHTML = '<div class="q-empty">membuka…</div>';
  try {
    const d = await apiLab('resolve', { url });
    box.innerHTML = `<div class="dl-item"><div class="meta"><b>${esc(d.filename || 'File')}</b><small>${esc(d.provider)}</small></div><a class="dl" href="${esc(dlHref(d.url, d.filename))}" target="_blank" rel="noopener"><i class="fa-solid fa-download"></i></a></div>`;
  } catch (e) { box.innerHTML = `<div class="q-empty" style="color:var(--bad)">${esc(e.message)}</div>`; }
};

/* ---------- TEMP MAIL ---------- */
let mailProv = localStorage.getItem(LS.mprov) || 'auto';
let mailSess = null, mailTimer = null, mailCount = 12;
const domainProv = new Map();

const mailApi = (step, extra, provider) =>
  apiLab('mail', Object.assign({ step, provider: provider || (mailSess ? mailSess.provider : mailProv) }, extra || {}));

$('#mProv').onchange = () => { mailProv = $('#mProv').value; localStorage.setItem(LS.mprov, mailProv); loadMailDomains(); };

async function loadMailDomains() {
  const sel = $('#mDomain');
  sel.innerHTML = '<option>memuat…</option>';
  try {
    const r = await mailApi('domains', { provider: mailProv });
    domainProv.clear();
    (r.map || []).forEach(x => domainProv.set(x.domain, x.provider));
    (r.domains || []).forEach(d => { if (!domainProv.has(d)) domainProv.set(d, mailProv); });
    const opts = (r.domains || []).map(d => `<option value="${esc(d)}">${esc(d)}${domainProv.get(d) && domainProv.get(d) !== 'auto' ? ' · ' + esc(domainProv.get(d)) : ''}</option>`).join('');
    sel.innerHTML = opts || '<option value="">kosong</option>';
  } catch (e) { sel.innerHTML = '<option value="">gagal</option>'; }
}

async function mailBoot() {
  try { mailSess = JSON.parse(localStorage.getItem(LS.mail) || 'null'); } catch { mailSess = null; }
  const sel = $('#mProv');
  if (sel && !sel.dataset.ready) {
    sel.dataset.ready = '1';
    try {
      const r = await apiLab('mail', { step: 'sources' });
      sel.innerHTML = '<option value="auto">Otomatis</option>' + (r.items || []).map(p => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');
      sel.value = mailProv;
    } catch {}
  }
  loadMailDomains();
  if (mailSess) startMail();
}

function startMail() {
  $('#mAddrWrap').hidden = false;
  $('#mAddr').textContent = mailSess.address;
  mailRefresh();
  clearInterval(mailTimer);
  mailTimer = setInterval(() => {
    mailCount--;
    $('#mTimer').textContent = 'auto ' + mailCount + 's';
    if (mailCount <= 0) { mailCount = 12; mailRefresh(); }
  }, 1000);
}

function saveSess(s) { mailSess = s; localStorage.setItem(LS.mail, JSON.stringify(s)); }

$('#mCreate').onclick = async () => {
  const name = $('#mName').value.trim().toLowerCase();
  const domain = $('#mDomain').value;
  if (name.length < 3) return toast('Nama minimal 3.', 'er');
  if (!domain) return toast('Domain belum siap.', 'er');
  const prov = domainProv.get(domain) || mailProv;
  const btn = $('#mCreate');
  busy(btn, true, 'Membuat...');
  try {
    const r = await mailApi('new', { name, domain }, prov);
    saveSess({ address: r.address, name: r.name, domain: r.domain, token: r.token, sid: r.sid, provider: r.provider });
    mailCount = 12;
    startMail();
    toast('Mailbox siap: ' + r.address, 'ok');
  } catch (e) { toast(e.message, 'er'); }
  finally { busy(btn, false); }
};

$('#mBulkBtn').onclick = async () => {
  const box = $('#mBulk');
  box.innerHTML = '<div class="q-empty">generate…</div>';
  try {
    const r = await apiLab('mail', { step: 'bulk', count: 10, provider: mailProv });
    const items = (r.items || []).filter(x => x.address);
    if (!items.length) throw new Error('kosong');
    box.innerHTML = items.map((m, i) =>
      `<div class="dl-item"><div class="meta"><b>${esc(m.address)}</b><small>${esc(m.provider)}</small></div><button class="tool-btn" data-a="${i}"><i class="fa-regular fa-copy"></i></button><button class="tool-btn" data-u="${i}"><i class="fa-solid fa-inbox"></i></button></div>`
    ).join('');
    $$('#mBulk [data-a]').forEach(b => b.onclick = () => copyText(items[+b.dataset.a].address));
    $$('#mBulk [data-u]').forEach(b => b.onclick = () => {
      const m = items[+b.dataset.u];
      saveSess({ address: m.address, name: m.name, domain: m.domain, token: m.token, sid: m.sid, provider: m.provider });
      mailCount = 12;
      startMail();
      toast('Mailbox aktif.', 'ok');
    });
  } catch (e) { box.innerHTML = `<div class="q-empty" style="color:var(--bad)">${esc(e.message)}</div>`; }
};

$('#mCopy').onclick = () => copyText(mailSess.address);
$('#mNew').onclick = () => { $('#mName').value = 'v' + Math.random().toString(36).slice(2, 8); $('#mCreate').click(); };
$('#mDrop').onclick = () => {
  localStorage.removeItem(LS.mail);
  mailSess = null;
  clearInterval(mailTimer);
  $('#mAddrWrap').hidden = true;
  toast('Dihapus.', 'sy');
};
$('#mRefresh').onclick = () => { mailCount = 12; mailRefresh(); };

async function mailRefresh() {
  if (!mailSess) return;
  const list = $('#mList');
  const payload = { token: mailSess.token, sid: mailSess.sid, name: mailSess.name, domain: mailSess.domain, address: mailSess.address };
  try {
    const r = await mailApi('list', payload);
    if (r.switched) {
      saveSess(Object.assign({}, mailSess, {
        provider: r.provider, address: r.address, name: r.name,
        domain: r.domain, token: r.token, sid: r.sid
      }));
      $('#mAddr').textContent = mailSess.address;
      toast('Provider lama mati, alamat baru dibuat.', 'sy');
    }
    const msgs = r.messages || [];
    const unread = msgs.filter(m => !m.seen).length;
    $('#mUnread').textContent = unread + ' baru';
    $('#mUnread').style.display = unread ? '' : 'none';
    if (!msgs.length) { list.innerHTML = '<div class="q-empty">Belum ada pesan.</div>'; return; }
    list.innerHTML = msgs.map((m, i) =>
      `<div class="m-row" data-i="${i}">${m.seen ? '' : '<span class="new-dot"></span>'}<span class="av"><i class="fa-solid fa-envelope"></i></span><span class="tx"><b>${esc(m.subject)}</b><small>${esc(m.from)}</small></span></div>`
    ).join('');
    $$('#mList .m-row').forEach(el => el.onclick = () => mailRead(msgs[+el.dataset.i].id));
  } catch (e) {
    list.innerHTML = `<div class="q-empty" style="color:var(--bad)">${esc(e.message)}</div>`;
  }
}

async function mailRead(id) {
  const box = $('#mRead');
  box.classList.add('open');
  box.innerHTML = '<div class="q-empty">memuat…</div>';
  try {
    const d = await mailApi('read', {
      id, token: mailSess.token, sid: mailSess.sid, name: mailSess.name,
      domain: mailSess.domain, address: mailSess.address
    });
    const blob = [d.subject, d.text, d.html].join(' ');
    const codes = [...new Set((blob.match(/\b\d{6}\b/g) || []))].slice(0, 4);
    const link = (blob.match(/https?:\/\/[^\s"'<>]+oobCode=[^\s"'<>]+/i) || [])[0] || '';
    box.innerHTML =
      `<div class="note">${esc(d.from)} · ${esc(d.subject)}</div>` +
      (codes.length || link ? '<div class="otp-box">' +
        codes.map(c => `<span class="otp-code" data-code="${esc(c)}">${esc(c)}</span>`).join('') +
        (link ? '<button class="tool-btn" id="mUseLink"><i class="fa-solid fa-bolt"></i> Pakai di terminal</button>' : '') +
      '</div>' : '') +
      (d.html
        ? `<iframe srcdoc="${esc(String(d.html))}" sandbox></iframe>`
        : `<pre style="white-space:pre-wrap;font-size:.64rem">${esc(d.text || '(kosong)')}</pre>`);
    $$('#mRead .otp-code').forEach(el => el.onclick = () => copyText(el.dataset.code));
    const ub = $('#mUseLink');
    if (ub) ub.onclick = () => {
      gotoView('home');
      $('#emailInput').value = mailSess.address;
      setTimeout(() => {
        $('#linkInput').value = link;
        $('#linkInput').dispatchEvent(new Event('input'));
        $('#terminal').scrollIntoView({ behavior: 'smooth' });
        toast('Link ditempel. Isi email target lalu kirim.', 'ok');
      }, 80);
    };
  } catch {
    box.innerHTML = '<div class="q-empty" style="color:var(--bad)">gagal</div>';
  }
}

/* ---------- MANGA ---------- */
const MG = {
  src: 'mangadex', tab: 'home', cur: null, ch: [], idx: 0, pages: [],
  set: { auto: false, next: false, speed: 6, fit: false, h: false, title: true, dim: 0 },
  genres: null, nextFired: false, raf: null
};
MG.set = Object.assign(MG.set, (() => { try { return JSON.parse(localStorage.getItem(LS.mgset)) || {}; } catch { return {}; } })());
const saveMgSet = () => localStorage.setItem(LS.mgset, JSON.stringify(MG.set));

const favGet = k => { try { return JSON.parse(localStorage.getItem('ves-fav-' + k) || '[]'); } catch { return []; } };
function favToggle(k, item) {
  const l = favGet(k), i = l.findIndex(x => x.id === item.id);
  if (i >= 0) l.splice(i, 1); else l.unshift(item);
  localStorage.setItem('ves-fav-' + k, JSON.stringify(l.slice(0, 120)));
  return i < 0;
}
const favHas = (k, id) => favGet(k).some(x => x.id === id);

const doneGet = () => { try { return JSON.parse(localStorage.getItem(LS.mgd) || '{}'); } catch { return {}; } };
const doneHas = id => !!doneGet()[id];
function doneSet(id, on) { const d = doneGet(); if (on) d[id] = 1; else delete d[id]; localStorage.setItem(LS.mgd, JSON.stringify(d)); }
const progGet = () => { try { return JSON.parse(localStorage.getItem(LS.mgprog) || '{}'); } catch { return {}; } };
function progSet(m, chIdx, chNum, title) {
  const p = progGet();
  p[m.id] = { title, chIdx, chNum, at: Date.now() };
  localStorage.setItem(LS.mgprog, JSON.stringify(p));
}

async function mgBoot() {
  if (!$('#mgSrc').dataset.ready) {
    $('#mgSrc').dataset.ready = '1';
    try {
      const r = await apiLab('manga', { step: 'sources' });
      $('#mgSrc').innerHTML = (r.items || []).map(s => `<button data-src="${esc(s.id)}">${esc(s.label)}</button>`).join('');
      $$('#mgSrc button').forEach(b => b.onclick = () => {
        MG.src = b.dataset.src;
        $$('#mgSrc button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        mgLoad();
      });
      $$('#mgSrc button')[0]?.classList.add('on');
    } catch {}
  }
  mgLoad();
}

$$('#mgTabs button').forEach(b => b.onclick = () => {
  $$('#mgTabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  MG.tab = b.dataset.tab;
  mgLoad();
});
$('#mgRefresh').onclick = () => mgLoad();
$('#mgSearchBtn').onclick = () => mgSearch();
$('#mgQ').addEventListener('keydown', e => { if (e.key === 'Enter') mgSearch(); });

function mgCard(m) {
  const on = favHas('manga', m.id);
  return `<div class="mv-card">
    <button class="fav ${on ? 'on' : ''}" title="Favorit"><i class="fa-solid fa-heart"></i></button>
    ${m.cover ? `<img class="cv" src="${esc(m.cover)}" loading="lazy" alt="">` : '<div class="ph"></div>'}
    <div class="cap"><b>${esc(m.title)}</b>${m.meta ? `<small>${esc(m.meta)}</small>` : ''}</div>
  </div>`;
}
function mgBind(items) {
  $$('#mgBody .mv-card').forEach((c, i) => {
    c.onclick = e => { if (e.target.closest('.fav')) return; mgOpen(items[i]); };
    const f = c.querySelector('.fav');
    if (f) f.onclick = () => {
      const on = favToggle('manga', items[i]);
      f.classList.toggle('on', on);
      toast(on ? 'Favorit ditambah.' : 'Dihapus.', 'sy');
    };
  });
}
const skel = n => '<div class="mv-grid">' + Array.from({ length: n }, () => '<div class="mv-card"><div class="ph"></div></div>').join('') + '</div>';

function mgLoad() {
  if (MG.tab === 'fav') return mgFav();
  if (MG.tab === 'genre') return mgGenres();
  if (MG.tab === 'history') return mgHistory();
  mgHome();
}

function mgResumeCard() {
  const p = progGet();
  const keys = Object.keys(p).sort((a, b) => p[b].at - p[a].at);
  if (!keys.length) return '';
  const k = keys[0], e = p[k];
  return `<div class="resume-card" data-resume="${esc(k)}">
    <div style="flex:1"><small>Lanjut baca</small><b>${esc(e.title)}</b><small>Chapter ${esc(String(e.chNum))}</small></div>
    <i class="fa-solid fa-arrow-right" style="color:var(--v2)"></i>
  </div>`;
}

async function mgHome() {
  $('#mgBody').innerHTML = mgResumeCard() + skel(9);
  try {
    const d = await apiLab('manga', { step: 'home', source: 'mangadex' });
    const tr = d.trending || [], lt = d.latest || [];
    if (!tr.length && !lt.length) { $('#mgBody').innerHTML = '<div class="empty">Kosong.</div>'; return; }
    $('#mgBody').innerHTML = mgResumeCard() +
      (tr.length ? `<div class="mv-sec"><b>Populer</b><span>${tr.length}</span></div><div class="mv-grid">${tr.map(mgCard).join('')}</div>` : '') +
      (lt.length ? `<div class="mv-sec"><b>Update terbaru</b><span>${lt.length}</span></div><div class="mv-grid">${lt.map(mgCard).join('')}</div>` : '');
    mgBind(tr.concat(lt));
    const rc = $('[data-resume]');
    if (rc) rc.onclick = () => mgOpen({ id: rc.dataset.resume, title: progGet()[rc.dataset.resume].title });
  } catch (e) { $('#mgBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}

async function mgGenres() {
  if (MG.genres) {
    $('#mgBody').innerHTML = `<div class="mv-sec"><b>Pilih genre</b><span>${MG.genres.length}</span></div><div class="genre-grid">${MG.genres.map(g => `<button data-tag="${esc(g.id)}">${esc(g.name)}</button>`).join('')}</div>`;
    return bindGenres();
  }
  $('#mgBody').innerHTML = '<div class="empty">memuat genre…</div>';
  try {
    const d = await apiLab('manga', { step: 'genres', source: 'mangadex' });
    MG.genres = d.items || [];
    mgGenres();
  } catch (e) { $('#mgBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}
function bindGenres() {
  $$('#mgBody [data-tag]').forEach(b => b.onclick = async () => {
    $('#mgBody').innerHTML = skel(9);
    try {
      const d = await apiLab('manga', { step: 'bygenre', source: 'mangadex', tag: b.dataset.tag });
      if (!d.items.length) { $('#mgBody').innerHTML = '<div class="empty">Kosong.</div>'; return; }
      $('#mgBody').innerHTML = `<div class="mv-sec"><b>${esc(b.textContent)}</b><span>${d.items.length}</span></div><div class="mv-grid">${d.items.map(mgCard).join('')}</div>`;
      mgBind(d.items);
    } catch (e) { $('#mgBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
  });
}

function mgFav() {
  const l = favGet('manga');
  if (!l.length) { $('#mgBody').innerHTML = '<div class="empty">Belum ada favorit.</div>'; return; }
  $('#mgBody').innerHTML = `<div class="mv-sec"><b>Favorit</b><span>${l.length}</span></div><div class="mv-grid">${l.map(mgCard).join('')}</div>`;
  mgBind(l);
}

function mgHistory() {
  const p = progGet(), keys = Object.keys(p).sort((a, b) => p[b].at - p[a].at);
  if (!keys.length) { $('#mgBody').innerHTML = '<div class="empty">Belum ada riwayat baca.</div>'; return; }
  $('#mgBody').innerHTML = `<div class="mv-sec"><b>Lanjut baca</b><span>${keys.length}</span></div>` +
    keys.map(k => `<div class="m-row" data-r="${esc(k)}"><span class="av"><i class="fa-solid fa-book-open"></i></span><span class="tx"><b>${esc(p[k].title)}</b><small>Chapter ${esc(String(p[k].chNum))} · ${new Date(p[k].at).toLocaleDateString('id-ID')}</small></span></div>`).join('');
  $$('#mgBody [data-r]').forEach(el => el.onclick = () => mgOpen({ id: el.dataset.r, title: progGet()[el.dataset.r].title }));
}

async function mgSearch() {
  const q = $('#mgQ').value.trim();
  if (q.length < 2) return toast('Minimal 2 huruf.', 'er');
  $('#mgBody').innerHTML = skel(6);
  try {
    const d = await apiLab('manga', { step: 'search', source: MG.src, q });
    if (!d.items.length) { $('#mgBody').innerHTML = '<div class="empty">Tidak ada hasil.</div>'; return; }
    $('#mgBody').innerHTML = `<div class="mv-sec"><b>Hasil</b><span>${d.items.length}</span></div><div class="mv-grid">${d.items.map(mgCard).join('')}</div>`;
    mgBind(d.items);
  } catch (e) { $('#mgBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}

async function mgOpen(m) {
  MG.cur = m;
  $('#mgBody').innerHTML = '<div class="empty">memuat chapter…</div>';
  try {
    const d = await apiLab('manga', { step: 'chapters', source: MG.src, id: m.id });
    MG.ch = d.items || [];
    const on = favHas('manga', m.id);
    $('#mgBody').innerHTML = `
      <div class="mv-hero">
        ${m.cover ? `<img class="bg" src="${esc(m.cover)}">` : ''}
        <div class="in">
          ${m.cover ? `<img class="cv" src="${esc(m.cover)}">` : '<div class="cv"></div>'}
          <div style="min-width:0">
            <h3>${esc(m.title)}</h3>
            <div class="meta"><span class="good">${esc(MG.src)}</span><span>${MG.ch.length} chapter</span></div>
            <div class="row-btns" style="margin-top:.35rem">
              <button class="btn btn-plain btn-sm" id="mgBack">Kembali</button>
              <button class="btn btn-soft btn-sm" id="mgFav">${on ? 'Hapus favorit' : 'Favorit'}</button>
              ${MG.ch.length ? '<button class="btn btn-solid btn-sm" id="mgFirst">Mulai baca</button>' : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="chap-tools">
        <input class="inp" id="mgChQ" placeholder="Cari chapter…">
        <button class="tool-btn" id="mgSort" title="Urutan">ASC</button>
        <button class="tool-btn" id="mgDlAll" title="Unduh semua chapter"><i class="fa-solid fa-download"></i> Semua</button>
      </div>
      <div class="chap-list" id="mgChap"></div>`;
    $('#mgBack').onclick = () => mgLoad();
    $('#mgFav').onclick = () => {
      const x = favToggle('manga', m);
      $('#mgFav').textContent = x ? 'Hapus favorit' : 'Favorit';
      toast(x ? 'Ditambah.' : 'Dihapus.', 'sy');
    };
    if (MG.ch.length) $('#mgFirst').onclick = () => mgRead(0);

    let asc = true;
    const paintCh = () => {
      const q = ($('#mgChQ').value || '').toLowerCase().trim();
      let list = MG.ch.map((c, i) => ({ ...c, i }));
      if (q) list = list.filter(c => String(c.num).toLowerCase().includes(q));
      if (!asc) list.reverse();
      const box = $('#mgChap');
      if (!list.length) { box.innerHTML = '<div class="empty">Tidak ada chapter cocok.</div>'; return; }
      box.innerHTML = list.map(c =>
        `<button data-i="${c.i}" class="${doneHas(c.id) ? 'done' : ''}"><span class="no">${esc(c.num)}</span> Chapter ${esc(c.num)}${doneHas(c.id) ? '<i class="fa-solid fa-check tick"></i>' : ''}</button>`
      ).join('');
      $$('#mgChap button').forEach(b => b.onclick = () => mgRead(+b.dataset.i));
    };
    paintCh();
    $('#mgChQ').oninput = paintCh;
    $('#mgSort').onclick = e => { asc = !asc; e.currentTarget.textContent = asc ? 'ASC' : 'DESC'; paintCh(); };
    $('#mgDlAll').onclick = () => mgDownloadRange(0, MG.ch.length - 1);
  } catch (e) { $('#mgBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}

function mgReaderTools() {
  const t = MG.set;
  return `<div class="rd-progress"><i id="rdProg"></i></div>
  <div class="rd-tools">
    <button class="tool-btn ${t.auto ? 'on' : ''}" id="rdAuto" title="Auto scroll"><i class="fa-solid fa-arrows-up-down"></i></button>
    <input type="range" id="rdSpeed" min="1" max="20" value="${t.speed}" title="Kecepatan auto scroll">
    <button class="tool-btn ${t.next ? 'on' : ''}" id="rdNext" title="Auto lanjut chapter"><i class="fa-solid fa-forward"></i></button>
    <span class="sep"></span>
    <button class="tool-btn ${t.title ? 'on' : ''}" id="rdTitle" title="Tampilkan judul"><i class="fa-solid fa-heading"></i></button>
    <span class="rd-title ${t.title ? '' : 'hide'}" id="rdName"></span>
    <span class="grow"></span>
    <span class="rd-count" id="rdCount">1/1</span>
    <button class="tool-btn" id="rdJump" title="Lompat halaman"><i class="fa-solid fa-arrow-down-1-9"></i></button>
    <button class="tool-btn ${t.fit ? 'on' : ''}" id="rdFit" title="Muat layar"><i class="fa-solid fa-expand"></i></button>
    <button class="tool-btn ${t.h ? 'on' : ''}" id="rdH" title="Mode geser"><i class="fa-solid fa-arrows-left-right"></i></button>
    <span class="sep"></span>
    <button class="tool-btn" id="rdDl" title="Unduh chapter"><i class="fa-solid fa-download"></i></button>
    <button class="tool-btn" id="rdDone" title="Tandai selesai"><i class="fa-solid fa-check"></i></button>
    <button class="tool-btn" id="rdList" title="Daftar chapter"><i class="fa-solid fa-list"></i></button>
    <button class="tool-btn" id="rdDim" title="Redup"><i class="fa-solid fa-circle-half-stroke"></i></button>
  </div>`;
}

async function mgRead(i) {
  const c = MG.ch[i];
  if (!c) return;
  MG.idx = i;
  MG.nextFired = false;
  $('#mgBody').innerHTML = '<div class="empty">memuat halaman…</div>';
  try {
    const d = await apiLab('manga', { step: 'pages', source: MG.src, id: c.id });
    MG.pages = d.pages || [];
    if (!MG.pages.length) throw new Error('Halaman kosong.');
    progSet(MG.cur, i, c.num, MG.cur.title);
    $('#mgBody').innerHTML = mgReaderTools() +
      `<div class="reader ${MG.set.fit ? 'mode-fit' : ''} ${MG.set.h ? 'mode-h' : ''}" id="reader">${MG.pages.map((p, n) => `<img src="${esc(p)}" loading="lazy" alt="Halaman ${n + 1}">`).join('')}</div>
       <div class="rd-nav">
         <button class="btn btn-plain" id="rdPrev"><i class="fa-solid fa-chevron-left"></i> Sebelumnya</button>
         <button class="btn btn-solid" id="rdNextCh">Chapter berikutnya <i class="fa-solid fa-chevron-right"></i></button>
       </div>
       <div class="dim-layer" id="dimLayer" style="opacity:${MG.set.dim / 100}"></div>`;
    $('#rdName').textContent = `${MG.cur.title} · Ch. ${c.num}`;
    $('#rdCount').textContent = `1/${MG.pages.length}`;
    document.title = `${MG.cur.title} Ch. ${c.num} — VESPERA`;
    bindReader(c);
    window.scrollTo({ top: 0 });
  } catch (e) { $('#mgBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}

function bindReader(c) {
  const t = MG.set;
  $('#rdAuto').onclick = e => { t.auto = !t.auto; saveMgSet(); e.currentTarget.classList.toggle('on', t.auto); mgAuto(); };
  $('#rdNext').onclick = e => { t.next = !t.next; saveMgSet(); e.currentTarget.classList.toggle('on', t.next); };
  $('#rdSpeed').oninput = e => { t.speed = +e.target.value; saveMgSet(); };
  $('#rdTitle').onclick = e => { t.title = !t.title; saveMgSet(); e.currentTarget.classList.toggle('on', t.title); $('#rdName').classList.toggle('hide', !t.title); };
  $('#rdFit').onclick = e => { t.fit = !t.fit; saveMgSet(); e.currentTarget.classList.toggle('on', t.fit); $('#reader').classList.toggle('mode-fit', t.fit); };
  $('#rdH').onclick = e => { t.h = !t.h; saveMgSet(); e.currentTarget.classList.toggle('on', t.h); $('#reader').classList.toggle('mode-h', t.h); };
  $('#rdDl').onclick = () => mgDownloadPages(0, MG.pages.length - 1);
  $('#rdDone').onclick = () => {
    const on = !doneHas(c.id);
    doneSet(c.id, on);
    toast(on ? 'Chapter ditandai selesai.' : 'Tanda selesai dihapus.', on ? 'ok' : 'sy');
    if (on && MG.set.next && MG.idx + 1 < MG.ch.length) mgRead(MG.idx + 1);
  };
  $('#rdList').onclick = () => { mgOpen(MG.cur); };
  $('#rdDim').onclick = () => { t.dim = t.dim >= 60 ? 0 : t.dim + 20; saveMgSet(); $('#dimLayer').style.opacity = t.dim / 100; };
  $('#rdJump').onclick = () => {
    const n = parseInt(prompt('Lompat ke halaman (1-' + MG.pages.length + ')'), 10);
    if (!n) return;
    const img = $$('#reader img')[clamp(n - 1, 0, MG.pages.length - 1)];
    img?.scrollIntoView({ block: 'start' });
  };
  $('#rdPrev').onclick = () => MG.idx > 0 ? mgRead(MG.idx - 1) : toast('Chapter pertama.', 'sy');
  $('#rdNextCh').onclick = () => MG.idx + 1 < MG.ch.length ? mgRead(MG.idx + 1) : toast('Chapter terakhir.', 'sy');
  mgAuto();
}

function mgAuto() {
  cancelAnimationFrame(MG.raf);
  if (!MG.set.auto || reduce) return;
  const step = () => {
    if (!MG.set.auto) return;
    if (!MG.set.h) window.scrollBy(0, MG.set.speed / 6);
    else $('#reader').scrollLeft += MG.set.speed / 3;
    MG.raf = requestAnimationFrame(step);
  };
  MG.raf = requestAnimationFrame(step);
}

function mgOnScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const p = max > 0 ? doc.scrollTop / max : 0;
  const bar = $('#rdProg');
  if (bar) bar.style.width = (p * 100) + '%';
  const cnt = $('#rdCount');
  if (cnt && MG.pages.length) {
    const imgs = $$('#reader img');
    const mid = scrollY + innerHeight / 2;
    let cur = 0;
    imgs.forEach((im, i) => { if (im.offsetTop <= mid) cur = i; });
    cnt.textContent = (cur + 1) + '/' + MG.pages.length;
  }
  if (MG.set.next && p > .9 && !MG.nextFired && MG.pages.length) {
    MG.nextFired = true;
    if (MG.idx + 1 < MG.ch.length) {
      toast('Lanjut chapter…', 'sy');
      mgRead(MG.idx + 1);
    }
  }
  if (p < .7) MG.nextFired = false;
}

async function mgDownloadPages(from, to, prefix) {
  if (!MG.pages.length) return;
  const name = prefix || (MG.cur.title + '_Ch' + MG.ch[MG.idx].num);
  let ok = 0;
  for (let i = from; i <= to; i++) {
    try {
      const r = await fetch(MG.pages[i]);
      const b = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${name.replace(/[^\w\-]+/g, '_')}_${String(i + 1).padStart(3, '0')}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      ok++;
      toast(`Unduh ${i - from + 1}/${to - from + 1}`, 'sy');
      await new Promise(r => setTimeout(r, 250));
    } catch {}
  }
  toast(`${ok}/${to - from + 1} halaman tersimpan.`, ok ? 'ok' : 'er');
}

async function mgDownloadRange(from, to) {
  toast('Menyiapkan unduhan…', 'sy');
  for (let i = from; i <= to; i++) {
    const c = MG.ch[i];
    if (!c) continue;
    try {
      const d = await apiLab('manga', { step: 'pages', source: MG.src, id: c.id });
      MG.pages = d.pages || [];
      MG.idx = i;
      await mgDownloadPages(0, MG.pages.length - 1, MG.cur.title + '_Ch' + c.num);
    } catch {}
  }
  toast('Selesai.', 'ok');
}

/* keyboard reader */
addEventListener('keydown', e => {
  if (!MG.pages.length || document.body.dataset.view !== 'manga') return;
  if (/input|textarea|select/i.test(e.target.tagName)) return;
  if (e.key === 'j' || e.key === 'ArrowDown') { window.scrollBy({ top: innerHeight * .85, behavior: 'smooth' }); e.preventDefault(); }
  if (e.key === 'k' || e.key === 'ArrowUp') { window.scrollBy({ top: -innerHeight * .85, behavior: 'smooth' }); e.preventDefault(); }
  if (e.key === 'n') MG.idx + 1 < MG.ch.length ? mgRead(MG.idx + 1) : null;
  if (e.key === 'p') MG.idx > 0 ? mgRead(MG.idx - 1) : null;
  if (e.key === 'a') { MG.set.auto = !MG.set.auto; saveMgSet(); $('#rdAuto')?.classList.toggle('on', MG.set.auto); mgAuto(); }
  if (e.key === 'f') { MG.set.fit = !MG.set.fit; saveMgSet(); $('#rdFit')?.classList.toggle('on', MG.set.fit); $('#reader')?.classList.toggle('mode-fit', MG.set.fit); }
});

/* ---------- MUSIK ---------- */
const MU = { tab: 'chart', list: [], i: 0, shuffle: false, rep: false };
const audio = $('#muAudio');
const ART = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23241c3d"/%3E%3Ccircle cx="50" cy="50" r="16" fill="none" stroke="%23a78bfa" stroke-width="2"/%3E%3Ccircle cx="50" cy="50" r="4" fill="%23a78bfa"/%3E%3C/svg%3E';

async function muBoot() { muLoad(); }
function muLoad() {
  if (MU.tab === 'fav') return muFav();
  if (MU.tab === 'queue') return muQueue();
  if (MU.tab === 'album') return muAlbums();
  muChart();
}
$$('#muTabs button').forEach(b => b.onclick = () => {
  $$('#muTabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  MU.tab = b.dataset.tab;
  muLoad();
});
$('#muSearchBtn').onclick = () => muSearch();
$('#muQ').addEventListener('keydown', e => { if (e.key === 'Enter') muSearch(); });

async function muChart() {
  $('#muBody').innerHTML = '<div class="empty">memuat…</div>';
  try {
    const d = await apiLab('music', { step: 'home' });
    MU.list = d.chart || [];
    if (!MU.list.length) { $('#muBody').innerHTML = '<div class="empty">Kosong.</div>'; return; }
    $('#muBody').innerHTML = `<div class="mv-sec"><b>Top chart</b><span>${MU.list.length}</span></div>` + muRows(MU.list);
    muBind(MU.list);
  } catch (e) { $('#muBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}
async function muAlbums() {
  $('#muBody').innerHTML = '<div class="empty">memuat…</div>';
  try {
    const d = await apiLab('music', { step: 'album' });
    const al = d.albums || [];
    if (!al.length) { $('#muBody').innerHTML = '<div class="empty">Kosong.</div>'; return; }
    $('#muBody').innerHTML = `<div class="mv-sec"><b>Album populer</b><span>${al.length}</span></div><div class="mus-grid">${al.map(a =>
      `<div class="mus-card"><img src="${esc(a.art || ART)}" loading="lazy" onerror="this.src='${ART}'"><b>${esc(a.title)}</b><small>${esc(a.artist)}</small></div>`
    ).join('')}</div>`;
  } catch (e) { $('#muBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}
const muRows = items => items.map((t, i) =>
  `<div class="track-row" data-i="${i}"><span class="n">${i + 1}</span><img src="${esc(t.art || ART)}" loading="lazy" onerror="this.src='${ART}'"><div class="tx"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></div><button class="pb-btn"><i class="fa-solid fa-download"></i></button></div>`
).join('');

function muBind(items) {
  $$('#muBody .track-row').forEach((r, i) => {
    r.onclick = e => { if (e.target.closest('.pb-btn')) return; muPlayList(items, i); };
    r.querySelector('.pb-btn').onclick = e => { e.stopPropagation(); muDownloadItem(items[i]); };
  });
  $$('#muBody .mus-card').forEach((c, i) => {
    c.onclick = () => muPlayList(items, i);
    const p = c.querySelector('.pl');
    if (p) p.onclick = e => { e.stopPropagation(); muPlayList(items, i); };
  });
}
async function muSearch() {
  const q = $('#muQ').value.trim();
  if (q.length < 2) return toast('Minimal 2 huruf.', 'er');
  $('#muBody').innerHTML = '<div class="empty">mencari…</div>';
  try {
    const d = await apiLab('music', { step: 'search', q });
    if (!d.items.length) { $('#muBody').innerHTML = '<div class="empty">Tidak ada hasil.</div>'; return; }
    MU.list = d.items;
    $('#muBody').innerHTML = `<div class="mv-sec"><b>Hasil</b><span>${d.items.length}</span></div>` + muRows(d.items);
    muBind(d.items);
  } catch (e) { $('#muBody').innerHTML = `<div class="empty bad">${esc(e.message)}</div>`; }
}
function muFav() {
  const l = favGet('music');
  if (!l.length) { $('#muBody').innerHTML = '<div class="empty">Belum ada favorit.</div>'; return; }
  MU.list = l;
  $('#muBody').innerHTML = `<div class="mv-sec"><b>Favorit</b><span>${l.length}</span></div>` + muRows(l);
  muBind(l);
}
function muQueue() {
  if (!MU.list.length) { $('#muBody').innerHTML = '<div class="empty">Antrian kosong.</div>'; return; }
  $('#muBody').innerHTML = `<div class="mv-sec"><b>Antrian</b><span>${MU.list.length}</span></div>` + muRows(MU.list);
  muBind(MU.list);
}

function paintMediaSession(t) {
  if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title || '—', artist: t.artist || 'VESPERA', artwork: [{ src: t.art || ART, sizes: '400x400', type: 'image/png' }] });
    navigator.mediaSession.setActionHandler('play', () => audio.play().catch(() => {}));
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('nexttrack', muNext);
    navigator.mediaSession.setActionHandler('previoustrack', muPrev);
  } catch {}
}
function muPlayList(list, i) {
  MU.list = list.slice();
  MU.i = i;
  const t = MU.list[i];
  if (!t) return;
  $('#pbArt').src = t.art || ART;
  $('#pbTitle').textContent = t.title;
  $('#pbArtist').textContent = t.artist;
  $('#playerbar').classList.add('on');
  document.body.classList.add('player-on');
  paintMediaSession(t);
  if (t.preview) { audio.src = t.preview; audio.play().catch(() => {}); }
  else { audio.removeAttribute('src'); toast('Menyiapkan track…', 'sy'); }
  if (!t.full) muResolveFull(t);
}
async function muResolveFull(t) {
  if (t._busy) return;
  t._busy = true;
  try {
    const d = await apiLab('music', { step: 'full', q: (t.artist + ' ' + t.title).trim() });
    if (!d.url) throw new Error('kosong');
    t.full = true; t.preview = d.url;
    if (MU.list[MU.i] === t) { const at = audio.currentTime || 0; audio.src = d.url; audio.play().catch(() => {}); if (at > 1) audio.currentTime = at; }
  } catch { if (!t.preview) toast('Track penuh tidak ketemu.', 'er'); }
  finally { t._busy = false; }
}
function muToggle() { audio.paused ? audio.play().catch(() => {}) : audio.pause(); }
function muNext() { if (!MU.list.length) return; let i = MU.shuffle ? Math.floor(Math.random() * MU.list.length) : MU.i + 1; if (i >= MU.list.length) i = 0; muPlayList(MU.list, i); }
function muPrev() { if (!MU.list.length) return; let i = MU.i - 1; if (i < 0) i = MU.list.length - 1; muPlayList(MU.list, i); }
$('#pbPlay').onclick = muToggle;
$('#pbNext').onclick = muNext;
$('#pbPrev').onclick = muPrev;
$('#pbShuffle').onclick = () => { MU.shuffle = !MU.shuffle; $('#pbShuffle').classList.toggle('on', MU.shuffle); };
$('#pbRep').onclick = () => { MU.rep = !MU.rep; $('#pbRep').classList.toggle('on', MU.rep); };
$('#pbDl').onclick = () => muDownloadItem(MU.list[MU.i]);
$('#pbClose').onclick = () => {
  audio.pause(); audio.removeAttribute('src'); audio.load();
  $('#playerbar').classList.remove('on');
  document.body.classList.remove('player-on');
};
audio.addEventListener('timeupdate', () => {
  const p = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
  $('#pbFill').style.width = p + '%';
  $('#pbCur').textContent = fmtT(audio.currentTime);
  $('#pbDur').textContent = fmtT(audio.duration || 0);
});
audio.addEventListener('play', () => $('#pbPlay').innerHTML = '<i class="fa-solid fa-pause"></i>');
audio.addEventListener('pause', () => $('#pbPlay').innerHTML = '<i class="fa-solid fa-play"></i>');
audio.addEventListener('ended', () => { MU.rep ? audio.play() : muNext(); });
$('#pbSeek').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
};
const fmtT = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

async function muDownloadItem(t) {
  if (!t) return toast('Pilih lagu dulu.', 'er');
  if (t.preview) { window.open(dlHref(t.preview, t.title + ' - ' + t.artist), '_blank'); return; }
  if (!t.url) return toast('Link tidak ada.', 'er');
  toast('Mencari unduhan…', 'sy');
  try {
    const d = await apiLab('dl', { url: t.url, format: 'mp3' });
    const first = (d.items || [])[0];
    if (!first) throw new Error('tidak ada hasil');
    window.open(dlHref(first.url, t.title), '_blank');
  } catch (e) { toast(e.message, 'er'); }
}

/* ---------- boot ---------- */
(function () {
  const el = $('#boot');
  const fill = $('#bootFill'), pct = $('#bootPct'), logEl = $('#bootLog'), stat = $('#bootStatus');
  const quick = sessionStorage.getItem('ves-booted') === '1';
  let p = 0, ended = false;
  const log = (tag, msg) => {
    const d = document.createElement('div');
    d.className = tag;
    d.textContent = (tag === 'ok' ? '[OK] ' : tag === 'er' ? '[ERR] ' : '[..] ') + msg;
    logEl.appendChild(d);
    while (logEl.children.length > 7) logEl.firstChild.remove();
  };
  const paint = () => {
    fill.style.width = Math.min(100, p) + '%';
    pct.textContent = String(Math.min(100, Math.floor(p))).padStart(2, '0');
    stat.textContent = p < 40 ? 'probing' : p < 80 ? 'mounting' : 'ready';
  };
  const tick = setInterval(() => {
    p += Math.max(.3, (100 - p) * .15);
    if (p >= 99.4) finish();
    paint();
  }, reduce ? 44 : 26);
  function finish() {
    if (ended) return;
    ended = true;
    clearInterval(tick);
    p = 100; paint();
    sessionStorage.setItem('ves-booted', '1');
    setTimeout(() => {
      el.classList.add('out');
      document.body.classList.remove('booting');
      setTimeout(() => el.remove(), 700);
      if (!localStorage.getItem(LS.seen)) { openSheet('welcomeSheet'); localStorage.setItem(LS.seen, '1'); }
    }, quick ? 90 : 320);
  }
  (async () => {
    log('', 'vespera kernel v9.0.0');
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      const d = await jread(r);
      log(r.ok ? 'ok' : 'er', 'health ' + r.status);
      if (d.env) Object.entries(d.env).forEach(([k, v]) => log(v ? 'ok' : 'er', 'env ' + k));
    } catch { log('er', 'health offline-safe'); }
    log('ok', 'mount media + lab');
  })();
  setTimeout(finish, 6000);
})();

/* ---------- init ---------- */
document.documentElement.dataset.theme = localStorage.getItem(LS.theme) || 'dark';
document.documentElement.dataset.acc = localStorage.getItem(LS.acc) || 'violet';
$$('[data-acc]').forEach(b => b.setAttribute('aria-pressed', b.dataset.acc === document.documentElement.dataset.acc));
paintTheme(); paintSound();
setIdMode(idMode);
setStep(1);
paintStats(); paintHistory(); paintQueue(); paintCacheSize(); renderDlHist();
loadMe();
$('#mProv').value = mailProv;
$('#emailInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnSend').click(); });
$('#dlUrl').addEventListener('keydown', e => { if (e.key === 'Enter') runDl(); });
$('#rsUrl').addEventListener('keydown', e => { if (e.key === 'Enter') $('#rsBtn').click(); });
$('#mName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#mCreate').click(); });
$('#authPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#authSubmit').click(); });
$('#fab').onclick = scrollToTerminal;