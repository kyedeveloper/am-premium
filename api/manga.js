/* /api/manga — MangaDex + Comick + Shinigami */
const UA = 'zukai/2.0';
const HARD = 8500;
const PROBE = 2200;
const TTL = 5 * 60 * 1000;
const cache = new Map();
const hostCache = new Map();
const rl = new Map();

const MD = 'https://api.mangadex.org';
const CK = 'https://api.comick.fun';
const MDO = 'https://mangadex.org';

const SRC = {
  mangadex: { label: 'MangaDex', doms: ['api.mangadex.org'], api: true },
  comick: { label: 'Comick', doms: ['api.comick.fun'], api: true },
  shinigami: {
    label: 'Shinigami',
    doms: ['11.shinigami.asia', '08.shinigami.asia', 'shinigami.asia', 'shinigami.to'],
    item: /\/series\/[a-z0-9\-_]+\/?$/i,
    ep: /\/series\/[a-z0-9\-_]+\/chapter\/[\d.\-]+\/?$/i
  }
};

const dec = s => String(s == null ? '' : s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const strip = s => dec(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const abs = (u, base) => { try { return new URL(u, base).href; } catch { return ''; } };
const img = u => '/api/manga?action=img&url=' + encodeURIComponent(u);

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function limit(ip) {
  const now = Date.now(), k = ip || 'x';
  const e = rl.get(k) || { n: 0, t: now };
  if (now - e.t > 60000) { e.n = 0; e.t = now; }
  e.n++; rl.set(k, e);
  return e.n <= 90;
}

async function tf(url, opts, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms || PROBE);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctrl.signal, ...(opts || {}) });
  } finally { clearTimeout(to); }
}
async function getHtml(url) {
  const r = await tf(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' } }, 6000);
  return { ok: r.ok, code: r.status, html: (await r.text()) || '' };
}

async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.d;
  const d = await fn();
  cache.set(key, { d, at: Date.now() });
  return d;
}

async function mdJson(path) {
  return cached('md' + path, TTL, async () => {
    const r = await tf(MD + path, { headers: { 'User-Agent': UA } }, 6000);
    if (!r.ok) throw Object.assign(new Error('mangadex ' + r.status), { code: 502 });
    return r.json();
  });
}
async function ckJson(path) {
  return cached('ck' + path, TTL, async () => {
    const r = await tf(CK + path, { headers: { 'User-Agent': UA } }, 6000);
    if (!r.ok) throw Object.assign(new Error('comick ' + r.status), { code: 502 });
    return r.json();
  });
}

function mdCover(m) {
  const rel = (m.relationships || []).find(x => x.type === 'cover_art');
  const f = rel && rel.attributes && rel.attributes.fileName;
  return f ? img('https://uploads.mangadex.org/covers/' + m.id + '/' + f + '.512.jpg') : '';
}
function mdItem(m) {
  const t = (m.attributes && m.attributes.title) || {};
  return {
    id: m.id,
    title: t.en || t['ja-ro'] || Object.values(t)[0] || 'Tanpa judul',
    cover: mdCover(m),
    status: (m.attributes && m.attributes.status) || '',
    year: (m.attributes && m.attributes.year) || 0
  };
}
function mdTagName(t) {
  const n = (t.attributes && t.attributes.name) || {};
  return n.en || Object.values(n)[0] || '';
}

async function pickHost(src) {
  const cfg = SRC[src];
  if (!cfg) throw Object.assign(new Error('sumber tidak dikenal'), { code: 400 });
  if (cfg.api) return cfg.doms[0];
  const hit = hostCache.get(src);
  if (hit && Date.now() - hit.at < TTL) return hit.host;
  const found = await Promise.all(cfg.doms.map(async d => {
    try { const r = await tf('https://' + d + '/', { headers: { 'User-Agent': UA } }); return r.ok || r.status < 500 ? d : null; }
    catch { return null; }
  }));
  const host = found.find(Boolean);
  if (!host) throw Object.assign(new Error('semua domain ' + cfg.label + ' mati'), { code: 502 });
  hostCache.set(src, { host, at: Date.now() });
  return host;
}

function links(html, base, re) {
  const out = [], seen = new Set();
  const aRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aRe.exec(html))) {
    const href = abs(m[1], base);
    if (!href || seen.has(href)) continue;
    let path;
    try { path = new URL(href).pathname; } catch { continue; }
    if (!re.test(path)) continue;
    const title = strip(m[2]);
    if (!title) continue;
    seen.add(href);
    const tail = html.slice(Math.max(0, m.index - 420), m.index);
    const c = /<img\b[^>]*src=["']([^"']+)["']/i.exec(tail);
    out.push({ url: href, title: title.slice(0, 140), cover: c ? img(abs(c[1], base)) : '' });
    if (out.length >= 40) break;
  }
  return out;
}

async function handle(step, b) {
  const src = SRC[b.source] ? b.source : 'mangadex';

  if (src === 'mangadex') {
    const base = '/manga?limit=24&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive';

    if (step === 'home') {
      const d = await mdJson(base + '&order[latestUploadedChapter]=desc');
      const items = (d.data || []).map(mdItem);
      return { items, trending: items.slice(0, 12), latest: items.slice(12) };
    }
    if (step === 'popular') {
      const d = await mdJson(base + '&order[followedCount]=desc');
      return { items: (d.data || []).map(mdItem) };
    }
    if (step === 'genres') {
      const d = await mdJson('/manga/tag');
      return { items: (d.data || []).map(t => ({ id: t.id, name: mdTagName(t) })).filter(x => x.name).slice(0, 40) };
    }
    if (step === 'bygenre') {
      const d = await mdJson(base + '&includedTags[]=' + encodeURIComponent(b.tag || ''));
      return { items: (d.data || []).map(mdItem) };
    }
    if (step === 'search') {
      const q = String(b.q || '').trim();
      if (q.length < 2) throw Object.assign(new Error('Kata kunci minimal 2 huruf.'), { code: 400 });
      const d = await mdJson(base + '&title=' + encodeURIComponent(q));
      return { items: (d.data || []).map(mdItem) };
    }
    if (step === 'detail') {
      const d = await mdJson('/manga/' + encodeURIComponent(b.id) + '?includes[]=cover_art&includes[]=author');
      const m = d.data;
      if (!m) throw Object.assign(new Error('Manga tidak ditemukan.'), { code: 404 });
      const it = mdItem(m);
      it.synopsis = strip(((m.attributes || {}).description || {}).en || Object.values((m.attributes || {}).description || {})[0] || '').slice(0, 1200);
      it.tags = ((m.attributes || {}).tags || []).map(mdTagName).filter(Boolean);
      it.author = ((m.relationships || []).find(x => x.type === 'author') || {}).attributes?.name || '';
      return { media: it };
    }
    if (step === 'chapters') {
      const d = await mdJson('/manga/' + encodeURIComponent(b.id) + '/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500');
      const items = (d.data || []).map(c => ({
        id: c.id,
        num: (c.attributes && c.attributes.chapter) || '?',
        at: (c.attributes && c.attributes.publishAt) || ''
      }));
      return { items };
    }
    if (step === 'pages') {
      const d = await mdJson('/at-home/server/' + encodeURIComponent(b.id));
      const host = d.baseUrl, h = d.chapter.hash;
      const files = (d.chapter.data && d.chapter.data.length ? d.chapter.data : d.chapter.dataSaver) || [];
      return { pages: files.map(f => img(host + '/data/' + h + '/' + f)) };
    }
  }

  if (src === 'comick') {
    if (step === 'home' || step === 'popular') {
      const d = await ckJson('/v1.0/search?limit=24&sort=follow&q=');
      const items = (Array.isArray(d) ? d : []).map(c => ({
        id: c.hid || c.slug,
        title: c.title || c.slug,
        cover: c.md_covers && c.md_covers[0] ? img('https://meo.comick.pictures/' + c.md_covers[0].b2key) : ''
      }));
      return { items, trending: items.slice(0, 12), latest: items.slice(12) };
    }
    if (step === 'search') {
      const q = String(b.q || '').trim();
      if (q.length < 2) throw Object.assign(new Error('Kata kunci minimal 2 huruf.'), { code: 400 });
      const d = await ckJson('/v1.0/search?limit=30&q=' + encodeURIComponent(q));
      return { items: (Array.isArray(d) ? d : []).map(c => ({
        id: c.hid || c.slug,
        title: c.title || c.slug,
        cover: c.md_covers && c.md_covers[0] ? img('https://meo.comick.pictures/' + c.md_covers[0].b2key) : ''
      })) };
    }
    if (step === 'chapters') {
      const d = await ckJson('/comic/' + encodeURIComponent(b.id) + '/chapters?lang=en&limit=500');
      const items = (d.chapters || []).map(c => ({ id: c.hid, num: c.chap || '?', at: c.created_at || '' }));
      return { items };
    }
    if (step === 'pages') {
      const d = await ckJson('/chapter/' + encodeURIComponent(b.id) + '?tachiyomi=true');
      return { pages: ((d.chapter && d.chapter.images) || []).map(img) };
    }
    if (step === 'detail') {
      const d = await ckJson('/comic/' + encodeURIComponent(b.id));
      const c = d.comic || d;
      return { media: {
        id: b.id,
        title: c.title || '',
        cover: c.md_covers && c.md_covers[0] ? img('https://meo.comick.pictures/' + c.md_covers[0].b2key) : '',
        synopsis: strip(c.desc || '').slice(0, 1200),
        tags: (c.genres || []).map(g => g.name || g).filter(Boolean)
      } };
    }
    if (step === 'genres') return { items: [] };
    if (step === 'bygenre') throw Object.assign(new Error('Genre belum didukung di Comick.'), { code: 400 });
  }

  /* shinigami */
  const cfg = SRC[src];
  const host = await pickHost(src);
  const base = 'https://' + host;

  if (step === 'home' || step === 'popular') {
    const r = await getHtml(base + '/');
    if (!r.ok) throw Object.assign(new Error('Beranda gagal (' + r.code + ').'), { code: 502 });
    const items = links(r.html, base, cfg.item);
    if (!items.length) throw Object.assign(new Error('Sumber tidak bisa dibaca.'), { code: 502 });
    return { items, trending: items.slice(0, 12), latest: items.slice(12) };
  }
  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) throw Object.assign(new Error('Kata kunci minimal 2 huruf.'), { code: 400 });
    const r = await getHtml(base + '/?s=' + encodeURIComponent(q));
    if (!r.ok) throw Object.assign(new Error('Pencarian gagal (' + r.code + ').'), { code: 502 });
    return { items: links(r.html, base, cfg.item) };
  }
  if (step === 'detail') {
    const r = await getHtml(b.url);
    if (!r.ok) throw Object.assign(new Error('Detail gagal (' + r.code + ').'), { code: 502 });
    const title = (/<h1[^>]*>([\s\S]{1,200}?)<\/h1>/i.exec(r.html) || [])[1] || '';
    const desc = (/<div[^>]*class=["'][^"']*(?:entry-content|summary|synopsis)[^"']*["'][^>]*>([\s\S]{20,4000}?)<\/div>/i.exec(r.html) || [])[1] || '';
    return { media: { id: b.url, title: strip(title), cover: '', synopsis: strip(desc).slice(0, 1200), tags: [] } };
  }
  if (step === 'chapters') {
    const r = await getHtml(b.url);
    if (!r.ok) throw Object.assign(new Error('Chapter gagal (' + r.code + ').'), { code: 502 });
    const items = links(r.html, b.url, cfg.ep).map(x => ({
      id: x.url,
      num: (x.title.match(/[\d.]+/) || ['?'])[0],
      at: ''
    }));
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
      if (!u || /logo|icon|avatar|banner|favicon|placeholder/i.test(u)) continue;
      if (!out.includes(u)) out.push(img(u));
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
    const row = { source: key, label: cfg.label, doms: [], live: false };
    await Promise.all(cfg.doms.map(async d => {
      const t0 = Date.now();
      try {
        const r = await tf('https://' + d + '/', { headers: { 'User-Agent': UA } });
        row.doms.push({ host: d, code: r.status, ms: Date.now() - t0, ok: r.ok || r.status < 500 });
      } catch { row.doms.push({ host: d, code: 0, ok: false }); }
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
      let ref = MDO + '/';
      if (/shinigami/i.test(url)) ref = 'https://shinigami.asia/';
      if (/comick|meo\./i.test(url)) ref = 'https://comick.io/';
      const r = await tf(url, { headers: { 'User-Agent': UA, 'Referer': ref } }, 8000);
      if (!r.ok) return json(res, r.status, { status: 'error', message: 'img ' + r.status });
      const buf = Buffer.from(await r.arrayBuffer());
      res.statusCode = 200;
      res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.end(buf);
    } catch { return json(res, 502, { status: 'error', message: 'img gagal' }); }
  }

  if (action === 'diag') {
    try { return json(res, 200, { status: 'success', ...(await Promise.race([diag(), new Promise(r => setTimeout(() => r({ sources: [] }), HARD))])) }); }
    catch { return json(res, 200, { status: 'success', sources: [] }); }
  }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const step = String(body.step || action || '').toLowerCase();

  const work = handle(step, body).then(d => ({ ok: true, d })).catch(e => ({ ok: false, e }));
  const raced = await Promise.race([work, new Promise(r => setTimeout(() => r({ timeout: true }), HARD))]);

  if (raced.timeout) return json(res, 504, { status: 'error', message: 'Server lambat. Coba lagi.' });
  if (!raced.ok) return json(res, raced.e.code || 502, { status: 'error', message: raced.e.message || 'Gagal mengambil data.' });
  return json(res, 200, { status: 'success', ...raced.d });
};
