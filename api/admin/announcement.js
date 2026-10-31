import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Pastikan yang akses adalah admin/owner (Cek token/session di sini)
  
  if (req.method === 'POST') {
    const { text } = req.body;
    await kv.set('global_announcement', text);
    return res.status(200).json({ status: 'success', message: 'Announcement updated' });
  } 
  
  if (req.method === 'DELETE') {
    await kv.del('global_announcement');
    return res.status(200).json({ status: 'success', message: 'Announcement cleared' });
  }

  // Jika GET (untuk dipanggil user biasa saat web dimuat)
  const text = await kv.get('global_announcement');
  return res.status(200).json({ text: text || '' });
}
