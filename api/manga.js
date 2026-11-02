/* /api/manga — MangaDex + Comick + Shinigami, anti-500 */
const UA = 'zukai-lab/1.0';
const HARD_MS = 8500;
const PROBE_MS = 2500;
const CACHE_MS = 10 * 60 * 1000;
const hostCache = new Map();
const rl = new Map();

const MD = 'https://api.mangadex.org';
const CK = 'https://api.comick.fun';

const SRC = {
  mangadex: { label: 'MangaDex', doms: ['api.mangadex.org'], api: true },
  comick: { label: 'Comick', doms: ['api.comick.fun'], api: true },
  shinigami: {
    label: 'Shinigami',
    doms: ['11.shinigami.asia', '08.shinigami.asia', 'shinigami.asia', 'shinigami.to', 'shinigami.ae'],
    item: /\/series\/[a-z0-9\-_]+\/?$/i,
    ep: /\/series\/[a-z0-9\-_]+\/chapter\/[\d.\-]+\/?$/i
  }
};

const dec = s => String(s == null ? '' : s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const strip = s => dec(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const abs = (u, base) => { try { return new URL(u, base).href; } catch { return ''; } };

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function limit(ip) {
  const now = Date.now();
  const k = ip || 'x';
  const e = rl.get(k) || { n: 0, t: now };
  if (now - e.t > 60000) { e.n = 0; e.t = now; }
  e.n++; rl.set(k, e.n > 90 ? e : e);
  return e.n <= 90;
}
async function tf(url, opts, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms || PROBE_MS);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/json,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
      },
      ...(opts || {})
    });
  } finally { clearTimeout(to); }
}
async function getHtml(url) {
  const r = await tf(url, null, 6000);
  return { ok: r.ok, code: r.status, html: (await r.text()) || '' };
}
async function pickHost(src) {
  const cfg = SRC[src];
  if (!cfg) throw Object.assign(new Error('sumber tidak dikenal'), { code: 400 });
  if (cfg.api) return cfg.doms[0];
  const hit = hostCache.get(src);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.host;
  const found = await Promise.all(cfg.doms.map(async d => {
    try { const r = await tf('https://' + d + '/'); return r.ok || r.status < 500 ? d : null; }
    catch { return null; }
  }));
  const host = found.find(Boolean);
  if (!host) throw Object.assign(new Error('semua domain ' + cfg.label + ' tidak merespons'), { code: 502 });
  hostCache.set(src, { host, at: Date.now() });
  return host;
}

function links(html, base, re) {
  const out = [];
  const seen = new Set();
  const aRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aRe.exec(html))) {
    const href = abs(m[1], base);
    if (!href || seen.has(href)) continue;
    let path;
    try { path = new URL(href).pathname; } catch { continue; }
    if (!re.test(path)) continue;
    const title = strip(m[2]);
    if (!title || title.length < 2) continue;
    seen.add(href);
    const tail = html.slice(Math.max(0, m.index - 400), m.index);
    const img = /<img\b[^>]*src=["']([^"']+)["']/i.exec(tail);
    out.push({ url: href, title: title.slice(0, 120), cover: img ? abs(img[1], base) : '' });
    if (out.length >= 30) break;
  }
  return out;
}

function mdImg(u) { return '/api/manga?action=img&url=' + encodeURIComponent(u); }

async function mdJson(path) {
  const r = await tf(MD + path, { headers: { 'User-Agent': UA } }, 6000);
  if (!r.ok) throw Object.assign(new Error('mangadex ' + r.status), { code: 502 });
  return r.json();
}
function mdCover(m) {
  const rel = (m.relationships || []).find(x => x.type === 'cover_art');
  if (!rel || !rel.attributes || !rel.attributes.fileName) return '';
  return mdImg('https://uploads.mangadex.org/covers/' + m.id + '/' + rel.attributes.fileName + '.256.jpg');
}
function mdItem(m) {
  const t = (m.attributes && (m.attributes.title || {})) || {};
  return { id: m.id, title: t.en || t['ja-ro'] || Object.values(t)[0] || 'Tanpa judul', cover: mdCover(m) };
}

async function handle(step, b) {
  const src = SRC[b.source] ? b.source : 'mangadex';

  if (src === 'mangadex') {
    if (step === 'home') {
      const d = await mdJson('/manga?limit=24&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&order[latestUploadedChapter]=desc');
      const items = (d.data || []).map(mdItem);
      return { trending: items.slice(0, 12), latest: items.slice(12, 24) };
    }
    if (step === 'genres') {
      const d = await mdJson('/manga/tag');
      const items = (d.data || []).map(t => ({ id: t.id, name: (t.attributes && t.attributes.name && (t.attributes.name.en || Object.values(t.attributes.name)[0])) || '' }));
      return { items: items.slice(0, 40) };
    }
    if (step === 'bygenre') {
      const d = await mdJson('/manga?limit=24&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&includedTags[]=' + encodeURIComponent(b.tag || ''));
      return { items: (d.data || []).map(mdItem) };
    }
    if (step === 'search') {
      const q = String(b.q || '').trim();
      if (q.length < 2) throw Object.assign(new Error('Kata kunci terlalu pendek.'), { code: 400 });
      const d = await mdJson('/manga?limit=24&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&title=' + encodeURIComponent(q));
      return { items: (d.data || []).map(mdItem) };
    }
    if (step === 'chapters') {
      const d = await mdJson('/manga/' + encodeURIComponent(b.id) + '/feed?translatedLanguage[]=en&order[chapter]=asc&limit=500&includes[]=scanlation_group');
      const items = (d.data || []).map(c => ({ id: c.id, num: (c.attributes && c.attributes.chapter) || '?' }));
      return { items };
    }
    if (step === 'pages') {
      const d = await mdJson('/at-home/server/' + encodeURIComponent(b.id));
      const host = d.baseUrl, h = d.chapter.hash, files = (d.chapter.data && d.chapter.data.length ? d.chapter.data : d.chapter.dataSaver) || [];
      return { pages: files.map(f => mdImg(host + '/data/' + h + '/' + f)) };
    }
  }

  if (src === 'comick') {
    if (step === 'search' || step === 'home') {
      const q = step === 'home' ? '' : String(b.q || '').trim();
      if (step === 'search' && q.length < 2) throw Object.assign(new Error('Kata kunci terlalu pendek.'), { code: 400 });
      const r = await tf(CK + '/v1.0/search?limit=24&q=' + encodeURIComponent(q), { headers: { 'User-Agent': UA } }, 6000);
      if (!r.ok) throw Object.assign(new Error('comick ' + r.status), { code: 502 });
      const d = await r.json();
      const items = (Array.isArray(d) ? d : []).map(c => ({
        id: c.hid || c.slug,
        title: c.title || c.slug,
        cover: c.md_covers && c.md_covers[0] ? mdImg('https://meo.comick.pictures/' + c.md_covers[0].b2key) : ''
      }));
      return step === 'home' ? { trending: items.slice(0, 12), latest: items.slice(12, 24) } : { items };
    }
    if (step === 'chapters') {
      const r = await tf(CK + '/comic/' + encodeURIComponent(b.id) + '/chapters?lang=en&limit=500', { headers: { 'User-Agent': UA } }, 6000);
      if (!r.ok) throw Object.assign(new Error('comick ' + r.status), { code: 502 });
      const d = await r.json();
      const list = (d.chapters || []).map(c => ({ id: c.hid, num: c.chap || '?' })).reverse();
      return { items: list };
    }
    if (step === 'pages') {
      const r = await tf(CK + '/chapter/' + encodeURIComponent(b.id) + '?tachiyomi=true', { headers: { 'User-Agent': UA } }, 6000);
      if (!r.ok) throw Object.assign(new Error('comick ' + r.status), { code: 502 });
      const d = await r.json();
      return { pages: (d.chapter && d.chapter.images || []).map(u => mdImg(u)) };
    }
    if (step === 'genres') return { items: [] };
    if (step === 'bygenre') throw Object.assign(new Error('Genre belum didukung di Comick.'), { code: 400 });
  }

  /* shinigami (scrape) */
  const cfg = SRC[src];
  const host = await pickHost(src);
  const base = 'https://' + host;

  if (step === 'home') {
    const r = await getHtml(base + '/');
    if (!r.ok) throw Object.assign(new Error('Beranda gagal (' + r.code + ').'), { code: 502 });
    const items = links(r.html, base, cfg.item);
    if (!items.length) throw Object.assign(new Error('Sumber tidak bisa dibaca.'), { code: 502 });
    return { trending: items.slice(0, 12), latest: items.slice(12, 24) };
  }
  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) throw Object.assign(new Error('Kata kunci terlalu pendek.'), { code: 400 });
    const r = await getHtml(base + '/?s=' + encodeURIComponent(q));
    if (!r.ok) throw Object.assign(new Error('Pencarian gagal (' + r.code + ').'), { code: 502 });
    return { items: links(r.html, base, cfg.item) };
  }
  if (step === 'chapters') {
    const r = await getHtml(b.url);
    if (!r.ok) throw Object.assign(new Error('Chapter gagal (' + r.code + ').'), { code: 502 });
    const items = links(r.html, b.url, cfg.ep).map(x => ({ id: x.url, num: (x.title.match(/[\d.]+/) || ['?'])[0] }));
    return { items };
  }
  if (step === 'pages') {
    const r = await getHtml(b.id);
    if (!r.ok) throw Object.assign(new Error('Halaman gagal (' + r.code + ').'), { code: 502 });
    const out = [];
    const re = /<img\b[^>]*(?:data-src|src)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
    let m;
    while ((m = re.exec(r.html))) {
      const u = abs(dec(m[1]), b.id);
      if (!u || /logo|icon|avatar|banner|favicon/i.test(u)) continue;
      if (!out.includes(u)) out.push(mdImg(u));
    }
    if (!out.length) throw Object.assign(new Error('Halaman tidak ditemukan.'), { code: 502 });
    return { pages: out };
  }
  if (step === 'genres') return { items: [] };
  if (step === 'bygenre') throw Object.assign(new Error('Genre belum didukung di sumber ini.'), { code: 400 });

  throw Object.assign(new Error('step tidak dikenal.'), { code: 400 });
}

async function diag() {
  const out = [];
  await Promise.all(Object.entries(SRC).map(async ([key, cfg]) => {
    const row = { source: key, label: cfg.label, doms: [] };
    await Promise.all(cfg.doms.map(async d => {
      const t0 = Date.now();
      try {
        const r = await tf('https://' + d + '/');
        row.doms.push({ host: d, code: r.status, ms: Date.now() - t0, ok: r.ok });
      } catch (e) {
        row.doms.push({ host: d, code: 0, ms: Date.now() - t0, ok: false });
      }
    }));
    row.doms.sort((a, b) => (b.ok - a.ok) || (a.ms - b.ms));
    row.live = row.doms.some(x => x.ok);
    out.push(row);
  }));
  return { sources: out };
}

module.exports = async function handler(req, res) {
  if (!limit((req.headers['x-forwarded-for'] || '').split(',')[0].trim())) {
    return json(res, 429, { status: 'error', message: 'Kebanyakan request, tunggu 1 menit.' });
  }

  const action = String(req.query.action || '').toLowerCase();

  if (action === 'img') {
    const url = String(req.query.url || '');
    if (!/^https?:\/\//.test(url)) return json(res, 400, { status: 'error', message: 'url invalid' });
    try {
      let ref = 'https://mangadex.org/';
      if (/shinigami/i.test(url)) ref = 'https://shinigami.asia/';
      if (/comick|meo\./i.test(url)) ref = 'https://comick.io/';
      const r = await tf(url, { headers: { 'User-Agent': UA, 'Referer': ref } }, 8000);
      if (!r.ok) return json(res, r.status, { status: 'error', message: 'img ' + r.status });
      const buf = Buffer.from(await r.arrayBuffer());
      res.statusCode = 200;
      res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(buf);
    } catch {
      return json(res, 502, { status: 'error', message: 'img gagal' });
    }
  }

  if (action === 'diag') {
    try { return json(res, 200, { status: 'success', ...(await Promise.race([diag(), new Promise(r => setTimeout(() => r({ sources: [] }), HARD_MS))])) }); }
    catch { return json(res, 200, { status: 'success', sources: [] }); }
  }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const step = String(body.step || action || '').toLowerCase();

  const work = handle(step, body).then(d => ({ ok: true, d })).catch(e => ({ ok: false, e }));
  const raced = await Promise.race([work, new Promise(r => setTimeout(() => r({ timeout: true }), HARD_MS))]);

  if (raced.timeout) return json(res, 504, { status: 'error', message: 'Server lambat. Coba lagi atau ganti sumber.' });
  if (!raced.ok) return json(res, raced.e.code || 502, { status: 'error', message: raced.e.message || 'Gagal mengambil data.' });
  return json(res, 200, { status: 'success', ...raced.d });
};
