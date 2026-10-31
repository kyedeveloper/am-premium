import { currentUser } from '../../lib/auth.js';
import { isPremium, PREMIUM_PRICE, PREMIUM_DAYS } from '../../lib/premium.js';
import { db, K } from '../../lib/db.js';

const BASE = 'https://pixpayz.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });

  const user = await currentUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Login dulu.' });
  if (isPremium(user)) return res.status(400).json({ status: 'error', message: 'Akun kamu sudah premium.' });

  const key = process.env.PIXPAYZ_API_KEY;
  if (!key) return res.status(500).json({ status: 'error', message: 'PIXPAYZ_API_KEY belum diset.' });

  try {
    const r = await fetch(`${BASE}/api/createinvoice?apikey=${encodeURIComponent(key)}&amount=${PREMIUM_PRICE}`);
    const d = await r.json();
    if (!d || !d.success) throw new Error(JSON.stringify(d));

    const order = {
      invoiceId: d.invoice_id,
      userId: user.id,
      amount: d.amount,
      total: d.total,
      days: PREMIUM_DAYS,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.parse(d.expired_at) || Date.now() + 3600000,
    };

    await db.set(K.order(d.invoice_id), JSON.stringify(order), { ex: 60 * 60 * 24 * 3 });
    await db.sadd(K.orders(user.id), d.invoice_id);
    await db.expire(K.orders(user.id), 60 * 60 * 24 * 90);

    res.status(200).json({
      status: 'success',
      invoiceId: d.invoice_id,
      total: d.total,
      paymentLink: d.payment_link,
      qrisImage: d.qris_image,
      expiredAt: d.expired_at,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: 'Gagal membuat invoice: ' + e.message });
  }
        }
