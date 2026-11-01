const PISTON = 'https://emkc.org/api/v2/piston/execute';
const MAILTM = 'https://api.mail.tm';
const ONESEC = 'https://www.1secmail.com/api/v1/';
const RL = new Map();
const CAPS = { exec: 24, dl: 24, net: 40, mail: 80 };

const LANG = {
  bash: 'bash', sh: 'bash', shell: 'bash',
  node: 'javascript', js: 'javascript', javascript: 'javascript',
  python: 'python', python3: 'python', py: 'python',
  php: 'php', go: 'go', c: 'c', cpp: 'c++', java: 'java', ruby: 'ruby', lua: 'lua'
};

function out(res, code, obj) {
  res.status(code).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function hit(ip, act) {
  const k = ip + '|' + act, now = Date.now();
  const r = RL.get(k) || { n: 0, t: now };
  if (now - r.t > 60000) { r.n = 0; r.t = now; }
  r.n++; RL.set(k, r);
  return r.n <= (CAPS[act] || 40);
}

async function tf(url, opt = {}, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); }
  finally { clearTimeout(t); }
}

/* ---------- exec ---------- */
async function doExec(req, res) {
  const body = req.body || {};
  const lang = LANG[String(body.lang || '').toLowerCase()];
  if (!lang) return out(res, 400, { status: 'error', message: 'Bahasa tidak didukung.' });
  if (!Array.isArray(body.files) || !body.files.length) return out(res, 400, { status: 'error', message: 'File kosong.' });

  const files = body.files.slice(0, 6).map(f => ({
    name: String(f.name || 'main').replace(/[^\w.\-]/g, ''),
    content: String(f.content || '').slice(0, 40000)
  }));

  const r = await tf(PISTON, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang, version: '*', files, stdin: String(body.stdin || '') })
  }, 10000);

  const d = await r.json().catch(() => ({}));
  if (!r.ok) return out(res, 502, { status: 'error', message: d.message || 'Sandbox menolak (' + r.status + ')' });

  return out(res, 200, {
    status: 'success',
    stdout: (d.run && d.run.stdout) || '',
    stderr: (d.run && d.run.stderr) || '',
    code: (d.run && d.run.code) ?? 0,
    compile: (d.compile && d.compile.output) || ''
  });
}

/* ---------- downloader ---------- */
async function cobalt(url, fmt, key) {
  const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  if (key) h['api-key'] = key;
  const r = await tf('https://api.cobalt.tools/', {
    method: 'POST', headers: h,
    body: JSON.stringify({ url, videoQuality: '1080', audioBitrate: '320', downloadMode: fmt === 'mp3' ? 'audio' : 'auto' })
  }, 9000);
  if (!r.ok) throw new Error('cobalt ' + r.status);
  const d = await r.json();
  if (d.status === 'error') throw new Error((d.error && d.error.code) || 'cobalt error');
  if (d.status === 'picker' && Array.isArray(d.picker))
    return d.picker.map(p => ({ url: p.url, label: p.type || 'media', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'cobalt' }));
  if (d.url) return [{ url: d.url, label: d.filename || 'media', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'cobalt' }];
  throw new Error('cobalt kosong');
}

async function tikwm(url) {
  const r = await tf('https://tikwm.com/api/?hd=1&url=' + encodeURIComponent(url), {}, 9000);
  const d = await r.json();
  if (!d || d.code !== 0 || !d.data) throw new Error('tikwm gagal');
  const x = d.data, list = [];
  if (x.hdplay) list.push({ url: x.hdplay, label: 'HD · tanpa watermark', type: 'video', provider: 'tikwm' });
  if (x.play) list.push({ url: x.play, label: 'SD · tanpa watermark', type: 'video', provider: 'tikwm' });
  if (x.music) list.push({ url: x.music, label: 'Audio MP3', type: 'audio', provider: 'tikwm' });
  return { title: x.title, thumb: x.cover, items: list };
}

async function oceansaver(url, fmt) {
  const r = await tf('https://p.oceansaver.in/ajax/download.php?format=' + fmt + '&url=' + encodeURIComponent(url), {}, 9000);
  const d = await r.json();
  if (!d || !d.success || !d.id) throw new Error('oceansaver gagal');
  for (let i = 0; i < 5; i++) {
    await new Promise(x => setTimeout(x, 700));
    const p = await tf('https://p.oceansaver.in/api/progress?id=' + d.id, {}, 7000);
    const j = await p.json().catch(() => ({}));
    if (j && j.download_url) return [{ url: j.download_url, label: fmt === 'mp3' ? 'Audio MP3' : 'Video', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'oceansaver' }];
    if (j && j.success === 0 && j.error) break;
  }
  throw new Error('oceansaver timeout');
}

async function doDl(req, res) {
  const b = req.body || {};
  const url = String(b.url || req.query.url || '').trim();
  const fmt = String(b.format || 'mp4').toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });

  if (/\.(mp4|mp3|m4a|webm|mov|jpg|jpeg|png|webp|gif)(\?|$)/i.test(url))
    return out(res, 200, { status: 'success', items: [{ url, label: 'Direct link', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'direct' }] });

  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const errors = [];
  let meta = {};

  const tries = [];
  if (/tiktok\.com|douyin\.com/.test(host)) tries.push(() => tikwm(url).then(r => { meta = r; return r.items; }));
  tries.push(() => cobalt(url, fmt, process.env.COBALT_KEY));
  if (/youtube\.com|youtu\.be/.test(host)) tries.push(() => oceansaver(url, fmt));

  for (const t of tries) {
    try {
      const items = await t();
      if (items && items.length) return out(res, 200, { status: 'success', host, title: meta.title || '', thumb: meta.thumb || '', items });
    } catch (e) { errors.push(e.message); }
  }

  return out(res, 502, { status: 'error', message: 'Semua provider gagal. Coba lagi / ganti link.', detail: errors.join(' · ') });
}

/* ---------- net (curl) ---------- */
async function doNet(req, res) {
  const url = String(req.query.url || (req.body && req.body.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
  const r = await tf(url, { headers: { 'User-Agent': 'zukai-lab/1.0' } }, 9000);
  const txt = (await r.text()).slice(0, 60000);
  return out(res, 200, { status: 'success', code: r.status, type: r.headers.get('content-type') || '', body: txt });
}

/* ---------- temp mail (mail.tm) ---------- */
async function mt(path, opt = {}, token) {
  const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await tf(MAILTM + path, { ...opt, headers: h }, 9000);
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, code: r.status, d };
}

async function doMail(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');

  if (step === 'domains') {
    const r = await mt('/domains?page=1');
    const list = ((r.d && r.d['hydra:member']) || []).filter(x => !x.isPrivate && x.isActive !== false).map(x => x.domain);
    if (!list.length) return out(res, 502, { status: 'error', message: 'Domain tidak tersedia.' });
    return out(res, 200, { status: 'success', domains: list.slice(0, 12) });
  }

  if (step === 'new') {
    const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
    const domain = String(b.domain || '').trim();
    if (name.length < 3) return out(res, 400, { status: 'error', message: 'Nama minimal 3 karakter.' });
    if (!domain) return out(res, 400, { status: 'error', message: 'Domain kosong.' });

    const address = name + '@' + domain;
    const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const c = await mt('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
    if (!c.ok) return out(res, 409, { status: 'error', message: c.d['hydra:description'] || 'Alamat sudah dipakai, coba nama lain.' });

    const t = await mt('/token', { method: 'POST', body: JSON.stringify({ address, password }) });
    if (!t.ok || !t.d.token) return out(res, 502, { status: 'error', message: 'Gagal membuat sesi mailbox.' });
    return out(res, 200, { status: 'success', address, password, token: t.d.token, provider: 'mailtm' });
  }

  if (step === 'token') {
    const t = await mt('/token', { method: 'POST', body: JSON.stringify({ address: b.address, password: b.password }) });
    if (!t.ok || !t.d.token) return out(res, 401, { status: 'error', message: 'Sesi mailbox habis, buat alamat baru.' });
    return out(res, 200, { status: 'success', token: t.d.token });
  }

  if (step === 'list') {
    const r = await mt('/messages?page=1', {}, b.token);
    if (r.code === 401) return out(res, 401, { status: 'error', message: 'Sesi kedaluwarsa.' });
    const arr = (r.d['hydra:member'] || []).map(m => ({
      id: m.id, from: (m.from && m.from.address) || '?', subject: m.subject || '(tanpa subjek)', intro: m.intro || '', seen: !!m.seen, at: m.createdAt
    }));
    return out(res, 200, { status: 'success', messages: arr });
  }

  if (step === 'read') {
    const r = await mt('/messages/' + encodeURIComponent(String(b.id || '')), {}, b.token);
    if (!r.ok) return out(res, 404, { status: 'error', message: 'Pesan tidak ditemukan.' });
    await mt('/messages/' + encodeURIComponent(String(b.id)), { method: 'PATCH', body: JSON.stringify({ seen: true }) }, b.token).catch(() => {});
    const m = r.d;
    return out(res, 200, {
      status: 'success',
      subject: m.subject || '(tanpa subjek)',
      from: (m.from && m.from.address) || '?',
      at: m.createdAt,
      html: Array.isArray(m.html) ? m.html.join('\n') : '',
      text: m.text || ''
    });
  }

  if (step === 'del') {
    await mt('/messages/' + encodeURIComponent(String(b.id || '')), { method: 'DELETE' }, b.token).catch(() => {});
    return out(res, 200, { status: 'success' });
  }

  if (step === 'onesec') {
    const login = String(b.name || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
    const domain = String(b.domain || '1secmail.com');
    const list = await tf(ONESEC + '?action=getMessages&login=' + login + '&domain=' + domain, {}, 9000);
    const arr = await list.json().catch(() => []);
    const msgs = (Array.isArray(arr) ? arr : []).map(m => ({
      id: m.id, from: m.from, subject: m.subject, intro: '', seen: false, at: m.date
    }));
    return out(res, 200, { status: 'success', messages: msgs });
  }

  return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
}

/* ---------- router ---------- */
export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const act = String(req.query.action || '').toLowerCase();
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  if (!hit(ip, act)) return out(res, 429, { status: 'error', message: 'Kebanyakan request, tunggu 1 menit.' });

  try {
    if (act === 'exec') return await doExec(req, res);
    if (act === 'dl') return await doDl(req, res);
    if (act === 'net') return await doNet(req, res);
    if (act === 'mail') return await doMail(req, res);
    return out(res, 404, { status: 'error', message: 'action tidak dikenal.' });
  } catch (e) {
    return out(res, 500, { status: 'error', message: e.message || 'internal error' });
  }
             }
