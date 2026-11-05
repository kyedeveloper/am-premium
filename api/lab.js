/**
 * VESPERA · Lab API  v8.3.0
 * TikTok → tikwm · YouTube + musik full → Piped (proxy Range)
 * Temp mail → provider stateless + probe + failover
 */
export const config = { maxDuration: 60 };

const PISTON = 'https://emkc.org/api/v2/piston/execute';
const ONESEC = 'https://www.1secmail.com/api/v1/';
const ITUNES = 'https://itunes.apple.com';
const RL = new Map();
const PIPED = ['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee', 'https://pipedapi.astartes.nl'];

const CAPS = { exec: 24, dl: 40, resolve: 60, net: 40, mail: 220, img: 260, manga: 60, anime: 90, music: 140, proxy: 1400, health: 120 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const LANG = { bash:'bash', sh:'bash', shell:'bash', node:'javascript', js:'javascript', javascript:'javascript', python:'python', python3:'python', py:'python', php:'php', go:'go', c:'c', cpp:'c++', java:'java', ruby:'ruby', lua:'lua' };

function out(res, code, obj) {
  try { res.status(code); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
  catch { try { res.end(JSON.stringify(obj)); } catch {} }
}

function hit(ip, act) {
  const k = ip + '|' + act, now = Date.now();
  const r = RL.get(k) || { n: 0, t: now };
  if (now - r.t > 60000) { r.n = 0; r.t = now; }
  r.n++; RL.set(k, r);
  if (RL.size > 8000) RL.clear();
  return r.n <= (CAPS[act] || 40);
}

async function tf(url, opt = {}, ms = 9000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); }
}

function bh(ref) {
  const h = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Upgrade-Insecure-Requests': '1', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Cache-Control': 'no-cache'
  };
  if (ref) { h['Referer'] = ref; h['Sec-Fetch-Site'] = 'same-origin'; }
  return h;
}

async function jj(method, url, body, headers, ms = 9000) {
  const h = { 'Accept': 'application/json', ...(headers || {}) };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await tf(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }, ms);
  return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) };
}

async function txt(url, headers, ms = 9000) {
  const r = await tf(url, { headers: { ...bh(), ...(headers || {}) } }, ms);
  return { ok: r.ok, code: r.status, t: await r.text() };
}

const getHtml = async (url, ref) => { const r = await tf(url, { headers: bh(ref) }, 12000); return { ok: r.ok, code: r.status, text: await r.text() }; };

const strip = s => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const abs = (b, u) => { try { return new URL(u, b).href; } catch { return u; } };
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const imgProxy = (u, ref) => '/api/lab?action=img&url=' + encodeURIComponent(u) + (ref ? '&ref=' + encodeURIComponent(ref) : '');
const pxUrl = (u, ref) => '/api/lab?action=proxy&url=' + encodeURIComponent(u) + (ref ? '&ref=' + encodeURIComponent(ref) : '');
const safeName = s => String(s || 'media').replace(/[^\w.\-]+/g, '_').slice(0, 60);
const dlUrl = (u, ref, name) => pxUrl(u, ref) + '&dl=1&name=' + encodeURIComponent(safeName(name));

/* ===== scraper (opsional) ===== */
let SCR = null, SCR_TRIED = false;
async function scraper() {
  if (SCR) return SCR;
  if (SCR_TRIED) return null;
  SCR_TRIED = true;
  try { const m = await import('@coflyn/scrapr'); SCR = m.default && m.default.tiktok ? m.default : m; } catch { SCR = null; }
  return SCR;
}
function need() { if (!SCR) throw new Error('Modul scraper tidak tersedia.'); return SCR; }
function pick(path) {
  const l = need(), [ns, fn] = path.split('.');
  const f = l[ns] && l[ns][fn];
  if (typeof f !== 'function') throw new Error(path + ' tidak tersedia');
  return f;
}

/* ===== exec ===== */
async function doExec(req, res) {
  const b = req.body || {};
  const lang = LANG[String(b.lang || '').toLowerCase()];
  if (!lang) return out(res, 400, { status: 'error', message: 'Bahasa tidak didukung.' });
  if (!Array.isArray(b.files) || !b.files.length) return out(res, 400, { status: 'error', message: 'File kosong.' });

  const files = b.files.slice(0, 6).map(f => ({ name: String(f.name || 'main').replace(/[^\w.\-]/g, '') || 'main', content: String(f.content || '').slice(0, 40000) }));
  const r = await tf(PISTON, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: lang, version: '*', files, stdin: String(b.stdin || '') }) }, 12000);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return out(res, 502, { status: 'error', message: d.message || 'Sandbox menolak (' + r.status + ')' });

  return out(res, 200, { status: 'success', stdout: (d.run && d.run.stdout) || '', stderr: (d.run && d.run.stderr) || '', code: (d.run && d.run.code) ?? 0, compile: (d.compile && d.compile.output) || '' });
}

/* ===== proxy gambar ===== */
async function doImg(req, res) {
  const url = String(req.query.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
  const ref = String(req.query.ref || '') || ('https://' + hostOf(url) + '/');
  const r = await tf(url, { headers: { 'User-Agent': UA, 'Referer': ref, 'Accept': 'image/*,*/*;q=0.8' } }, 12000);
  if (!r.ok) return out(res, 502, { status: 'error', message: 'HTTP ' + r.status });
  res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res.status(200).end(Buffer.from(await r.arrayBuffer()));
}

/* ===== proxy halaman / media / HLS ===== */
const HIDE_CSS = `html,body{margin:0!important;padding:0!important;background:#000!important;color:#eee!important;overflow-x:hidden!important}
video,iframe,img{max-width:100%!important}
ins,.adsbygoogle,[id*="ad-"],[id*="ads"],[class*="ad-"],[class*="ads"],[class*="banner"],#player-ads,.jw-ads,.video-ads,.preroll,.overlay-ad,.popup,.float-ad{display:none!important;height:0!important}
::-webkit-scrollbar{width:0!important}`;

const AD_HOST = /(doubleclick|googlesyndication|googleadservices|adsterra|popads|propellerads|highperformanceformat|profitableratecpm|adcash|mgid|revcontent|taboola|outbrain|histats|googletagmanager|google-analytics|cloudflareinsights|onesignal|pushcrew|cleverpush)/i;

function cleanHtml(html, pageUrl) {
  const base = new URL(pageUrl), ref = base.origin + '/';
  let h = html;
  h = h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => (/<script\b[^>]*src=["']([^"']+)/i.test(m) && AD_HOST.test(m)) ? '' : m);
  h = h.replace(/<ins\b[\s\S]*?<\/ins>/gi, '');
  h = h.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, m => (AD_HOST.test(m) ? '' : m));
  h = h.replace(/(<iframe\b[^>]*?src=["'])([^"']+)(["'])/gi, (m, a, u, b) => a + pxUrl(abs(base.href, u), ref) + b);
  h = h.replace(/(<(?:video|source|img|track)\b[^>]*?(?:src|data-src)=["'])([^"']+)(["'])/gi, (m, a, u, b) => a + abs(base.href, u) + b);
  h = h.replace(/\s(on\w+)=["'][^"']*["']/gi, '');
  const head = '<base href="' + base.href + '"><style>' + HIDE_CSS + '</style>';
  return /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, m => m + head) : head + h;
}

async function doProxy(req, res) {
  const url = String(req.query.url || '').trim();
  const raw = req.query.raw === '1';
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });

  let ref = String(req.query.ref || '');
  if (!ref) { try { ref = new URL(url).origin + '/'; } catch { ref = ''; } }

  const h = { ...bh(ref), 'Accept': '*/*', 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Mode': 'navigate' };
  if (req.headers.range) h['Range'] = req.headers.range;

  const r = await tf(url, { headers: h }, 20000);
  if (!r.ok && r.status !== 206) return out(res, 502, { status: 'error', message: 'HTTP ' + r.status });

  const ct = r.headers.get('content-type') || '';
  const isList = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(url);
  const isHtml = /text\/html/i.test(ct);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  if (isList) {
    const base = new URL(url);
    const body = (await r.text()).split('\n').map(line => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (m, u) => 'URI="' + pxUrl(abs(base.href, u), base.origin + '/') + '"');
      return pxUrl(abs(base.href, t), base.origin + '/');
    }).join('\n');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, max-age=10');
    return res.status(200).end(body);
  }

  if (isHtml && !raw) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).end(cleanHtml(await r.text(), url));
  }

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', ct || 'application/octet-stream');
  if (r.status === 206 && r.headers.get('content-range')) res.setHeader('Content-Range', r.headers.get('content-range'));
  if (r.headers.get('content-length')) res.setHeader('Content-Length', r.headers.get('content-length'));
  if (req.query.dl === '1') res.setHeader('Content-Disposition', 'attachment; filename="' + safeName(req.query.name) + '"');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(r.status === 206 ? 206 : 200).end(Buffer.from(await r.arrayBuffer()));
}

/* ===== TikTok native (tikwm) ===== */
const TK_API = ['https://www.tikwm.com/api/?url=', 'https://tikwm.com/api/?url='];

async function tiktokNative(url, fmt) {
  const errs = [];
  for (const base of TK_API) {
    try {
      const r = await tf(base + encodeURIComponent(url) + '&hd=1', { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.tikwm.com/' } }, 14000);
      const d = await r.json().catch(() => ({}));
      if (!d || d.code !== 0 || !d.data) throw new Error(d && d.msg ? d.msg : 'tikwm gagal');

      const v = d.data, items = [];
      const push = (u, label, type) => {
        if (!u) return;
        const full = /^https?:\/\//.test(u) ? u : 'https://www.tikwm.com' + u;
        items.push({ url: dlUrl(full, 'https://www.tikwm.com/', (v.title || 'tiktok') + '-' + label), label, type, provider: 'tikwm' });
      };

      if (fmt === 'mp3') {
        if (v.music) push(v.music, 'Audio', 'audio');
      } else {
        if (v.hdplay) push(v.hdplay, 'HD', 'video');
        if (v.play) push(v.play, 'Normal', 'video');
        if (v.wmplay) push(v.wmplay, 'Watermark', 'video');
        if (v.music) push(v.music, 'Audio', 'audio');
        (v.images || []).slice(0, 12).forEach((im, i) => push(im, 'Foto ' + (i + 1), 'image'));
      }

      if (!items.length) throw new Error('kosong');
      return { items, title: v.title || '', thumb: v.cover || '' };
    } catch (e) { errs.push(e.message); }
  }
  throw new Error('tikwm: ' + errs.join(', '));
}

/* ===== YouTube native (Piped) ===== */
function ytId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/);
    if (m) return m[1];
  } catch {}
  const m = String(url).match(/(?:v=|\/)([\w-]{11})(?:[&?/]|$)/);
  return m ? m[1] : '';
}

async function ytStream(id, fmt) {
  const errs = [];
  for (const base of PIPED) {
    try {
      const r = await tf(base + '/streams/' + encodeURIComponent(id), { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, 14000);
      if (!r.ok) throw new Error('http ' + r.status);
      const d = await r.json().catch(() => ({}));
      if (d.error) throw new Error(d.error);

      const name = safeName(d.title || 'youtube');
      let list = fmt === 'mp3' ? (d.audioStreams || []) : (d.videoStreams || []).filter(s => !s.videoOnly);
      if (!list.length && fmt !== 'mp3') list = d.videoStreams || [];

      const items = list.filter(s => s && s.url).map(s => ({
        url: dlUrl(s.url, 'https://www.youtube.com/', name + (fmt === 'mp3' ? '.m4a' : '.mp4')),
        label: (s.quality || (s.bitrate ? s.bitrate + 'bps' : 'media')) + (s.codec ? ' · ' + s.codec : ''),
        type: fmt === 'mp3' ? 'audio' : 'video',
        provider: 'piped'
      }));

      if (!items.length) throw new Error('kosong');
      if (fmt === 'mp3') items.sort((a, b) => (parseInt(b.label) || 0) - (parseInt(a.label) || 0));
      return { items, title: d.title || '', thumb: d.thumbnailUrl || '' };
    } catch (e) { errs.push(e.message); }
  }
  throw new Error('piped: ' + errs.join(', '));
}

/* ===== downloader lain ===== */
function cobaltBases() {
  const env = (process.env.COBALT_API || '').split(',').map(s => s.trim()).filter(Boolean);
  return env.length ? env : ['https://api.cobalt.tools', 'https://co.wuk.sh'];
}

async function cobalt(url, fmt) {
  const key = process.env.COBALT_KEY, errs = [];
  for (const base of cobaltBases()) {
    try {
      const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      if (key) h['Authorization'] = 'Api-Key ' + key;
      const r = await tf(base.replace(/\/+$/, '') + '/', { method: 'POST', headers: h, body: JSON.stringify({ url, videoQuality: '1080', audioBitrate: '320', downloadMode: fmt === 'mp3' ? 'audio' : 'auto' }) }, 9000);
      if (!r.ok) throw new Error('http ' + r.status);
      const d = await r.json();
      if (d.status === 'error') throw new Error((d.error && d.error.code) || 'error');
      if (d.status === 'picker' && Array.isArray(d.picker)) return d.picker.map(p => ({ url: p.url, label: p.type || 'media', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'cobalt' }));
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

function norm(resp, provider, fmt) {
  if (!resp || resp.status !== true || !resp.result) return [];
  const r = resp.result;
  let list = [];
  if (Array.isArray(r.downloads)) list = r.downloads;
  else if (Array.isArray(r.items)) list = r.items;
  else if (r.url) list = [{ url: r.url }];

  const items = list.filter(d => d && d.url).map(d => ({
    url: d.url, label: d.quality || d.label || d.type || 'media',
    type: fmt === 'mp3' ? 'audio' : (/audio|mp3|m4a/i.test(String(d.type)) ? 'audio' : 'video'), provider
  }));
  if (fmt === 'mp3') items.sort((a, b) => (a.type === 'audio' ? -1 : 1) - (b.type === 'audio' ? -1 : 1));
  return items;
}

async function runChain(chain, url, fmt) {
  const errs = [];
  let meta = {};
  for (const path of chain) {
    try {
      const r = await pick(path)(url);
      const items = norm(r, path.split('.')[1], fmt);
      if (r && r.result) meta = { title: r.result.title || '', thumb: r.result.thumbnail || '' };
      if (items.length) return { items, meta };
      errs.push(path + ': kosong');
    } catch (e) { errs.push(path + ': ' + (e.message || 'gagal')); }
  }
  throw new Error(errs.join(' · '));
}

const DL_ROUTES = [
  { re: /tiktok\.com|douyin\.com|tt\.site/, chain: ['tiktok.snaptik', 'tiktok.tiktokio', 'tiktok.ssstik'] },
  { re: /(^|\.)(x|twitter)\.com$/, chain: ['twitter.direct', 'twitter.tweeload', 'twitter.tvd'] },
  { re: /instagram\.com/, chain: ['instagram.indown', 'instagram.snapsave', 'instagram.direct'] },
  { re: /facebook\.com|fb\.watch/, chain: ['facebook.snapsave', 'facebook.fdown'] },
  { re: /(^|\.)(youtube\.com|youtu\.be)$/, chain: ['youtube.ytmp3gg', 'youtube.ytmp3'] },
  { re: /spotify\.com|spoti\.fi/, chain: ['spotify.spotisaver', 'spotify.spotidown', 'spotify.spotmate'] },
  { re: /soundcloud\.com/, chain: ['soundcloud.klickaud'] },
  { re: /pinterest\.[a-z.]+|pin\.it/, chain: ['pinterest.direct', 'pinterest.pindown'] },
  { re: /threads\.(net|com)/, chain: ['threads.threadster'] },
  { re: /reddit\.com|redd\.it/, chain: ['reddit.rapidsave'] },
  { re: /bilibili\.com|b23\.tv/, chain: ['bilibili.direct'] },
  { re: /terabox\.(com|app)|1024tera/, chain: ['terabox.sechno'] },
  { re: /pixiv\.net/, chain: ['pixiv.ajax'] },
  { re: /xiaohongshu\.com|xhslink\.com/, chain: ['rednote.direct'] },
  { re: /music\.apple\.com/, chain: ['applemusic.aplmate'] },
  { re: /bandcamp\.com/, chain: ['bandcamp.direct'] }
];

const RESOLVE_ROUTES = [
  { re: /mediafire\.com/, fn: 'mediafire' }, { re: /sfile\.(mobi|co)/, fn: 'sfile' },
  { re: /pixeldrain\.com/, fn: 'pixeldrain' }, { re: /catbox\.moe|litter\.catbox\.moe/, fn: 'catbox' },
  { re: /drive\.google\.com|docs\.google\.com/, fn: 'gdrive' }, { re: /krakenfiles\.com/, fn: 'krakenfiles' },
  { re: /dood\.(to|so|watch|pm)|ds2play\.com|d000d\.com/, fn: 'doodstream' },
  { re: /sfl\.gl|safelinku\.com/, fn: 'safelinku' }, { re: /sub2unlock\.(io|com)|sub4unlock/, fn: 'sub2unlock' },
  { re: /rekonise\.com/, fn: 'rekonise' }
];

const DIRECT_FILE = /\.(mp4|mp3|m4a|webm|mov|mkv|jpg|jpeg|png|webp|gif|zip|apk|pdf|rar)(\?|$)/i;

async function doDl(req, res) {
  const b = req.body || {};
  const url = String(b.url || req.query.url || '').trim();
  const fmt = String(b.format || 'mp4').toLowerCase() === 'mp3' ? 'mp3' : 'mp4';
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });

  const host = hostOf(url);
  const errors = [];

  if (DIRECT_FILE.test(url))
    return out(res, 200, { status: 'success', host, items: [{ url: dlUrl(url, '', 'media'), label: 'Direct', type: fmt === 'mp3' ? 'audio' : 'video', provider: 'direct' }] });

  /* native dulu */
  if (/tiktok|douyin|tt\.site/.test(host)) {
    try { const r = await tiktokNative(url, fmt); return out(res, 200, { status: 'success', host, ...r }); }
    catch (e) { errors.push(e.message); }
  }

  if (/youtube|youtu\.be/.test(host)) {
    try {
      const id = ytId(url);
      if (!id) throw new Error('ID video tidak terbaca');
      const r = await ytStream(id, fmt);
      return out(res, 200, { status: 'success', host, ...r });
    } catch (e) { errors.push(e.message); }
  }

  /* rantai scraper */
  await scraper();
  const route = DL_ROUTES.find(r => r.re.test(host) || r.re.test(url));

  if (route && SCR) {
    try {
      const { items, meta } = await runChain(route.chain, url, fmt);
      if (items.length) return out(res, 200, { status: 'success', host, title: meta.title || '', thumb: meta.thumb || '', items });
    } catch (e) { errors.push(e.message); }
  }

  const rr = RESOLVE_ROUTES.find(r => r.re.test(url));
  if (rr && SCR) {
    try {
      const r = await pick('resolver.' + rr.fn)(url);
      if (!r.status) throw new Error(r.message || rr.fn + ' gagal');
      return out(res, 200, { status: 'success', host, resolved: true, title: r.result.filename || '', items: [{ url: dlUrl(r.result.url, '', r.result.filename), label: r.result.filename || 'File', type: 'file', provider: rr.fn }] });
    } catch (e) { errors.push(rr.fn + ': ' + e.message); }
  }

  if (SCR) {
    try {
      const r = await pick('resolver.unshorten')(url);
      if (r.status && r.result && r.result.url && DIRECT_FILE.test(r.result.url))
        return out(res, 200, { status: 'success', host, items: [{ url: dlUrl(r.result.url, '', 'file'), label: 'Direct', type: 'video', provider: 'unshorten' }] });
    } catch (e) { errors.push('unshorten: ' + e.message); }
  }

  for (const fn of [() => cobalt(url, fmt), () => oceansaver(url, fmt)]) {
    try { const items = await fn(); if (items.length) return out(res, 200, { status: 'success', host, items }); }
    catch (e) { errors.push(e.message); }
  }

  return out(res, 502, { status: 'error', message: route ? 'Semua sumber gagal. Coba lagi atau ganti link.' : 'Platform belum didukung.', detail: errors.join(' · ') });
}

async function doResolve(req, res) {
  const b = req.body || {};
  const url = String(b.url || req.query.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
  await scraper();

  const r = RESOLVE_ROUTES.find(x => x.re.test(url));
  const fns = r ? [r.fn] : ['unshorten'];
  const errs = [];
  for (const fn of fns) {
    try {
      const x = await pick('resolver.' + fn)(url);
      if (!x.status) throw new Error(x.message || 'gagal');
      return out(res, 200, { status: 'success', provider: fn, url: dlUrl(x.result.url, '', x.result.filename), filename: x.result.filename || '', size: x.result.size || '' });
    } catch (e) { errs.push(fn + ': ' + e.message); }
  }
  return out(res, 502, { status: 'error', message: 'Resolver gagal.', detail: errs.join(' · ') });
}

/* ===== net ===== */
async function doNet(req, res) {
  const url = String(req.query.url || (req.body && req.body.url) || '').trim();
  if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
  const r = await tf(url, { headers: bh() }, 10000);
  return out(res, 200, { status: 'success', code: r.status, type: r.headers.get('content-type') || '', body: (await r.text()).slice(0, 60000) });
}

/* ===== MANGA ===== */
const MD = 'https://api.mangadex.org';
const COMIC_SOURCES = { komikindo: 'Komikindo', komiku: 'Komiku', kiryuu: 'Kiryuu', komikcast: 'KomikCast', asurascans: 'Asura Scans', bacakomik: 'BacaKomik', manhwaindo: 'ManhwaIndo', mangabats: 'MangaBats' };
const MD_SOURCES = { mangadex: 'MangaDex', comick: 'Comick' };

async function mdJson(path) {
  const r = await tf(MD + path, { headers: { 'User-Agent': 'vespera-lab/8.3', 'Accept': 'application/json' } }, 9000);
  if (!r.ok) throw new Error('mangadex ' + r.status);
  return r.json();
}

const MD_Q = 'includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&hasAvailableChapters=true&limit=18';
const mdTitle = m => { const t = m.attributes && m.attributes.title; return t ? (t.en || t.id || Object.values(t)[0] || 'Tanpa judul') : 'Tanpa judul'; };
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

  if (step === 'sources') return out(res, 200, {
    status: 'success',
    items: [...Object.entries(MD_SOURCES).map(([id, label]) => ({ id, label, api: true })), ...Object.entries(COMIC_SOURCES).map(([id, label]) => ({ id, label, api: false }))]
  });

  if (COMIC_SOURCES[src]) {
    await scraper();
    try {
      const mod = need().comic && need().comic[src];
      if (!mod) throw new Error('sumber tidak tersedia');

      if (step === 'search') {
        const q = String(b.q || '').trim();
        if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
        const r = await mod.search(q);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, { status: 'success', source: src, items: (r.result || []).map(x => ({ id: x.url, title: x.title, cover: imgProxy(x.thumbnail, 'https://' + src + '.org/'), source: src })) });
      }
      if (step === 'chapters') {
        const url = String(b.id || b.url || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL komik tidak valid.' });
        const r = await mod.getChapters(url);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, { status: 'success', source: src, items: (r.result || []).map((x, i) => ({ id: x.url, num: String(x.title || i + 1) })) });
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
      return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
    } catch (e) { return out(res, 502, { status: 'error', message: '[' + src + '] ' + e.message }); }
  }

  if (step === 'home') {
    const [a, c] = await Promise.allSettled([mdJson('/manga?order[followedCount]=desc&' + MD_Q), mdJson('/manga?order[latestUploadedChapter]=desc&' + MD_Q)]);
    const trending = a.status === 'fulfilled' ? mdMap(a.value.data) : [];
    const latest = c.status === 'fulfilled' ? mdMap(c.value.data) : [];
    if (!trending.length && !latest.length) return out(res, 502, { status: 'error', message: 'MangaDex tidak merespons.' });
    return out(res, 200, { status: 'success', trending, latest });
  }
  if (step === 'genres') {
    const d = await mdJson('/manga/tag');
    return out(res, 200, { status: 'success', items: (d.data || []).filter(t => t.attributes && t.attributes.group === 'genre').map(t => ({ id: t.id, name: (t.attributes.name && (t.attributes.name.en || Object.values(t.attributes.name)[0])) || t.id })).sort((x, y) => x.name.localeCompare(y.name)) });
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
      return out(res, 200, { status: 'success', items: (Array.isArray(d) ? d : []).map(m => ({ id: m.hid || m.slug, title: m.title, cover: m.md_covers && m.md_covers[0] ? imgProxy('https://meo.comick.pictures/' + m.md_covers[0].b2key, 'https://comick.io/') : '', source: 'comick' })) });
    }
    const d = await mdJson('/manga?title=' + encodeURIComponent(q) + '&limit=24&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive');
    return out(res, 200, { status: 'success', items: mdMap(d.data) });
  }
  if (step === 'chapters') {
    const id = String(b.id || '').trim();
    if (!id) return out(res, 400, { status: 'error', message: 'ID kosong.' });
    const d = await mdJson('/manga/' + id + '/feed?translatedLanguage[]=en&order[chapter]=asc&limit=200&includeFutureUpdates=1');
    return out(res, 200, { status: 'success', items: (d.data || []).map(c => ({ id: c.id, num: (c.attributes && c.attributes.chapter) || '?' })).filter(c => c.num !== '?') });
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
    const base = d.baseUrl, hash = d.chapter && d.chapter.hash, files = (d.chapter && d.chapter.data) || [];
    if (!base || !files.length) return out(res, 502, { status: 'error', message: 'Halaman tidak tersedia.' });
    return out(res, 200, { status: 'success', pages: files.map(f => imgProxy(base + '/data/' + hash + '/' + f, 'https://mangadex.org/')) });
  }
  return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
}

/* ===== ANIME ===== */
const ANIME_SOURCES = { otakudesu: 'OtakuDesu', gogoanime: 'GogoAnime', nimegami: 'Nimegami', animetosho: 'AnimeTosho' };
const ANIME_FEED = {
  otakudesu: { doms: ['otakudesu.blog', 'otakudesu.io', 'otakudesu.cloud', 'otakudesu.best'], lists: ['/ongoing-anime/', '/anime-terbaru/'], rated: '/complete-anime/', schedule: '/jadwal-rilis/', genres: '/genre-list/' },
  samehadaku: { doms: ['samehadaku.li', 'samehadaku.care', 'samehadaku.email'], lists: ['/anime-terbaru/', '/ongoing-anime/'], rated: '/daftar-anime/', schedule: '/jadwal-rilis/', genres: '/genre/' },
  anoboy: { doms: ['anoboy.be', 'anoboy.biz', 'anoboy.ch'], lists: ['/', '/anime-terbaru/'], rated: '/', schedule: '/', genres: '/' }
};
const HOST_CACHE = new Map();

async function pickHost(src) {
  const cfg = ANIME_FEED[src];
  if (!cfg) throw new Error('sumber tidak punya feed');
  const cached = HOST_CACHE.get(src);
  if (cached && Date.now() - cached.at < 600000) return cached.host;
  const hasil = await Promise.all(cfg.doms.map(async d => { try { const r = await tf('https://' + d + '/', { headers: bh() }, 3500); return r.ok ? d : null; } catch { return null; } }));
  const host = hasil.find(Boolean);
  if (!host) throw new Error('semua domain ' + src + ' mati');
  HOST_CACHE.set(src, { host, at: Date.now() });
  return host;
}

function altUrls(url) {
  const list = [url], h = hostOf(url);
  const cfg = Object.values(ANIME_FEED).find(c => c.doms.some(d => h === d || h.endsWith('.' + d)));
  if (!cfg) return list;
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  cfg.doms.forEach(d => { if (h !== d) list.push('https://' + d + path); });
  return list;
}

const AN_RE = /<a[^>]+href="(https?:\/\/[^"]+?\/(?:anime|tv|movie|anime-terbaru)\/[^"'#?]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi;
const AN_EP = /<a[^>]+href="(https?:\/\/[^"]+?(?:\/episode\/|episode-\d|ep-\d)[^"'#?]*)"[^>]*>([\s\S]{0,160}?)<\/a>/gi;

function anItems(text, host, limit) {
  const seen = new Set(), items = [];
  let m; AN_RE.lastIndex = 0;
  while ((m = AN_RE.exec(text)) && items.length < limit) {
    const url = m[1];
    if (seen.has(url)) continue;
    const title = strip(m[2]);
    if (title.length < 3) continue;
    const im = /<img[^>]+(?:data-src|src)="([^"]+)"/i.exec(text.slice(m.index, m.index + 800));
    seen.add(url);
    items.push({ id: url, url, title, cover: im ? imgProxy(im[1], 'https://' + host + '/') : '', host });
  }
  return items;
}

function extractServers(html, pageUrl) {
  const raw = String(html || '').replace(/\\\//g, '/');
  const found = [], seen = new Set();
  const add = (u, label, m3u8) => {
    if (!u || seen.has(u) || !/^https?:\/\//i.test(u) || AD_HOST.test(u)) return;
    seen.add(u);
    found.push({ url: u, label, type: m3u8 ? 'video' : 'link', m3u8, player: pxUrl(u, pageUrl) });
  };
  let m;
  const mp = /https?:\/\/[^"'\s\\]+?\.m3u8[^"'\s\\]*/gi;
  while ((m = mp.exec(raw))) add(m[0], 'HLS', true);
  const ifr = /<(?:iframe|embed)\b[^>]+(?:data-src|data-lazy-src|src)="([^"]+)"/gi;
  while ((m = ifr.exec(raw))) add(abs(pageUrl, m[1]), 'Server', /\.m3u8/i.test(m[1]));
  const mp4 = /https?:\/\/[^"'\s\\]+?\.(?:mp4|m4v)(?:\?[^"'\s\\]*)?/gi;
  while ((m = mp4.exec(raw))) add(m[0], 'MP4', false);
  return found.slice(0, 12);
}

async function fetchAny(url) {
  const errs = [];
  for (const u of altUrls(url)) {
    try {
      const r = await getHtml(u, 'https://' + hostOf(u) + '/');
      if (r.ok && r.text.length > 400) return { url: u, text: r.text };
      errs.push(hostOf(u) + ' ' + r.code);
    } catch (e) { errs.push(hostOf(u) + ' ' + e.message); }
  }
  throw new Error('semua host gagal (' + errs.join(', ') + ')');
}

async function doAnime(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const src = String(b.source || 'otakudesu').toLowerCase();

  if (step === 'sources') return out(res, 200, {
    status: 'success',
    items: [...Object.entries(ANIME_SOURCES).map(([id, label]) => ({ id, label, stream: true })), ...Object.entries(ANIME_FEED).filter(([id]) => !ANIME_SOURCES[id]).map(([id]) => ({ id, label: id[0].toUpperCase() + id.slice(1), stream: false }))]
  });

  if (ANIME_SOURCES[src]) {
    await scraper();
    try {
      const mod = need().anime && need().anime[src];
      if (!mod) throw new Error('sumber tidak tersedia');

      if (step === 'search') {
        const q = String(b.q || '').trim();
        if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
        const r = await mod.search(q);
        if (!r.status) throw new Error(r.message || 'gagal');
        return out(res, 200, { status: 'success', source: src, items: (r.result || []).map(x => ({ id: x.url, url: x.url, title: x.title, meta: x.meta || '', cover: x.thumbnail ? imgProxy(x.thumbnail, 'https://' + hostOf(x.url) + '/') : '', source: src })) });
      }

      if (step === 'detail' || step === 'episodes') {
        const url = String(b.url || b.id || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
        if (mod.getEpisodes) {
          try {
            const r = await mod.getEpisodes(url);
            if (r.status && (r.result || []).length)
              return out(res, 200, { status: 'success', source: src, synopsis: '', items: (r.result || []).map((x, i) => ({ id: x.url, url: x.url, title: x.title || 'Episode ' + (i + 1) })).reverse() });
          } catch {}
        }
        const page = await fetchAny(url);
        const seen = new Set(), items = [];
        let m; AN_EP.lastIndex = 0;
        while ((m = AN_EP.exec(page.text)) && items.length < 400) { if (seen.has(m[1])) continue; seen.add(m[1]); items.push({ id: m[1], url: m[1], title: strip(m[2]) || 'Episode' }); }
        if (!items.length) throw new Error('daftar episode tidak terbaca');
        return out(res, 200, { status: 'success', source: src, items: items.reverse() });
      }

      if (step === 'episode' || step === 'stream') {
        const url = String(b.url || b.id || '').trim();
        if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
        let servers = [];
        try {
          const r = await mod.scrape(url);
          if (r.status) servers = (r.result.downloads || []).filter(d => d.url && !AD_HOST.test(d.url)).map(d => ({
            url: d.url, label: d.quality || d.type || 'server', type: /audio/i.test(String(d.type)) ? 'audio' : (/\.m3u8/i.test(d.url) ? 'video' : 'link'), m3u8: /\.m3u8/i.test(d.url), player: pxUrl(d.url, url)
          }));
        } catch {}
        if (!servers.length) { const page = await fetchAny(url); servers = extractServers(page.text, page.url); }
        if (!servers.length) throw new Error('Tidak ada server yang bisa diputar.');
        return out(res, 200, { status: 'success', source: src, servers });
      }

      if (step === 'home') {
        const r = await mod.search(String(b.q || 'a'));
        return out(res, 200, { status: 'success', trending: r.status ? (r.result || []).map(x => ({ id: x.url, url: x.url, title: x.title, cover: x.thumbnail || '' })) : [], latest: [], rated: [] });
      }
      return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
    } catch (e) { return out(res, 502, { status: 'error', message: '[' + src + '] ' + e.message }); }
  }

  const cfg = ANIME_FEED[src];
  if (!cfg) return out(res, 400, { status: 'error', message: 'sumber tidak dikenal' });

  try {
    const dom = await pickHost(src), base = 'https://' + dom;

    if (step === 'home') {
      const [a, c] = await Promise.allSettled([getHtml(base + cfg.lists[0], base), getHtml(base + cfg.lists[1], base)]);
      const trending = a.status === 'fulfilled' && a.value.ok ? anItems(a.value.text, dom, 14) : [];
      const latest = c.status === 'fulfilled' && c.value.ok ? anItems(c.value.text, dom, 14) : [];
      let rated = [];
      if (cfg.rated && cfg.rated !== cfg.lists[0]) { const r = await getHtml(base + cfg.rated, base).catch(() => null); if (r && r.ok) rated = anItems(r.text, dom, 14); }
      if (!trending.length && !latest.length && !rated.length) throw new Error('Sumber tidak bisa dibaca.');
      return out(res, 200, { status: 'success', trending, latest, rated, host: dom });
    }
    if (step === 'schedule') {
      const r = await getHtml(base + cfg.schedule, base);
      if (!r.ok) throw new Error('Jadwal gagal (' + r.code + ').');
      const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
      const chunks = r.text.split(/Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu/i);
      const sections = [];
      for (let i = 1; i < chunks.length; i++) { const items = anItems(chunks[i], dom, 20); if (items.length) sections.push({ day: days[i - 1] || 'Lainnya', items }); }
      if (!sections.length) sections.push({ day: 'Semua', items: anItems(r.text, dom, 24) });
      return out(res, 200, { status: 'success', sections, host: dom });
    }
    if (step === 'genres') {
      const r = await getHtml(base + cfg.genres, base);
      if (!r.ok) throw new Error('Genre gagal (' + r.code + ').');
      const seen = new Set(), items = [];
      const re = /<a[^>]+href="(https?:\/\/[^"]+?\/genre\/[^"'#]+)"[^>]*>([\s\S]{0,80}?)<\/a>/gi;
      let m;
      while ((m = re.exec(r.text)) && items.length < 40) { const name = strip(m[2]); if (!name || seen.has(m[1])) continue; seen.add(m[1]); items.push({ id: m[1], url: m[1], name, host: dom }); }
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
      if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
      const page = await fetchAny(url);
      const seen = new Set(), items = [];
      let m; AN_EP.lastIndex = 0;
      while ((m = AN_EP.exec(page.text)) && items.length < 400) { if (seen.has(m[1])) continue; seen.add(m[1]); items.push({ id: m[1], url: m[1], title: strip(m[2]) || 'Episode' }); }
      items.reverse();
      const syn = /<div[^>]+class="[^"]*(?:sinopsis|desc|entry-content)[^"]*"[^>]*>([\s\S]{0,900}?)<\/div>/i.exec(page.text);
      return out(res, 200, { status: 'success', items, synopsis: syn ? strip(syn[1]).slice(0, 500) : '', host: hostOf(page.url) });
    }
    if (step === 'episode' || step === 'stream') {
      const url = String(b.url || b.id || '').trim();
      if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
      const page = await fetchAny(url);
      const servers = extractServers(page.text, page.url);
      if (!servers.length) throw new Error('Tidak ada server yang bisa diputar.');
      return out(res, 200, { status: 'success', servers });
    }
    return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
  } catch (e) { return out(res, 502, { status: 'error', message: '[' + src + '] ' + e.message }); }
}

/* ===== MUSIK ===== */
const trackMap = x => ({
  id: String(x.trackId || x.id || ''), title: x.trackName || x.name || 'Tanpa judul', artist: x.artistName || 'Tanpa artis',
  album: x.collectionName || '', art: String(x.artworkUrl100 || x.artworkUrl60 || '').replace(/\/\d+x\d+bb/, '/400x400bb'),
  preview: x.previewUrl || '', url: x.trackViewUrl || x.url || '', dur: Math.round((x.trackTimeMillis || 0) / 1000), full: false, src: 'itunes'
});

async function itSearch(q, limit = 24) {
  const r = await tf(ITUNES + '/search?term=' + encodeURIComponent(q) + '&entity=song&limit=' + limit + '&country=ID&media=music', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, 9000);
  const d = await r.json().catch(() => ({}));
  return (d.results || []).filter(x => x && x.previewUrl).map(trackMap);
}

async function itChart(limit = 25) {
  const r = await tf('https://rss.applemarketingtools.com/api/v2/id/music/most-played/' + limit + '/songs.json', {}, 9000);
  const d = await r.json().catch(() => ({}));
  const list = (d.feed && d.feed.results) || [];
  if (!list.length) return [];
  const ids = list.map(x => x.id).filter(Boolean), prev = {};
  if (ids.length) {
    try {
      const l = await tf(ITUNES + '/lookup?id=' + ids.join(',') + '&country=ID', {}, 9000);
      const j = await l.json().catch(() => ({}));
      (j.results || []).forEach(x => { if (x.previewUrl) prev[x.trackId] = x.previewUrl; });
    } catch {}
  }
  return list.map(x => trackMap({ trackId: x.id, trackName: x.name, artistName: x.artistName, artworkUrl100: x.artworkUrl100, previewUrl: prev[x.id] || '', url: x.url }));
}

async function itAlbums(limit = 12) {
  const r = await tf('https://rss.applemarketingtools.com/api/v2/id/music/most-played/' + limit + '/albums.json', {}, 9000);
  const d = await r.json().catch(() => ({}));
  return ((d.feed && d.feed.results) || []).map(a => ({ id: String(a.id || ''), title: a.name || 'Tanpa judul', artist: a.artistName || '', art: String(a.artworkUrl100 || '').replace(/\/\d+x\d+bb/, '/400x400bb'), url: a.url || '' }));
}

/* cari video musik di Piped lalu ambil audio penuh */
async function fullTrack(q) {
  const errs = [];
  for (const base of PIPED) {
    try {
      const s = await tf(base + '/search?q=' + encodeURIComponent(q) + '&filter=music_songs', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, 14000);
      if (!s.ok) throw new Error('search ' + s.status);
      const sd = await s.json().catch(() => ({}));
      const first = (sd.items || [])[0];
      if (!first || !first.url) throw new Error('kosong');
      const id = ytId(first.url);
      if (!id) throw new Error('id kosong');

      const r = await tf(base + '/streams/' + id, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, 14000);
      if (!r.ok) throw new Error('streams ' + r.status);
      const d = await r.json().catch(() => ({}));
      const aud = (d.audioStreams || []).filter(a => a && a.url).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (!aud) throw new Error('tanpa audio');

      return { url: pxUrl(aud.url, 'https://www.youtube.com/'), dur: Number(d.duration) || 0, title: d.title || first.title || '', artist: first.uploaderName || '' };
    } catch (e) { errs.push(e.message); }
  }
  throw new Error('full track: ' + errs.join(', '));
}

async function doMusic(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || 'home');

  if (step === 'full') {
    const q = String(b.q || req.query.q || '').trim();
    if (q.length < 2) return out(res, 400, { status: 'error', message: 'Query kosong.' });
    try {
      const d = await fullTrack(q);
      return out(res, 200, { status: 'success', ...d });
    } catch (e) { return out(res, 502, { status: 'error', message: e.message }); }
  }

  if (step === 'search') {
    const q = String(b.q || req.query.q || '').trim();
    if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
    return out(res, 200, { status: 'success', items: await itSearch(q, 24) });
  }

  if (step === 'album') return out(res, 200, { status: 'success', albums: await itAlbums(12) });

  const [chart, albums] = await Promise.all([itChart(25).catch(() => []), itAlbums(8).catch(() => [])]);
  if (!chart.length) return out(res, 502, { status: 'error', message: 'Chart musik tidak bisa dibaca.' });
  return out(res, 200, { status: 'success', chart, albums });
}

/* ===== TEMP MAIL ===== */
const MT_BASE = { mailtm: 'https://api.mail.tm', mailgw: 'https://api.mail.gw' };

function mtAdapter(prov) {
  const base = MT_BASE[prov];
  const auth = ctx => ({ Authorization: 'Bearer ' + ctx.token });
  async function relogin(ctx) {
    if (!ctx.extra) throw new Error('Sesi habis, buat alamat baru.');
    const t = await jj('POST', base + '/token', { address: ctx.address, password: ctx.extra });
    if (!t.ok || !t.d.token) throw new Error('Sesi habis, buat alamat baru.');
    ctx.token = t.d.token;
  }
  return {
    label: prov === 'mailtm' ? 'mail.tm' : 'mail.gw',
    async domains() {
      const r = await jj('GET', base + '/domains?page=1');
      return ((r.d && r.d['hydra:member']) || []).filter(x => !x.isPrivate && x.isActive !== false).map(x => x.domain).slice(0, 12);
    },
    async create({ address }) {
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const c = await jj('POST', base + '/accounts', { address, password });
      if (!c.ok) throw new Error(c.d['hydra:description'] || 'Alamat sudah dipakai.');
      const t = await jj('POST', base + '/token', { address, password });
      if (!t.ok || !t.d.token) throw new Error('Gagal membuat sesi.');
      return { address, token: t.d.token, extra: password };
    },
    async list(ctx) {
      let r = await jj('GET', base + '/messages?page=1', undefined, auth(ctx));
      if (r.code === 401) { await relogin(ctx); r = await jj('GET', base + '/messages?page=1', undefined, auth(ctx)); }
      if (!r.ok) throw new Error('Gagal memuat inbox (' + r.code + ').');
      return (r.d['hydra:member'] || []).map(m => ({ id: m.id, from: (m.from && m.from.address) || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.seen, at: m.createdAt }));
    },
    async read(ctx, id) {
      let r = await jj('GET', base + '/messages/' + encodeURIComponent(id), undefined, auth(ctx));
      if (r.code === 401) { await relogin(ctx); r = await jj('GET', base + '/messages/' + encodeURIComponent(id), undefined, auth(ctx)); }
      if (!r.ok) throw new Error('Pesan tidak ditemukan.');
      const m = r.d;
      return { subject: m.subject || '(tanpa subjek)', from: (m.from && m.from.address) || '?', at: m.createdAt, html: Array.isArray(m.html) ? m.html.join('\n') : '', text: m.text || '' };
    },
    async del(ctx, id) { await jj('DELETE', base + '/messages/' + encodeURIComponent(id), undefined, auth(ctx)); }
  };
}

async function gm(f, extra = '') {
  const r = await tf('https://api.guerrillamail.com/ajax.php?f=' + f + '&agent=vespera-lab' + extra, {}, 9000);
  return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) };
}

const MAIL = {
  plus: {
    label: 'tempmail.plus',
    async domains() { return ['rover.info', 'fexpost.com', 'mailto.plus', 'fextemp.com', 'fexbox.org', 'fexbox.ru', 'mailbox.in.ua', 'chitthi.in', 'any.pink', 'merepost.com', 'tofeat.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://tempmail.plus/api/mails?email=' + encodeURIComponent(ctx.address) + '&epin=&first_id=0');
      if (!r.ok) throw new Error('tempmail.plus ' + r.code);
      return ((r.d && r.d.mail_list) || []).map(m => ({ id: String(m.id), from: m.from_mail || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.seen, at: m.time || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://tempmail.plus/api/mails/' + encodeURIComponent(id) + '?email=' + encodeURIComponent(ctx.address) + '&epin=');
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from_mail || '?', at: m.time || '', html: m.html || '', text: m.text || '' };
    },
    async del() {}
  },

  maildrop: {
    label: 'maildrop.cc',
    async domains() { return ['maildrop.cc']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('POST', 'https://api.maildrop.cc/graphql', { query: 'query($m:String!){inbox(mailbox:$m){id headerfrom subject date}}', variables: { m: ctx.name } });
      if (!r.ok) throw new Error('maildrop ' + r.code);
      return ((r.d && r.d.data && r.d.data.inbox) || []).map(m => ({ id: m.id, from: m.headerfrom, subject: m.subject || '(tanpa subjek)', seen: false, at: m.date }));
    },
    async read(ctx, id) {
      const r = await jj('POST', 'https://api.maildrop.cc/graphql', { query: 'query($m:String!,$i:String!){message(mailbox:$m,id:$i){subject headerfrom html data}}', variables: { m: ctx.name, i: id } });
      const m = (r.d && r.d.data && r.d.data.message) || null;
      if (!m) throw new Error('Pesan tidak ditemukan.');
      return { subject: m.subject || '(tanpa subjek)', from: m.headerfrom || '?', at: '', html: m.html || '', text: m.data || '' };
    },
    async del() {}
  },

  inboxes: {
    label: 'inboxes.com',
    async domains() { return ['inboxes.com']; },
    async create() {
      const r = await jj('POST', 'https://inboxes.com/api/v2/inbox');
      if (!r.ok || !r.d.inbox) throw new Error('inboxes.com menolak.');
      return { address: r.d.inbox + '@inboxes.com', extra: r.d.inbox };
    },
    async list(ctx) {
      const r = await jj('GET', 'https://inboxes.com/api/v2/inbox/' + encodeURIComponent(ctx.extra || ctx.name));
      if (!r.ok) throw new Error('inboxes ' + r.code);
      return ((r.d && r.d.messages) || []).map(m => ({ id: m.uid, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.created || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://inboxes.com/api/v2/message/' + encodeURIComponent(id));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.created || '', html: m.html || '', text: m.text || '' };
    },
    async del(ctx, id) { await jj('DELETE', 'https://inboxes.com/api/v2/message/' + encodeURIComponent(id)); }
  },

  harakirimail: {
    label: 'harakirimail',
    async domains() { return ['harakirimail.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://harakirimail.com/api/v1/inbox/' + encodeURIComponent(ctx.name));
      if (!r.ok) throw new Error('harakirimail ' + r.code);
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://harakirimail.com/api/v1/message/' + encodeURIComponent(id));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || '', text: m.text || '' };
    },
    async del() {}
  },

  moakt: {
    label: 'moakt',
    async domains() { return ['moakt.com', 'tempinbox.xyz', 'aboodman.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', 'https://www.moakt.com/api/inbox?email=' + encodeURIComponent(ctx.address));
      if (!r.ok) throw new Error('moakt ' + r.code);
      const arr = Array.isArray(r.d) ? r.d : (r.d && r.d.messages) || [];
      return arr.map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://www.moakt.com/api/message?id=' + encodeURIComponent(id) + '&email=' + encodeURIComponent(ctx.address));
      const m = r.d || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || m.body || '', text: m.text || '' };
    },
    async del() {}
  },

  mailnesia: {
    label: 'mailnesia',
    async domains() { return ['mailnesia.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await txt('https://mailnesia.com/mailbox/' + encodeURIComponent(ctx.name));
      const items = [], re = /href="\/mailbox\/[^/]+\/([^"]+)"[^>]*>([^<]{0,120})/gi;
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

  dispostable: {
    label: 'dispostable',
    async domains() { return ['dispostable.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await txt('https://www.dispostable.com/inbox/' + encodeURIComponent(ctx.name));
      const items = [], re = /href="\/inbox\/[^/]+\/([^"]+)"[^>]*>([\s\S]{0,160}?)<\/a>/gi;
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

  onesec: {
    label: '1secmail',
    async domains() { return ['1secmail.com', '1secmail.net', '1secmail.org', 'wwjmp.com', 'esiix.com', 'xojxe.com', 'yoggm.com']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const r = await jj('GET', ONESEC + '?action=getMessages&login=' + encodeURIComponent(ctx.name) + '&domain=' + encodeURIComponent(ctx.domain));
      if (!r.ok) throw new Error('1secmail ' + r.code);
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
      if (!r.ok || !r.d.email) throw new Error('temp-mail.io menolak.');
      return { address: r.d.email, token: r.d.token };
    },
    async list(ctx) {
      const r = await jj('GET', 'https://api.temp-mail.io/api/v3/email/' + encodeURIComponent(ctx.address) + '/messages', undefined, { 'X-Api-Token': String(ctx.token || '') });
      if (!r.ok) throw new Error('temp-mail.io ' + r.code);
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.created_at || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://api.temp-mail.io/api/v3/email/' + encodeURIComponent(ctx.address) + '/messages', undefined, { 'X-Api-Token': String(ctx.token || '') });
      const m = (Array.isArray(r.d) ? r.d : []).find(x => String(x.id) === String(id)) || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.created_at || '', html: m.body_html || '', text: m.body_text || '' };
    },
    async del(ctx, id) { await jj('DELETE', 'https://api.temp-mail.io/api/v3/email/' + encodeURIComponent(ctx.address) + '/messages/' + encodeURIComponent(id), undefined, { 'X-Api-Token': String(ctx.token || '') }); }
  },

  tmplol: {
    label: 'tempmail.lol',
    async domains() { return ['tempmail.lol', 'scryptmail.com', 'mailiverse.com']; },
    async create({ domain }) {
      const r = await jj('POST', 'https://api.tempmail.lol/v2/inbox/create', { domain: domain || undefined });
      if (!r.ok || !r.d.address) throw new Error('tempmail.lol menolak.');
      return { address: r.d.address, token: r.d.token };
    },
    async list(ctx) {
      const r = await jj('GET', 'https://api.tempmail.lol/v2/inbox?token=' + encodeURIComponent(String(ctx.token || '')));
      if (!r.ok) throw new Error('tempmail.lol ' + r.code);
      return (Array.isArray(r.d.emails) ? r.d.emails : []).map(m => ({ id: m.id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: false, at: m.date || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://api.tempmail.lol/v2/inbox?token=' + encodeURIComponent(String(ctx.token || '')));
      const m = (Array.isArray(r.d.emails) ? r.d.emails : []).find(x => String(x.id) === String(id)) || {};
      return { subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.html || '', text: m.body || '' };
    },
    async del() {}
  },

  mailtm: mtAdapter('mailtm'),
  mailgw: mtAdapter('mailgw'),

  dropmail: {
    label: 'dropmail.me',
    async domains() { return ['dropmail.me', '10mail.org', 'emlhub.com', 'emlpro.com', 'emltmp.com']; },
    async create() {
      const r = await jj('POST', 'https://dropmail.me/api/graphql/VESPERA-LAB', { query: 'mutation{introduceSession{id,addresses{address}}}' });
      const s = r.d && r.d.data && r.d.data.introduceSession;
      if (!s || !s.addresses || !s.addresses[0]) throw new Error('dropmail menolak.');
      return { address: s.addresses[0].address, extra: s.id };
    },
    async list(ctx) {
      const r = await jj('POST', 'https://dropmail.me/api/graphql/VESPERA-LAB', { query: 'query($id:ID!){session(id:$id){mails{id,fromAddr,headerSubject,downloadUrl}}}', variables: { id: ctx.extra } });
      if (!r.ok) throw new Error('dropmail ' + r.code);
      const mails = (r.d && r.d.data && r.d.data.session && r.d.data.session.mails) || [];
      return mails.map(m => ({ id: m.id, from: m.fromAddr || '?', subject: m.headerSubject || '(tanpa subjek)', seen: false, at: '' }));
    },
    async read(ctx, id) {
      const r = await jj('POST', 'https://dropmail.me/api/graphql/VESPERA-LAB', { query: 'query($id:ID!){session(id:$id){mails{id,fromAddr,headerSubject,rawSize,downloadUrl}}}', variables: { id: ctx.extra } });
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

  guerrilla: {
    label: 'Guerrilla Mail',
    async domains() { return ['guerrillamail.com', 'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me']; },
    async create({ name }) {
      const s = await gm('get_email_address');
      if (!s.ok || !s.d.sid_token) throw new Error('Guerrilla menolak.');
      const u = await gm('set_email_user', '&email_user=' + encodeURIComponent(name) + '&sid_token=' + s.d.sid_token);
      return { address: (u.d && u.d.email_addr) || s.d.email_addr, extra: s.d.sid_token };
    },
    async list(ctx) {
      const r = await gm('get_email_list', '&offset=0&sid_token=' + encodeURIComponent(String(ctx.extra || '')));
      return ((r.d && r.d.list) || []).map(m => ({ id: String(m.mail_id), from: m.mail_from, subject: m.mail_subject || '(tanpa subjek)', seen: false, at: '' }));
    },
    async read(ctx, id) {
      const r = await gm('fetch_email', '&email_id=' + encodeURIComponent(id) + '&sid_token=' + encodeURIComponent(String(ctx.extra || '')));
      return { subject: r.d.mail_subject || '(tanpa subjek)', from: r.d.mail_from || '?', at: '', html: r.d.mail_body || '', text: '' };
    },
    async del(ctx, id) { await gm('del_email', '&email_ids[]=' + encodeURIComponent(id) + '&sid_token=' + encodeURIComponent(String(ctx.extra || ''))); }
  },

  yopmail: {
    label: 'YOPmail',
    async domains() { return ['yopmail.com', 'yopmail.fr', 'cool.fr.nf']; },
    async create({ address }) { return { address }; },
    async list(ctx) {
      const h = await txt('https://yopmail.com/mail?login=' + encodeURIComponent(ctx.name), { Referer: 'https://yopmail.com/' });
      const items = [], re = /data-id="(\d+)"[\s\S]{0,200}?class="[^"]*?subj[^"]*"[^>]*>([^<]{0,120})/gi;
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
    async domains() { return ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com']; },
    async create() {
      const r = await jj('POST', 'https://smailpro.com/app/temp-email', {});
      if (!r.ok || !r.d.address) throw new Error('smailpro menolak.');
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
      if (!r.ok) throw new Error('mailsac ' + r.code);
      return (Array.isArray(r.d) ? r.d : []).map(m => ({ id: m._id, from: m.from || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.read, at: m.received || '' }));
    },
    async read(ctx, id) {
      const r = await jj('GET', 'https://mailsac.com/api/text/' + encodeURIComponent(ctx.address) + '/' + encodeURIComponent(id), undefined, { 'Mailsac-Key': process.env.MAILSAC_KEY || '' });
      return { subject: '(tanpa subjek)', from: '?', at: '', html: '', text: typeof r.d === 'string' ? r.d : JSON.stringify(r.d) };
    },
    async del() {}
  }
};

/* stateless = inbox publik tanpa sesi → dipakai lebih dulu */
const STATELESS = new Set(['plus', 'maildrop', 'inboxes', 'harakirimail', 'moakt', 'mailnesia', 'dispostable', 'onesec', 'yopmail']);

const MAIL_ORDER = ['plus', 'maildrop', 'inboxes', 'harakirimail', 'moakt', 'mailnesia', 'dispostable', 'onesec', 'yopmail', 'tempmailio', 'tmplol', 'mailtm', 'mailgw', 'dropmail', 'guerrilla', 'smailpro', 'mailsac'];

let PROBE = { at: 0, list: [] };

async function probe(force) {
  if (!force && Date.now() - PROBE.at < 60000 && PROBE.list.length) return PROBE.list;

  const ok = [];
  await Promise.all(MAIL_ORDER.map(async id => {
    try {
      const d = await MAIL[id].domains();
      if (!d || !d.length) return;
      if (!STATELESS.has(id)) { ok.push(id); return; }
      const name = 'v' + Math.random().toString(36).slice(2, 9);
      await MAIL[id].list({ address: name + '@' + d[0], name, domain: d[0], token: '', extra: name });
      ok.push(id);
    } catch {}
  }));

  PROBE = { at: Date.now(), list: MAIL_ORDER.filter(id => ok.includes(id)) };
  return PROBE.list;
}

async function resolveProvider(name) {
  if (name && name !== 'auto') {
    if (!MAIL[name]) throw new Error('Provider tidak dikenal.');
    return name;
  }
  const list = await probe();
  if (!list.length) throw new Error('Tidak ada provider yang hidup saat ini.');
  return list[0];
}

const randName = () => 'v' + Math.random().toString(36).slice(2, 9);

async function makeAddress(prov, name) {
  const p = await resolveProvider(prov);
  const ds = await MAIL[p].domains();
  const domain = (ds && ds[0]) || '';
  if (!domain) throw new Error('Domain tidak tersedia.');
  const made = await MAIL[p].create({ name, domain, address: name + '@' + domain });
  const address = made.address || (name + '@' + domain);
  const parts = address.split('@');
  return { provider: p, address, name: parts[0], domain: parts[1], token: made.token || '', sid: made.extra || '' };
}

async function doMail(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  let prov = String(b.provider || req.query.provider || 'auto').toLowerCase();

  if (step === 'sources') return out(res, 200, { status: 'success', items: MAIL_ORDER.map(id => ({ id, label: MAIL[id].label, stateless: STATELESS.has(id) })) });

  if (step === 'check') {
    const list = await probe(true).catch(() => []);
    return out(res, 200, { status: 'success', items: list.map(id => ({ id, label: MAIL[id].label })) });
  }

  try {
    if (step === 'domains') {
      if (prov === 'auto') {
        const list = await probe();
        const all = [];
        for (const id of list.slice(0, 6)) {
          try { (await MAIL[id].domains()).slice(0, 4).forEach(domain => all.push({ domain, provider: id })); } catch {}
        }
        if (!all.length) return out(res, 502, { status: 'error', message: 'Semua provider sedang mati.' });
        return out(res, 200, { status: 'success', domains: all.map(x => x.domain), map: all });
      }
      const d = await MAIL[prov].domains();
      if (!d.length) return out(res, 502, { status: 'error', message: 'Domain tidak tersedia.' });
      return out(res, 200, { status: 'success', domains: d });
    }

    if (step === 'new') {
      const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
      if (name.length < 3) return out(res, 400, { status: 'error', message: 'Nama minimal 3 karakter.' });
      const made = await makeAddress(prov, name);
      return out(res, 200, { status: 'success', ...made, password: made.provider.startsWith('mail') ? made.sid : '' });
    }

    if (step === 'bulk') {
      const count = Math.min(Math.max(Number(b.count) || 10, 1), 20);
      const items = [];
      for (let i = 0; i < count; i++) {
        try { items.push(await makeAddress(prov, randName())); }
        catch (e) { items.push({ address: '', provider: prov, error: e.message }); }
        await new Promise(r => setTimeout(r, 120));
      }
      if (!items.filter(x => x.address).length) return out(res, 502, { status: 'error', message: 'Gagal membuat alamat.', items });
      return out(res, 200, { status: 'success', items });
    }

    if (!prov || prov === 'auto') prov = await resolveProvider('auto');

    const address = String(b.address || '');
    const parts = address.split('@');
    const ctx = { address, name: String(b.name || parts[0] || ''), domain: String(b.domain || parts[1] || ''), token: String(b.token || ''), extra: String(b.sid || b.password || b.extra || '') };

    if (step === 'list') {
      let messages;
      try {
        messages = await MAIL[prov].list(ctx);
      } catch (e) {
        /* failover ke provider stateless lain, pakai local-part sama */
        const alt = (await probe(true).catch(() => [])).filter(id => id !== prov && STATELESS.has(id)).slice(0, 3);
        let done = false;
        for (const id of alt) {
          try {
            const ds = await MAIL[id].domains();
            const dom = (ds && ds[0]) || '';
            if (!dom) continue;
            const name = ctx.name || randName();
            const made = await MAIL[id].create({ name, domain: dom, address: name + '@' + dom });
            const addr = made.address || (name + '@' + dom);
            const p2 = addr.split('@');
            const newCtx = { address: addr, name: p2[0], domain: p2[1], token: made.token || '', extra: made.extra || '' };
            messages = await MAIL[id].list(newCtx);
            return out(res, 200, { status: 'success', provider: id, switched: true, address: addr, name: newCtx.name, domain: newCtx.domain, token: newCtx.token, sid: newCtx.extra, messages });
          } catch {}
        }
        if (!done) throw e;
      }
      return out(res, 200, { status: 'success', provider: prov, messages });
    }

    if (step === 'read') {
      const m = await MAIL[prov].read(ctx, String(b.id || ''));
      return out(res, 200, { status: 'success', provider: prov, ...m });
    }

    if (step === 'del') {
      await MAIL[prov].del(ctx, String(b.id || '')).catch(() => {});
      return out(res, 200, { status: 'success' });
    }

    return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
  } catch (e) {
    return out(res, 502, { status: 'error', provider: prov, message: e.message || 'Provider gagal.' });
  }
}

/* ===== health ===== */
async function doHealth(req, res) {
  const l = await scraper().catch(() => null);
  return out(res, 200, { status: 'success', version: '8.3.0', scraper: !!l, piped: PIPED.length, mail: MAIL_ORDER });
}

/* ===== router ===== */
export default async function handler(req, res) {
  try {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Range');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (typeof req.body === 'string') { try { req.body = JSON.parse(req.body); } catch { req.body = {}; } }

    const act = String((req.query && req.query.action) || '').toLowerCase();
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
    if (!hit(ip, act)) return out(res, 429, { status: 'error', message: 'Kebanyakan request, tunggu 1 menit.' });

    if (act === 'exec') return await doExec(req, res);
    if (act === 'dl') return await doDl(req, res);
    if (act === 'resolve') return await doResolve(req, res);
    if (act === 'net') return await doNet(req, res);
    if (act === 'img') return await doImg(req, res);
    if (act === 'proxy' || act === 'hls') return await doProxy(req, res);
    if (act === 'manga') return await doManga(req, res);
    if (act === 'anime') return await doAnime(req, res);
    if (act === 'music' || act === 'song') return await doMusic(req, res);
    if (act === 'mail') return await doMail(req, res);
    if (act === 'health') return await doHealth(req, res);

    return out(res, 404, { status: 'error', message: 'action tidak dikenal.' });
  } catch (e) {
    return out(res, 500, { status: 'error', message: (e && e.message) || 'internal error' });
  }
                     }
