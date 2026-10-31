import { db, K } from './db.js';
import { isUnlimited } from './premium.js';

export const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT || 20);

export function dayKey(ts = Date.now()) {
  return new Date(ts + 7 * 3600000).toISOString().slice(0, 10);
}

export function resetAt(ts = Date.now()) {
  return new Date(dayKey(ts) + 'T00:00:00Z').getTime() + 24 * 3600000 - 7 * 3600000;
}

export async function quotaInfo(user) {
  if (!user) return { premium: false, limit: 0, used: 0, remaining: 0, resetAt: null };
  if (isUnlimited(user)) {
    return { premium: true, limit: null, used: 0, remaining: null, resetAt: null };
  }
  const used = Number((await db.get(K.quota(user.id, dayKey()))) || 0);
  return {
    premium: false,
    limit: FREE_DAILY_LIMIT,
    used,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    resetAt: resetAt(),
  };
}

export async function bumpQuota(user) {
  if (!user || isUnlimited(user)) return;
  const key = K.quota(user.id, dayKey());
  await db.incr(key);
  await db.expire(key, 60 * 60 * 48);
}
