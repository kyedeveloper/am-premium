import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    try {
        const history = await kv.lrange('success_history', 0, 9); // Ambil 10 data
        res.status(200).json(history || []);
    } catch (error) {
        res.status(500).json([]);
    }
}
