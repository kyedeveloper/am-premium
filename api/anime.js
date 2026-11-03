'use strict';

const ANILIST = 'https://graphql.anilist.co';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';
const HARD_MS = 8000;
const PROBE_MS = 2400;
const HOSTS = [
  'https://v1.samehadaku.how',
  'https://samehadaku.vip',
  'https://samehadaku.email',
  'https://samehadaku.fit'
];

let cachedHost = null;
const cache = new Map();

function parse(s) { try { return JSON.parse(s); } catch (e) { return {}; } }

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

function ok(res, obj) { res.status(200).json(Object.assign({ status: 'success' }, obj)); }
function bad(res, msg) { res.status(200).json({ status: 'error', message: String(msg) }); }

async function getText(url, headers, ms) {
  const r = await withTimeout(fetch(url, { headers: headers || {} }), ms || HARD_MS);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

async function anilist(query, variables) {
  const r = await withTimeout(fetch(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
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
  siteUrl
  trailer { id site }
  studios(isMain: true) { nodes { name } }
  streamingEpisodes { title thumbnail url site }
}`;

function card(m) {
  if (!m) return null;
  return {
    id: m.id,
    title: (m.title && (m.title.english || m.title.romaji || m.title.native)) || 'Untitled',
    cover: m.coverImage ? (m.coverImage.extraLarge || m.coverImage.large) : null,
    banner: m.bannerImage || null,
    score: m.averageScore || null,
    format: m.format || null,
    year: m.seasonYear || null,
    episodes: m.episodes || null,
    status: m.status || null
  };
}

function full(m) {
  const base = card(m);
  if (!base) return null;
  base.synopsis = m.description || '';
  base.tags = m.genres || [];
  base.genres = m.genres || [];
  base.studio = (m.studios && m.studios.nodes && m.studios.nodes[0]) ? m.studios.nodes[0].name : null;
  base.trailer = (m.trailer && m.trailer.site === 'youtube') ? m.trailer.id : null;
  base.streaming = (m.streamingEpisodes || []).map(function (s) {
    return { title: s.title || s.site, url: s.url, site: s.site };
  });
  base.siteUrl = m.siteUrl || null;
  return base;
}

function seasonNow() {
  const d = new Date();
  const mo = d.getUTCMonth() + 1;
  let s = 'WINTER';
  if (mo >= 4 && mo <= 6) s = 'SPRING';
  else if (mo >= 7 && mo <= 9) s = 'SUMMER';
  else if (mo >= 10) s = 'FALL';
  return { season: s, year: d.getUTCFullYear() };
}

async function pickHost() {
  if (cachedHost) return cachedHost;
  for (let i = 0; i < HOSTS.length; i++) {
    const h = HOSTS[i];
    try {
      const r = await withTimeout(fetch(h + '/', { headers: { 'User-Agent': UA } }), PROBE_MS);
      if (r.ok) { cachedHost = h; return h; }
    } catch (e) { /* lanjut */ }
  }
  cachedHost = HOSTS[0];
  return cachedHost;
}

async function scrapeFind(q) {
  const key = 'f:' + q;
  const hit = cget(key);
  if (hit) return hit;
  const host = await pickHost();
  const html = await getText(host + '/?s=' + encodeURIComponent(q) + '&post_type=anime',
    { 'User-Agent': UA, Referer: host + '/' });
  const out = [];
  const seen = {};
  const re = /href="([^"]*\/anime\/([a-z0-9\-]+)\/?)"[^>]*>([^<]{1,150})</gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[2];
    if (!slug || seen[slug]) continue;
    seen[slug] = 1;
    out.push({ slug: slug, url: host + '/anime/' + slug + '/' });
    if (out.length >= 10) break;
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
  const re = /href="([^"]*\/episode\/([a-z0-9\-]+)\/?)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const es = m[2];
    if (!es || seen[es]) continue;
    seen[es] = 1;
    const num = (es.match(/episode[-\s]*([0-9.]+)/i) || [])[1] || null;
    out.push({ slug: es, number: num, url: host + '/episode/' + es + '/' });
  }
  out.reverse();
  const res = out.filter(function (e) { return e.number; });
  cset(key, res, 600000);
  return res;
}

function label(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '');
    const part = h.split('.');
    const base = part.length > 2 ? part[part.length - 3] : part[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch (e) { return 'Server'; }
}

async function probe(u, ref) {
  try {
    const r = await withTimeout(fetch(u, { headers: { 'User-Agent': UA, Referer: ref } }), PROBE_MS);
    const ct = r.headers.get('content-type') || '';
    const txt = await r.text();
    if (/mpegurl/i.test(ct) || /#EXTM3U/.test(txt)) {
      const direct = u.split('?')[0].match(/\.m3u8$/i) ? u : null;
      const found = txt.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
      const target = direct || (found ? found[0] : null);
      if (target) return { host: label(u), url: target, m3u8: true };
      return null;
    }
    const inner = txt.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
    if (inner) return { host: label(u), url: inner[0], m3u8: true };
    return { host: label(u), url: u, m3u8: false };
  } catch (e) {
    return null;
  }
}

async function scrapeServers(pageUrl) {
  const key = 'v:' + pageUrl;
  const hit = cget(key);
  if (hit) return hit;

  const html = await getText(pageUrl, { 'User-Agent': UA, Referer: cachedHost || HOSTS[0] });
  const cand = [];
  const seen = {};
  const re = /(?:src|data-src)="(https?:\/\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (seen[u]) continue;
    if (/samehadaku|gstatic|google\.com\/recaptcha|fonts|wp-content|jquery|\.css|\.js(\?|$)/i.test(u)) continue;
    seen[u] = 1;
    cand.push(u);
    if (cand.length >= 6) break;
  }
  if (!cand.length) throw new Error('Tidak ada server di halaman episode.');

  const probed = await Promise.all(cand.map(function (u) { return probe(u, pageUrl); }));
  const servers = probed.filter(Boolean);
  if (!servers.length) throw new Error('Server tidak merespons.');
  cset(key, servers, 300000);
  return servers;
}

async function handleProxy(res, q) {
  const target = q.url || q.u;
  if (!target || !/^https?:\/\//i.test(target)) return bad(res, 'url required');

  const headers = { 'User-Agent': UA };
  headers.Referer = q.ref ? String(q.ref) : (cachedHost || HOSTS[0]) + '/';

  const r = await withTimeout(fetch(target, { headers: headers }), HARD_MS);
  if (!r.ok) return bad(res, 'upstream ' + r.status);

  const ct = r.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(await r.arrayBuffer());

  if (/mpegurl/i.test(ct) || /#EXTM3U/.test(buf.toString('utf8').slice(0, 200))) {
    const base = target.replace(/[^/]*$/, '');
    const txt = buf.toString('utf8').split('\n').map(function (line) {
      const l = line.trim();
      if (!l) return line;
      if (l.charAt(0) === '#') {
        return line.replace(/URI="([^"]+)"/g, function (_, u) {
          let abs = u;
          try { abs = new URL(u, base).href; } catch (e) {}
          return 'URI="/api/anime?action=proxy&url=' + encodeURIComponent(abs) + '&ref=' + encodeURIComponent(target) + '"';
        });
      }
      let abs = l;
      try { abs = new URL(l, base).href; } catch (e) {}
      return '/api/anime?action=proxy&url=' + encodeURIComponent(abs) + '&ref=' + encodeURIComponent(target);
    }).join('\n');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(txt);
    return;
  }

  res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(buf);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.method === 'GET' ? (req.query || {})
    : (typeof req.body === 'string' ? parse(req.body) : (req.body || {}));

  if (q.action === 'proxy' || q.action === 'img') {
    try { await handleProxy(res, q); } catch (e) { bad(res, e.message); }
    return;
  }

  const step = String(q.step || q.action || 'home').toLowerCase();

  try {
    if (step === 'home') {
      const tab = String(q.tab || 'trending').toLowerCase();
      let gql;
      const vars = { perPage: 24 };
      if (tab === 'popular') {
        gql = 'query($perPage:Int){Page(perPage:$perPage){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){...M}}}';
      } else if (tab === 'top') {
        gql = 'query($perPage:Int){Page(perPage:$perPage){media(sort:SCORE_DESC,type:ANIME,isAdult:false){...M}}}';
      } else if (tab === 'season') {
        const s = seasonNow();
        gql = 'query($perPage:Int,$season:MediaSeason,$year:Int){Page(perPage:$perPage){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false,season:$season,seasonYear:$year){...M}}}';
        vars.season = s.season;
        vars.year = s.year;
      } else if (tab === 'upcoming') {
        gql = 'query($perPage:Int){Page(perPage:$perPage){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false,status:NOT_YET_RELEASED){...M}}}';
      } else {
        gql = 'query($perPage:Int){Page(perPage:$perPage){media(sort:TRENDING_DESC,type:ANIME,isAdult:false){...M}}}';
      }
      const d = await anilist(gql + MEDIA, vars);
      const items = ((d && d.Page && d.Page.media) || []).map(card).filter(Boolean);
      return ok(res, { items: items });
    }

    if (step === 'search') {
      const term = String(q.q || '').trim();
      if (!term) return ok(res, { items: [] });
      const gql = 'query($q:String,$perPage:Int){Page(perPage:$perPage){media(search:$q,type:ANIME,isAdult:false,sort:SEARCH_MATCH){...M}}}';
      const d = await anilist(gql + MEDIA, { q: term, perPage: 24 });
      const items = ((d && d.Page && d.Page.media) || []).map(card).filter(Boolean);
      return ok(res, { items: items });
    }

    if (step === 'detail') {
      const id = parseInt(q.id, 10);
      if (!id) return bad(res, 'id required');
      const gql = 'query($id:Int){Media(id:$id,type:ANIME){...M}}';
      const d = await anilist(gql + MEDIA, { id: id });
      const m = d && d.Media;
      if (!m) return bad(res, 'Anime tidak ditemukan.');
      const media = full(m);

      let episodes = [];
      let source = null;
      try {
        const found = await scrapeFind((m.title && (m.title.romaji || m.title.english)) || '');
        if (found.length) {
          episodes = await scrapeEpisodes(found[0].slug);
          source = label(found[0].url) + ' · lokal';
        }
      } catch (e) { /* biarkan kosong */ }

      return ok(res, { media: media, episodes: episodes, source: source });
    }

    if (step === 'stream') {
      const pageUrl = String(q.url || '').trim();
      if (!pageUrl) return bad(res, 'url required');
      const servers = await scrapeServers(pageUrl);
      return ok(res, { servers: servers });
    }

    if (step === 'diagnostics') {
      const out = {};
      for (let i = 0; i < HOSTS.length; i++) {
        const h = HOSTS[i];
        const t0 = Date.now();
        try {
          const r = await withTimeout(fetch(h + '/', { headers: { 'User-Agent': UA } }), PROBE_MS);
          out[h] = { ok: r.ok, status: r.status, ms: Date.now() - t0 };
        } catch (e) {
          out[h] = { ok: false, error: String(e.message || e) };
        }
      }
      return ok(res, { probes: out });
    }

    return bad(res, 'step tidak dikenal: ' + step);
  } catch (e) {
    return bad(res, (e && e.message) || e);
  }
};
