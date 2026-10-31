import { db, K } from '../../lib/db.js';
import { authUser } from '../../lib/auth.js';
import { isOwner, grantPremium } from '../../lib/premium.js';
import { dayKey } from '../../lib/quota.js';

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
      case 'grant': return await handleGrant(req, res);
      case 'stats': return await handleStats(req, res);
      default: return res.status(404).json({ status: 'error', message: 'Admin endpoint tidak ditemukan' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

async function handleGrant(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  const u = await authUser(req);
  if (!u || !isOwner(u)) return res.status(403).json({ status: 'error', message: 'Khusus owner.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const days = Number(req.body?.days || 30);
  const id = await db.get(K.email(email));
  if (!id) return res.status(404).json({ status: 'error', message: 'Email belum terdaftar.' });
  await grantPremium(id, days);
  res.status(200).json({ status: 'success', message: `${email} premium ${days} hari.` });
}

async function handleStats(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const u = await authUser(req);
  if (!u || !isOwner(u)) return res.status(403).json({ status: 'error', message: 'Khusus owner.' });
  const totalUsers = await db.scard(K.allUsers).catch(() => 0);
  const today = Number((await db.get(K.globalQuota(dayKey()))) || 0);
  res.status(200).json({ status: 'success', totalUsers, injectToday: today });
}
