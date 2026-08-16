export default async function handler(req, res) {
    const { email, magicLink } = req.query;
    const targetUrl = `https://free-restapi.biz.id/api/alight-verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(magicLink)}`;
    
    try {
        const response = await fetch(targetUrl);
        const data = await response.text();
        return res.status(200).json({ success: true, message: data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
