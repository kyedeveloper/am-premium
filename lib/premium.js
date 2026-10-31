import { getUserById, saveUser } from './db.js';

export const PREMIUM_PRICE = Number(process.env.PREMIUM_PRICE || 3500);
export const PREMIUM_DAYS = Number(process.env.PREMIUM_DAYS || 30);

const OWNER_EMAILS = (process.env.OWNER_EMAIL || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export function isPremium(u) {
  return !!u && u.plan === 'premium' && (!u.premiumUntil || u.premiumUntil > Date.now());
}

export function isOwner(u) {
  return !!u && (u.plan === 'owner' || OWNER_EMAILS.includes(u.email));
}

export function isUnlimited(u) {
  return isPremium(u) || isOwner(u);
}

export async function grantPremium(userId, days = PREMIUM_DAYS) {
  const u = await getUserById(userId);
  if (!u) return null;
  if (isOwner(u)) return u;
  const base = Math.max(Date.now(), u.premiumUntil || 0);
  u.plan = 'premium';
  u.premiumUntil = base + days * 86400000;
  await saveUser(u);
  return u;
}
