import { currentUser } from '../../lib/auth.js';
import { db, K } from '../../lib/db.js';

export default async function handler(req, res) {
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
