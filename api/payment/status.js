import { currentUser } from '../../lib/auth.js';
import { grantPremium, isPremium } from '../../lib/premium.js';
import { db, K } from '../../lib/db.js';

const BASE = 'https://pixpayz.com';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const user = await currentUser(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Login dulu.' });

  const id = String(req.query.id || '');
  const raw = await db.get(K.order(id));
  if (!raw) return res.status(404).json({ status: 'error', message: 'Invoice tidak ditemukan.' });

  const order = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (order.userId !== user.id) return res.status(403).json({ status: 'error', message: 'Bukan invoice kamu.' });

  if (order.status === 'paid') {
    return res.status(200).json({ status: 'success', paid: true, premium: true });
  }

  const key = process.env.PIXPAYZ_API_KEY;
  try {
    const r = await fetch(`${BASE}/api/checkinvoice?apikey=${encodeURIComponent(key)}&id=${encodeURIComponent(id)}`);
    const d = await r.json();

    if (d?.status === 'paid') {
      order.status = 'paid';
      await db.set(K.order(id), JSON.stringify(order), { ex: 60 * 60 * 24 * 30 });
      await grantPremium(order.userId, order.days || 30);
      return res.status(200).json({ status: 'success', paid: true, premium: true });
    }

    res.status(200).json({ status: 'success', paid: false, invoiceStatus: d?.status || 'pending' });
  } catch (e) {
    res.status(200).json({ status: 'success', paid: false, invoiceStatus: 'unknown' });
  }
}
