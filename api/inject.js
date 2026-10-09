// File: api/inject.js

export default async function handler(req, res) {
    // Izinkan CORS agar bisa diakses darimana saja jika kamu sewakan apinya
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });

    const { email, oobCode, orderId } = req.body;
    
    // Ambil token rahasia dari Vercel
    const API_KEY = process.env.API_KEY;
    const TOKEN = process.env.ALIGHT_TOKEN;
    const FIREBASE_TOKEN = process.env.FIREBASE_TOKEN;

    const HEADERS = {
        "Content-Type": "application/json",
        "X-Android-Package": "com.alightcreative.motion",
        "X-Android-Cert": "ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8"
    };

    try {
        // Step 1: Login dengan OOB Code yang didapat
        const signinRes = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/emailLinkSignin?key=${API_KEY}`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ email: email, oobCode: oobCode, clientType: "CLIENT_TYPE_ANDROID" })
        });

        const signinData = await signinRes.json();
        if (!signinRes.ok) throw new Error(JSON.stringify(signinData));
        const idToken = signinData.idToken;

        // Step 2: Inject Premium VVIP
        const premiumRes = await fetch('https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase', {
            method: 'POST',
            headers: {
                "authorization": "Bearer " + idToken,
                "firebase-instance-id-token": FIREBASE_TOKEN,
                "content-type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({
                data: {
                    productId: "am.full.sub.annual.19q4",
                    token: TOKEN,
                    skuType: "subs",
                    orderId: orderId
                }
            })
        });

        const premiumData = await premiumRes.json();
        
        // Berikan respon sukses
        res.status(200).json({ 
            status: 'success', 
            message: 'Aktivasi Premium Berhasil!', 
            orderId: orderId 
        });

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
                  }
