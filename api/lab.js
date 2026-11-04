/**
 * AM PREMIUM · Lab API
 * v6.0.0 — scrapr edition
 *
 * Perubahan dari v5.x:
 *  - Downloader: rantai scraper multi-sumber (coflyn/scrapr) + modul resolver file host
 *  - Anime: scrapr anime (otakudesu, gogoanime, nimegami, animetosho)
 *  - Manga: scrapr comic (9 sumber) + mangadex/comick native
 *  - Temp mail: registry adapter, 17 provider, mode auto-probe
 *  - exec / net / proxy / router tetap
 */

import { createRequire } from 'node:module';

const PISTON = 'https://emkc.org/api/v2/piston/execute';
const ONESEC = 'https://www.1secmail.com/api/v1/';
const RL = new Map();
const CAPS = { exec: 24, dl: 24, resolve: 60, net: 40, mail: 80, img: 240, manga: 60, anime: 60, proxy: 600, health: 120 };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const LANG = {
  bash: 'bash', sh: 'bash', shell: 'bash',
  node: 'javascript', js: 'javascript', javascript: 'javascript',
  python: 'python', python3: 'python', py: 'python',
  php: 'php', go: 'go', c: 'c', cpp: 'c++', java: 'java', ruby: 'ruby', lua: 'lua'
};

/* ---------- scrapr loader ---------- */
let _lib = null;
function L() {
  if (_lib) return _lib;
  try {
    const req = createRequire(import.meta.url);
    _lib = req('@coflyn/scrapr');
  } catch {
    _lib = null;
  }
  return _lib;
}

function need() {
  const l = L();
  if (!l) throw new Error('Modul scraper belum terpasang (npm i @coflyn/scrapr).');
  return l;
}

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

async function getHtml(url, ref) {
  const h = { 'User-Agent': UA, 'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'id,en;q=0.8' };
  if (ref) h['Referer'] = ref;
  const r = await tf(url, { headers: h }, 11000);
  return { ok: r.ok, code: r.status, text: await r.text() };
}

const strip = s => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const abs = (base, u) => { try { return new URL(u, base).href; } catch { return u; } };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const imgProxy = (u, ref) => '/api/lab?action=img&url=' + encodeURIComponent(u) + (ref ? '&ref=' + encodeURIComponent(ref) : '');

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

/* ---------- proxy gambar ---------- */
async function doImg(req, res) {
  const url = String(req.query.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
  const ref = String(req.query.ref || '') || ('https://' + hostOf(url) + '/');
  const r = await tf(url, { headers: { 'User-Agent': UA, 'Referer': ref, 'Accept': 'image/*,*/*;q=0.8' } }, 12000);
  if (!r.ok) return out(res, 502, { status: 'error', message: 'HTTP ' + r.status });
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.status(200).end(buf);
}

/* ---------- PROXY / PEMBERSIH ---------- */
const HIDE_CSS = `
html,body{margin:0!important;padding:0!important;background:#000!important;color:#eee!important;overflow-x:hidden!important}
video,iframe,img{max-width:100%!important}
ins,.adsbygoogle,[id*="ad-"],[id*="ads"],[class*="ad-"],[class*="ads"],[class*="banner"],
div[style*="text-align:center"]>a>img,
#player-ads,.jw-ads,.video-ads,.preroll,.overlay-ad,.popup,.float-ad{display:none!important;visibility:hidden!important;height:0!important}
::-webkit-scrollbar{width:0!important}
`;

const AD_HOST = /(doubleclick|googlesyndication|googleadservices|adsterra|popads|propellerads|highperformanceformat|profitableratecpm|adcash|mgid|revcontent|taboola|outbrain|histats|googletagmanager|google-analytics|cloudflareinsights|onesignal|pushcrew|cleverpush)/i;

function pxify(u, base, ref) {
  return '/api/lab?action=proxy&url=' + encodeURIComponent(abs(base, u)) + '&ref=' + encodeURIComponent(ref);
}

function cleanHtml(html, pageUrl) {
  const base = new URL(pageUrl);
  const ref = base.origin + '/';
  let h = html;

  h = h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => (/<script\b[^>]*src=["']([^"']+)/i.test(m) && AD_HOST.test(m)) ? '' : m);
  h = h.replace(/<ins\b[\s\S]*?<\/ins>/gi, '');
  h = h.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, m => (AD_HOST.test(m) ? '' : m));

  h = h.replace(/(<iframe\b[^>]*?src=["'])([^"']+)(["'])/gi, (m, a, u, b) => a + pxify(u, pageUrl, ref) + b);
  h = h.replace(/(<(?:video|source|img|track)\b[^>]*?(?:src|data-src)=["'])([^"']+)(["'])/gi, (m, a, u, b) => a + abs(base.href, u) + b);
  h = h.replace(/\s(on\w+)=["'][^"']*["']/gi, '');

  const head = '<base href="' + base.href + '"><style>' + HIDE_CSS + '</style>';
  if (/<head[^>]*>/i.test(h)) h = h.replace(/<head[^>]*>/i, m => m + head);
  else h = head + h;
  return h;
}

async function doProxy(req, res) {
  const url = String(req.query.url || '').trim();
  const raw = req.query.raw === '1';
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });

  let ref = String(req.query.ref || '');
  if (!ref) { try { ref = new URL(url).origin + '/'; } catch { ref = ''; } }

  const r = await tf(url, { headers: { 'User-Agent': UA, 'Referer': ref, 'Accept': '*/*' } }, 14000);
  if (!r.ok) return out(res, 502, { status: 'error', message: 'HTTP ' + r.status });

  const ct = r.headers.get('content-type') || '';
  const isList = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(url);
  const isHtml = /text\/html/i.test(ct);

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (isList) {
    const text = await r.text();
    const base = new URL(url);
    const px = u => pxify(u, base.href, base.origin + '/');
    const body = text.split('\n').map(line => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (m, u) => 'URI="' + px(u) + '"');
      return px(t);
    }).join('\n');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.status(200).end(body);
  }

  if (isHtml && !raw) {
    const text = await r.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).end(cleanHtml(text, url));
  }

  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', ct || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.status(200).end(buf);
}

/* ---------- DOWNLOADER ---------- */
function cobaltBases() {
  const env = (process.env.COBALT_API || '').split(',').map(s => s.trim()).filter(Boolean);
  return env.length ? env : ['https://api.cobalt.tools', 'https://co.wuk.sh'];
}

async function cobalt(url, fmt) {
  const key = process.env.COBALT_KEY;
  const errs = [];
  for (const base of cobaltBases()) {
    try {
      const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      if (key) h['Authorization'] = 'Api-Key ' + key;
      const r = await tf(base.replace(/\/+$/, '') + '/', {
        method: 'POST', headers: h,
        body: JSON.stringify({ url, videoQuality: '1080', audioBitrate: '320', downloadMode: fmt === 'mp3' ? 'audio' : 'auto' })
      }, 8000);
      if (!r.ok) throw new Error('http ' + r.status);
      const d = await r.json();
      if (d.status === 'error') throw new Error((d.error && d.error.code) || 'error');
      if (d.status === 'picker' && Array.isArray(d.picker))
        return d.picker.map(p => ({ url: p.url, label: p.type || 'media', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'cobalt' }));
      if (d.url) return [{ url: d.url, label: d.filename || 'media', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'cobalt' }];
      throw new Error('kosong');
    } catch (e) { errs.push(e.message); }
  }
  throw new Error('cobalt: ' + errs.join(', '));
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

/* panggil satu scraper scrapr lalu normalisasi */
function pick(path) {
  const l = need();
  const [ns, fn] = path.split('.');
  const f = l[ns] && l[ns][fn];
  if (typeof f !== 'function') throw new Error(path + ' tidak tersedia');
  return f;
}

function norm(resp, provider, fmt) {
  if (!resp || resp.status !== true || !resp.result) return [];
  const r = resp.result;
  let list = [];
  if (Array.isArray(r.downloads)) list = r.downloads;
  else if (Array.isArray(r.items)) list = r.items;
  else if (r.url) list = [{ url: r.url }];

  const items = list.filter(d => d && d.url).map(d => ({
    url: d.url,
    label: d.quality || d.label || d.type || 'media',
    type: fmt === 'mp3' ? 'audio' : (/audio|mp3|m4a/i.test(String(d.type)) ? 'audio' : 'video'),
    provider,
    headers: d.headers || null
  }));

  if (fmt === 'mp3') items.sort((a, b) => (a.type === 'audio' ? -1 : 1) - (b.type === 'audio' ? -1 : 1));
  return items;
}

async function runChain(chain, url, fmt) {
  const errs = [];
  let meta = {};
  for (const path of chain) {
    try {
      const fn = pick(path);
      const r = await fn(url);
      const items = norm(r, path.split('.')[1], fmt);
      if (r && r.result) meta = { title: r.result.title || '', thumb: r.result.thumbnail || '' };
      if (items.length) return { items, meta };
      errs.push(path + ': kosong');
    } catch (e) { errs.push(path + ': ' + (e.message || 'gagal')); }
  }
  throw new Error(errs.join(' · '));
}

const DL_ROUTES = [
  { re: /tiktok\.com|douyin\.com|tt\.site/, chain: ['tiktok.snaptik', 'tiktok.tiktokio', 'tiktok.ssstik', 'tiktok.savetik', 'tiktok.tikdownloader'] },
  { re: /(^|\.)(x|twitter)\.com$/, chain: ['twitter.direct', 'twitter.tweeload', 'twitter.tvd', 'twitter.savetwt'] },
  { re: /instagram\.com/, chain: ['instagram.indown', 'instagram.snapsave', 'instagram.direct', 'instagram.snapinsta'] },
  { re: /facebook\.com|fb\.watch/, chain: ['facebook.snapsave', 'facebook.fdown'] },
  { re: /(^|\.)(youtube\.com|youtu\.be|music\.youtube\.com)$/, chain: ['youtube.ytmp3gg', 'youtube.ytmp3'] },
  { re: /spotify\.com|spoti\.fi/, chain: ['spotify.spotisaver', 'spotify.spotidown', 'spotify.spotmate', 'spotify.soundloaders'] },
  { re: /soundcloud\.com/, chain: ['soundcloud.klickaud'] },
  { re: /pinterest\.[a-z.]+|pin\.it/, chain: ['pinterest.direct', 'pinterest.pindown'] },
  { re: /threads\.(net|com)/, chain: ['threads.threadster'] },
  { re: /reddit\.com|redd\.it/, chain: ['reddit.rapidsave'] },
  { re: /bilibili\.com|b23\.tv/, chain: ['bilibili.direct'] },
  { re: /terabox\.(com|app)|1024tera/, chain: ['terabox.sechno'] },
  { re: /pixiv\.net/, chain: ['pixiv.ajax'] },
  { re: /xiaohongshu\.com|xhslink\.com/, chain: ['rednote.direct'] },
  { re: /music\.apple\.com/, chain: ['applemusic.aplmate'] },
  { re: /bandcamp\.com/, chain: ['bandcamp.direct', 'bandcamp.bandcampdownloader'] }
];

const RESOLVE_ROUTES = [
  { re: /mediafire\.com/, fn: 'mediafire' },
  { re: /sfile\.(mobi|co)/, fn: 'sfile' },
  { re: /pixeldrain\.com/, fn: 'pixeldrain' },
  { re: /catbox\.moe|litter\.catbox\.moe/, fn: 'catbox' },
  { re: /drive\.google\.com|docs\.google\.com/, fn: 'gdrive' },
  { re: /krakenfiles\.com/, fn: 'krakenfiles' },
  { re: /dood\.(to|so|watch|pm)|ds2play\.com|d000d\.com/, fn: 'doodstream' },
  { re: /sfl\.gl|safelinku\.com/, fn: 'safelinku' },
  { re: /sub2unlock\.(io|com)|sub4unlock/, fn: 'sub2unlock' },
  { re: /rekonise\.com/, fn: 'rekonise' }
];

const DIRECT_FILE = /\.(mp4|mp3|m4a|webm|mov|mkv|jpg|jpeg|png|webp|gif|zip|apk|pdf|rar)(\?|$)/i;

async function doDl(req, res) {
  const b = req.body || {};
  const url = String(b.url || req.query.url || '').trim();
  const fmt = String(b.format || 'mp4').toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
  const step = String(b.step || req.query.step || '').toLowerCase();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });

  const host = hostOf(url);

  // playlist YouTube
  if (step === 'playlist' || (/youtube\.com\/playlist/.test(url))) {
    try {
      const r = await pick('youtube.playlist')(url);
      if (!r.status) throw new Error(r.message || 'playlist gagal');
      return out(res, 200, { status: 'success', type: 'playlist', title: r.result.title || '', items: r.result.items || [] });
    } catch (e) { return out(res, 502, { status: 'error', message: e.message }); }
  }

  if (DIRECT_FILE.test(url))
    return out(res, 200, { status: 'success', host, items: [{ url, label: 'Direct link', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'direct' }] });

  const route = DL_ROUTES.find(r => r.re.test(host) || r.re.test(url));
  const errors = [];

  if (route) {
    try {
      const { items, meta } = await runChain(route.chain, url, fmt);
      if (items.length) return out(res, 200, { status: 'success', host, title: meta.title || '', thumb: meta.thumb || '', items });
    } catch (e) { errors.push(e.message); }
  }

  // file host / shortlink
  const rr = RESOLVE_ROUTES.find(r => r.re.test(url));
  if (rr) {
    try {
      const r = await pick('resolver.' + rr.fn)(url);
      if (!r.status) throw new Error(r.message || rr.fn + ' gagal');
      const fileUrl = r.result.url;
      return out(res, 200, {
        status: 'success', host, resolved: true,
        title: r.result.filename || r.result.title || '',
        items: [{ url: fileUrl, label: (r.result.filename || 'File') + (r.result.size ? ' · ' + r.result.size : ''), type: 'file', provider: rr.fn }]
      });
    } catch (e) { errors.push(rr.fn + ': ' + e.message); }
  }

  // generic: unshorten → cobalt → oceansaver
  try {
    const r = await pick('resolver.unshorten')(url);
    if (r.status && r.result && r.result.url && r.result.url !== url && DIRECT_FILE.test(r.result.url))
      return out(res, 200, { status: 'success', host, resolved: true, items: [{ url: r.result.url, label: 'Direct link', type: 'video', provider: 'unshorten' }] });
  } catch (e) { errors.push('unshorten: ' + e.message); }

  for (const fn of [() => cobalt(url, fmt), () => oceansaver(url, fmt)]) {
    try {
      const items = await fn();
      if (items.length) return out(res, 200, { status: 'success', host, items });
    } catch (e) { errors.push(e.message); }
  }

  return out(res, 502, {
    status: 'error',
    message: route ? 'Semua sumber untuk platform ini gagal. Coba lagi atau ganti link.' : 'Platform belum didukung.',
    detail: errors.join(' · ')
  });
}

/* ---------- RESOLVER MANDIRI ---------- */
async function doResolve(req, res) {
  const b = req.body || {};
  const url = String(b.url || req.query.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });

  const r = RESOLVE_ROUTES.find(x => x.re.test(url));
  const fns = r ? [r.fn] : ['unshorten'];

  const errs = [];
  for (const fn of fns) {
    try {
      const x = await pick('resolver.' + fn)(url);
      if (!x.status) throw new Error(x.message || 'gagal');
      return out(res, 200, {
        status: 'success', provider: fn,
        url: x.result.url, filename: x.result.filename || '', size: x.result.size || ''
      });
    } catch (e) { errs.push(fn + ': ' + e.message); }
  }
  return out(res, 502, { status: 'error', message: 'Resolver gagal.', detail: errs.join(' · ') });
}

/* ---------- net ---------- */
async function doNet(req, res) {
  const url = String(req.query.url || (req.body && req.body.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
  const r = await tf(url, { headers: { 'User-Agent': UA } }, 9000);
  const txt = (await r.text()).slice(0, 60000);
  return out(res, 200, { status: 'success', code: r.status, type: r.headers.get('content-type') || '', body: txt });
}

/* ---------- MANGA ---------- */
const MD = 'https://api.mangadex.org';

const COMIC_SOURCES = {
  komikindo: 'Komikindo',
  komiku: 'Komiku',
  kiryuu: 'Kiryuu',
  komikcast: 'KomikCast',
  asurascans: 'Asura Scans',
  bacakomik: 'BacaKomik',
  manhwaindo: 'ManhwaIndo',
  mangabats: 'MangaBats'
};

const MD_SOURCES = { mangadex: 'MangaDex', comick: 'Comick' };

async function mdJson(path) {
  const r = await tf(MD + path, { headers: { 'User-Agent': 'zukai-lab/1.0' } }, 9000);
  if (!r.ok) throw new Error('mangadex ' + r.status);
  return r.json();
}

const MD_Q = 'includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&hasAvailableChapters=true&limit=18';
const mdTitle = m => {
  const t = m.attributes && m.attributes.title;
  if (!t) return 'Tanpa judul';
  return t.en || t.id || Object.values(t)[0] || 'Tanpa judul';
};
function mdCover(m) {
  const rel = (m.relationships || []).find(r => r.type === 'cover_art');
  const f = rel && rel.attributes && rel.attributes.fileName;
  return f ? imgProxy('https://uploads.mangadex.org/covers/' + m.id + '/' + f + '.256.jpg', 'https://mangadex.org/') : '';
}
const mdMap = list => (list || []).map(m => ({ id: m.id, title: mdTitle(m), cover: mdCover(m), source: 'mangadex' }));

async function doManga(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const src = String(b.source || 'mangadex').toLowerCase();

  if (step === 'sources') {
    return out(res, 200, {
      status: 'success',
      items: [
        ...Object.entries(MD_SOURCES).map(([id, label]) => ({ id, label, api: true })),
        ...Object.entries(COMIC_SOURCES).map(([id, label]) => ({ id, label, api: false }))
      ]
    });
  }

  if (COMIC_SOURCES[src]) {
    try {
      const mod = need().comic[src];
      if (!mod) throw new Error('sumber tidak tersedia');

      if (step === 'search') {
        const q = String(b.q || '').trim();
        if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
        const r = await mod.search(q);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, {
          status: 'success', source: src,
          items: (r.result || []).map(x => ({ id: x.url, title: x.title, cover: imgProxy(x.thumbnail, 'https://' + src + '.org/'), source: src }))
        });
      }

      if (step === 'chapters') {
        const url = String(b.id || b.url || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL komik tidak valid.' });
        const r = await mod.getChapters(url);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, {
          status: 'success', source: src,
          items: (r.result || []).map((x, i) => ({ id: x.url, num: String(x.title || i + 1) }))
        });
      }

      if (step === 'pages') {
        const url = String(b.id || b.url || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL chapter tidak valid.' });
        const r = await mod.scrape(url);
        if (!r.status) throw new Error(r.message || 'gagal');
        const ref = new URL(url).origin + '/';
        const pages = (r.result.downloads || []).filter(d => d.url).map(d => imgProxy(d.url, ref));
        if (!pages.length) throw new Error('Halaman kosong.');
        return out(res, 200, { status: 'success', source: src, title: r.result.title || '', pages });
      }

      return out(res, 400, { status: 'error', message: 'step tidak dikenal untuk sumber ini.' });
    } catch (e) {
      return out(res, 502, { status: 'error', message: '[' + src + '] ' + e.message });
    }
  }

  // mangadex / comick native
  if (step === 'home') {
    const [a, c] = await Promise.allSettled([
      mdJson('/manga?order[followedCount]=desc&' + MD_Q),
      mdJson('/manga?order[latestUploadedChapter]=desc&' + MD_Q)
    ]);
    const trending = a.status === 'fulfilled' ? mdMap(a.value.data) : [];
    const latest = c.status === 'fulfilled' ? mdMap(c.value.data) : [];
    if (!trending.length && !latest.length) return out(res, 502, { status: 'error', message: 'MangaDex tidak merespons.' });
    return out(res, 200, { status: 'success', trending, latest });
  }

  if (step === 'genres') {
    const d = await mdJson('/manga/tag');
    const items = (d.data || [])
      .filter(t => t.attributes && t.attributes.group === 'genre')
      .map(t => ({ id: t.id, name: (t.attributes.name && (t.attributes.name.en || Object.values(t.attributes.name)[0])) || t.id }))
      .sort((x, y) => x.name.localeCompare(y.name));
    return out(res, 200, { status: 'success', items });
  }

  if (step === 'bygenre') {
    const tag = String(b.tag || '').trim();
    if (!tag) return out(res, 400, { status: 'error', message: 'Genre kosong.' });
    const d = await mdJson('/manga?includedTags[]=' + encodeURIComponent(tag) + '&order[followedCount]=desc&' + MD_Q);
    return out(res, 200, { status: 'success', items: mdMap(d.data) });
  }

  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });

    if (src === 'comick') {
      const r = await tf('https://api.comick.fun/v1.0/search?q=' + encodeURIComponent(q) + '&limit=24', { headers: { 'User-Agent': UA } }, 9000);
      if (!r.ok) return out(res, 502, { status: 'error', message: 'comick ' + r.status });
      const d = await r.json().catch(() => []);
      const items = (Array.isArray(d) ? d : []).map(m => ({
        id: m.hid || m.slug, title: m.title,
        cover: m.md_covers && m.md_covers[0] ? imgProxy('https://meo.comick.pictures/' + m.md_covers[0].b2key, 'https://comick.io/') : '',
        source: 'comick'
      }));
      return out(res, 200, { status: 'success', items });
    }

    const d = await mdJson('/manga?title=' + encodeURIComponent(q) + '&limit=24&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive');
    return out(res, 200, { status: 'success', items: mdMap(d.data) });
  }

  if (step === 'chapters') {
    const id = String(b.id || '').trim();
    if (!id) return out(res, 400, { status: 'error', message: 'ID kosong.' });
    const d = await mdJson('/manga/' + id + '/feed?translatedLanguage[]=en&order[chapter]=asc&limit=200&includeFutureUpdates=1');
    const items = (d.data || [])
      .map(c => ({ id: c.id, num: (c.attributes && c.attributes.chapter) || '?' }))
      .filter(c => c.num !== '?');
    return out(res, 200, { status: 'success', items });
  }

  if (step === 'pages') {
    const id = String(b.id || '').trim();
    if (!id) return out(res, 400, { status: 'error', message: 'ID kosong.' });

    if (src === 'comick') {
      const r = await tf('https://api.comick.fun/chapter/' + encodeURIComponent(id) + '?tachiyomi=true', { headers: { 'User-Agent': UA } }, 12000);
      const d = await r.json().catch(() => ({}));
      const imgs = ((d.chapter && d.chapter.images) || []).map(i => i.url).filter(Boolean);
      if (!imgs.length) return out(res, 502, { status: 'error', message: 'Halaman kosong.' });
      return out(res, 200, { status: 'success', pages: imgs.map(u => imgProxy(u, 'https://comick.io/')) });
    }

    const d = await mdJson('/at-home/server/' + encodeURIComponent(id));
    const base = d.baseUrl, hash = d.chapter && d.chapter.hash;
    const files = (d.chapter && d.chapter.data) || [];
    if (!base || !files.length) return out(res, 502, { status: 'error', message: 'Halaman tidak tersedia (mungkin butuh login).' });
    return out(res, 200, { status: 'success', pages: files.map(f => imgProxy(base + '/data/' + hash + '/' + f, 'https://mangadex.org/')) });
  }

  return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
}

/* ---------- ANIME ---------- */
const ANIME_SOURCES = {
  otakudesu: 'OtakuDesu',
  gogoanime: 'GogoAnime',
  nimegami: 'Nimegami',
  animetosho: 'AnimeTosho'
};

/* sumber lama, dipakai buat feed beranda / jadwal / genre */
const ANIME_FEED = {
  otakudesu: { doms: ['otakudesu.blog', 'otakudesu.io', 'otakudesu.cloud'], lists: ['/ongoing-anime/', '/anime-terbaru/'], rated: '/complete-anime/', schedule: '/jadwal-rilis/', genres: '/genre-list/' },
  samehadaku: { doms: ['samehadaku.li', 'samehadaku.care', 'samehadaku.email'], lists: ['/anime-terbaru/', '/ongoing-anime/'], rated: '/daftar-anime/', schedule: '/jadwal-rilis/', genres: '/genre/' },
  anoboy: { doms: ['anoboy.be', 'anoboy.biz', 'anoboy.ch', 'anoboy.li'], lists: ['/', '/anime-terbaru/'], rated: '/', schedule: '/', genres: '/' }
};

const HOST_CACHE = new Map();

async function pickHost(src) {
  const cfg = ANIME_FEED[src];
  if (!cfg) throw new Error('sumber tidak punya feed');

  const cached = HOST_CACHE.get(src);
  if (cached && Date.now() - cached.at < 600000) return cached.host;

  const hasil = await Promise.all(cfg.doms.map(async d => {
    try {
      const r = await tf('https://' + d + '/', { headers: { 'User-Agent': UA } }, 2500);
      return r.ok ? d : null;
    } catch { return null; }
  }));

  const host = hasil.find(Boolean);
  if (!host) throw new Error('semua domain ' + src + ' tidak merespons');

  HOST_CACHE.set(src, { host, at: Date.now() });
  return host;
}

const AN_RE = /<a[^>]+href="(https?:\/\/[^"]+?\/(?:anime|tv|movie|anime-terbaru)\/[^"'#?]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi;
const AN_EP = /<a[^>]+href="(https?:\/\/[^"]+?(?:\/episode\/|episode-\d|ep-\d)[^"'#?]*)"[^>]*>([\s\S]{0,160}?)<\/a>/gi;

function anItems(text, host, limit) {
  const seen = new Set(), items = [];
  let m;
  AN_RE.lastIndex = 0;
  while ((m = AN_RE.exec(text)) && items.length < limit) {
    const url = m[1];
    if (seen.has(url)) continue;
    const title = strip(m[2]);
    if (title.length < 3) continue;
    const win = text.slice(m.index, m.index + 800);
    const im = /<img[^>]+(?:data-src|src)="([^"]+)"/i.exec(win);
    seen.add(url);
    items.push({ id: url, url, title, cover: im ? imgProxy(im[1], 'https://' + host + '/') : '', host });
  }
  return items;
}

async function doAnime(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const src = String(b.source || 'otakudesu').toLowerCase();

  if (step === 'sources') {
    return out(res, 200, {
      status: 'success',
      items: [
        ...Object.entries(ANIME_SOURCES).map(([id, label]) => ({ id, label, stream: true })),
        ...Object.entries(ANIME_FEED).filter(([id]) => !ANIME_SOURCES[id]).map(([id, v]) => ({ id, label: id[0].toUpperCase() + id.slice(1), stream: false }))
      ]
    });
  }

  /* pencarian + episode + stream lewat scrapr */
  if (ANIME_SOURCES[src]) {
    try {
      const mod = need().anime[src];
      if (!mod) throw new Error('sumber tidak tersedia');

      if (step === 'search') {
        const q = String(b.q || '').trim();
        if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
        const r = await mod.search(q);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, {
          status: 'success', source: src,
          items: (r.result || []).map(x => ({
            id: x.url, url: x.url, title: x.title, meta: x.meta || '',
            cover: x.thumbnail ? imgProxy(x.thumbnail, 'https://' + hostOf(x.url) + '/') : '', source: src
          }))
        });
      }

      if (step === 'detail' || step === 'episodes') {
        const url = String(b.url || b.id || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL anime tidak valid.' });
        if (!mod.getEpisodes) throw new Error('sumber ini tidak punya daftar episode');
        const r = await mod.getEpisodes(url);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, {
          status: 'success', source: src, synopsis: '',
          items: (r.result || []).map((x, i) => ({ id: x.url, url: x.url, title: x.title || 'Episode ' + (i + 1) })).reverse()
        });
      }

      if (step === 'episode' || step === 'stream') {
        const url = String(b.url || b.id || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL episode tidak valid.' });
        const r = await mod.scrape(url);
        if (!r.status) throw new Error(r.message || 'gagal');
        const servers = (r.result.downloads || []).filter(d => d.url).map(d => ({
          url: d.url,
          label: d.quality || d.type || 'server',
          type: d.type === 'video' ? 'video' : 'link',
          m3u8: /\.m3u8/i.test(d.url),
          player: /\.m3u8/i.test(d.url) ? '/api/lab?action=proxy&url=' + encodeURIComponent(d.url) : null,
          headers: d.headers || null
        }));
        if (!servers.length) throw new Error('Tidak ada server di episode ini.');
        return out(res, 200, { status: 'success', source: src, title: r.result.title || '', servers });
      }

      if (step === 'home') {
        // feed tidak tersedia di scrapr, pinjam keyword musiman
        const r = await mod.search(String(b.q || 'a'));
        const items = r.status ? (r.result || []).map(x => ({ id: x.url, url: x.url, title: x.title, cover: x.thumbnail || '' })) : [];
        return out(res, 200, { status: 'success', trending: items, latest: [], rated: [] });
      }

      return out(res, 400, { status: 'error', message: 'step tidak dikenal untuk sumber ini.' });
    } catch (e) {
      return out(res, 502, { status: 'error', message: '[' + src + '] ' + e.message });
    }
  }

  /* feed lama: beranda, jadwal, genre */
  const cfg = ANIME_FEED[src];
  if (!cfg) return out(res, 400, { status: 'error', message: 'sumber tidak dikenal' });

  try {
    const dom = await pickHost(src);
    const base = 'https://' + dom;

    if (step === 'home') {
      const [a, c] = await Promise.allSettled([getHtml(base + cfg.lists[0], base), getHtml(base + cfg.lists[1], base)]);
      const trending = a.status === 'fulfilled' && a.value.ok ? anItems(a.value.text, dom, 14) : [];
      const latest = c.status === 'fulfilled' && c.value.ok ? anItems(c.value.text, dom, 14) : [];
      let rated = [];
      if (cfg.rated && cfg.rated !== cfg.lists[0]) {
        const r = await getHtml(base + cfg.rated, base).catch(() => null);
        if (r && r.ok) rated = anItems(r.text, dom, 14);
      }
      if (!trending.length && !latest.length && !rated.length) throw new Error('Sumber tidak bisa dibaca.');
      return out(res, 200, { status: 'success', trending, latest, rated, host: dom });
    }

    if (step === 'schedule') {
      const r = await getHtml(base + cfg.schedule, base);
      if (!r.ok) throw new Error('Jadwal gagal (' + r.code + ').');
      const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const chunks = r.text.split(/Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu/i);
      const sections = [];
      for (let i = 1; i < chunks.length; i++) {
        const items = anItems(chunks[i], dom, 20);
        if (items.length) sections.push({ day: days[i - 1] || 'Lainnya', items });
      }
      if (!sections.length) sections.push({ day: 'Semua', items: anItems(r.text, dom, 24) });
      return out(res, 200, { status: 'success', sections, host: dom });
    }

    if (step === 'genres') {
      const r = await getHtml(base + cfg.genres, base);
      if (!r.ok) throw new Error('Genre gagal (' + r.code + ').');
      const seen = new Set(), items = [];
      const re = /<a[^>]+href="(https?:\/\/[^"]+?\/genre\/[^"'#]+)"[^>]*>([\s\S]{0,80}?)<\/a>/gi;
      let m;
      while ((m = re.exec(r.text)) && items.length < 40) {
        const name = strip(m[2]);
        if (!name || seen.has(m[1])) continue;
        seen.add(m[1]);
        items.push({ id: m[1], url: m[1], name, host: dom });
      }
      return out(res, 200, { status: 'success', items, host: dom });
    }

    if (step === 'bygenre' || step === 'list') {
      const url = String(b.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
      const r = await getHtml(url, base);
      if (!r.ok) throw new Error('Gagal membuka genre (' + r.code + ').');
      return out(res, 200, { status: 'success', items: anItems(r.text, dom, 30), host: dom });
    }

    if (step === 'search') {
      const q = String(b.q || '').trim();
      if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
      const r = await getHtml(base + '/?s=' + encodeURIComponent(q), base);
      if (!r.ok) throw new Error('Pencarian gagal (' + r.code + ').');
      return out(res, 200, { status: 'success', items: anItems(r.text, dom, 24), host: dom });
    }
    
    if (step === 'detail' || step === 'episodes') {
      const url = String(b.url || b.id || '').trim();
      if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL anime tidak valid.' });
      const r = await getHtml(url, base);
      if (!r.ok) throw new Error('Detail gagal (' + r.code + ').');
      const seen = new Set(), items = [];
      let m;
      AN_EP.lastIndex = 0;
      while ((m = AN_EP.exec(r.text)) && items.length < 400) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        items.push({ id: m[1], url: m[1], title: strip(m[2]) || 'Episode' });
      }
      items.reverse();
      const syn = /<div[^>]+class="[^"]*(?:sinopsis|desc|entry-content)[^"]*"[^>]*>([\s\S]{0,900}?)<\/div>/i.exec(r.text);
      return out(res, 200, { status: 'success', items, synopsis: syn ? strip(syn[1]).slice(0, 500) : '', host: dom });
    }

    if (step === 'episode' || step === 'stream') {
      const url = String(b.url || b.id || '').trim();
      if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL episode tidak valid.' });
      const r = await getHtml(url, base);
      if (!r.ok) throw new Error('Episode gagal (' + r.code + ').');
      const found = [], seen = new Set();
      const re = /<(?:iframe|source)[^>]+(?:data-src|src)="([^"]+)"/gi;
      let m;
      while ((m = re.exec(r.text))) {
        const u = m[1];
        if (!/^https?:\/\//i.test(u) || seen.has(u)) continue;
        seen.add(u);
        found.push({ url: u, label: 'Server', type: 'link', m3u8: /\.m3u8/i.test(u), player: /\.m3u8/i.test(u) ? '/api/lab?action=proxy&url=' + encodeURIComponent(u) : null });
      }
      const raw = r.text.replace(/\\\//g, '/');
      const mp = /https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*/gi;
      while ((m = mp.exec(raw))) {
        if (!seen.has(m[0])) { seen.add(m[0]); found.unshift({ url: m[0], label: 'HLS', type: 'video', m3u8: true, player: '/api/lab?action=proxy&url=' + encodeURIComponent(m[0]) }); }
      }
      if (!found.length) throw new Error('Tidak ada server di episode ini.');
      return out(res, 200, { status: 'success', servers: found.slice(0, 12), host: dom });
                                 }

    return out(res, 400, { status: 'error', message: 'step tidak dikenal untuk sumber ini.' });
  } catch (e) {
    return out(res, 502, { status: 'error', message: '[' + src + '] ' + e.message });
  }
}

/* ---------- TEMP MAIL ---------- */
/* adapter generik: { label, domains(), create(), list(), read(), del() } */

async function jj(method, url, body, headers, ms = 9000) {
  const h = { 'Accept': 'application/json', ...(headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await tf(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }, ms);
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, code: r.status, d };
}

async function txt(url, headers, ms = 9000) {
  const r = await tf(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*;q=0.8', ...(headers || {}) } }, ms);
  return { ok: r.ok, code: r.status, t: await r.text() };
}

const MT_BASE = { mailtm: 'https://api.mail.tm', mailgw: 'https://api.mail.gw' };

function mtAdapter(prov) {
  const base = MT_BASE[prov];
  return {
    label: prov === 'mailtm' ? 'mail.tm' : 'mail.gw',
    async domains() {
      const r = await jj('GET', base + '/domains?page=1');
      return ((r.d && r.d['hydra:member']) || []).filter(x => !x.isPrivate && x.isActive !== false).map(x => x.domain).slice(0, 12);
    },
    async create({ address }) {
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const c = await jj('POST', base + '/accounts', { address, password });
      if (!c.ok) throw new Error(c.d['hydra:description'] || 'Alamat sudah dipakai, coba nama lain.');
      const t = await jj('POST', base + '/token', { address, password });
      if (!t.ok || !t.d.token) throw new Error('Gagal membuat sesi mailbox.');
      return { address, token: t.d.token, extra: password };
    },
    async list(ctx) {
      const r = await jj('GET', base + '/messages?page=1', undefined, { Authorization: 'Bearer ' + ctx.token });
      if (r.code === 401) throw new Error('Sesi kedaluwarsa.');
      return (r.d['hydra:member'] || []).map(m => ({ id: m.id, from: (m.from && m.from.address) || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.seen, at: m.createdAt }));
    },
    async read(ctx, id) {
      const r = await jj('GET', base + '/messages/' + encodeURIComponent(id), undefined, { Authorization: 'Bearer ' + ctx.token });
      if (!r.ok) throw new Error('Pesan tidak ditemukan.');
      jj('PATCH', base + '/messages/' + encodeURIComponent(id), { seen: true }, { Authorization: 'Bearer ' + ctx.token }).catch(() => {});
      const m = r.d;
      return { subject: m.subject || '(tanpa subjek)', from: (m.from && m.from.address) || '?', at: m.createdAt, html: Array.isArray(m.html) ? m.html.join('\n') : '', text: m.text || '' };
    },
    async del(ctx, id) {
      await jj('DELETE', base + '/messages/' + encodeURIComponent(id), undefined, { Authorization: 'Bearer ' + ctx.token });
    }
  };
}

async function gm(f, extra = '') {
  const r = await tf('https://api.guerrillamail.com/ajax.php?f=' + f + '&agent=zukai-lab' + extra, {}, 9000);
  return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) };
}

const MAIL = {
  mailtm: mtAdapter('mailtm'),
  mailgw: mtAdapter('mailgw'),

  plus: {
    label: 'tempmail.plus',
    async domains() { return ['rover.info', 'fexpost.com', 'mailto.plus', 'fextemp.com', 'fexbox.org', 'fexbox.ru', 'mailbox.in.ua', 'chitthi.in', 'any.pink', 'merepost.com', 'tofeat.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://tempmail.plus/api/mails?email=' + encodeURIComponent(ctx.address) + '&epin=&first_id=0');
      return ((r.d && r.d.mail_list) || []).map(m => ({ id: String(m.id), from: m.from_mail || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.seen, at: m.time || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://tempmail.plus/api/mails/' + encodeURIComponent(id) + '?email=' + encodeURIComponent(ctx.address) + '&epin=');
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from_mail || '?', at: m.time || '', html: m.html || '', text: m.text || '' };
    },
    async del() {}
  },

  guerrilla: {
    label: 'Guerrilla Mail',
    async domains() { return ['guerrillamail.com', 'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me']; },
    async create({ name }) {
      const s = await gm('get_email_address');
      if (!s.ok || !s.d.sid_token) throw new Error('Guerrilla menolak sesi baru.');
      const u = await gm('set_email_user', '&email_user=' + encodeURIComponent(name) + '&sid_token=' + s.d.sid_token);
      const addr = (u.d && u.d.email_addr) || s.d.email_addr;
      return { address: addr, extra: s.d.sid_token };
    },
    async list(ctx) {
      const r = await gm('get_email_list', '&offset=0&sid_token=' + encodeURIComponent(String(ctx.extra || '')));
      return ((r.d && r.d.list) || []).map(m => ({ id: String(m.mail_id), from: m.mail_from, subject: m.mail_subject || '(tanpa subjek)', seen: false, at: new Date((m.mail_timestamp || 0) * 1000).toISOString() }));
    },
    async read(ctx, id) {
      const r = await gm('fetch_email', '&email_id=' + encodeURIComponent(id) + '&sid_token=' + encodeURIComponent(String(ctx.extra || '')));
      if (!r.ok) throw new Error('Pesan tidak ditemukan.');
      return { subject: r.d.mail_subject || '(tanpa subjek)', from: r.d.mail_from || '?', at: '', html: r.d.mail_body || '', text: '' };
    },
    async del(ctx, id) { await gm('del_email', '&email_ids[]=' + encodeURIComponent(id) + '&sid_token=' + encodeURIComponent(String(ctx.extra || ''))); }
  },

  maildrop: {
    label: 'maildrop.cc',
    async domains() { return ['maildrop.cc']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('POST', 'https://api.maildrop.cc/graphql', {
        query: 'query($m:String!){inbox(mailbox:$m){id headerfrom subject date}}',
        variables: { m: ctx.name }
      });
      return ((r.d && r.d.data && r.d.data.inbox) || []).map(m => ({ id: m.id, from: m.headerfrom, subject: m.subject || '(tanpa subjek)', seen: false, at: m.date }));
    },
    async read(ctx, id) {
      const r = await jj('POST', 'https://api.maildrop.cc/graphql', {
        query: 'query($m:String!,$i:String!){message(mailbox:$m,id:$i){subject headerfrom html data}}',
        variables: { m: ctx.name, i: id }
      });
      const m = (r.d && r.d.data && r.d.data.message) || null;
      if (!m) throw new Error('Pesan tidak ditemukan.');
      return { subject: m.subject || '(tanpa subjek)', from: m.headerfrom || '?', at: '', html: m.html || '', text: m.data || '' };
    },
    async del() {}
  },

  onesec: {
    label: '1secmail',
    async domains() { return ['1secmail.com', '1secmail.net', '1secmail.org', 'wwjmp.com', 'esiix.com', 'xojxe.com', 'yoggm.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', ONESEC + '?action=getMessages&login=' + encodeURIComponent(ctx.name) + '&domain=' + encodeURIComponent(ctx.domain));
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: String(m.id), from: m.from, subject: m.subject || '(tanpa subjek)', seen: false, at: m.date }));
    },
    async read(ctx, id) {
      const r = await jj('GET', ONESEC + '?action=readMessage&login=' + encodeURIComponent(ctx.name) + '&domain=' + encodeURIComponent(ctx.domain) + '&id=' + encodeURIComponent(id));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.htmlBody || '', text: m.textBody || '' };
    },
    async del() {}
  },

  tempmailio: {
    label: 'temp-mail.io',
    async domains() {
      const r = await jj('GET', 'https://api.temp-mail.io/api/v3/domains');
      const list = Array.isArray(r.d) ? r.d.map(x => (typeof x === 'string' ? x : x.name || x.domain)).filter(Boolean) : [];
      return list.length ? list.slice(0, 12) : ['temp-mail.io', 'mjj.pw', 'dev-temp-mail.com'];
    },
    async create({ domain }) {
      const r = await jj('POST', 'https://api.temp-mail.io/api/v3/email/new', { domain: domain || 'temp-mail.io' });
      if (!r.ok || !r.d.email) throw new Error('temp-mail.io menolak permintaan.');
      return { address: r.d.email, token: r.d.token };
    },
    async list(ctx) {
      const r = await jj('GET', 'https://api.temp-mail.io/api/v3/email/' + encodeURIComponent(ctx.address) + '/messages', undefined, { 'X-Api-Token': String(ctx.token || '') });
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.created_at || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://api.temp-mail.io/api/v3/email/' + encodeURIComponent(ctx.address) + '/messages', undefined, { 'X-Api-Token': String(ctx.token || '') });
      const m = (Array.isArray(r.d) ? r.d : []).find(x => String(x.id) === String(id)) || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.created_at || '', html: m.body_html || '', text: m.body_text || '' };
    },
    async del(ctx, id) {
      await jj('DELETE', 'https://api.temp-mail.io/api/v3/email/' + encodeURIComponent(ctx.address) + '/messages/' + encodeURIComponent(id), undefined, { 'X-Api-Token': String(ctx.token || '') });
    }
  },

  tmplol: {
    label: 'tempmail.lol',
    async domains() { return ['tempmail.lol', 'scryptmail.com', 'mailiverse.com']; },
    async create({ domain }) {
      const r = await jj('POST', 'https://api.tempmail.lol/v2/inbox/create', { domain: domain || undefined });
      if (!r.ok || !r.d.address) throw new Error('tempmail.lol menolak permintaan.');
      return { address: r.d.address, token: r.d.token };
    },
    async list(ctx) {
      const r = await jj('GET', 'https://api.tempmail.lol/v2/inbox?token=' + encodeURIComponent(String(ctx.token || '')));
      return (Array.isArray(r.d.emails) ? r.d.emails : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://api.tempmail.lol/v2/inbox?token=' + encodeURIComponent(String(ctx.token || '')));
      const m = (Array.isArray(r.d.emails) ? r.d.emails : []).find(x => String(x.id) === String(id)) || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || '', text: m.body || '' };
    },
    async del() {}
  },

  dropmail: {
    label: 'dropmail.me',
    async domains() { return ['dropmail.me', '10mail.org', 'emlhub.com', 'emlpro.com', 'emltmp.com']; },
    async create() {
      const q = 'mutation{introduceSession{id,addresses{address}}}';
      const r = await jj('POST', 'https://dropmail.me/api/graphql/ZUKAI-LAB', { query: q });
      const s = r.d && r.d.data && r.d.data.introduceSession;
      if (!s || !s.addresses || !s.addresses[0]) throw new Error('dropmail menolak permintaan.');
      return { address: s.addresses[0].address, extra: s.id };
    },
    async list(ctx) {
      const q = 'query($id:ID!){session(id:$id){mails{id,fromAddr,headerSubject,downloadUrl}}}';
      const r = await jj('POST', 'https://dropmail.me/api/graphql/ZUKAI-LAB', { query: q, variables: { id: ctx.extra } });
      const mails = (r.d && r.d.data && r.d.data.session && r.d.data.session.mails) || [];
      return mails.map(m => ({ id: m.id, from: m.fromAddr || '?', subject: m.headerSubject || '(tanpa subjek)', seen: false, at: '' }));
    },
    async read(ctx, id) {
      const q = 'query($id:ID!){session(id:$id){mails{id,fromAddr,headerSubject,rawSize,downloadUrl}}}';
      const r = await jj('POST', 'https://dropmail.me/api/graphql/ZUKAI-LAB', { query: q, variables: { id: ctx.extra } });
      const mails = (r.d && r.d.data && r.d.data.session && r.d.data.session.mails) || [];
      const m = mails.find(x => String(x.id) === String(id));
      if (!m) throw new Error('Pesan tidak ditemukan.');
      let html = '', text = '';
      if (m.downloadUrl) {
        const raw = await txt(m.downloadUrl);
        const body = raw.t.split(/\r?\n\r?\n/).slice(1).join('\n\n');
        if (/<[a-z][\s\S]*>/i.test(body)) html = body; else text = body;
      }
      return { subject: m.headerSubject || '(tanpa subjek)', from: m.fromAddr || '?', at: '', html, text };
    },
    async del() {}
  },

  inboxes: {
    label: 'inboxes.com',
    async domains() { return ['inboxes.com']; },
    async create() {
      const r = await jj('POST', 'https://inboxes.com/api/v2/inbox');
      if (!r.ok || !r.d.inbox) throw new Error('inboxes.com menolak permintaan.');
      return { address: r.d.inbox + '@inboxes.com', extra: r.d.inbox };
    },
    async list(ctx) {
      const r = await jj('GET', 'https://inboxes.com/api/v2/inbox/' + encodeURIComponent(ctx.extra));
      return ((r.d && r.d.messages) || []).map(m => ({ id: m.uid, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.created || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://inboxes.com/api/v2/message/' + encodeURIComponent(id));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.created || '', html: m.html || '', text: m.text || '' };
    },
    async del(ctx, id) { await jj('DELETE', 'https://inboxes.com/api/v2/message/' + encodeURIComponent(id)); }
  },

  mailnesia: {
    label: 'mailnesia',
    async domains() { return ['mailnesia.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await txt('https://mailnesia.com/mailbox/' + encodeURIComponent(ctx.name));
      const items = [];
      const re = /href="\/mailbox\/[^/]+\/([^"]+)"[^>]*>([^<]{0,120})/gi;
      let m;
      while ((m = re.exec(r.t)) && items.length < 40) items.push({ id: m[1], from: '?', subject: strip(m[2]) || '(tanpa subjek)', seen: false, at: '' });
      return items;
    },
    async read(ctx, id) {
      const r = await txt('https://mailnesia.com/mailbox/' + encodeURIComponent(ctx.name) + '/' + encodeURIComponent(id));
      const ttl = /<title[^>]*>([^<]+)</i.exec(r.t);
      return { subject: ttl ? strip(ttl[1]) : '(tanpa subjek)', from: '?', at: '', html: r.t, text: '' };
    },
    async del() {}
  },

  harakirimail: {
    label: 'harakirimail',
    async domains() { return ['harakirimail.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://harakirimail.com/api/v1/inbox/' + encodeURIComponent(ctx.name));
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://harakirimail.com/api/v1/message/' + encodeURIComponent(id));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || '', text: m.text || '' };
    },
    async del() {}
  },

  dispostable: {
    label: 'dispostable',
    async domains() { return ['dispostable.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await txt('https://www.dispostable.com/inbox/' + encodeURIComponent(ctx.name));
      const items = [];
      const re = /href="\/inbox\/[^/]+\/([^"]+)"[^>]*>([\s\S]{0,160}?)<\/a>/gi;
      let m;
      while ((m = re.exec(r.t)) && items.length < 40) items.push({ id: m[1], from: '?', subject: strip(m[2]) || '(tanpa subjek)', seen: false, at: '' });
      return items;
    },
    async read(ctx, id) {
      const r = await txt('https://www.dispostable.com/inbox/' + encodeURIComponent(ctx.name) + '/' + encodeURIComponent(id));
      const ttl = /<title[^>]*>([^<]+)</i.exec(r.t);
      return { subject: ttl ? strip(ttl[1]) : '(tanpa subjek)', from: '?', at: '', html: r.t, text: '' };
    },
    async del() {}
  },

  yopmail: {
    label: 'YOPmail',
    async domains() { return ['yopmail.com', 'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://yopmail.com/api/inbox?login=' + encodeURIComponent(ctx.name) + '&env=inbox', { }, { Referer: 'https://yopmail.com/' });
      const arr = Array.isArray(r.d) ? r.d : (r.d && r.d.inbox) || [];
      if (Array.isArray(arr) && arr.length) return arr.map((m, i) => ({ id: String(m.id || i), from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
      const h = await txt('https://yopmail.com/mail?login=' + encodeURIComponent(ctx.name), { Referer: 'https://yopmail.com/' });
      const items = [];
      const re = /data-id="(\d+)"[\s\S]{0,200}?class="[^"]*?subj[^"]*"[^>]*>([^<]{0,120})/gi;
      let m;
      while ((m = re.exec(h.t)) && items.length < 30) items.push({ id: m[1], from: '?', subject: strip(m[2]) || '(tanpa subjek)', seen: false, at: '' });
      return items;
    },
    async read(ctx, id) {
      const r = await txt('https://yopmail.com/mail?login=' + encodeURIComponent(ctx.name) + '&id=' + encodeURIComponent(id), { Referer: 'https://yopmail.com/' });
      const ttl = /<title[^>]*>([^<]+)</i.exec(r.t);
      return { subject: ttl ? strip(ttl[1]) : '(tanpa subjek)', from: '?', at: '', html: r.t, text: '' };
    },
    async del() {}
  },

  smailpro: {
    label: 'smailpro',
    async domains() { return ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'smailpro.com']; },
    async create() {
      const r = await jj('POST', 'https://smailpro.com/app/temp-email', {});
      if (!r.ok || !r.d.address) throw new Error('smailpro menolak permintaan.');
      return { address: r.d.address, extra: r.d.address };
    },
    async list(ctx) {
      const r = await jj('POST', 'https://smailpro.com/app/email/' + encodeURIComponent(ctx.address), {});
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('POST', 'https://smailpro.com/app/message/' + encodeURIComponent(ctx.address) + '/' + encodeURIComponent(id), {});
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || '', text: m.text || '' };
    },
    async del() {}
  },

  mailsac: {
    label: 'Mailsac',
    async domains() { return ['mailsac.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://mailsac.com/api/addresses/' + encodeURIComponent(ctx.address) + '/messages', undefined, { 'Mailsac-Key': process.env.MAILSAC_KEY || '' });
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m._id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.read, at: m.received || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://mailsac.com/api/text/' + encodeURIComponent(ctx.address) + '/' + encodeURIComponent(id), undefined, { 'Mailsac-Key': process.env.MAILSAC_KEY || '' });
      return { subject: '(tanpa subjek)', from: '?', at: '', html: '', text: typeof r.d === 'string' ? r.d : JSON.stringify(r.d) };
    },
    async del(ctx, id) {
      await jj('DELETE', 'https://mailsac.com/api/addresses/' + encodeURIComponent(ctx.address) + '/messages/' + encodeURIComponent(id), undefined, { 'Mailsac-Key': process.env.MAILSAC_KEY || '' });
    }
  },

  moakt: {
    label: 'moakt',
    async domains() { return ['moakt.com', 'tempinbox.xyz', 'aboodman.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://www.moakt.com/api/inbox?email=' + encodeURIComponent(ctx.address));
      const arr = Array.isArray(r.d) ? r.d : (r.d && r.d.messages) || [];
      return arr.map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://www.moakt.com/api/message?id=' + encodeURIComponent(id) + '&email=' + encodeURIComponent(ctx.address));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || m.body || '', text: m.text || '' };
    },
    async del() {}
  }
};

const MAIL_ORDER = ['mailtm', 'mailgw', 'tempmailio', 'tmplol', 'dropmail', 'inboxes', 'plus', 'guerrilla', 'maildrop', 'onesec', 'mailnesia', 'harakirimail', 'dispostable', 'yopmail', 'smailpro', 'mailsac', 'moakt'];

async function resolveProvider(name) {
  if (name && name !== 'auto') {
    if (!MAIL[name]) throw new Error('Provider tidak dikenal.');
    return name;
  }
  const errs = [];
  for (const id of MAIL_ORDER) {
    try {
      const d = await MAIL[id].domains();
      if (d && d.length) return id;
    } catch (e) { errs.push(id); }
  }
  throw new Error('Tidak ada provider yang hidup saat ini.');
}

async function doMail(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  let prov = String(b.provider || req.query.provider || 'auto').toLowerCase();

  if (step === 'sources') {
    return out(res, 200, {
      status: 'success',
      items: MAIL_ORDER.map(id => ({ id, label: MAIL[id].label }))
    });
  }

  try {
    if (step === 'domains') {
      if (prov === 'auto') {
        const all = [];
        for (const id of MAIL_ORDER) {
          try {
            const d = await MAIL[id].domains();
            d.slice(0, 4).forEach(domain => all.push({ domain, provider: id }));
            if (all.length >= 24) break;
          } catch {}
        }
        if (!all.length) return out(res, 502, { status: 'error', message: 'Semua provider sedang mati. Coba lagi.' });
        return out(res, 200, { status: 'success', domains: all.map(x => x.domain), map: all });
      }
      const d = await MAIL[prov].domains();
      if (!d.length) return out(res, 502, { status: 'error', message: 'Domain tidak tersedia di provider ini.' });
      return out(res, 200, { status: 'success', domains: d });
    }

    if (step === 'new') {
      const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
      const domain = String(b.domain || '').trim();
      if (name.length < 3) return out(res, 400, { status: 'error', message: 'Nama minimal 3 karakter.' });

      const picked = await resolveProvider(prov);
      prov = picked;
      const ctxIn = { name, domain, address: name + '@' + domain };

      let made;
      if (domain || MAIL[prov].label !== 'smailpro') made = await MAIL[prov].create(ctxIn);
      else made = await MAIL[prov].create(ctxIn);

      const address = made.address || ctxIn.address;
      const parts = address.split('@');
      return out(res, 200, {
        status: 'success', provider: prov,
        address, name: parts[0], domain: parts[1],
        token: made.token || '', sid: made.extra || '', password: made.extra && prov.startsWith('mail') ? made.extra : ''
      });
    }

    if (!prov || prov === 'auto') prov = await resolveProvider('auto');
    const adapter = MAIL[prov];
    if (!adapter) return out(res, 400, { status: 'error', message: 'Provider tidak dikenal.' });

    const address = String(b.address || '');
    const parts = address.split('@');
    const ctx = { address, name: String(b.name || parts[0] || ''), domain: String(b.domain || parts[1] || ''), token: String(b.token || ''), extra: String(b.sid || b.password || b.extra || '') };

    if (step === 'list') {
      const messages = await adapter.list(ctx);
      return out(res, 200, { status: 'success', provider: prov, messages });
    }

    if (step === 'read') {
      const m = await adapter.read(ctx, String(b.id || ''));
      return out(res, 200, { status: 'success', provider: prov, ...m });
    }

    if (step === 'del') {
      await adapter.del(ctx, String(b.id || '')).catch(() => {});
      return out(res, 200, { status: 'success' });
    }

    return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
  } catch (e) {
    return out(res, 502, { status: 'error', provider: prov, message: e.message || 'Provider gagal.' });
  }
}

/* ---------- health ---------- */
async function doHealth(req, res) {
  const l = L();
  const mods = ['tiktok', 'instagram', 'twitter', 'facebook', 'youtube', 'spotify', 'soundcloud', 'pinterest', 'threads', 'reddit', 'bilibili', 'terabox', 'pixiv', 'rednote', 'applemusic', 'bandcamp', 'resolver', 'anime', 'comic'];
  const state = {};
  if (l) for (const m of mods) state[m] = !!l[m];
  return out(res, 200, {
    status: 'success',
    version: '6.0.0',
    scraper: !!l,
    modules: state,
    mail: MAIL_ORDER,
    anime: Object.keys(ANIME_SOURCES),
    comic: Object.keys(COMIC_SOURCES)
  });
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
    if (act === 'resolve') return await doResolve(req, res);
    if (act === 'net') return await doNet(req, res);
    if (act === 'img') return await doImg(req, res);
    if (act === 'proxy' || act === 'hls') return await doProxy(req, res);
    if (act === 'manga') return await doManga(req, res);
    if (act === 'anime') return await doAnime(req, res);
    if (act === 'mail') return await doMail(req, res);
    if (act === 'health') return await doHealth(req, res);
    return out(res, 404, { status: 'error', message: 'action tidak dikenal.' });
  } catch (e) {
    return out(res, 500, { status: 'error', message: e.message || 'internal error' });
  }
}
