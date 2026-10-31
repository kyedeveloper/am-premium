import crypto from 'node:crypto';

// MASUKIN getUserById ke sini, barengan sama db dan K
import { db, K, getUserById } from '../../lib/db.js'; 

import { 
  verifyPassword, setSessionCookie, signSession, 
  publicUser, clearSessionCookie, authUser, createUser, currentUser, saveUser 
} from '../../lib/auth.js'; 

import { quotaInfo } from '../../lib/quota.js';
import { isOwner, isPremium } from '../../lib/premium.js';

// ... (sisa kodenya ke bawah biarin persis kayak sebelumnya)

export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    switch (action) {
      case 'login': return await handleLogin(req, res);
      case 'register': return await handleRegister(req, res);
      case 'me': return await handleMe(req, res);
      case 'logout': return await handleLogout(req, res);
      case 'key': return await handleKey(req, res);
      default: return res.status(404).json({ status: 'error', message: 'Auth endpoint tidak ditemukan' });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
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
