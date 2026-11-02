/* /api/anime — multi-source, anti-500, deadline keras */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HARD_MS = 8500;
const PROBE_MS = 2500;
const CACHE_MS = 10 * 60 * 1000;
const hostCache = new Map();
const rl = new Map();

const SRC = {
  otakudesu: {
    label: 'Otakudesu',
    doms: ['otakudesu.io', 'otakudesu.blog', 'otakudesu.cloud', 'otakudesu.care'],
    search: q => '/?s=' + encodeURIComponent(q) + '&post_type=anime',
    item: /\/anime\/[a-z0-9\-_]+\/?$/i,
    ep: /\/episode\/[a-z0-9\-_]+\/?$/i
  },
  samehadaku: {
    label: 'Samehadaku',
    doms: ['samehadaku.li', 'samehadaku.care', 'samehadaku.email', 'v1.samehadaku.how'],
    search: q => '/?s=' + encodeURIComponent(q),
    item: /\/anime\/[a-z0-9\-_]+\/?$/i,
    ep: /\/[a-z0-9\-_]+-episode-\d+\/?$/i
  },
  anoboy: {
    label: 'Anoboy',
    doms: ['anoboy.quest', 'anoboy.xyz', 'anoboy.be', 'anoboy.biz', 'anoboy.ch', 'anoboy.li'],
    search: q => '/?s=' + encodeURIComponent(q),
    item: /^\/(?!episode|jadwal|genre|anime-list|ongoing|complete|movie|tv|ova|ona|special|dmca|about|contact|privacy|disclaimer|sitemap|page)[a-z0-9\-_.]+-?\/?$/i,
    ep: /\/[a-z0-9\-_.]+-episode-\d+\/?$/i
  },
  oploverz: {
    label: 'Oploverz',
    doms: ['oploverz.now', 'oploverz.biz', 'oploverz.in'],
    search: q => '/?s=' + encodeURIComponent(q),
    item: /\/anime\/[a-z0-9\-_]+\/?$/i,
    ep: /\/[a-z0-9\-_]+-episode-\d+\/?$/i
  },
  kuramanime: {
    label: 'Kuramanime',
    doms: ['kuramanime.xyz', 'kuramanime.net', 'kuramanime.com'],
    search: q => '/anime?search=' + encodeURIComponent(q),
    item: /\/anime\/\d+\/[a-z0-9\-_]+\/?$/i,
    ep: /\/episode\/\d+\/?$/i
  },
  anichin: {
    label: 'Anichin (donghua)',
    doms: ['anichin.vip', 'anichin.top', 'anichin.co'],
    search: q => '/?s=' + encodeURIComponent(q),
    item: /\/seri\/[a-z0-9\-_]+\/?$/i,
    ep: /\/[a-z0-9\-_]+-episode-\d+\/?$/i
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
  e.n++; rl.set(k, e);
  return e.n <= 60;
}

async function tf(url, opts, ms) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms || PROBE_MS);
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
      },
      ...(opts || {})
    });
    return r;
  } finally { clearTimeout(to); }
}

async function getHtml(url) {
  const r = await tf(url, null, 6000);
  const html = await r.text();
  return { ok: r.ok, code: r.status, html: html || '' };
}

async function pickHost(src) {
  const cfg = SRC[src];
  if (!cfg) throw Object.assign(new Error('sumber tidak dikenal'), { code: 400 });

  const hit = hostCache.get(src);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.host;

  const found = await Promise.all(cfg.doms.map(async d => {
    try {
      const r = await tf('https://' + d + '/');
      return r.ok || r.status < 500 ? d : null;
    } catch { return null; }
  }));

  const host = found.find(Boolean);
  if (!host) throw Object.assign(new Error('semua domain ' + cfg.label + ' tidak merespons'), { code: 502 });

  hostCache.set(src, { host, at: Date.now() });
  return host;
}

function links(html, base, re, withCover) {
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
    let cover = '';
    if (withCover) {
      const tail = html.slice(Math.max(0, m.index - 400), m.index);
      const img = /<img\b[^>]*src=["']([^"']+)["']/i.exec(tail);
      if (img) cover = abs(img[1], base);
    }
    out.push({ url: href, title: title.slice(0, 120), cover });
    if (out.length >= 30) break;
  }
  return out;
}

function synopsis(html) {
  const meta = /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html);
  if (meta && strip(meta[1]).length > 30) return strip(meta[1]).slice(0, 500);
  const body = /<div[^>]*class=["'][^"']*(?:entry-content|sinopsis|desc)[^"']*["'][^>]*>([\s\S]{40,4000}?)<\/div>/i.exec(html);
  if (body) return strip(body[1]).slice(0, 500);
  return '';
}

function servers(html, base) {
  const out = [];
  const seen = new Set();
  const push = (u, m3u8) => {
    if (!u || seen.has(u)) return;
    seen.add(u);
    let host = 'server';
    try { host = new URL(u).hostname.replace(/^www\./, ''); } catch {}
    out.push({ url: u, host, m3u8: !!m3u8 });
  };

  const ifr = /<iframe\b[^>]*(?:src|data-src)=["']([^"']+)["']/gi;
  let m;
  while ((m = ifr.exec(html))) push(abs(dec(m[1]), base));

  const m3 = /(https?:)?\/\/[^\s"'<>\\]+\.m3u8[^\s"'<>\\]*/gi;
  const found = [];
  while ((m = m3.exec(html))) found.push(abs(m[0], base));
  found.reverse().forEach(u => push(u, true));

  const srcs = /<(?:source|video)\b[^>]*src=["']([^"']+)["']/gi;
  while ((m = srcs.exec(html))) push(abs(dec(m[1]), base));

  return out.slice(0, 12);
}

async function handle(step, b) {
  const src = SRC[b.source] ? b.source : 'otakudesu';
  const cfg = SRC[src];

  if (step === 'search') {
    const q = String(b.q || '').trim();
    if (q.length < 2) throw Object.assign(new Error('Kata kunci terlalu pendek.'), { code: 400 });
    const host = await pickHost(src);
    const base = 'https://' + host;
    const r = await getHtml(base + cfg.search(q));
    if (!r.ok) throw Object.assign(new Error('Pencarian gagal (' + r.code + ').'), { code: 502 });
    return { items: links(r.html, base, cfg.item, true), host };
  }

  if (step === 'home') {
    const host = await pickHost(src);
    const base = 'https://' + host;
    const r = await getHtml(base + '/');
    if (!r.ok) throw Object.assign(new Error('Beranda gagal (' + r.code + ').'), { code: 502 });
    const items = links(r.html, base, cfg.item, true);
    if (!items.length) throw Object.assign(new Error('Sumber tidak bisa dibaca.'), { code: 502 });
    return { trending: items.slice(0, 12), latest: items.slice(12, 24), rated: items.slice(0, 6), host };
  }

  if (step === 'detail') {
    const host = await pickHost(src);
    const r = await getHtml(b.url);
    if (!r.ok) throw Object.assign(new Error('Detail gagal (' + r.code + ').'), { code: 502 });
    return { items: links(r.html, b.url, cfg.ep, false).reverse(), synopsis: synopsis(r.html), host };
  }

  if (step === 'episode') {
    const host = await pickHost(src);
    const r = await getHtml(b.url);
    if (!r.ok) throw Object.assign(new Error('Episode gagal (' + r.code + ').'), { code: 502 });
    const list = servers(r.html, b.url);
    if (!list.length) throw Object.assign(new Error('Tidak ada server di episode ini.'), { code: 502 });
    return { servers: list, host };
  }

  if (step === 'schedule') {
    const host = await pickHost(src);
    const base = 'https://' + host;
    const r = await getHtml(base + '/jadwal-rilis/');
    if (!r.ok) throw Object.assign(new Error('Jadwal gagal (' + r.code + ').'), { code: 502 });
    return { sections: [{ day: 'Jadwal rilis', items: links(r.html, base, cfg.item, true) }], host };
  }

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
        row.doms.push({ host: d, code: 0, ms: Date.now() - t0, ok: false, err: e.name || 'error' });
      }
    }));
    row.doms.sort((a, b) => (b.ok - a.ok) || (a.ms - b.ms));
    row.live = row.doms.some(x => x.ok);
    out.push(row);
  }));
  out.sort((a, b) => b.live - a.live);
  return { sources: out, checkedAt: new Date().toISOString() };
}

module.exports = async function handler(req, res) {
  if (!limit((req.headers['x-forwarded-for'] || '').split(',')[0].trim())) {
    return json(res, 429, { status: 'error', message: 'Kebanyakan request, tunggu 1 menit.' });
  }

  const action = String(req.query.action || '').toLowerCase();
  if (action === 'diag') {
    try { return json(res, 200, { status: 'success', ...(await Promise.race([diag(), new Promise(r => setTimeout(() => r({ sources: [], timeout: true }), HARD_MS))])) }); }
    catch (e) { return json(res, 200, { status: 'success', sources: [], timeout: true }); }
  }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const step = String(body.step || action || '').toLowerCase();

  const work = handle(step, body).then(d => ({ ok: true, d })).catch(e => ({ ok: false, e }));
  const raced = await Promise.race([work, new Promise(r => setTimeout(() => r({ timeout: true }), HARD_MS))]);

  if (raced.timeout) {
    return json(res, 504, { status: 'error', message: 'Server lambat. Coba lagi atau ganti sumber.' });
  }
  if (!raced.ok) {
    return json(res, raced.e.code || 502, { status: 'error', message: raced.e.message || 'Gagal mengambil data.' });
  }
  return json(res, 200, { status: 'success', ...raced.d });
};
