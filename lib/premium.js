import { getUserById, saveUser } from './db.js';

export const PREMIUM_PRICE = Number(process.env.PREMIUM_PRICE || 3500);
export const PREMIUM_DAYS = Number(process.env.PREMIUM_DAYS || 30);

export function isPremium(u) {
  return !!u && u.plan === 'premium' && (!u.premiumUntil || u.premiumUntil > Date.now());
}

export async function grantPremium(userId, days = PREMIUM_DAYS) {
  const u = await getUserById(userId);
  if (!u) return null;
  const base = Math.max(Date.now(), u.premiumUntil || 0);
  u.plan = 'premium';
  u.premiumUntil = base + days * 86400000;
  await saveUser(u);
  return u;
}
