const PISTON = 'https://emkc.org/api/v2/piston/execute';
const ONESEC = 'https://www.1secmail.com/api/v1/';
const RL = new Map();
const CAPS = { exec: 24, dl: 24, net: 40, mail: 80, img: 240, manga: 60, anime: 60, proxy: 600 };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const LANG = {
  bash: 'bash', sh: 'bash', shell: 'bash',
  node: 'javascript', js: 'javascript', javascript: 'javascript',
  python: 'python', python3: 'python', py: 'python',
  php: 'php', go: 'go', c: 'c', cpp: 'c++', java: 'java', ruby: 'ruby', lua: 'lua'
};

const MT_BASE = { mailtm: 'https://api.mail.tm', mailgw: 'https://api.mail.gw' };
const STATIC_DOM = {
  plus: ['rover.info', 'fexpost.com', 'mailto.plus', 'fextemp.com', 'fexbox.org', 'fexbox.ru', 'mailbox.in.ua', 'chitthi.in', 'any.pink', 'merepost.com', 'tofeat.com'],
  guerrilla: ['guerrillamail.com', 'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net', 'spam4.me'],
  maildrop: ['maildrop.cc'],
  onesec: ['1secmail.com', '1secmail.net', '1secmail.org', 'wwjmp.com', 'esiix.com', 'xojxe.com', 'yoggm.com']
};

const AD_HOST = /(doubleclick|googlesyndication|googleadservices|adsterra|popads|propellerads|highperformanceformat|profitableratecpm|adcash|mgid|revcontent|taboola|outbrain|histats|googletagmanager|google-analytics|cloudflareinsights|onesignal|pushcrew|cleverpush)/i;

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
  const r = await tf(url, { headers: { 'User-Agent': UA, 'Referer': 'https://mangadex.org/' } }, 12000);
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
  const isHtml = /text\/html/i.test(ct) || (!ct && /^\s*</.test(await r.clone().text().catch(() => '')));

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

/* ---------- downloader ---------- */
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

async function fx(url) {
  const id = (url.match(/status\/(\d+)/) || [])[1];
  const user = (url.match(/(?:x|twitter)\.com\/([^/]+)\/status/) || [])[1];
  if (!id || !user) throw new Error('bukan tweet');
  for (const host of ['https://api.fxtwitter.com', 'https://api.vxtwitter.com']) {
    try {
      const r = await tf(host + '/' + user + '/status/' + id, {}, 8000);
      if (!r.ok) continue;
      const d = await r.json();
      const m = (d.media && (d.media.videos || d.media.all)) || [];
      const items = m.filter(v => v.url).map(v => ({ url: v.url, label: (v.type || 'video') + (v.height ? ' ' + v.height + 'p' : ''), type: 'video', provider: 'fx' }));
      if (items.length) return { title: d.tweet && d.tweet.text, thumb: m[0] && m[0].thumbnail_url, items };
    } catch (e) {}
  }
  throw new Error('fx gagal');
}

async function igEmbed(url) {
  const r = await tf(url.replace(/\/?$/, '/') + 'embed/captioned/', { headers: { 'User-Agent': UA } }, 10000);
  const t = await r.text();
  const items = [];
  const v = t.match(/"video_url":"([^"]+)"/);
  if (v) items.push({ url: v[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'), label: 'Video', type: 'video', provider: 'instagram' });
  const img = t.match(/"display_url":"([^"]+)"/);
  if (!items.length && img) items.push({ url: img[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'), label: 'Gambar', type: 'video', provider: 'instagram' });
  if (!items.length) throw new Error('instagram kosong');
  const ttl = t.match(/<title[^>]*>([^<]+)</);
  return { title: ttl ? strip(ttl[1]) : '', thumb: img ? img[1].replace(/\\\//g, '/') : '', items };
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
  if (/tiktok\.com|douyin\.com|vt\.tiktok/.test(host)) tries.push(() => tikwm(url).then(r => { meta = r; return r.items; }));
  if (/(^|\.)(x|twitter)\.com$/.test(host)) tries.push(() => fx(url).then(r => { meta = r; return r.items; }));
  if (/instagram\.com/.test(host)) tries.push(() => igEmbed(url).then(r => { meta = r; return r.items; }));
  tries.push(() => cobalt(url, fmt));
  if (/youtube\.com|youtu\.be/.test(host)) tries.push(() => oceansaver(url, fmt));
  tries.push(() => cobalt(url, fmt));

  for (const t of tries) {
    try {
      const items = await t();
      if (items && items.length) return out(res, 200, { status: 'success', host, title: meta.title || '', thumb: meta.thumb || '', items });
    } catch (e) { errors.push(e.message); }
  }

  return out(res, 502, { status: 'error', message: 'Semua sumber gagal. Coba lagi atau ganti link.', detail: errors.join(' · ') });
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
(b.id || '');
    if (src === 'comick') {
      const r = await tf('https://api.comick.fun/chapter/' + encodeURIComponent(id) + '?tachiyomi=true', { headers: { 'User-Agent': UA } }, 12000);
      const d = await r.json().catch(() => ({}));
      const imgs = ((d.chapter && d.chapter.images) || []).map(i => i.url).filter(Boolean);
      if (!imgs.length) return out(res, 502, { status: 'error', message: 'Halaman kosong.' });
      return out(res, 200, { status: 'success', pages: imgs.map(u => mdImg(u)) });
    }
    const d = await mdJson('/at-home/server/' + encodeURIComponent(id));
    const base = d.baseUrl, hash = d.chapter && d.chapter.hash;
    const files = (d.chapter && d.chapter.data) || [];
    if (!base || !files.length) return out(res, 502, { status: 'error', message: 'Halaman tidak tersedia (mungkin butuh login).' });
    return out(res, 200, { status: 'success', pages: files.map(f => mdImg(base + '/data/' + hash + '/' + f)) });
  }

  return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
}

/* ---------- ANIME ---------- */
const ANIME_SRC = {
  otakudesu: { doms: ['otakudesu.blog', 'otakudesu.io', 'otakudesu.cloud'], path: q => '/?s=' + encodeURIComponent(q) + '&post_type=anime' },
  samehadaku: { doms: ['samehadaku.li', 'samehadaku.care', 'samehadaku.email'], path: q => '/?s=' + encodeURIComponent(q) },
  anoboy: { doms: ['anoboy.be', 'anoboy.biz', 'anoboy.ch', 'anoboy.li'], path: q => '/?s=' + encodeURIComponent(q) }
};

async function pickHost(src) {
  const cfg = ANIME_SRC[src];
  if (!cfg) throw new Error('sumber tidak dikenal');
  for (const d of cfg.doms) {
    try {
      const r = await tf('https://' + d + '/', { headers: { 'User-Agent': UA } }, 7000);
      if (r.ok) return d;
    } catch (e) {}
  }
  throw new Error('semua domain ' + src + ' tidak merespons');
}

async function doAnime(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const src = String(b.source || 'otakudesu').toLowerCase();

  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
    const dom = await pickHost(src);
    const base = 'https://' + dom;
    const r = await getHtml(base + ANIME_SRC[src].path(q), base);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Pencarian gagal (' + r.code + ').' });

    const seen = new Set(), items = [];
    const re = /<a[^>]+href="(https?:\/\/[^"]+?\/(?:anime|tv|movie)\/[^"'#?]+)"[^>]*>([\s\S]{0,160}?)<\/a>/gi;
    let m;
    while ((m = re.exec(r.text)) && items.length < 24) {
      const u = m[1];
      if (seen.has(u)) continue;
      const title = strip(m[2]);
      if (title.length < 3) continue;
      seen.add(u);
      items.push({ url: u, title, source: src, host: dom });
    }
    if (!items.length) return out(res, 404, { status: 'error', message: 'Tidak ada hasil di ' + dom + '.' });
    return out(res, 200, { status: 'success', items });
  }

  if (step === 'detail') {
    const url = String(b.url || '');
    if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
    const host = new URL(url).hostname;
    const r = await getHtml(url, 'https://' + host);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Gagal membuka halaman.' });
/* ---------- MANGA ---------- */
const MD = 'https://api.mangadex.org';
const mdImg = u => '/api/lab?action=img&url=' + encodeURIComponent(u);

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
  return f ? mdImg('https://uploads.mangadex.org/covers/' + m.id + '/' + f + '.256.jpg') : '';
}
const mdMap = list => (list || []).map(m => ({ id: m.id, title: mdTitle(m), cover: mdCover(m), source: 'mangadex' }));

async function doManga(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const src = String(b.source || 'mangadex').toLowerCase();

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
        cover: m.md_covers && m.md_covers[0] ? mdImg('https://meo.comick.pictures/' + m.md_covers[0].b2key) : '',
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
    const d = await mdJson('/at-home/server/' + id);
    const base = d.baseUrl, hash = d.chapter.hash;
    const files = (d.chapter.data && d.chapter.data.length) ? d.chapter.data : d.chapter.dataSaver;
    return out(res, 200, { status: 'success', pages: files.map(f => mdImg(base + '/data/' + hash + '/' + f)) });
  }

  return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
}

/* ---------- ANIME ---------- */
const ANIME_SRC = {
  otakudesu: { doms: ['otakudesu.blog', 'otakudesu.io', 'otakudesu.cloud'], search: q => '/?s=' + encodeURIComponent(q) + '&post_type=anime', lists: ['/ongoing-anime/', '/anime-terbaru/'], rated: '/complete-anime/', schedule: '/jadwal-rilis/', genres: '/genre-list/' },
  samehadaku: { doms: ['samehadaku.li', 'samehadaku.care', 'samehadaku.email'], search: q => '/?s=' + encodeURIComponent(q), lists: ['/anime-terbaru/', '/ongoing-anime/'], rated: '/daftar-anime/', schedule: '/jadwal-rilis/', genres: '/genre/' },
  anoboy: { doms: ['anoboy.be', 'anoboy.biz', 'anoboy.ch', 'anoboy.li'], search: q => '/?s=' + encodeURIComponent(q), lists: ['/', '/anime-terbaru/'], rated: '/', schedule: '/', genres: '/' }
};

async function pickHost(src) {
  const cfg = ANIME_SRC[src];
  if (!cfg) throw new Error('sumber tidak dikenal');
  for (const d of cfg.doms) {
    try {
      const r = await tf('https://' + d + '/', { headers: { 'User-Agent': UA } }, 7000);
      if (r.ok) return d;
    } catch (e) {}
  }
  throw new Error('semua domain ' + src + ' tidak merespons');
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
    items.push({ url, title, cover: im ? im[1] : '', host });
  }
  return items;
}

async function doAnime(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const src = String(b.source || 'otakudesu').toLowerCase();
  const cfg = ANIME_SRC[src];
  if (!cfg) return out(res, 400, { status: 'error', message: 'sumber tidak dikenal' });

  const dom = await pickHost(src);
  const base = 'https://' + dom;

  if (step === 'home') {
    const [a, c] = await Promise.allSettled([
      getHtml(base + cfg.lists[0], base),
      getHtml(base + cfg.lists[1], base)
    ]);
    const trending = a.status === 'fulfilled' && a.value.ok ? anItems(a.value.text, dom, 14) : [];
    const latest = c.status === 'fulfilled' && c.value.ok ? anItems(c.value.text, dom, 14) : [];
    let rated = [];
    if (cfg.rated && cfg.rated !== cfg.lists[0]) {
      const r = await getHtml(base + cfg.rated, base).catch(() => null);
      if (r && r.ok) rated = anItems(r.text, dom, 14);
    }
    if (!trending.length && !latest.length && !rated.length) return out(res, 502, { status: 'error', message: 'Sumber tidak bisa dibaca.' });
    return out(res, 200, { status: 'success', trending, latest, rated, host: dom });
  }

  if (step === 'schedule') {
    const r = await getHtml(base + cfg.schedule, base);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Jadwal gagal (' + r.code + ').' });
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
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Genre gagal (' + r.code + ').' });
    const seen = new Set(), items = [];
    const re = /<a[^>]+href="(https?:\/\/[^"]+?\/genre\/[^"'#]+)"[^>]*>([\s\S]{0,80}?)<\/a>/gi;
    let m;
    while ((m = re.exec(r.text)) && items.length < 40) {
      const name = strip(m[2]);
      if (!name || seen.has(m[1])) continue;
      seen.add(m[1]);
      items.push({ url: m[1], name, host: dom });
    }
    return out(res, 200, { status: 'success', items, host: dom });
  }

  if (step === 'bygenre' || step === 'list') {
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
    const r = await getHtml(url, base);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Gagal membuka genre (' + r.code + ').' });
    return out(res, 200, { status: 'success', items: anItems(r.text, dom, 30), host: dom });
  }

  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) return out(res, 400, { status: 'error', message: 'Kata kunci terlalu pendek.' });
    const r = await getHtml(base + cfg.search(q), base);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Pencarian gagal (' + r.code + ').' });
    return out(res, 200, { status: 'success', items: anItems(r.text, dom, 24), host: dom });
  }

  if (step === 'detail') {
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
    const r = await getHtml(url, base);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Detail gagal (' + r.code + ').' });
    const seen = new Set(), items = [];
    let m;
    AN_EP.lastIndex = 0;
    while ((m = AN_EP.exec(r.text)) && items.length < 400) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      items.push({ url: m[1], title: strip(m[2]) || 'Episode' });
    }
    items.reverse();
    const syn = /<div[^>]+class="[^"]*(?:sinopsis|desc|entry-content)[^"]*"[^>]*>([\s\S]{0,900}?)<\/div>/i.exec(r.text);
    return out(res, 200, { status: 'success', items, synopsis: syn ? strip(syn[1]).slice(0, 500) : '', host: dom });
  }

  if (step === 'episode') {
    const url = String(b.url || '').trim();
    if (!/^https?:\/\//i.test(url)) return out(res, 400, { status: 'error', message: 'URL tidak valid.' });
    const r = await getHtml(url, base);
    if (!r.ok) return out(res, 502, { status: 'error', message: 'Episode gagal (' + r.code + ').' });
    const out2 = [], seen = new Set();
    const re = /<(?:iframe|source)[^>]+(?:data-src|src)="([^"]+)"/gi;
    let m;
    while ((m = re.exec(r.text))) {
      let u = m[1];
      if (!/^https?:\/\//i.test(u)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out2.push({ url: u, m3u8: /\.m3u8/i.test(u), host: (u.match(/^https?:\/\/([^\/]+)/) || [])[1] || '' });
    }
    const mp = /https?:\\?\/\\?\/[^"'\s]+?\.m3u8[^"'\s]*/gi;
    const raw = r.text.replace(/\\\//g, '/');
    while ((m = mp.exec(raw))) {
      if (!seen.has(m[0])) { seen.add(m[0]); out2.unshift({ url: m[0], m3u8: true, host: 'm3u8' }); }
    }
    if (!out2.length) return out(res, 502, { status: 'error', message: 'Tidak ada server di episode ini.' });
    return out(res, 200, { status: 'success', servers: out2.slice(0, 12), host: dom });
  }

  return out(res, 400, { status: 'error', message: 'step tidak dikenal.' });
                                    }
    
/* ---------- temp mail ---------- */
async function mt(prov, path, opt = {}, token) {
  const h = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await tf(MT_BASE[prov] + path, { ...opt, headers: h }, 9000);
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, code: r.status, d };
}

async function gm(f, extra = '') {
  const r = await tf('https://api.guerrillamail.com/ajax.php?f=' + f + '&agent=zukai-lab' + extra, {}, 9000);
  return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) };
}

async function plusList(addr) {
  const r = await tf('https://tempmail.plus/api/mails?email=' + encodeURIComponent(addr) + '&epin=&first_id=0', {}, 9000);
  return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) };
}

async function dropGraphql(query, vars) {
  const r = await tf('https://api.maildrop.cc/graphql', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: vars })
  }, 9000);
  return { ok: r.ok, code: r.status, d: await r.json().catch(() => ({})) };
}

async function doMail(req, res) {
  const b = req.body || {};
  const step = String(b.step || req.query.step || '');
  const prov = String(b.provider || 'mailtm').toLowerCase();

  if (step === 'domains') {
    if (MT_BASE[prov]) {
      const r = await mt(prov, '/domains?page=1');
      const list = ((r.d && r.d['hydra:member']) || []).filter(x => !x.isPrivate && x.isActive !== false).map(x => x.domain);
      if (!list.length) return out(res, 502, { status: 'error', message: 'Domain tidak tersedia di provider ini.' });
      return out(res, 200, { status: 'success', domains: list.slice(0, 12) });
    }
    const stat = STATIC_DOM[prov];
    if (!stat) return out(res, 400, { status: 'error', message: 'Provider tidak dikenal.' });
    return out(res, 200, { status: 'success', domains: stat });
  }

  if (step === 'new') {
    const name = String(b.name || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24);
    const domain = String(b.domain || '').trim();
    if (name.length < 3) return out(res, 400, { status: 'error', message: 'Nama minimal 3 karakter.' });
    if (!domain) return out(res, 400, { status: 'error', message: 'Domain kosong.' });
    const address = name + '@' + domain;

    if (MT_BASE[prov]) {
      const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const c = await mt(prov, '/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
      if (!c.ok) return out(res, 409, { status: 'error', message: c.d['hydra:description'] || 'Alamat sudah dipakai, coba nama lain.' });
      const t = await mt(prov, '/token', { method: 'POST', body: JSON.stringify({ address, password }) });
      if (!t.ok || !t.d.token) return out(res, 502, { status: 'error', message: 'Gagal membuat sesi mailbox.' });
      return out(res, 200, { status: 'success', address, name, domain, provider: prov, password, token: t.d.token });
    }

    if (prov === 'guerrilla') {
      const s = await gm('get_email_address');
      if (!s.ok || !s.d.sid_token) return out(res, 502, { status: 'error', message: 'Guerrilla menolak sesi baru.' });
      const u = await gm('set_email_user', '&email_user=' + encodeURIComponent(name) + '&sid_token=' + s.d.sid_token);
      const addr = (u.d && u.d.email_addr) || s.d.email_addr;
      return out(res, 200, { status: 'success', address: addr, name: String(addr).split('@')[0], domain: String(addr).split('@')[1], provider: prov, sid: s.d.sid_token });
    }

    if (prov === 'plus' || prov === 'maildrop' || prov === 'onesec')
      return out(res, 200, { status: 'success', address, name, domain, provider: prov });

    return out(res, 400, { status: 'error', message: 'Provider tidak dikenal.' });
  }

  if (step === 'token') {
    if (!MT_BASE[prov]) return out(res, 200, { status: 'success' });
    const t = await mt(prov, '/token', { method: 'POST', body: JSON.stringify({ address: b.address, password: b.password }) });
    if (!t.ok || !t.d.token) return out(res, 401, { status: 'error', message: 'Sesi mailbox habis, buat alamat baru.' });
    return out(res, 200, { status: 'success', token: t.d.token });
  }

  if (step === 'list') {
    const addr = String(b.address || '');
    if (MT_BASE[prov]) {
      const r = await mt(prov, '/messages?page=1', {}, b.token);
      if (r.code === 401) return out(res, 401, { status: 'error', message: 'Sesi kedaluwarsa.' });
      return out(res, 200, { status: 'success', messages: (r.d['hydra:member'] || []).map(m => ({ id: m.id, from: (m.from && m.from.address) || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.seen, at: m.createdAt })) });
    }
    if (prov === 'guerrilla') {
      const r = await gm('get_email_list', '&offset=0&sid_token=' + encodeURIComponent(String(b.sid || '')));
      return out(res, 200, { status: 'success', messages: ((r.d && r.d.list) || []).map(m => ({ id: String(m.mail_id), from: m.mail_from, subject: m.mail_subject || '(tanpa subjek)', seen: false, at: new Date((m.mail_timestamp || 0) * 1000).toISOString() })) });
    }
    if (prov === 'plus') {
      const r = await plusList(addr);
      return out(res, 200, { status: 'success', messages: ((r.d && r.d.mail_list) || []).map(m => ({ id: String(m.id), from: m.from_mail || '?', subject: m.subject || '(tanpa subjek)', seen: !!m.seen, at: m.time || '' })) });
    }
    if (prov === 'maildrop') {
      const r = await dropGraphql('query($m:String!){inbox(mailbox:$m){id headerfrom subject date}}', { m: String(b.name || '') });
      return out(res, 200, { status: 'success', messages: (((r.d && r.d.data && r.d.data.inbox) || [])).map(m => ({ id: m.id, from: m.headerfrom, subject: m.subject || '(tanpa subjek)', seen: false, at: m.date })) });
    }
    if (prov === 'onesec') {
      const list = await tf(ONESEC + '?action=getMessages&login=' + encodeURIComponent(String(b.name || '')) + '&domain=' + encodeURIComponent(String(b.domain || '')), {}, 9000);
      const arr = await list.json().catch(() => []);
      return out(res, 200, { status: 'success', messages: (Array.isArray(arr) ? arr : []).map(m => ({ id: String(m.id), from: m.from, subject: m.subject || '(tanpa subjek)', seen: false, at: m.date })) });
    }
    return out(res, 400, { status: 'error', message: 'Provider tidak dikenal.' });
  }

  if (step === 'read') {
    const id = encodeURIComponent(String(b.id || ''));
    if (MT_BASE[prov]) {
      const r = await mt(prov, '/messages/' + id, {}, b.token);
      if (!r.ok) return out(res, 404, { status: 'error', message: 'Pesan tidak ditemukan.' });
      await mt(prov, '/messages/' + id, { method: 'PATCH', body: JSON.stringify({ seen: true }) }, b.token).catch(() => {});
      const m = r.d;
      return out(res, 200, { status: 'success', subject: m.subject || '(tanpa subjek)', from: (m.from && m.from.address) || '?', at: m.createdAt, html: Array.isArray(m.html) ? m.html.join('\n') : '', text: m.text || '' });
    }
    if (prov === 'guerrilla') {
      const r = await gm('fetch_email', '&email_id=' + id + '&sid_token=' + encodeURIComponent(String(b.sid || '')));
      if (!r.ok) return out(res, 404, { status: 'error', message: 'Pesan tidak ditemukan.' });
      return out(res, 200, { status: 'success', subject: r.d.mail_subject || '(tanpa subjek)', from: r.d.mail_from || '?', at: '', html: r.d.mail_body || '', text: '' });
    }
    if (prov === 'plus') {
      const r = await tf('https://tempmail.plus/api/mails/' + id + '?email=' + encodeURIComponent(String(b.address || '')) + '&epin=', {}, 9000);
      if (!r.ok) return out(res, 404, { status: 'error', message: 'Pesan tidak ditemukan.' });
      const m = await r.json().catch(() => ({}));
      return out(res, 200, { status: 'success', subject: m.subject || '(tanpa subjek)', from: m.from_mail || '?', at: m.time || '', html: m.html || '', text: m.text || '' });
    }
    if (prov === 'maildrop') {
      const r = await dropGraphql('query($m:String!,$i:String!){message(mailbox:$m,id:$i){id headerfrom subject html data}}', { m: String(b.name || ''), i: String(b.id || '') });
      const m = (r.d && r.d.data && r.d.data.message) || null;
      if (!m) return out(res, 404, { status: 'error', message: 'Pesan tidak ditemukan.' });
      return out(res, 200, { status: 'success', subject: m.subject || '(tanpa subjek)', from: m.headerfrom || '?', at: '', html: m.html || '', text: m.data || '' });
    }
    if (prov === 'onesec') {
      const r = await tf(ONESEC + '?action=readMessage&login=' + encodeURIComponent(String(b.name || '')) + '&domain=' + encodeURIComponent(String(b.domain || '')) + '&id=' + id, {}, 9000);
      const m = await r.json().catch(() => ({}));
      return out(res, 200, { status: 'success', subject: m.subject || '(tanpa subjek)', from: m.from || '?', at: m.date || '', html: m.htmlBody || '', text: m.textBody || '' });
    }
    return out(res, 400, { status: 'error', message: 'Provider tidak dikenal.' });
  }

  if (step === 'del') {
    const id = encodeURIComponent(String(b.id || ''));
    try {
      if (MT_BASE[prov]) await mt(prov, '/messages/' + id, { method: 'DELETE' }, b.token);
      else if (prov === 'guerrilla') await gm('del_email', '&email_ids[]=' + id + '&sid_token=' + encodeURIComponent(String(b.sid || '')));
    } catch (e) {}
    return out(res, 200, { status: 'success' });
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
    if (act === 'img') return await doImg(req, res);
    if (act === 'proxy' || act === 'hls') return await doProxy(req, res);
    if (act === 'manga') return await doManga(req, res);
    if (act === 'anime') return await doAnime(req, res);
    if (act === 'mail') return await doMail(req, res);
    return out(res, 404, { status: 'error', message: 'action tidak dikenal.' });
  } catch (e) {
    return out(res, 500, { status: 'error', message: e.message || 'internal error' });
  }
    }
