import { currentUser } from '../../lib/auth.js';
import { isUnlimited, PREMIUM_PRICE, PREMIUM_DAYS } from '../../lib/premium.js';
import { db, K } from '../../lib/db.js';

const BASE = 'https://pixpayz.com';

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    switch (action) {
      case 'create': return await handleCreate(req, res);
      case 'history': return await handleHistory(req, res);
      case 'status': return await handleStatus(req, res);
      case 'webhook': return await handleWebhook(req, res);
      default: return res.status(404).json({ status: 'error', message: 'Payment endpoint tidak ditemukan' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

async function handleCreate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Login dulu.' });
  if (isUnlimited(user)) return res.status(400).json({ status: 'error', message: 'Akun kamu sudah premium.' });
  const key = process.env.PIXPAYZ_API_KEY;
  if (!key) return res.status(500).json({ status: 'error', message: 'PIXPAYZ_API_KEY belum diset.' });
  
  const r = await fetch(`${BASE}/api/createinvoice?apikey=${encodeURIComponent(key)}&amount=${PREMIUM_PRICE}`);
  const d = await r.json();
  if (!d || !d.success) throw new Error(JSON.stringify(d));
  
  const order = {
    invoiceId: d.invoice_id,
    userId: user.id,
    amount: d.amount,
    total: d.total,
    days: PREMIUM_DAYS,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.parse(d.expired_at) || Date.now() + 3600000,
  };
  
  await db.set(K.order(d.invoice_id), JSON.stringify(order), { ex: 60 * 60 * 24 * 3 });
  await db.sadd(K.orders(user.id), d.invoice_id);
  await db.expire(K.orders(user.id), 60 * 60 * 24 * 90);
  
  res.status(200).json({
    status: 'success',
    invoiceId: d.invoice_id,
    total: d.total,
    paymentLink: d.payment_link,
    qrisImage: d.qris_image,
    expiredAt: d.expired_at,
  });
}

async function handleHistory(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ status: 'error', message: 'Login dulu.' });
  const ids = await db.smembers(K.orders(u.id));
  const rows = [];
  for (const id of (ids || []).slice(0, 20)) {
    const raw = await db.get(K.order(id));
    if (raw) rows.push(typeof raw === 'string' ? JSON.parse(raw) : raw);
  }
  rows.sort((a, b) => b.createdAt - a.createdAt);
  res.status(200).json({ status: 'success', orders: rows });
}

async function handleStatus(req, res) {
  // TODO: Paste logic dari api/payment/status.js punya lu ke sini
}

async function handleWebhook(req, res) {
  // TODO: Paste logic dari api/payment/webhook.js punya lu ke sini
}
