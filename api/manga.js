'use strict';

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';
const HARD_MS = 8000;
const SHINI = 'https://shinigamitoon.com';
const MD = 'https://api.mangadex.org';
const COMICK = 'https://api.comick.io';

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

async function getJSON(url, headers, ms) {
  const r = await withTimeout(fetch(url, { headers: headers || {} }), ms || HARD_MS);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function getText(url, headers, ms) {
  const r = await withTimeout(fetch(url, { headers: headers || {} }), ms || HARD_MS);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

function img(res, u, ref) {
  if (!u) return null;
  return '/api/manga?action=img&url=' + encodeURIComponent(u) + '&ref=' + encodeURIComponent(ref || 'https://mangadex.org/');
}

/* ---------- MangaDex ---------- */

const MDH = { 'User-Agent': UA, Accept: 'application/json' };

function mdFile(m) {
  const rel = (m.relationships || []).filter(function (x) { return x.type === 'cover_art'; })[0];
  return (rel && rel.attributes && rel.attributes.fileName) || null;
}

function mdName(m) {
  const t = m.attributes && m.attributes.title;
  if (!t) return 'Untitled';
  return t.id || t.en || t.ja || Object.keys(t).map(function (k) { return t[k]; })[0] || 'Untitled';
}

function mdItem(m) {
  const file = mdFile(m);
  return {
    id: m.id,
    source: 'mangadex',
    title: mdName(m),
    cover: file ? img(null, 'https://uploads.mangadex.org/covers/' + m.id + '/' + file + '.512.jpg', 'https://mangadex.org/') : null,
    status: (m.attributes && m.attributes.status) || null,
    year: (m.attributes && m.attributes.year) || null,
    url: 'https://mangadex.org/title/' + m.id
  };
}

async function mdList(path) {
  const j = await getJSON(MD + path + '&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive', MDH);
  return (j.data || []).map(mdItem);
}

/* ---------- Comick ---------- */

function ckItem(m) {
  const key = m.md_covers && m.md_covers[0] && m.md_covers[0].b2key;
  return {
    id: m.slug || m.hid,
    source: 'comick',
    title: m.title || m.slug,
    cover: key ? img(null, 'https://meo.comick.pictures/' + key, 'https://comick.io/') : null,
    status: m.status || null,
    year: m.year || null,
    url: 'https://comick.io/comic/' + (m.slug || m.hid)
  };
}

/* ---------- Shinigami ---------- */

function shItem(slug, title, cover) {
  return {
    id: slug,
    source: 'shinigami',
    title: title,
    cover: cover ? img(null, cover, SHINI + '/') : null,
    status: null,
    year: null,
    url: SHINI + '/manga/' + slug + '/'
  };
}

function shParse(html) {
  const out = [];
  const seen = {};
  const re = /<a[^>]+href="([^"]*\/manga\/([a-z0-9\-]+)\/?)"[^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[2];
    if (!slug || seen[slug]) continue;
    seen[slug] = 1;
    const title = (m[3].match(/>([^<]{2,120})</) || [])[1] || m[3].replace(/<[^>]+>/g, '').trim();
    if (!title) continue;
    out.push(shItem(slug, title.trim(), null));
    if (out.length >= 24) break;
  }
  return out;
}

/* ---------- proxy gambar ---------- */

async function handleImg(res, q) {
  const target = q.url || q.u;
  if (!target || !/^https?:\/\//i.test(target)) return bad(res, 'url required');
  const headers = { 'User-Agent': UA, Referer: q.ref ? String(q.ref) : 'https://mangadex.org/' };
  const r = await withTimeout(fetch(target, { headers: headers }), HARD_MS);
  if (!r.ok) return bad(res, 'upstream ' + r.status);
  res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(await r.arrayBuffer()));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.method === 'GET' ? (req.query || {})
    : (typeof req.body === 'string' ? parse(req.body) : (req.body || {}));

  if (q.action === 'img') {
    try { await handleImg(res, q); } catch (e) { bad(res, e.message); }
    return;
  }

  const step = String(q.step || q.action || 'home').toLowerCase();
  const src = String(q.source || 'auto').toLowerCase();

  try {
    if (step === 'home') {
      const jobs = [];
      if (src === 'auto' || src === 'mangadex') {
        jobs.push(mdList('/manga?limit=18&order[followedCount]=desc').catch(function () { return []; }));
        jobs.push(mdList('/manga?limit=18&order[latestUploadedChapter]=desc').catch(function () { return []; }));
      }
      if (src === 'auto' || src === 'comick') {
        jobs.push(getJSON(COMICK + '/v1.0/search?q=&limit=18&sort=follow', { 'User-Agent': UA, Accept: 'application/json' })
          .then(function (j) { return (Array.isArray(j) ? j : (j.data || [])).map(ckItem); })
          .catch(function () { return []; }));
      }
      if (src === 'auto' || src === 'shinigami') {
        jobs.push(getText(SHINI + '/manga/?order=popular', { 'User-Agent': UA, Referer: SHINI + '/' })
          .then(shParse).catch(function () { return []; }));
      }
      const packs = await Promise.all(jobs);
      const trending = [];
      const latest = [];
      for (let i = 0; i < packs.length; i++) {
        for (let k = 0; k < packs[i].length; k++) {
          if (i % 2 === 0 && trending.length < 18) trending.push(packs[i][k]);
          else if (latest.length < 18) latest.push(packs[i][k]);
        }
      }
      return ok(res, { trending: trending, latest: latest.length ? latest : trending.slice(0, 18) });
    }

    if (step === 'genres') {
      const j = await getJSON(MD + '/manga/tag', MDH);
      const items = (j.data || []).map(function (t) {
        return { id: t.id, name: (t.attributes && t.attributes.name && t.attributes.name.en) || null };
      }).filter(function (t) { return t.name; });
      return ok(res, { items: items });
    }

    if (step === 'bygenre') {
      const tag = String(q.tag || '').trim();
      if (!tag) return ok(res, { items: [] });
      const items = await mdList('/manga?limit=24&includedTags[]=' + encodeURIComponent(tag) + '&order[relevance]=desc');
      return ok(res, { items: items });
    }

    if (step === 'search') {
      const term = String(q.q || '').trim();
      if (!term) return ok(res, { items: [] });
      const key = 'q:' + src + ':' + term;
      const hit = cget(key);
      if (hit) return ok(res, { items: hit });

      const jobs = [];
      if (src === 'auto' || src === 'mangadex') {
        jobs.push(mdList('/manga?limit=18&title=' + encodeURIComponent(term) + '&order[relevance]=desc').catch(function () { return []; }));
      }
      if (src === 'auto' || src === 'comick') {
        jobs.push(getJSON(COMICK + '/v1.0/search?q=' + encodeURIComponent(term) + '&limit=18', { 'User-Agent': UA, Accept: 'application/json' })
          .then(function (j) { return (Array.isArray(j) ? j : (j.data || [])).map(ckItem); })
          .catch(function () { return []; }));
      }
      if (src === 'auto' || src === 'shinigami') {
        jobs.push(getText(SHINI + '/?s=' + encodeURIComponent(term) + '&post_type=wp-manga', { 'User-Agent': UA, Referer: SHINI + '/' })
          .then(shParse).catch(function () { return []; }));
      }

      const packs = await Promise.all(jobs);
      const merged = [];
      const seen = {};
      for (let i = 0; i < packs.length; i++) {
        for (let k = 0; k < packs[i].length; k++) {
          const it = packs[i][k];
          const sig = String(it.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!sig || seen[sig]) continue;
          seen[sig] = 1;
          merged.push(it);
        }
      }
      cset(key, merged);
      return ok(res, { items: merged });
    }

    if (step === 'detail') {
      const id = String(q.id || '').trim();
      if (!id) return bad(res, 'id required');
      if (src === 'mangadex' || (src === 'auto' && /^[0-9a-f-]{30,}$/i.test(id))) {
        const j = await getJSON(MD + '/manga/' + id + '?includes[]=cover_art', MDH);
        const m = j.data;
        const file = mdFile(m);
        const desc = m.attributes.description || {};
        return ok(res, {
          media: {
            title: mdName(m),
            cover: file ? img(null, 'https://uploads.mangadex.org/covers/' + m.id + '/' + file + '.512.jpg', 'https://mangadex.org/') : null,
            synopsis: desc.id || desc.en || '',
            tags: ((m.attributes.tags || []).map(function (t) {
              return (t.attributes && t.attributes.name && t.attributes.name.en) || null;
            })).filter(Boolean)
          }
        });
      }
      const html = await getText(String(q.url || (SHINI + '/manga/' + id + '/')), { 'User-Agent': UA, Referer: SHINI + '/' });
      const title = ((html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i) || [])[1] || id).replace(/<[^>]+>/g, '').trim();
      const cover = (html.match(/class="summary_image"[\s\S]{0,400}?src="([^"]+)"/i) || [])[1] || null;
      const synopsis = ((html.match(/class="summary__content[^"]*"[^>]*>([\s\S]{0,1500}?)<\/div>/i) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
      return ok(res, { media: { title: title, cover: cover ? img(null, cover, SHINI + '/') : null, synopsis: synopsis, tags: [] } });
    }

    if (step === 'chapters') {
      const id = String(q.id || '').trim();
      if (!id) return bad(res, 'id required');
      const key = 'c:' + src + ':' + id;
      const hit = cget(key);
      if (hit) return ok(res, { items: hit });

      let items = [];

      if (src === 'shinigami' || (src === 'auto' && !/^[0-9a-f-]{30,}$/i.test(id))) {
        const html = await getText(String(q.url || (SHINI + '/manga/' + id + '/')), { 'User-Agent': UA, Referer: SHINI + '/' });
        const seen = {};
        const re = /href="([^"]*\/manga\/[a-z0-9\-]+\/([a-z0-9\-]*chapter[^"\/]*)\/?)"[^>]*>([^<]{0,120})</gi;
        let m;
        while ((m = re.exec(html))) {
          const cs = m[2];
          if (!cs || seen[cs]) continue;
          seen[cs] = 1;
          const num = (cs.match(/chapter[-\s]*([0-9.]+)/i) || [])[1] || cs.replace(/[^0-9.]/g, '');
          items.push({ id: cs, num: num || '?', at: null, url: SHINI + '/manga/' + id + '/' + cs + '/' });
        }
      } else {
        const j = await getJSON(MD + '/manga/' + id + '/feed?limit=200&translatedLanguage[]=id&order[chapter]=desc', MDH)
          .catch(function () { return { data: [] }; });
        let rows = (j.data || []).filter(function (c) { return c.attributes && c.attributes.pages > 0; });
        if (!rows.length) {
          const j2 = await getJSON(MD + '/manga/' + id + '/feed?limit=200&translatedLanguage[]=en&order[chapter]=desc', MDH)
            .catch(function () { return { data: [] }; });
          rows = (j2.data || []).filter(function (c) { return c.attributes && c.attributes.pages > 0; });
        }
        items = rows.map(function (c) {
          return { id: c.id, num: c.attributes.chapter || '?', at: c.attributes.readableAt || null, url: null };
        });
      }

      cset(key, items, 600000);
      return ok(res, { items: items });
    }

    if (step === 'pages') {
      const id = String(q.id || '').trim();
      if (!id) return bad(res, 'id required');
      const key = 'p:' + src + ':' + id;
      const hit = cget(key);
      if (hit) return ok(res, { pages: hit });

      let pages = [];

      if (src === 'shinigami' || (src === 'auto' && !/^[0-9a-f-]{30,}$/i.test(id))) {
        const html = await getText(String(q.url || (SHINI + '/manga/x/' + id + '/')), { 'User-Agent': UA, Referer: SHINI + '/' });
        const seen = {};
        const re = /(?:src|data-src)="(https?:\/\/[^"]+\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
        let m;
        while ((m = re.exec(html))) {
          const u = m[1];
          if (seen[u]) continue;
          seen[u] = 1;
          pages.push(img(null, u, SHINI + '/'));
        }
      } else {
        const j = await getJSON(MD + '/at-home/server/' + id, MDH);
        const base = j.baseUrl;
        const hash = j.chapter && j.chapter.hash;
        const files = (j.chapter && j.chapter.data) || [];
        pages = files.map(function (f) {
          return img(null, base + '/data/' + hash + '/' + f, 'https://mangadex.org/');
        });
      }

      cset(key, pages, 1800000);
      return ok(res, { pages: pages });
    }

    if (step === 'diagnostics') {
      const out = {};
      const t0 = Date.now();
      try { await getJSON(MD + '/manga?limit=1', MDH); out.mangadex = { ok: true, ms: Date.now() - t0 }; }
      catch (e) { out.mangadex = { ok: false, error: String(e.message || e) }; }
      try { await getJSON(COMICK + '/v1.0/search?q=one&limit=1', { 'User-Agent': UA, Accept: 'application/json' }); out.comick = { ok: true }; }
      catch (e) { out.comick = { ok: false, error: String(e.message || e) }; }
      try { await getText(SHINI + '/', { 'User-Agent': UA }); out.shinigami = { ok: true }; }
      catch (e) { out.shinigami = { ok: false, error: String(e.message || e) }; }
      return ok(res, { probes: out });
    }

    return bad(res, 'step tidak dikenal: ' + step);
  } catch (e) {
    return bad(res, (e && e.message) || e);
  }
};
