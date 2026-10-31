// api/admin/grant.js
import { db } from '../../lib/db.js';
// sesuaikan nama variabel dengan export di lib/db.js;
import { authUser } from '../../lib/auth.js';
import { isOwner, grantPremium } from '../../lib/premium.js';

export default async function handler(req, res) {
  // Hanya izinkan POST
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  const u = await authUser(req);
  if (!u || !isOwner(u)) {
    return res.status(403).json({ status: 'error', message: 'Khusus owner.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const days = Number(req.body?.days || 30);
  const id = await db.get(K.email(email));

  if (!id) {
    return res.status(404).json({ status: 'error', message: 'Email belum terdaftar.' });
  }

  await grantPremium(id, days);
  return res.status(200).json({
    status: 'success',
    message: `${email} premium ${days} hari.`
  });
}
