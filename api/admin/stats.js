// api/admin/stats.js
import { db, K } from '../../lib/db.js';
import { authUser } from '../../lib/auth.js';
import { isOwner } from '../../lib/premium.js';
import { dayKey } from '../../lib/quota.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const u = await authUser(req);
  if (!u || !isOwner(u)) {
    return res.status(403).json({ status: 'error', message: 'Khusus owner.' });
  }

  const totalUsers = await db.scard(K.allUsers).catch(() => 0);
  const today = Number((await db.get(K.globalQuota(dayKey()))) || 0);

  return res.status(200).json({
    status: 'success',
    totalUsers,
    injectToday: today
  });
}
