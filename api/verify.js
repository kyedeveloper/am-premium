import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { email, magicLink } = req.query;
    
    try {
        // Tembak API Alight
        const response = await fetch(`https://free-restapi.biz.id/api/alight-verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(magicLink)}`);
        
        // Simpan ke database (Vercel KV)
        // Kita simpan emailnya dengan disensor dikit buat privasi (ex: re***@gmail.com)
        const maskedEmail = email.replace(/(.{2})(.*)(?=@)/, "$1***");
        await kv.lpush('success_history', { email: maskedEmail, time: new Date().toLocaleTimeString() });
        await kv.ltrim('success_history', 0, 4); // Cuma simpan 5 data terakhir

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false });
    }
}
