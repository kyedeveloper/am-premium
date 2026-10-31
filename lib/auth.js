import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, K, getUserById, saveUser } from './db.js';

const SECRET = process.env.JWT_SECRET || 'ganti-ini-di-vercel';
const COOKIE = 'amsess';
const MAXAGE = 60 * 60 * 24 * 30;

export const hashPassword = p => bcrypt.hash(p, 10);
export const verifyPassword = (p, h) => bcrypt.compare(p, h);

export function signSession(userId) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: MAXAGE });
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAXAGE}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  return hit ? hit.slice(COOKIE.length + 1) : null;
}

export async function currentUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, SECRET);
    return await getUserById(sub);
  } catch { return null; }
}

export async function userFromApiKey(req) {
  const key = req.headers['x-api-key'];
  if (!key) return null;
  const id = await db.get(K.key(key));
  return id ? await getUserById(id) : null;
}

// session cookie ATAU x-api-key (buat bot)
export async function authUser(req) {
  return (await currentUser(req)) || (await userFromApiKey(req));
}

export async function createUser(email, password) {
  const id = crypto.randomUUID();
  const apiKey = 'am_' + crypto.randomBytes(24).toString('hex');
  const user = {
    id,
    email: email.toLowerCase(),
    pw: await hashPassword(password),
    plan: 'free',
    premiumUntil: 0,
    apiKey,
    createdAt: Date.now(),
  };
  await saveUser(user);
  await db.set(K.email(user.email), id);
  await db.set(K.key(apiKey), id);
  return user;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    plan: u.plan,
    premiumUntil: u.premiumUntil || 0,
    apiKey: u.apiKey,
    createdAt: u.createdAt,
  };
    }
