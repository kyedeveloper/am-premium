import crypto from 'node:crypto';
import { db, K, getUserById, saveUser } from '../../lib/db.js';
import {
  verifyPassword, setSessionCookie, signSession,
  publicUser, clearSessionCookie, authUser, createUser, currentUser
} from '../../lib/auth.js';
import { quotaInfo } from '../../lib/quota.js';
import { isOwner, isPremium } from '../../lib/premium.js';

/* ================= OTP HELPER (inline) ================= */
const OTP_PEPPER = process.env.OTP_PEPPER || process.env.JWT_SECRET || 'otp-pepper';
const OTP_TTL = 600;
const MAX_ATTEMPT = 5;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 10;
const MAX_PER_DAY = 25;
const MAIL_TOKEN = process.env.MAILTARGET_API_KEY || process.env.MAILTRAP_TOKEN;
const MAIL_FROM = process.env.MAIL_FROM || 'no-reply@juikoprem.my.id';

const otpKey = email => `otp:${email}`;
const otpIpKey = ip => `rl:otp:ip:${ip}`;
const otpMailKey = email => `rl:otp:email:${email}`;
const otpDayKey = () => `otp:global:${new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)}`;

const genCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const hashCode = c => crypto.createHash('sha256').update(c + OTP_PEPPER).digest('hex');

function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

async function rateHit(key, max, ttl) {
  const n = Number((await db.incr(key)) || 0);
  if (n === 1) await db.expire(key, ttl);
  return n <= max;
}

async function checkLimits(ip, email) {
  if (!(await rateHit(otpMailKey(email), MAX_PER_EMAIL, 3600)))
    return { ok: false, message: 'Terlalu sering minta kode untuk email ini. Coba lagi 1 jam lagi.' };
  if (!(await rateHit(otpIpKey(ip), MAX_PER_IP, 3600)))
    return { ok: false, message: 'Terlalu banyak permintaan dari jaringan ini. Coba lagi nanti.' };
  if (!(await rateHit(otpDayKey(), MAX_PER_DAY, 172800)))
    return { ok: false, message: 'Kuota kirim kode harian habis. Coba lagi besok atau pakai password.' };
  return { ok: true };
}

async function saveOtp(email, code) {
  await db.set(otpKey(email), JSON.stringify({ h: hashCode(code), a: 0, exp: Date.now() + OTP_TTL * 1000 }));
  await db.expire(otpKey(email), OTP_TTL);
}

async function readOtp(email) {
  const raw = await db.get(otpKey(email));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function bumpAttempt(email, rec) {
  rec.a = (rec.a || 0) + 1;
  const left = Math.max(1, Math.round((rec.exp - Date.now()) / 1000));
  await db.set(otpKey(email), JSON.stringify(rec));
  await db.expire(otpKey(email), left);
  return MAX_ATTEMPT - rec.a;
}

const dropOtp = email => db.del(otpKey(email));

async function sendMail(email, code) {
  if (!MAIL_TOKEN) throw new Error('MAILTARGET_API_KEY belum dikonfigurasi.');
  
  const bodyText =
`Kode masuk AM PREMIUM kamu: ${code}

Kode berlaku 10 menit dan cuma bisa dipakai sekali.
Kalau bukan kamu yang minta, abaikan email ini.

juikoprem.my.id`;

  const bodyHtml =
`<div style="font-family:ui-monospace,Menlo,monospace;background:#050507;color:#e8ecf4;padding:28px;border-radius:14px">
  <p style="font-size:12px;letter-spacing:.22em;color:#00f5d4;margin:0 0 14px">AM PREMIUM</p>
  <p style="font-size:13px;color:#8b93a7;margin:0 0 18px">Kode masuk kamu:</p>
  <p style="font-size:34px;letter-spacing:.22em;font-weight:700;color:#fff;margin:0 0 18px">${code}</p>
  <p style="font-size:12px;color:#8b93a7;margin:0">Berlaku 10 menit, sekali pakai.</p>
</div>`;

  const r = await fetch('https://transmission.mailtarget.co/v1/layang/transmissions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MAIL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: { email: MAIL_FROM, name: 'AM PREMIUM' },
      to: [{ email }],
      subject: `${code} — kode masuk AM PREMIUM`,
      bodyText,
      bodyHtml
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error('Mailtarget Error ' + r.status + ': ' + detail.slice(0, 160));
  }
}

/* ================= HANDLER ================= */
export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (typeof req.body === 'string') {
    try { req.body = JSON.parse(req.body); } catch {}
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'login': return await handleLogin(req, res);
      case 'register': return await handleRegister(req, res);
      case 'me': return await handleMe(req, res);
      case 'logout': return await handleLogout(req, res);
      case 'key': return await handleKey(req, res);
      case 'request-code': return await handleRequestCode(req, res);
      case 'verify-code': return await handleVerifyCode(req, res);
      default: return res.status(404).json({ status: 'error', message: 'Auth endpoint tidak ditemukan' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

async function handleRequestCode(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ status: 'error', message: 'Email tidak valid.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const limit = await checkLimits(ip, email);
  if (!limit.ok) return res.status(429).json({ status: 'error', message: limit.message });

  const code = genCode();
  await saveOtp(email, code);

  try {
    await sendMail(email, code);
  } catch (e) {
    return res.status(500).json({ status: 'error', message: 'Gagal kirim email: ' + e.message });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ status: 'success', message: 'Kode terkirim. Cek inbox atau folder spam.', ttl: OTP_TTL });
}

async function handleVerifyCode(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').replace(/\D/g, '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ status: 'error', message: 'Email tidak valid.' });
  if (code.length !== 6)
    return res.status(400).json({ status: 'error', message: 'Kode harus 6 digit.' });

  const rec = await readOtp(email);
  if (!rec || rec.exp < Date.now()) {
    await dropOtp(email);
    return res.status(400).json({ status: 'error', message: 'Kode kedaluwarsa. Minta kode baru.' });
  }
  if ((rec.a || 0) >= MAX_ATTEMPT) {
    await dropOtp(email);
    return res.status(429).json({ status: 'error', message: 'Terlalu banyak percobaan. Minta kode baru.' });
  }
  if (!safeEqual(rec.h, hashCode(code))) {
    const left = await bumpAttempt(email, rec);
    return res.status(400).json({ status: 'error', message: `Kode salah. Sisa ${left} percobaan.` });
  }

  await dropOtp(email);

  let user = null;
  const existingId = await db.get(K.email(email));
  if (existingId) user = await getUserById(existingId);

  if (!user) {
    user = await createUser(email, crypto.randomUUID());
  } else if (!user.apiKey) {
    user.apiKey = 'am_' + crypto.randomBytes(24).toString('hex');
    await saveUser(user);
    await db.set(K.key(user.apiKey), user.id);
  }

  setSessionCookie(res, signSession(user.id));
  const pub = publicUser(user);
  pub.premium = isPremium(user) || isOwner(user);
  pub.owner = isOwner(user);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ status: 'success', user: pub, quota: await quotaInfo(user) });
}

async function handleLogin(req, res) {
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

async function handleRegister(req, res) {
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
  const pub = publicUser(user);
  pub.premium = isOwner(user);
  pub.owner = isOwner(user);
  res.status(200).json({ status: 'success', user: pub, quota: await quotaInfo(user) });
}

async function handleMe(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const u = await authUser(req);
  if (!u) return res.status(200).json({ user: null, quota: null });
  const user = publicUser(u);
  user.premium = isPremium(u) || isOwner(u);
  user.owner = isOwner(u);
  res.status(200).json({ user, quota: await quotaInfo(u) });
}

async function handleLogout(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ status: 'success' });
}

async function handleKey(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ status: 'error', message: 'Belum login.' });
  await db.del(K.key(u.apiKey));
  u.apiKey = 'am_' + crypto.randomBytes(24).toString('hex');
  await saveUser(u);
  await db.set(K.key(u.apiKey), u.id);
  res.status(200).json({ status: 'success', apiKey: u.apiKey });
}
