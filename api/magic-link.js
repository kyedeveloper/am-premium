// File: api/magic-link.js

export default async function handler(req, res) {
    // Hanya izinkan metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
    }

    const { email } = req.body;
    const API_KEY = process.env.API_KEY; // Diambil rahasia dari Vercel

    const HEADERS = {
        "Content-Type": "application/json",
        "X-Android-Package": "com.alightcreative.motion",
        "X-Android-Cert": "ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8"
    };

    try {
        // Step 1: Create Auth URI
        await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/createAuthUri?key=${API_KEY}`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ identifier: email, continueUri: "http://localhost" })
        });

        // Step 2: Request OOB Confirmation Code (Kirim Email)
        const response = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getOobConfirmationCode?key=${API_KEY}`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                requestType: 6,
                email: email,
                androidInstallApp: true,
                canHandleCodeInApp: true,
                continueUrl: "https://alightcreative.com?ui_sid=0366624874&ui_sd=0",
                iosBundleId: "com.alightcreative.motion",
                androidPackageName: "com.alightcreative.motion",
                androidMinimumVersion: "585",
                clientType: "CLIENT_TYPE_ANDROID"
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(data));

        res.status(200).json({ status: 'success', message: 'Magic Link berhasil dikirim!' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
}
  
