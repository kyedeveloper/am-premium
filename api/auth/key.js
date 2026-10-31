import crypto from 'node:crypto';
import { db, K } from '../../lib/db.js';
import { currentUser, saveUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ status: 'error', message: 'Belum login.' });

  await db.del(K.key(u.apiKey));
  u.apiKey = 'am_' + crypto.randomBytes(24).toString('hex');
  await saveUser(u);
  await db.set(K.key(u.apiKey), u.id);
  res.status(200).json({ status: 'success', apiKey: u.apiKey });
}
