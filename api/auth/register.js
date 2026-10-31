import { db, K } from '../../lib/db.js';
import { createUser, setSessionCookie, signSession, publicUser } from '../../lib/auth.js';
import { quotaInfo } from '../../lib/quota.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ status: 'error', message: 'Email tidak valid.' });
  if (password.length < 6)
    return res.status(400).json({ status: 'error', message: 'Password minimal 6 karakter.' });

  if (await db.get(K.email(email)))
    return res.status(409).json({ status: 'error', message: 'Email sudah terdaftar. Login aja.' });

  const user = await createUser(email, password);
  setSessionCookie(res, signSession(user.id));
  res.status(200).json({ status: 'success', user: publicUser(user), quota: await quotaInfo(user) });
      }
