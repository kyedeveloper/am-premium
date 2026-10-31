import { Redis } from '@upstash/redis';

// Kasih URL dummy biar Vercel ga langsung crash (HTML 500) pas env telat masuk
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || 'https://dummy.upstash.io';
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy';

export const db = new Redis({ url, token });

export const K = {
  user: id => `user:${id}`,
  email: e => `email:${e.toLowerCase()}`,
  key: k => `key:${k}`,
  quota: (id, day) => `quota:${id}:${day}`,
  order: id => `order:${id}`,
  orders: id => `orders:${id}`,
  acts: id => `acts:${id}`,
  rl: ip => `rl:${ip}`,
  allUsers: 'users:all',
  globalQuota: day => `quota:global:${day}`,
};

export async function getUserById(id) {
  if (!id) return null;
  const raw = await db.get(K.user(id)).catch(() => null);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function saveUser(u) {
  await db.set(K.user(u.id), JSON.stringify(u)).catch(() => null);
}
