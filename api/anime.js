/* /api/anime — katalog AniList + resolver stream */
const AL = 'https://graphql.anilist.co';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HARD = 8500;
const PROBE = 2200;
const TTL = 5 * 60 * 1000;
const cache = new Map();
const hostCache = new Map();
const rl = new Map();

const SRC = {
  otakudesu: {
    label: 'Otakudesu',
    doms: ['otakudesu.io', 'otakudesu.blog', 'otakudesu.cloud'],
    search: q => '/?s=' + encodeURIComponent(q) + '&post_type=anime',
    item: /\/anime\/[a-z0-9\-_]+\/?$/i,
    ep: /\/episode\/[a-z0-9\-_]+\/?$/i
  },
  samehadaku: {
    label: 'Samehadaku',
    doms: ['samehadaku.li', 'samehadaku.care', 'samehadaku.email'],
    search: q => '/?s=' + encodeURIComponent(q),
    item: /\/anime\/[a-z0-9\-_]+\/?$/i,
    ep: /\/[a-z0-9\-_]+-episode-\d+\/?$/i
  },
  anoboy: {
    label: 'Anoboy',
    doms: ['anoboy.quest', 'anoboy.xyz', 'anoboy.be'],
    search: q => '/?s=' + encodeURIComponent(q),
    item: /^\/(?!episode|jadwal|genre|anime-list|ongoing|complete|movie|tv|ova|ona|special|dmca|about|contact|privacy|disclaimer|sitemap|page)[a-z0-9\-_.]+-?\/?$/i,
    ep: /\/[a-z0-9\-_.]+-episode-\d+\/?$/i
  }
};

const dec = s => String(s == null ? '' : s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');
const strip = s => dec(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const abs = (u, base) => { try { return new URL(u, base).href; } catch { return ''; } };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

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
  return e.n <= 80;
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

async function al(query, vars) {
  const key = query.replace(/\s+/g, ' ').slice(0, 60) + JSON.stringify(vars || {});
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.d;

  const r = await tf(AL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query, variables: vars || {} })
  }, 6000);

  const d = await r.json().catch(() => null);
  if (!d) throw Object.assign(new Error('AniList tidak bisa dibaca.'), { code: 502 });
  if (d.errors && !d.data) {
    const m = (d.errors[0] && d.errors[0].message) || 'AniList error';
    throw Object.assign(new Error(m), { code: 502 });
  }
  cache.set(key, { d, at: Date.now() });
  return d;
}

const MEDIA = `
  id
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  description(asHtml: false)
  genres
  averageScore
  popularity
  status
  seasonYear
  format
  episodes
  duration
  studios(isMain: true) { nodes { name } }
  trailer { id site }
  streamingEpisodes { title thumbnail url site }
  externalLinks { url site }
`;

const pick = m => ({
  id: m.id,
  title: (m.title && (m.title.english || m.title.romaji || m.title.native)) || 'Tanpa judul',
  cover: (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '',
  color: (m.coverImage && m.coverImage.color) || '#9d4edd',
  banner: m.bannerImage || '',
  score: m.averageScore || 0,
  year: m.seasonYear || 0,
  format: m.format || '',
  episodes: m.episodes || 0,
  genres: m.genres || []
});

async function pickHost(src) {
  const cfg = SRC[src];
  if (!cfg) throw Object.assign(new Error('sumber tidak dikenal'), { code: 400 });
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
    out.push({ url: href, title: title.slice(0, 140) });
    if (out.length >= 40) break;
  }
  return out;
}

function servers(html, base) {
  const out = [], seen = new Set();
  const push = (u, m3u8) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    let host = 'server';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {}
    out.push({ url: u, host, m3u8: !!m3u8 });
  };
  let m;
  const ifr = /<iframe\b[^>]*(?:src|data-src)=["']([^"']+)["']/gi;
  while ((m = ifr.exec(html))) push(abs(dec(m[1]), base));

  const found = [];
  const m3 = /(https?:)?\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
  while ((m = m3.exec(html))) found.push(abs(m[0], base));
  found.reverse().forEach(u => push(u, true));

  const srcs = /<(?:source|video)\b[^>]*src=["']([^"']+)["']/gi;
  while ((m = srcs.exec(html))) push(abs(dec(m[1]), base));

  return out.slice(0, 12);
}

async function resolveEpisodes(title) {
  for (const [key, cfg] of Object.entries(SRC)) {
    try {
      const host = await pickHost(key);
      const base = 'https://' + host;
      const r = await getHtml(base + cfg.search(title));
      if (!r.ok) continue;
      const items = links(r.html, base, cfg.item);
      if (!items.length) continue;
      const t = norm(title);
      const best = items.find(x => norm(x.title).includes(t) || t.includes(norm(x.title))) || items[0];
      const d = await getHtml(best.url);
      if (!d.ok) continue;
      const eps = links(d.html, best.url, cfg.ep).reverse();
      if (eps.length) return { source: cfg.label, url: best.url, episodes: eps };
    } catch {}
  }
  return null;
}

async function handle(step, b) {
  if (step === 'home') {
    const tab = String(b.tab || 'trending');
    const sort = tab === 'popular' ? 'POPULARITY_DESC' : tab === 'seasonal' ? 'POPULARITY_DESC' : 'TRENDING_DESC';
    const q = tab === 'seasonal'
      ? `query{Page(page:1,perPage:24){media(type:ANIME,sort:${sort},isAdult:false,season:${season()},seasonYear:${new Date().getFullYear()}){${MEDIA}}}}`
      : `query{Page(page:1,perPage:24){media(type:ANIME,sort:${sort},isAdult:false){${MEDIA}}}}`;
    const d = await al(q);
    const items = ((d.data || {}).Page || {}).media || [];
    if (!items.length) throw Object.assign(new Error('AniList kosong.'), { code: 502 });
    return { items: items.map(pick), tab };
  }

  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) throw Object.assign(new Error('Kata kunci minimal 2 huruf.'), { code: 400 });
    const d = await al(
      `query($q:String){Page(page:1,perPage:30){media(type:ANIME,isAdult:false,search:$q,sort:SEARCH_MATCH){${MEDIA}}}}`,
      { q }
    );
    const items = ((d.data || {}).Page || {}).media || [];
    return { items: items.map(pick) };
  }

  if (step === 'detail') {
    const id = Number(b.id);
    if (!id) throw Object.assign(new Error('id tidak valid.'), { code: 400 });
    const d = await al(`query($id:Int){Media(id:$id,type:ANIME){${MEDIA}}}`, { id });
    const m = (d.data || {}).Media;
    if (!m) throw Object.assign(new Error('Anime tidak ditemukan.'), { code: 404 });

    const media = pick(m);
    media.synopsis = strip(m.description || '').slice(0, 900);
    media.studio = ((m.studios || {}).nodes || []).map(x => x.name).filter(Boolean).join(', ');
    media.status = m.status || '';
    media.duration = m.duration || 0;
    media.trailer = m.trailer && m.trailer.site === 'youtube' ? m.trailer.id : '';
    media.streaming = (m.streamingEpisodes || []).slice(0, 30).map(x => ({ title: x.title, thumb: x.thumbnail, url: x.url, site: x.site }));
    media.links = (m.externalLinks || []).filter(x => x.url).slice(0, 6);

    const res = await resolveEpisodes(media.title).catch(() => null);
    return {
      media,
      episodes: res ? res.episodes.map((e, i) => ({ ...e, number: i + 1 })) : [],
      source: res ? res.source : '',
      sourceUrl: res ? res.url : ''
    };
  }

  if (step === 'stream') {
    if (!b.url) throw Object.assign(new Error('url episode kosong.'), { code: 400 });
    const r = await getHtml(b.url);
    if (!r.ok) throw Object.assign(new Error('Episode gagal (' + r.code + ').'), { code: 502 });
    const list = servers(r.html, b.url);
    if (!list.length) throw Object.assign(new Error('Tidak ada server di episode ini.'), { code: 502 });
    return { servers: list };
  }

  throw Object.assign(new Error('step tidak dikenal.'), { code: 400 });
}

function season() {
  const m = new Date().getMonth() + 1;
  return m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'FALL';
}

async function diag() {
  const out = [];
  await Promise.all(Object.entries(SRC).map(async ([key, cfg]) => {
    const row = { source: key, label: cfg.label, doms: [], live: false };
    await Promise.all(cfg.doms.map(async d => {
      const t0 = Date.now();
      try {
        const r = await tf('https://' + d + '/', { headers: { 'User-Agent': UA } });
        row.doms.push({ host: d, code: r.status, ms: Date.now() - t0, ok: r.ok });
      } catch { row.doms.push({ host: d, code: 0, ok: false }); }
    }));
    row.doms.sort((a, b) => (b.ok - a.ok) || (a.ms - b.ms));
    row.live = row.doms.some(x => x.ok);
    out.push(row);
  }));

  let anilist = false;
  try {
    const r = await tf(AL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query: '{Page(page:1,perPage:1){media(type:ANIME){id}}}' })
    }, 4000);
    anilist = r.ok;
  } catch {}

  out.sort((a, b) => b.live - a.live);
  return { anilist, sources: out };
}

module.exports = async function handler(req, res) {
  if (!limit((req.headers['x-forwarded-for'] || '').split(',')[0].trim())) {
    return json(res, 429, { status: 'error', message: 'Kebanyakan request, tunggu 1 menit.' });
  }

  const action = String(req.query.action || '').toLowerCase();
  if (action === 'diag') {
    try {
      return json(res, 200, { status: 'success', ...(await Promise.race([diag(), new Promise(r => setTimeout(() => r({ anilist: false, sources: [] }), HARD))])) });
    } catch { return json(res, 200, { status: 'success', anilist: false, sources: [] }); }
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
