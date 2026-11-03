'use strict';

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';
const HARD_MS = 8500;
const SHINI = 'https://shinigamitoon.com';
const MD = 'https://api.mangadex.org';
const COMICK = 'https://api.comick.io';

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

async function getJSON(url, headers, ms) {
  const r = await withTimeout(fetch(url, { headers: headers || {} }), ms || HARD_MS);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

async function getText(url, headers, ms) {
  const r = await withTimeout(fetch(url, { headers: headers || {} }), ms || HARD_MS);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.text();
}

/* ---------- MangaDex ---------- */

function mdCover(m) {
  const rel = (m.relationships || []).filter(function (x) { return x.type === 'cover_art'; })[0];
  const file = rel && rel.attributes && rel.attributes.fileName;
  return file ? 'https://uploads.mangadex.org/covers/' + m.id + '/' + file + '.512.jpg' : null;
}

function mdTitle(m) {
  const t = m.attributes && m.attributes.title;
  if (!t) return 'Untitled';
  return t.id || t.en || t.ja || Object.keys(t).map(function (k) { return t[k]; })[0] || 'Untitled';
}

async function mdSearch(term, page) {
  const offset = (Math.max(1, page) - 1) * 24;
  const u = MD + '/manga?limit=24&offset=' + offset +
    '&title=' + encodeURIComponent(term) +
    '&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive' +
    '&order[relevance]=desc';
  const j = await getJSON(u, { 'User-Agent': UA, Accept: 'application/json' });
  return (j.data || []).map(function (m) {
    return {
      id: m.id,
      source: 'mangadex',
      title: mdTitle(m),
      cover: mdCover(m),
      status: (m.attributes && m.attributes.status) || null,
      year: (m.attributes && m.attributes.year) || null,
      tags: ((m.attributes && m.attributes.tags) || []).map(function (t) {
        return (t.attributes && t.attributes.name && t.attributes.name.en) || null;
      }).filter(Boolean),
      description: (m.attributes && m.attributes.description && (m.attributes.description.id || m.attributes.description.en)) || null
    };
  });
}

async function mdChapters(id) {
  const langs = ['id', 'en'];
  for (let i = 0; i < langs.length; i++) {
    const u = MD + '/manga/' + id + '/feed?limit=200&translatedLanguage[]=' + langs[i] +
      '&order[chapter]=desc&includes[]=scanlation_group';
    let j;
    try { j = await getJSON(u, { 'User-Agent': UA, Accept: 'application/json' }); } catch (e) { continue; }
    const rows = (j.data || []).filter(function (c) { return c.attributes && c.attributes.pages > 0; });
    if (!rows.length) continue;
    return rows.map(function (c) {
      const grp = (c.relationships || []).filter(function (r) { return r.type === 'scanlation_group'; })[0];
      return {
        id: c.id,
        source: 'mangadex',
        chapter: c.attributes.chapter || '?',
        title: c.attributes.title || '',
        lang: c.attributes.translatedLanguage,
        pages: c.attributes.pages,
        group: (grp && grp.attributes && grp.attributes.name) || null
      };
    });
  }
  return [];
}

async function mdPages(chapterId) {
  const j = await getJSON(MD + '/at-home/server/' + chapterId, { 'User-Agent': UA, Accept: 'application/json' });
  const base = j.baseUrl;
  const hash = j.chapter && j.chapter.hash;
  const files = (j.chapter && j.chapter.data) || [];
  return files.map(function (f) {
    return {
      url: base + '/data/' + hash + '/' + f,
      proxy: '/api/manga?action=img&ref=' + encodeURIComponent('https://mangadex.org/') + '&url=' + encodeURIComponent(base + '/data/' + hash + '/' + f)
    };
  });
}

/* ---------- Comick ---------- */

async function ckSearch(term) {
  const j = await getJSON(COMICK + '/v1.0/search?q=' + encodeURIComponent(term) + '&limit=24',
    { 'User-Agent': UA, Accept: 'application/json' });
  const rows = Array.isArray(j) ? j : (j.data || []);
  return rows.map(function (m) {
    const cover = (m.md_covers && m.md_covers[0] && m.md_covers[0].b2key)
      ? 'https://meo.comick.pictures/' + m.md_covers[0].b2key : null;
    return {
      id: m.slug || m.hid,
      source: 'comick',
      title: m.title || m.slug,
      cover: cover,
      status: m.status || null,
      year: m.year || null,
      tags: (m.genres || []).map(function (g) { return typeof g === 'string' ? g : (g.name || null); }).filter(Boolean),
      description: m.desc || null
    };
  });
}

async function ckChapters(slug) {
  const j = await getJSON(COMICK + '/comic/' + slug + '/chapters?lang=id&limit=300',
    { 'User-Agent': UA, Accept: 'application/json' });
  let rows = Array.isArray(j) ? j : (j.chapters || []);
  if (!rows.length) {
    const j2 = await getJSON(COMICK + '/comic/' + slug + '/chapters?lang=en&limit=300',
      { 'User-Agent': UA, Accept: 'application/json' });
    rows = Array.isArray(j2) ? j2 : (j2.chapters || []);
  }
  return rows.map(function (c) {
    return {
      id: c.hid,
      source: 'comick',
      chapter: c.chap || '?',
      title: c.title || '',
      lang: c.lang || 'id',
      pages: null,
      group: (c.group && c.group[0] && c.group[0].name) || null
    };
  });
}

async function ckPages(hid) {
  const j = await getJSON(COMICK + '/chapter/' + hid, { 'User-Agent': UA, Accept: 'application/json' });
  const ch = j.chapter || j;
  const imgs = ch.images || [];
  return imgs.map(function (i) {
    const url = 'https://meo.comick.pictures/' + i.b2key;
    return {
      url: url,
      proxy: '/api/manga?action=img&ref=' + encodeURIComponent('https://comick.io/') + '&url=' + encodeURIComponent(url)
    };
  });
}

/* ---------- Shinigami ---------- */

async function shSearch(term) {
  const html = await getText(SHINI + '/?s=' + encodeURIComponent(term) + '&post_type=wp-manga',
    { 'User-Agent': UA, Referer: SHINI + '/' });
  const out = [];
  const seen = {};
  const re = /href="([^"]*\/manga\/([a-z0-9\-]+)\/?)"[^>]*>([^<]{1,150})</gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[2];
    if (!slug || seen[slug]) continue;
    seen[slug] = 1;
    out.push({ id: slug, source: 'shinigami', title: m[3].trim(), cover: null, status: null, year: null, tags: [], description: null });
    if (out.length >= 24) break;
  }
  return out;
}

async function shChapters(slug) {
  const html = await getText(SHINI + '/manga/' + slug + '/', { 'User-Agent': UA, Referer: SHINI + '/' });
  const out = [];
  const seen = {};
  const re = /href="([^"]*\/manga\/[a-z0-9\-]+\/([a-z0-9\-]*chapter[^"\/]*)\/?)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const cs = m[2];
    if (!cs || seen[cs]) continue;
    seen[cs] = 1;
    out.push({
      id: cs,
      source: 'shinigami',
      chapter: (cs.match(/chapter[-\s]*([0-9.]+)/i) || [])[1] || '?',
      title: '',
      lang: 'id',
      pages: null,
      group: null
    });
  }
  return out;
}

async function shPages(slug, chapterSlug) {
  const html = await getText(SHINI + '/manga/' + slug + '/' + chapterSlug + '/',
    { 'User-Agent': UA, Referer: SHINI + '/' });
  const out = [];
  const seen = {};
  const re = /(?:src|data-src)="(https?:\/\/[^"]+\/wp-content\/uploads\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (seen[u]) continue;
    seen[u] = 1;
    out.push({
      url: u,
      proxy: '/api/manga?action=img&ref=' + encodeURIComponent(SHINI + '/') + '&url=' + encodeURIComponent(u)
    });
  }
  return out;
}

async function handleImg(res, q) {
  const target = q.url || q.u;
  if (!target || !/^https?:\/\//i.test(target)) {
    res.status(400).json({ ok: false, error: 'url required' });
    return;
  }
  const headers = { 'User-Agent': UA };
  headers.Referer = q.ref ? String(q.ref) : 'https://mangadex.org/';
  const r = await withTimeout(fetch(target, { headers: headers }), HARD_MS);
  if (!r.ok) { res.status(502).json({ ok: false, error: 'upstream ' + r.status }); return; }
  res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(await r.arrayBuffer()));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const q = req.method === 'GET'
    ? (req.query || {})
    : (typeof req.body === 'string' ? safeParse(req.body) : (req.body || {}));
  const action = String(q.action || 'search').toLowerCase();

  try {
    if (action === 'img') { await handleImg(res, q); return; }

    if (action === 'search') {
      const term = String(q.q || q.s || q.query || '').trim();
      if (!term) { res.status(200).json({ ok: true, data: [] }); return; }
      const key = 'q:' + term;
      const hit = cget(key);
      if (hit) { res.status(200).json({ ok: true, data: hit }); return; }

      const src = String(q.src || 'auto').toLowerCase();
      const jobs = [];
      if (src === 'auto' || src === 'mangadex') jobs.push(mdSearch(term, 1).catch(function () { return []; }));
      if (src === 'auto' || src === 'comick') jobs.push(ckSearch(term).catch(function () { return []; }));
      if (src === 'auto' || src === 'shinigami') jobs.push(shSearch(term).catch(function () { return []; }));

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
      res.status(200).json({ ok: true, data: merged });
      return;
    }

    if (action === 'chapters') {
      const id = String(q.id || q.slug || '').trim();
      const src = String(q.src || 'mangadex').toLowerCase();
      if (!id) { res.status(400).json({ ok: false, error: 'id required' }); return; }
      const key = 'c:' + src + ':' + id;
      const hit = cget(key);
      if (hit) { res.status(200).json({ ok: true, data: hit }); return; }

      let list = [];
      if (src === 'mangadex') list = await mdChapters(id);
      else if (src === 'comick') list = await ckChapters(id);
      else if (src === 'shinigami') list = await shChapters(id);

      cset(key, list, 600000);
      res.status(200).json({ ok: true, data: list });
      return;
    }

    if (action === 'pages') {
      const id = String(q.id || q.chapter || '').trim();
      const src = String(q.src || 'mangadex').toLowerCase();
      const slug = String(q.slug || '').trim();
      if (!id) { res.status(400).json({ ok: false, error: 'id required' }); return; }
      const key = 'p:' + src + ':' + id;
      const hit = cget(key);
      if (hit) { res.status(200).json({ ok: true, data: hit }); return; }

      let pages = [];
      if (src === 'mangadex') pages = await mdPages(id);
      else if (src === 'comick') pages = await ckPages(id);
      else if (src === 'shinigami') pages = await shPages(slug || id, q.chapterSlug || '');

      cset(key, pages, 1800000);
      res.status(200).json({ ok: true, data: pages });
      return;
    }

    if (action === 'diagnostics') {
      const t0 = Date.now();
      const out = {};
      try {
        await getJSON(MD + '/manga?limit=1', { 'User-Agent': UA });
        out.mangadex = { ok: true, ms: Date.now() - t0 };
      } catch (e) { out.mangadex = { ok: false, error: String(e.message || e) }; }
      try {
        await getJSON(COMICK + '/v1.0/search?q=one&limit=1', { 'User-Agent': UA });
        out.comick = { ok: true };
      } catch (e) { out.comick = { ok: false, error: String(e.message || e) }; }
      res.status(200).json({ ok: true, data: out });
      return;
    }

    res.status(400).json({ ok: false, error: 'unknown action: ' + action });
  } catch (e) {
    res.status(200).json({ ok: false, error: String((e && e.message) || e) });
  }
};
