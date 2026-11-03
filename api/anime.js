'use strict';

const ANILIST = 'https://graphql.anilist.co';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';
const HARD_MS = 8500;
const PROBE_MS = 2200;
const HOSTS = [
  'https://v1.samehadaku.how',
  'https://samehadaku.vip',
  'https://samehadaku.email',
  'https://samehadaku.fit'
];

let cachedHost = null;
const cache = new Map();

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}

function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise(function (_, rej) {
      setTimeout(function () { rej(new Error('timeout ' + ms + 'ms')); }, ms);
    })
  ]);
}

function cget(k) {
  const v = cache.get(k);
  if (!v) return null;
  if (v.exp < Date.now()) { cache.delete(k); return null; }
  return v.data;
}

function cset(k, d, ttl) {
  if (cache.size > 300) cache.clear();
  cache.set(k, { data: d, exp: Date.now() + (ttl || 300000) });
}

async function getText(url, headers, ms) {
  const r = await withTimeout(fetch(url, { headers: headers || {} }), ms || HARD_MS);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.text();
}

async function anilist(query, variables) {
  const r = await withTimeout(fetch(ANILIST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA
    },
    body: JSON.stringify({ query: query, variables: variables || {} })
  }), HARD_MS);
  if (!r.ok) throw new Error('anilist HTTP ' + r.status);
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error('anilist: ' + j.errors[0].message);
  return j.data;
}

const MEDIA = `
fragment M on Media {
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large color }
  bannerImage
  description(asHtml: false)
  format
  status
  season
  seasonYear
  episodes
  duration
  averageScore
  popularity
  genres
  isAdult
  siteUrl
  studios(isMain: true) { nodes { name } }
  streamingEpisodes { title thumbnail url site }
  nextAiringEpisode { episode airingAt }
}`;

function card(m) {
  if (!m) return null;
  return {
    id: m.id,
    malId: m.idMal,
    title: (m.title && (m.title.english || m.title.romaji || m.title.native)) || 'Untitled',
    titleNative: (m.title && m.title.native) || null,
    cover: m.coverImage ? (m.coverImage.extraLarge || m.coverImage.large) : null,
    color: m.coverImage ? m.coverImage.color : null,
    banner: m.bannerImage || null,
    description: m.description || null,
    format: m.format || null,
    status: m.status || null,
    season: m.season || null,
    year: m.seasonYear || null,
    episodes: m.episodes || null,
    duration: m.duration || null,
    score: m.averageScore || null,
    popularity: m.popularity || null,
    genres: m.genres || [],
    studio: (m.studios && m.studios.nodes && m.studios.nodes[0]) ? m.studios.nodes[0].name : null,
    siteUrl: m.siteUrl || null,
    next: m.nextAiringEpisode || null,
    streaming: m.streamingEpisodes || []
  };
}

async function pickHost() {
  if (cachedHost) return cachedHost;
  for (let i = 0; i < HOSTS.length; i++) {
    const h = HOSTS[i];
    try {
      const r = await withTimeout(fetch(h + '/', { headers: { 'User-Agent': UA } }), PROBE_MS);
      if (r.ok) { cachedHost = h; return h; }
    } catch (e) { /* coba host berikutnya */ }
  }
  cachedHost = HOSTS[0];
  return cachedHost;
}

async function scrapeAnime(q) {
  const key = 's:' + q;
  const hit = cget(key);
  if (hit) return hit;
  const host = await pickHost();
  const html = await getText(
    host + '/?s=' + encodeURIComponent(q) + '&post_type=anime',
    { 'User-Agent': UA, Referer: host + '/' }
  );
  const out = [];
  const seen = {};
  const re = /href="([^"]*\/anime\/([a-z0-9\-]+)\/?)"[^>]*>([^<]{1,150})</gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[2];
    if (!slug || seen[slug]) continue;
    seen[slug] = 1;
    out.push({ slug: slug, title: m[3].trim(), url: host + '/anime/' + slug + '/' });
    if (out.length >= 20) break;
  }
  cset(key, out);
  return out;
}

async function scrapeEpisodes(slug) {
  const key = 'e:' + slug;
  const hit = cget(key);
  if (hit) return hit;
  const host = await pickHost();
  const html = await getText(host + '/anime/' + slug + '/', { 'User-Agent': UA, Referer: host + '/' });
  const out = [];
  const seen = {};
  const re = /href="([^"]*\/episode\/([a-z0-9\-]+)\/?)"[^>]*>([^<]{0,150})</gi;
  let m;
  while ((m = re.exec(html))) {
    const es = m[2];
    if (!es || seen[es]) continue;
    seen[es] = 1;
    out.push({
      slug: es,
      title: (m[3] || '').trim() || es.replace(/-/g, ' '),
      url: host + '/episode/' + es + '/'
    });
  }
  out.reverse();
  cset(key, out, 600000);
  return out;
}

async function scrapeStream(epSlug) {
  const key = 'v:' + epSlug;
  const hit = cget(key);
  if (hit) return hit;
  const host = await pickHost();
  const html = await getText(host + '/episode/' + epSlug + '/', { 'User-Agent': UA, Referer: host + '/' });
  const out = [];
  const seen = {};
  const re = /(?:src|data-src)="(https?:\/\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (seen[u]) continue;
    if (/samehadaku|gstatic|google|fonts|wp-content|jquery|\.css|\.js(\?|$)/i.test(u)) continue;
    seen[u] = 1;
    out.push({ url: u, embed: true, proxy: '/api/anime?action=proxy&url=' + encodeURIComponent(u) });
  }
  const res = { sources: out };
  cset(res, res, 300000);
  cset(key, res, 300000);
  return res;
}

function abs(u, base) {
  try { return new URL(u, base).href; } catch (e) { return u; }
}

async function handleProxy(res, q, action) {
  const target = q.url || q.u;
  if (!target || !/^https?:\/\//i.test(target)) {
    res.status(400).json({ ok: false, error: 'url required' });
    return;
  }
  const headers = { 'User-Agent': UA };
  if (q.ref) headers.Referer = q.ref;
  else headers.Referer = (cachedHost || HOSTS[0]) + '/';

  const r = await withTimeout(fetch(target, { headers: headers }), HARD_MS);
  if (!r.ok) {
    res.status(502).json({ ok: false, error: 'upstream ' + r.status });
    return;
  }
  const ct = r.headers.get('content-type') || (action === 'img' ? 'image/jpeg' : 'application/octet-stream');
  res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const buf = Buffer.from(await r.arrayBuffer());

  if (/mpegurl/i.test(ct)) {
    const base = target.replace(/[^/]*$/, '');
    const txt = buf.toString('utf8').split('\n').map(function (line) {
      const l = line.trim();
      if (!l) return line;
      if (l.charAt(0) === '#') {
        return line.replace(/URI="([^"]+)"/g, function (_, u) {
          return 'URI="/api/anime?action=proxy&url=' + encodeURIComponent(abs(u, base)) + '"';
        });
      }
      return '/api/anime?action=proxy&url=' + encodeURIComponent(abs(l, base));
    }).join('\n');
    res.send(txt);
    return;
  }
  res.send(buf);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.method === 'GET'
    ? (req.query || {})
    : (typeof req.body === 'string' ? safeParse(req.body) : (req.body || {}));
  const action = String(q.action || 'trending').toLowerCase();

  try {
    if (action === 'proxy' || action === 'img') {
      await handleProxy(res, q, action);
      return;
    }

    if (action === 'diagnostics') {
      const results = [];
      for (let i = 0; i < HOSTS.length; i++) {
        const h = HOSTS[i];
        const t0 = Date.now();
        try {
          const r = await withTimeout(fetch(h + '/', { headers: { 'User-Agent': UA } }), PROBE_MS);
          results.push({ host: h, ok: r.ok, status: r.status, ms: Date.now() - t0 });
        } catch (e) {
          results.push({ host: h, ok: false, error: String(e.message || e), ms: Date.now() - t0 });
        }
      }
      res.status(200).json({ ok: true, data: { picked: await pickHost(), probes: results } });
      return;
    }

    if (action === 'trending' || action === 'popular') {
      const page = Math.max(1, parseInt(q.page, 10) || 1);
      const sort = action === 'popular' ? 'POPULARITY_DESC' : 'TRENDING_DESC';
      const gql = 'query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(sort:' + sort + ',type:ANIME,isAdult:false){...M}}}' + MEDIA;
      const d = await anilist(gql, { page: page, perPage: 24 });
      const list = ((d && d.Page && d.Page.media) || []).map(card);
      res.status(200).json({ ok: true, data: list, page: page });
      return;
    }

    if (action === 'search') {
      const term = String(q.q || q.s || q.query || '').trim();
      if (!term) { res.status(200).json({ ok: true, data: [] }); return; }
      const page = Math.max(1, parseInt(q.page, 10) || 1);
      const gql = 'query($q:String,$page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(search:$q,type:ANIME,isAdult:false,sort:SEARCH_MATCH){...M}}}' + MEDIA;
      const d = await anilist(gql, { q: term, page: page, perPage: 24 });
      const list = ((d && d.Page && d.Page.media) || []).map(card);
      res.status(200).json({ ok: true, data: list, page: page });
      return;
    }

    if (action === 'detail') {
      const id = parseInt(q.id, 10);
      if (!id) { res.status(400).json({ ok: false, error: 'id required' }); return; }
      const gql = 'query($id:Int){Media(id:$id,type:ANIME){...M}}' + MEDIA;
      const d = await anilist(gql, { id: id });
      res.status(200).json({ ok: true, data: card(d && d.Media) });
      return;
    }

    if (action === 'episodes') {
      const id = parseInt(q.id, 10);
      let title = String(q.title || '').trim();
      let streaming = [];
      if (id) {
        try {
          const gql = 'query($id:Int){Media(id:$id,type:ANIME){title{romaji english} streamingEpisodes{title thumbnail url site}}}';
          const d = await anilist(gql, { id: id });
          const m = d && d.Media;
          if (m) {
            title = title || (m.title && (m.title.romaji || m.title.english)) || '';
            streaming = m.streamingEpisodes || [];
          }
        } catch (e) { /* lanjut ke scraper */ }
      }

      let scraped = [];
      if (title) {
        try {
          const found = await scrapeAnime(title);
          if (found.length) scraped = await scrapeEpisodes(found[0].slug);
        } catch (e) { /* biarkan kosong */ }
      }

      res.status(200).json({
        ok: true,
        data: {
          title: title || null,
          episodes: scraped,
          streaming: streaming.map(function (s) {
            return { title: s.title, thumbnail: s.thumbnail, url: s.url, site: s.site };
          })
        }
      });
      return;
    }

    if (action === 'stream') {
      const slug = String(q.slug || '').trim();
      if (!slug) { res.status(400).json({ ok: false, error: 'slug required' }); return; }
      const d = await scrapeStream(slug);
      res.status(200).json({ ok: true, data: d });
      return;
    }

    res.status(400).json({ ok: false, error: 'unknown action: ' + action });
  } catch (e) {
    res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
};
