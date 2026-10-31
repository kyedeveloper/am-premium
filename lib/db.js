import { Redis } from '@upstash/redis';

// Paksa baca KV_REST_API_URL kalau UPSTASH_REDIS_REST_URL gak ada
export const db = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ... (sisa kode db.js lu di bawahnya biarin utuh)

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
  const raw = await db.get(K.user(id));
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function saveUser(u) {
  await db.set(K.user(u.id), JSON.stringify(u));
}
