import { db, K } from '../../lib/db.js';
import { grantPremium } from '../../lib/premium.js';

const BASE = 'https://pixpayz.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  try {
    const body = req.body || {};
    const d = body.data || {};
    if (body.event && body.event !== 'deposit.paid') return res.status(200).json({ ok: true, skip: true });

    const candidates = [d.reference, d.id, d.invoice_id].filter(Boolean);
    let order = null, orderId = null;

    for (const c of candidates) {
      const raw = await db.get(K.order(String(c)));
      if (raw) {
        order = typeof raw === 'string' ? JSON.parse(raw) : raw;
        orderId = String(c);
        break;
      }
    }

    if (!order) return res.status(200).json({ ok: true, matched: false });
    if (order.status === 'paid') return res.status(200).json({ ok: true, already: true });

    const r = await fetch(
      `${BASE}/api/checkinvoice?apikey=${encodeURIComponent(process.env.PIXPAYZ_API_KEY)}&id=${encodeURIComponent(order.invoiceId)}`
    );
    const check = await r.json();
    if (check?.status !== 'paid') return res.status(200).json({ ok: true, unverified: true });

    order.status = 'paid';
    await db.set(K.order(orderId), JSON.stringify(order), { ex: 60 * 60 * 24 * 30 });
    await grantPremium(order.userId, order.days || 30);

    res.status(200).json({ ok: true, activated: true });
  } catch {
    res.status(200).json({ ok: true });
  }
}
