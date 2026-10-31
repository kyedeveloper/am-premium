import { authUser } from '../lib/auth.js';
import { isPremium } from '../lib/premium.js';
import { quotaInfo, bumpQuota } from '../lib/quota.js';
import { db, K } from '../lib/db.js';

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });

  // ---- GATE: akun wajib ----
  const user = await authUser(req);
  if (!user) {
    return res.status(401).json({
      status: 'error',
      code: 'LOGIN_REQUIRED',
      message: 'Login dulu buat inject.',
    });
  }

  // ---- GATE: kuota ----
  if (!isPremium(user)) {
    const q = await quotaInfo(user);
    if (q.remaining <= 0) {
      return res.status(429).json({
        status: 'error',
        code: 'QUOTA_EXCEEDED',
        message: `Limit harian habis (${q.limit}/hari). Upgrade premium buat unlimited.`,
        quota: q,
      });
    }
  }

  const { email, oobCode, orderId } = req.body || {};

  const API_KEY = process.env.API_KEY;
  const TOKEN = process.env.ALIGHT_TOKEN;
  const FIREBASE_TOKEN = process.env.FIREBASE_TOKEN;

  const HEADERS = {
    'Content-Type': 'application/json',
    'X-Android-Package': 'com.alightcreative.motion',
    'X-Android-Cert': 'ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8',
  };

  try {
    const signinRes = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/emailLinkSignin?key=${API_KEY}`,
      { method: 'POST', headers: HEADERS,
        body: JSON.stringify({ email, oobCode, clientType: 'CLIENT_TYPE_ANDROID' }) }
    );

    const signinData = await signinRes.json();
    if (!signinRes.ok) throw new Error(JSON.stringify(signinData));
    const idToken = signinData.idToken;

    const premiumRes = await fetch('https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + idToken,
        'firebase-instance-id-token': FIREBASE_TOKEN,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        data: { productId: 'am.full.sub.annual.19q4', token: TOKEN, skuType: 'subs', orderId },
      }),
    });

    await premiumRes.json();

    // hitung kuota HANYA kalau sukses
    await bumpQuota(user);
    await db.lpush(K.acts(user.id), JSON.stringify({ email, orderId, ts: Date.now() }));
    await db.ltrim(K.acts(user.id), 0, 99);

    res.status(200).json({
      status: 'success',
      message: 'Aktivasi Premium Berhasil!',
      orderId,
      quota: await quotaInfo(user),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
