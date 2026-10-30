<div align="center">

```
  ▄▀█ █▀▄▀█   █▀█ █▀█ █▀▀ █▀▄▀█ █ █ █ █▀▄▀█
  █▀█ █░▀░█   █▀▀ █▀▄ ██▄ █░▀░█ █ █ █ █░▀░█
```

# AM PREMIUM // ZUKAI TERMINAL

**Alight Motion Premium tanpa drama.**

Terminal serverless buat aktivasi Alight Motion Premium. Kirim magic link, tempel OOB code, inject. Gratis, cepat, tanpa ribet.

[![Live](https://img.shields.io/badge/LIVE-juikoprem.my.id-8b5cf6?style=for-the-badge&logo=vercel&logoColor=white)](https://www.juikoprem.my.id/)
[![Version](https://img.shields.io/badge/VERSION-v4.1.0-22d3ee?style=for-the-badge)](https://github.com/kyedeveloper/am-premium)
[![Runtime](https://img.shields.io/badge/RUNTIME-Vercel%20Functions-a3e635?style=for-the-badge&logo=vercel&logoColor=black)](https://vercel.com/)
[![Stack](https://img.shields.io/badge/STACK-Vanilla%20JS-fbbf24?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/LICENSE-Open%20Source-f472b6?style=for-the-badge)](#-lisensi)

[Demo Langsung](https://www.juikoprem.my.id/) · [Fitur](#-kapabilitas) · [API](#-api-reference) · [Deploy Sendiri](#-deploy-sendiri) · [FAQ](#-faq)

<sub>Bukan produk resmi Alight Creative. Kalau premium tiba-tiba hilang, jalankan ulang prosesnya.</sub>

</div>

---

## 📟 Apa ini

**AM Premium** adalah terminal aktivasi berbasis satu halaman yang memangkas seluruh proses premium manual jadi **dua kolom input dan satu tombol**.

Proses aslinya panjang dan gampang salah: kirim link verifikasi, buka email, salin URL panjang yang berantakan, tempel ke tempat yang benar, baru jalankan. Terminal ini memotong semuanya.

Semua logika berat — login OOB, pemanggilan `verifyPurchase`, dan penyimpanan token — dipindah ke serverless function supaya browser tetap bersih. **Prinsip desainnya: satu layar, dua langkah, nol token di frontend.** Kalau satu langkah gagal, terminal bilang persis di mana masalahnya.

| | |
|---|---|
| **Developer** | Zukai Dev |
| **Runtime** | Vercel Functions (node `asia-se-01`) |
| **Stack** | HTML + JS, tanpa framework |
| **Auth** | OOB / Email Link |
| **Versi** | v4.1.0 · Build 2026.10.29 |
| **Lisensi** | Open Source |

---

## ⚡ Kapabilitas

Dibangun buat dipakai, bukan dipamerin. Tiap bagian terminal punya satu tugas jelas.

### 1. Magic Link Dispatch
Kirim email verifikasi ke akun target lewat `/api/magic-link`. Respon langsung, tanpa reload.

### 2. Bulk Antrian
Tempel puluhan email sekaligus, kirim berurutan dengan jeda aman. Status per baris terlihat jelas.

### 3. Validator Realtime
Tempel link, langsung dicek: `oobCode` ketemu atau tidak, panjang karakter, dan tombol inject menyesuaikan.

### 4. Force Inject
Payload diteruskan ke `/api/inject` dengan order ID unik sebagai jejak aktivasi.

### 5. Riwayat Lokal
Semua aktivasi tercatat di perangkat kamu, bisa diekspor CSV. Tidak dikirim ke mana pun.

### 6. Token di Server
`API_KEY`, `ALIGHT_TOKEN`, dan `FIREBASE_TOKEN` hidup sebagai env Vercel, bukan di HTML.

### Fitur terminal tambahan
- **Command palette** — `Ctrl + K` / `Cmd + K` untuk navigasi cepat
- **Accent themes** — violet / cyan / lime / ember
- **Sound toggle** — feedback audio opsional
- **QR share** — bagikan terminal lewat QR
- **Confetti + particle canvas** — respons sukses
- **Panduan keyboard** — `↑ ↓` navigasi, `Enter` jalankan, `Esc` tutup
- **Order ID mode** — acak (5 digit) atau urut (counter) buat pembukuan
- **Konfirmasi & struk** — sheet konfirmasi sebelum inject, struk unduhan saat sukses

---

## 🔄 Cara kerja

```
  [1]  Masukkan email target
          │
          ▼
  POST /api/magic-link  ──►  Google Identity Toolkit  ──►  📧 Email verifikasi
          │
          ▼
  [2]  Salin magic link dari inbox, tempel utuh
          │
          ▼
  Validator realtime  ──►  decode URL, ambil nilai oobCode
          │
          ▼
  POST /api/inject  ──►  emailLinkSignin  ──►  idToken
          │
          ▼
  verifyPurchase (Cloud Functions Alight Creative)
          │
          ▼
  ✅ Premium aktif · struk terunduh · riwayat tercatat lokal
```

**Order ID** bisa kamu pakai sebagai penanda transaksi. Mode acak menghasilkan 5 digit random per transaksi; mode urut dipakai kalau kamu jualan dan butuh ID yang konsisten.

---

## 🧱 Struktur proyek

```
am-premium/
├── api/
│   ├── magic-link.js     # POST — createAuthUri + getOobConfirmationCode
│   └── inject.js         # POST — emailLinkSignin + verifyPurchase (CORS: *)
├── backup/
│   └── index.html        # Snapshot halaman lama
├── index.html            # Seluruh frontend: hero, fitur, terminal, FAQ, tentang
├── package.json          # Dependensi (opsional @vercel/kv)
├── video1.mp4
└── video2.mp4
```

Frontend murni satu file. Tidak ada build step, tidak ada bundler, tidak ada framework. Buka `index.html` dan itu sudah seluruh aplikasinya.

---

## 🔌 API Reference

Base URL produksi: `https://am-premium.vercel.app`

> Ganti domain kalau kamu deploy di alamat lain.

### `POST /api/magic-link`

Memicu pengiriman email verifikasi ke akun target.

**Body**

```json
{ "email": "buyer@email.com" }
```

**Respon 200**

```json
{ "status": "success", "message": "Magic Link berhasil dikirim!" }
```

**Respon error**

```json
{ "status": "error", "message": "..." }
```

### `POST /api/inject`

Login dengan OOB code lalu meneruskan payload ke `verifyPurchase`. **CORS diizinkan (`*`)**, jadi aman dipanggil dari bot, panel, atau aplikasi mana pun.

**Body**

```json
{
  "email": "buyer@email.com",
  "oobCode": "OOB_CODE_NYA",
  "orderId": "ZukaiDev-VIP-00001"
}
```

**Respon 200**

```json
{ "status": "success", "message": "Aktivasi Premium Berhasil!", "orderId": "ZukaiDev-VIP-00001" }
```

### Contoh integrasi

<details open>
<summary><b>Node.js</b></summary>

```js
const axios = require('axios');

// 1. Kirim magic link
await axios.post('https://am-premium.vercel.app/api/magic-link', {
  email: "buyer@email.com"
});

// 2. Inject setelah buyer dapat link
await axios.post('https://am-premium.vercel.app/api/inject', {
  email: "buyer@email.com",
  oobCode: "OOB_CODE_NYA",
  orderId: "ZukaiDev-VIP-00001"
});
```

</details>

<details>
<summary><b>Python</b></summary>

```python
import requests

# 1. Kirim magic link
requests.post("https://am-premium.vercel.app/api/magic-link",
  json={"email": "buyer@email.com"})

# 2. Inject setelah buyer dapat link
requests.post("https://am-premium.vercel.app/api/inject",
  json={"email": "buyer@email.com",
        "oobCode": "OOB_CODE_NYA",
        "orderId": "ZukaiDev-VIP-00001"})
```

</details>

<details>
<summary><b>PHP</b></summary>

```php
<?php
// 1. Kirim magic link
$c1 = curl_init('https://am-premium.vercel.app/api/magic-link');
curl_setopt($c1, CURLOPT_POSTFIELDS, json_encode(['email'=>'buyer@email.com']));
curl_setopt($c1, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($c1, CURLOPT_RETURNTRANSFER, true);
echo curl_exec($c1);

// 2. Inject
$c2 = curl_init('https://am-premium.vercel.app/api/inject');
curl_setopt($c2, CURLOPT_POSTFIELDS, json_encode([
  'email'=>'buyer@email.com', 'oobCode'=>'OOB', 'orderId'=>'ID']));
curl_setopt($c2, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($c2, CURLOPT_RETURNTRANSFER, true);
echo curl_exec($c2);
```

</details>

---

## 🚀 Deploy sendiri

Butuh akun [Vercel](https://vercel.com/) dan tiga nilai rahasia.

### 1. Fork / clone

```bash
git clone https://github.com/kyedeveloper/am-premium.git
cd am-premium
```

### 2. Set environment variables

Di dashboard Vercel → **Settings → Environment Variables**, isi:

| Variable | Isi | Dipakai di |
|---|---|---|
| `API_KEY` | Web API key project Firebase Alight Creative | `magic-link.js`, `inject.js` |
| `ALIGHT_TOKEN` | Purchase token langganan yang dipakai sebagai payload | `inject.js` |
| `FIREBASE_TOKEN` | Firebase instance ID token | `inject.js` |

Ketiganya wajib hidup di server. Jangan pernah ditaruh di `index.html`.

### 3. Deploy

```bash
vercel --prod
```

Atau import repo-nya langsung dari dashboard Vercel — framework preset **Other**, tanpa build command.

### 4. Sesuaikan endpoint

Kalau kamu pakai domain sendiri, ganti `https://am-premium.vercel.app` di contoh kode dan panel API pada `index.html` dengan domain kamu.

---

## ❓ FAQ

**Ini legal atau bukan?**
Metodenya meniru alur verifikasi pembelian dari aplikasi resmi, jadi akun akan terbaca premium di Alight Motion. Risikonya cuma satu: kalau server Google atau Alight mengubah skema, endpoint bisa berhenti sampai diperbaiki.

**Email magic link nggak masuk, kenapa?**
Cek folder spam/promosi dulu, tunggu 1–2 menit, lalu kirim ulang. Pastikan email diketik lengkap tanpa spasi. Beberapa domain email kantor memblokir pengirim pihak ketiga.

**Link yang ditempel bentuknya aneh, masih bisa?**
Bisa. Parser akan mendekode URL, membuka parameter bersarang, dan mengambil nilai `oobCode` saja. Validator di kolom input langsung memberi tahu hasilnya sebelum kamu menembak API.

**Data email saya disimpan?**
Untuk request, tidak ada database di repo ini. Untuk riwayat, catatan disimpan di **localStorage browser kamu sendiri** dan bisa dihapus kapan saja lewat panel riwayat.

**Bisa dipakai buat jualan?**
Itu tujuan fitur antrian dan order ID urut. Pakai mode **Urut** supaya ID transaksi berjalan konsisten, dan ekspor riwayat sebagai CSV untuk pembukuan.

**Kenapa order ID penting?**
Dia jadi jejak aktivasi: unik per transaksi, muncul di respon API, dan tersimpan di riwayat lokal. Berguna buat rekonsiliasi kalau kamu layani banyak buyer.

**Bisa dipanggil dari bot?**
Ya. `/api/inject` mengizinkan CORS dari mana saja. Rate limit dan retry tetap tanggung jawab sisi kamu.

---

## ⚠️ Batasan

- Bukan produk resmi **Alight Creative** dan tidak berafiliasi dengan mereka.
- Bergantung penuh pada skema `identitytoolkit` Google dan endpoint `verifyPurchase` milik Alight. Perubahan di sisi mereka bisa mematahkan alur sampai kode diperbarui.
- `ALIGHT_TOKEN` yang dipakai bersama punya masa berlaku; kalau aktivasi mulai gagal konsisten, itu kandidat pertama yang perlu diganti.
- Tidak ada database. Riwayat hilang kalau localStorage dibersihkan atau kamu ganti perangkat/browser.
- `@vercel/kv` sudah ada di `package.json` sebagai dependensi opsional — alur inti tidak membutuhkannya.
- Kuota dan pembatasan email sepenuhnya mengikuti kebijakan Google Identity Toolkit.

---

## 🗺️ Roadmap

- [ ] Sinkronisasi riwayat lintas perangkat lewat KV
- [ ] Status per baris pada antrian bulk dengan retry terpisah
- [ ] Webhook callback setelah inject sukses
- [ ] Panel admin untuk rotasi token
- [ ] Dukungan produk selain `am.full.sub.annual.19q4`

---

## 🤝 Kontribusi

1. Fork repo
2. Buat branch: `git checkout -b fitur/nama-fitur`
3. Commit: `git commit -m "tambah: ..."`
4. Push: `git push origin fitur/nama-fitur`
5. Buka Pull Request

Frontend satu file — jaga gaya kode tetap konsisten dan jangan pernah menaruh token di HTML.

---

## 📄 Lisensi

Open Source. Lihat isi repo untuk ketentuan pemakaian. Kredit ke **Zukai Dev** kalau kamu fork atau pakai ulang.

---

<div align="center">

**SYSTEM CORE v4.1.0** © 2026 ZUKAI DEVELOPER

`zukai_kernel v4.1.0` · `mount /api/magic-link` **OK** · `mount /api/inject` **OK** · `queue module` **OK** · `node asia-se-01` **14ms** · **READY**

[Repo](https://github.com/kyedeveloper/am-premium) · [Live](https://www.juikoprem.my.id/)

</div>
