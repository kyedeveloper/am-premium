import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Pastikan yang akses adalah admin/owner (Cek token/session di sini)
  
  if (req.method === 'POST') {
    const { active } = req.body;
    await kv.set('maintenance_mode', active ? '1' : '0');
    return res.status(200).json({ status: 'success', active });
  }

  // Jika GET (untuk dicek frontend saat web dimuat)
  const isMaint = await kv.get('maintenance_mode');
  return res.status(200).json({ active: isMaint === '1' });
}
