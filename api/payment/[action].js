/**
 * VESPERA · Payment API  v8.0.0
 *
 * Alur: create → invoice QRIS (status pending) → webhook gateway menandai paid
 *       → premium nempel otomatis ke akun. Status dipolling frontend.
 *
 * Env:
 *   PIXPAYZ_API_KEY         (wajib)  API key gateway
 *   PIXPAYZ_API             (opsional) base URL, default https://api.pixpayz.com
 *   PIXPAYZ_WEBHOOK_SECRET  (disarankan) secret buat verifikasi callback
 *   PREMIUM_PRICE           (opsional) default 3500
 *   PREMIUM_DAYS            (opsional) default 30
 */

import crypto from 'node:crypto';
import { db, K, getUserById, saveUser } from '../../lib/db.js';
import { authUser } from '../../lib/auth.js';
import { isOwner, isPremium } from '../../lib/premium.js';

const PRICE = Number(process.env.PREMIUM_PRICE || 3500);
const DAYS = Number(process.env.PREMIUM_DAYS || 30);
const TTL = 3 * 86400;
const BASE = (process.env.PIXPAYZ_API || 'https://pixpayz.com').replace(/\/+$/, '');

let WORKING = null;

function json(res, code, obj) {
  try {
    res.status(code);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
  } catch {
    try { res.end(JSON.stringify(obj)); } catch {}
  }
}

async function tf(url, opt = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); }
  finally { clearTimeout(t); }
}

const qrImage = data =>
  /^data:image/i.test(data) || /^https?:\/\//i.test(data)
    ? data
    : 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=' + encodeURIComponent(data);

const newId = () => 'inv_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

async function readOrder(id) {
  if (!id || !/^inv_[a-z0-9]+$/i.test(id)) return null;
  const raw = await db.get(K.order(id)).catch(() => null);
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return null; }
}

async function writeOrder(o) {
  await db.set(K.order(o.id), JSON.stringify(o));
  await db.expire(K.order(o.id), TTL);
}

/* ---------- gateway ---------- */
const SHAPES = [
  { path: '/v1/invoice', body: o => ({ api_key: process.env.PIXPAYZ_API_KEY, order_id: o.id, amount: o.amount, description: o.description }) },
  { path: '/api/invoice', body: o => ({ api_key: process.env.PIXPAYZ_API_KEY, order_id: o.id, amount: o.amount, description: o.description }) },
  { path: '/v1/qris/create', body: o => ({ api_key: process.env.PIXPAYZ_API_KEY, order_id: o.id, amount: o.amount }) },
  { path: '/api/qris/create', body: o => ({ api_key: process.env.PIXPAYZ_API_KEY, order_id: o.id, amount: o.amount }) },
  { path: '/create', body: o => ({ api_key: process.env.PIXPAYZ_API_KEY, order_id: o.id, amount: o.amount }) }
];

function pickQr(d) {
  if (!d || typeof d !== 'object') return null;
  const bag = [d.data, d.result, d.invoice, d].filter(Boolean);
  for (const x of bag) {
    if (typeof x === 'string') {
      if (/^(data:image|https?:\/\/)/i.test(x)) return x;
      continue;
    }
    for (const k of ['qris_image', 'qrisImage', 'qris_url', 'qr_image', 'qrImage', 'qr_url', 'qrUrl', 'qr_string', 'qris_string', 'qris', 'qr', 'payment_url', 'checkout_url']) {
      const v = x[k];
      if (typeof v === 'string' && v.length > 8) return qrImage(v);
    }
  }
  return null;
}

const pickRef = d => {
  const x = (d && (d.data || d.result || d.invoice || d)) || {};
  return String(x.id || x.invoice_id || x.invoiceId || x.transaction_id || x.transactionId || x.ref || '');
};

async function createInvoice(order) {
  if (!process.env.PIXPAYZ_API_KEY) throw new Error('PIXPAYZ_API_KEY belum diisi.');

  const candidates = WORKING ? [SHAPES.find(s => s.path === WORKING), ...SHAPES.filter(s => s.path !== WORKING)] : SHAPES;
  const errs = [];

  for (const shape of candidates.filter(Boolean)) {
    try {
      const r = await tf(BASE + shape.path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + process.env.PIXPAYZ_API_KEY
        },
        body: JSON.stringify(shape.body(order))
      }, 12000);

      const text = await r.text();
      let d = {};
      try { d = JSON.parse(text); } catch {}

      if (!r.ok) { errs.push(shape.path + ' → ' + r.status); continue; }

      const qr = pickQr(d) || (text.startsWith('data:image') ? text : null);
      if (!qr) { errs.push(shape.path + ' → tanpa QR'); continue; }

      WORKING = shape.path;
      return { qr, ref: pickRef(d) };
    } catch (e) {
      errs.push(shape.path + ' → ' + (e.name === 'AbortError' ? 'timeout' : e.message));
    }
  }

  throw new Error('Gateway menolak: ' + errs.join(' · '));
}

/* ---------- premium ---------- */
async function grantPremium(user, days) {
  const now = Date.now();
  const base = Math.max(now, Number(user.premiumUntil || 0));
  user.plan = 'premium';
  user.premiumUntil = base + days * 86400000;
  user.updatedAt = now;
  await saveUser(user);
}

/* ---------- handlers ---------- */
async function handleCreate(req, res) {
  if (req.method !== 'POST') return json(res, 405, { status: 'error', message: 'Method Not Allowed' });

  const user = await authUser(req);
  if (!user) return json(res, 401, { status: 'error', message: 'Login dulu.' });
  if (isOwner(user) || isPremium(user)) return json(res, 400, { status: 'error', message: 'Akun ini sudah premium.' });

  const order = {
    id: newId(),
    userId: user.id,
    email: user.email,
    amount: PRICE,
    days: DAYS,
    status: 'pending',
    description: 'VESPERA Premium ' + DAYS + ' hari',
    createdAt: Date.now(),
    paidAt: 0,
    ref: ''
  };

  let qr;
  try {
    const made = await createInvoice(order);
    qr = made.qr;
    order.ref = made.ref;
  } catch (e) {
    return json(res, 502, { status: 'error', message: e.message });
  }

  await writeOrder(order);
  await db.sadd(K.orders(user.id), order.id).catch(() => null);
  await db.expire(K.orders(user.id), 90 * 86400).catch(() => null);

  return json(res, 200, { status: 'success', invoiceId: order.id, total: order.amount, qrisImage: qr });
}

async function handleStatus(req, res) {
  const id = String(req.query.id || req.query.invoiceId || '');
  const order = await readOrder(id);
  if (!order) return json(res, 404, { status: 'error', message: 'Invoice tidak ditemukan.' });

  return json(res, 200, {
    status: 'success',
    paid: order.status === 'paid',
    invoice: order.status,
    total: order.amount,
    expiresAt: order.createdAt + TTL * 1000
  });
}

async function handleHistory(req, res) {
  const user = await authUser(req);
  if (!user) return json(res, 401, { status: 'error', message: 'Login dulu.' });

  const ids = (await db.smembers(K.orders(user.id)).catch(() => [])) || [];
  const list = (await Promise.all(ids.slice(-20).map(readOrder))).filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(o => ({ id: o.id, total: o.amount, status: o.status, at: o.createdAt }));

  return json(res, 200, { status: 'success', items: list });
}

async function settle(order, source) {
  if (order.status === 'paid') return order;

  order.status = 'paid';
  order.paidAt = Date.now();
  order.source = source;
  await writeOrder(order);

  const user = await getUserById(order.userId);
  if (user) await grantPremium(user, order.days || DAYS);

  await db.sadd(K.acts(order.userId), JSON.stringify({ t: 'pay', id: order.id, at: Date.now() })).catch(() => null);
  return order;
}

async function handleWebhook(req, res) {
  if (!['POST', 'GET'].includes(req.method)) return json(res, 405, { status: 'error', message: 'Method Not Allowed' });

  const secret = process.env.PIXPAYZ_WEBHOOK_SECRET;
  if (secret) {
    const got = String(req.headers['x-webhook-secret'] || req.headers['x-pixpayz-signature'] || req.query.secret || '');
    if (got !== secret) return json(res, 401, { status: 'error', message: 'Secret tidak cocok.' });
  }

  const b = req.body || {};
  const id = String(b.order_id || b.invoiceId || b.invoice_id || b.id || req.query.order_id || req.query.id || '');
  const raw = String(b.status || b.payment_status || b.transaction_status || req.query.status || '').toLowerCase();

  if (!id) return json(res, 400, { status: 'error', message: 'order_id kosong.' });

  const order = await readOrder(id);
  if (!order) return json(res, 404, { status: 'error', message: 'Invoice tidak dikenal.' });

  const paidWords = ['paid', 'settled', 'settlement', 'success', 'succeeded', 'completed', 'complete', 'capture', '200'];
  const deadWords = ['expired', 'expire', 'failed', 'fail', 'cancel', 'cancelled', 'canceled', 'deny', 'denied'];

  if (deadWords.some(w => raw.includes(w))) {
    order.status = 'expired';
    await writeOrder(order);
    return json(res, 200, { status: 'success', invoice: 'expired' });
  }

  const amount = Number(b.amount || b.total || b.gross_amount || 0);
  const amountOk = !amount || amount >= order.amount;

  if (!paidWords.some(w => raw.includes(w)) && !(amountOk && !raw)) {
    return json(res, 200, { status: 'success', invoice: order.status });
  }
  if (!amountOk) return json(res, 200, { status: 'success', invoice: 'amount_mismatch' });

  await settle(order, 'webhook');
  return json(res, 200, { status: 'success', invoice: 'paid' });
}

async function handleConfirm(req, res) {
  const user = await authUser(req);
  if (!user || !isOwner(user)) return json(res, 401, { status: 'error', message: 'Khusus owner.' });

  const id = String((req.body && (req.body.id || req.body.invoiceId)) || req.query.id || '');
  const order = await readOrder(id);
  if (!order) return json(res, 404, { status: 'error', message: 'Invoice tidak ditemukan.' });

  await settle(order, 'manual');
  return json(res, 200, { status: 'success', message: 'Invoice ditandai lunas.' });
}

export default async function handler(req, res) {
  try {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-webhook-secret, x-pixpayz-signature');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(204).end();

    if (typeof req.body === 'string') {
      try { req.body = JSON.parse(req.body); } catch { req.body = {}; }
    }

    const action = String((req.query && req.query.action) || '').toLowerCase();

    switch (action) {
      case 'create': return await handleCreate(req, res);
      case 'status': return await handleStatus(req, res);
      case 'history': return await handleHistory(req, res);
      case 'webhook': return await handleWebhook(req, res);
      case 'confirm': return await handleConfirm(req, res);
      default: return json(res, 404, { status: 'error', message: 'Endpoint tidak ditemukan.' });
    }
  } catch (e) {
    return json(res, 500, { status: 'error', message: (e && e.message) || 'internal error' });
  }
  }
