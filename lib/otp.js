import crypto from 'node:crypto';
import { db } from './db.js';

const PEPPER = process.env.OTP_PEPPER || process.env.JWT_SECRET || 'otp-pepper';
const TTL = 600;              // 10 menit
const MAX_ATTEMPT = 5;
const MAX_PER_EMAIL = 3;      // per jam
const MAX_PER_IP = 10;        // per jam
const MAX_PER_DAY = 25;       // cap global harian, hemat kuota Mailtrap

export const otpKey = email => `otp:${email}`;
export const ipKey = ip => `rl:otp:ip:${ip}`;
export const mailKey = email => `rl:otp:email:${email}`;
export const dayKey = () => `otp:global:${new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)}`;

export function generate() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashCode(code) {
  return crypto.createHash('sha256').update(code + PEPPER).digest('hex');
}

export function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

export async function rateHit(key, max, ttl) {
  const n = Number((await db.incr(key)) || 0);
  if (n === 1) await db.expire(key, ttl);
  return n <= max;
}

export async function checkLimits(ip, email) {
  if (!(await rateHit(mailKey(email), MAX_PER_EMAIL, 3600))) {
    return { ok: false, message: 'Terlalu sering minta kode untuk email ini. Coba lagi 1 jam lagi.' };
  }
  if (!(await rateHit(ipKey(ip), MAX_PER_IP, 3600))) {
    return { ok: false, message: 'Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti.' };
  }
  if (!(await rateHit(dayKey(), MAX_PER_DAY, 172800))) {
    return { ok: false, message: 'Kuota kirim kode harian habis. Coba lagi besok atau pakai password.' };
  }
  return { ok: true };
}

export async function saveOtp(email, code) {
  await db.set(otpKey(email), JSON.stringify({
    h: hashCode(code),
    a: 0,
    exp: Date.now() + TTL * 1000,
  }));
  await db.expire(otpKey(email), TTL);
}

export async function readOtp(email) {
  const raw = await db.get(otpKey(email));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function bumpAttempt(email, rec) {
  rec.a = (rec.a || 0) + 1;
  const left = Math.max(1, Math.round((rec.exp - Date.now()) / 1000));
  await db.set(otpKey(email), JSON.stringify(rec));
  await db.expire(otpKey(email), left);
  return MAX_ATTEMPT - rec.a;
}

export async function dropOtp(email) {
  await db.del(otpKey(email));
}

export const MAX_ATTEMPTS = MAX_ATTEMPT;
export const TTL_MINUTES = TTL / 60;
