import { authUser, publicUser } from '../../lib/auth.js';
import { quotaInfo } from '../../lib/quota.js';
import { isPremium } from '../../lib/premium.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const u = await authUser(req);
  if (!u) return res.status(200).json({ user: null, quota: null });

  const user = publicUser(u);
  user.premium = isPremium(u);
  res.status(200).json({ user, quota: await quotaInfo(u) });
}
