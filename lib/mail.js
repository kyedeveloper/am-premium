const TOKEN = process.env.MAILTRAP_TOKEN;
const FROM = process.env.MAIL_FROM || 'no-reply@juikoprem.my.id';

export async function sendOtp(email, code, minutes) {
  if (!TOKEN) throw new Error('MAILTRAP_TOKEN belum diset di environment.');

  const text =
`Kode masuk AM PREMIUM kamu: ${code}

Kode berlaku ${minutes} menit dan cuma bisa dipakai sekali.
Kalau bukan kamu yang minta, abaikan email ini.

juikoprem.my.id`;

  const html =
`<div style="font-family:ui-monospace,Menlo,monospace;background:#050507;color:#e8ecf4;padding:28px;border-radius:14px">
  <p style="font-size:12px;letter-spacing:.22em;color:#00f5d4;margin:0 0 14px">AM PREMIUM</p>
  <p style="font-size:13px;color:#8b93a7;margin:0 0 18px">Kode masuk kamu:</p>
  <p style="font-size:34px;letter-spacing:.22em;font-weight:700;color:#fff;margin:0 0 18px">${code}</p>
  <p style="font-size:12px;color:#8b93a7;margin:0">Berlaku ${minutes} menit, sekali pakai.</p>
</div>`;

  const r = await fetch('https://send.api.mailtrap.io/api/send', {
    method: 'POST',
    headers: { 'Api-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: { email: FROM, name: 'AM PREMIUM' },
      to: [{ email }],
      subject: `${code} — kode masuk AM PREMIUM`,
      text,
      html,
      category: 'otp',
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error('Mailtrap ' + r.status + ': ' + detail.slice(0, 160));
  }
  return true;
}
