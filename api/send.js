export default async function handler(req, res) {
    const { email } = req.query;
    const targetUrl = `https://free-restapi.biz.id/api/alight-send?email=${encodeURIComponent(email)}&apikey=`;
    
    try {
        const response = await fetch(targetUrl);
        const data = await response.text(); // Ambil respon teks dari API
        return res.status(200).json({ success: true, message: data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
