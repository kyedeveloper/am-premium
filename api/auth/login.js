import { db, K } from '../../lib/db.js';
import { getUserById, verifyPassword, setSessionCookie, signSession, publicUser } from '../../lib/auth.js';
import { quotaInfo } from '../../lib/quota.js';
import { isOwner, isPremium } from '../../lib/premium.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  const id = await db.get(K.email(email));
  const user = id ? await getUserById(id) : null;

  if (!user || !(await verifyPassword(password, user.pw)))
    return res.status(401).json({ status: 'error', message: 'Email atau password salah.' });

  setSessionCookie(res, signSession(user.id));

  const pub = publicUser(user);
  pub.premium = isPremium(user) || isOwner(user);
  pub.owner = isOwner(user);
  res.status(200).json({ status: 'success', user: pub, quota: await quotaInfo(user) });
}
