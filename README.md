```
  ▄▀█ █▀▄▀█   █▀█ █▀█ █▀▀ █▀▄▀█ █ █ █ █▀▄▀█
  █▀█ █░▀░█   █▀▀ █▀▄ ██▄ █░▀░█ █ █ █ █░▀░█
```

# AM PREMIUM // ZUKAI TERMINAL

**Alight Motion Premium tanpa drama.**

Terminal serverless buat aktivasi Alight Motion Premium. Kirim magic link, tempel OOB code, inject. Ada akun, ada kuota, ada riwayat — semuanya rapi dalam satu layar.

[![Live](https://img.shields.io/badge/LIVE-juikoprem.my.id-8b5cf6?style=for-the-badge&logo=vercel&logoColor=white)](https://www.juikoprem.my.id/)
[![Version](https://img.shields.io/badge/VERSION-v5.1.0-22d3ee?style=for-the-badge)](https://github.com/kyedeveloper/am-premium)
[![Runtime](https://img.shields.io/badge/RUNTIME-Vercel%20Functions-a3e635?style=for-the-badge&logo=vercel&logoColor=black)](https://vercel.com/)
[![Stack](https://img.shields.io/badge/STACK-Vanilla%20JS%20%2B%20Redis-fbbf24?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/LICENSE-Open%20Source-f472b6?style=for-the-badge)](https://github.com/kyedeveloper/am-premium#-lisensi)

[Demo Langsung](https://www.juikoprem.my.id/) · [Fitur](#-kapabilitas) · [Cara Kerja](#-cara-kerja) · [API](#-api-reference) · [Deploy Sendiri](#-deploy-sendiri) · [FAQ](#-faq)

> Bukan produk resmi Alight Creative. Kalau premium tiba-tiba hilang, jalankan ulang prosesnya.

---

## 📟 Apa ini

**AM Premium** adalah terminal aktivasi satu halaman yang memangkas seluruh proses premium manual jadi **dua kolom input dan satu tombol**.

Proses aslinya panjang dan gampang salah: kirim link verifikasi, buka email, salin URL panjang yang berantakan, tempel ke tempat yang benar, baru jalankan. Terminal ini memotong semuanya.

Semua logika berat — login OOB, pemanggilan `verifyPurchase`, penyimpanan token, hitung kuota — dipindah ke serverless function supaya browser tetap bersih. **Prinsip desainnya: satu layar, dua langkah, nol token di frontend.** Kalau satu langkah gagal, terminal bilang persis di mana masalahnya.

|  |  |
| --- | --- |
| **Developer** | Zukai Dev |
| **Runtime** | Vercel Functions (node `asia-se-01`) |
| **Stack** | HTML + Vanilla JS, tanpa framework, tanpa build step |
| **Data** | Upstash Redis (REST) |
| **Auth** | Session JWT (cookie `HttpOnly`) + API key `x-api-key` |
| **Pembayaran** | QRIS via Pixpayz |
| **Versi** | v5.1.0 · Build 2026.10.31 |
| **Lisensi** | Open Source |

---

## ⚡ Kapabilitas

Dibangun buat dipakai, bukan dipamerin. Tiap bagian terminal punya satu tugas jelas.

### 1. Magic Link Dispatch
Kirim email verifikasi ke akun target lewat `POST /api/magic-link`. Respon langsung, tanpa reload. Rate limit 40 request/jam per IP.

### 2. Bulk Antrian
Tempel sampai 30 email sekaligus, dikirim berurutan dengan jeda 1,2 detik. Status per baris terlihat jelas — sukses, gagal, atau menunggu.

### 3. Validator Realtime
Tempel link, langsung dicek: `oobCode` ketemu atau tidak, panjang karakter, dan tombol inject menyesuaikan. Parser mendekode URL bersarang dan cuma mengambil nilai `oobCode`.

### 4. Force Inject
Payload diteruskan ke `POST /api/inject` dengan order ID unik sebagai jejak aktivasi. Butuh sesi login atau API key yang valid.

### 5. Akun & Kuota Server
Register/login pakai email + password (bcrypt, cost 10). Kuota **20 inject/hari** buat akun free, reset 00:00 WIB. Dihitung di Redis, bukan di browser — jadi nggak bisa diakalin lewat DevTools.

### 6. Premium & QRIS Otomatis
Upgrade Rp3.500 / 30 hari. Invoice dibuat lewat Pixpayz, QR dirender di sheet pembayaran, status di-polling sampai lunas, lalu plan naik otomatis tanpa perlu kirim bukti transfer.

### 7. API Key buat Bot
Setiap akun punya API key `am_<48 hex>`. Bisa dirotasi dari panel akun. Dipakai sebagai header `x-api-key` buat integrasi mesin.

### 8. Riwayat Lokal + CSV
Semua aktivasi tersimpan di `localStorage` perangkat kamu, bisa diekspor CSV buat pembukuan, bisa dihapus kapan saja.

### 9. Panel Owner
Statistik global (total user, inject hari ini), grant premium manual per email, banner pengumuman global, dan saklar maintenance mode.

### 10. Token di Server
`API_KEY`, `ALIGHT_TOKEN`, `FIREBASE_TOKEN`, `JWT_SECRET`, `PIXPAYZ_API_KEY` hidup sebagai env Vercel. Nol kredensial di HTML.

### Fitur terminal tambahan
- **Command palette** — `Ctrl + K` / `Cmd + K`
- **Accent themes** — violet / cyan / lime / ember
- **Sound toggle** — feedback audio opsional (Web Audio, tanpa file)
- **QR share** — bagikan terminal lewat QR
- **Confetti + particle canvas** — respons sukses
- **Panduan keyboard** — `↑ ↓` navigasi, `Enter` jalankan, `Esc` tutup
- **Order ID mode** — acak (5 digit) atau urut (counter) buat pembukuan
- **Konfirmasi & struk** — sheet konfirmasi sebelum inject, struk unduhan saat sukses
- **Mini tools** — OOB extractor, Base64 encode/decode, epoch clock
- **Responsive + reduced-motion** — jalan di HP, hormat ke preferensi aksesibilitas

---

## 🔄 Cara kerja

```
  [1]  Login / tempel API key
          │
          ▼
  [2]  Masukkan email target
          │
          ▼
  POST /api/magic-link  ──►  Google Identity Toolkit  ──►  📧 Email verifikasi
          │
          ▼
  [3]  Salin magic link dari inbox, tempel utuh
          │
          ▼
  Validator realtime  ──►  decode URL, ambil nilai oobCode
          │
          ▼
  POST /api/inject  ──►  cek sesi  ──►  cek kuota  ──►  emailLinkSignin  ──►  idToken
          │
          ▼
  verifyPurchase (Cloud Functions Alight Creative)
          │
          ▼
  ✅ Premium aktif · kuota naik · struk terunduh · riwayat lokal
```

**Order ID** bisa kamu pakai sebagai penanda transaksi. Mode acak menghasilkan 5 digit random per transaksi; mode urut dipakai kalau kamu jualan dan butuh ID yang konsisten.

---

## 🧱 Struktur proyek

```
am-premium/
├── api/
│   ├── admin/
│   │   ├── [action].js       # grant, stats (khusus owner)
│   │   ├── announcement.js   # banner pengumuman global
│   │   └── maintenance.js    # saklar maintenance mode
│   ├── auth/
│   │   └── [action].js       # login, register, me, logout, key
│   ├── payment/
│   │   └── [action].js       # create, history, status, webhook
│   ├── health.js             # cek env + versi
│   ├── inject.js             # emailLinkSignin + verifyPurchase
│   └── magic-link.js         # createAuthUri + getOobConfirmationCode
├── backup                    # snapshot frontend versi lama
├── lib/
│   ├── auth.js               # bcrypt, JWT, cookie, API key
│   ├── db.js                 # client Redis + skema key
│   ├── premium.js            # isPremium / isOwner / grantPremium
│   └── quota.js              # limit harian, dayKey WIB
├── index.html                # seluruh frontend: hero, fitur, terminal, FAQ, tools
├── package.json              # @upstash/redis, bcryptjs, jsonwebtoken
├── tutorial.mp4
├── video1.mp4
├── video2.mp4
└── vercel.json               # includeFiles: lib/**
```

Frontend murni satu file. Tidak ada build step, tidak ada bundler, tidak ada framework. Buka `index.html` dan itu sudah seluruh aplikasinya.

---

## 🔌 API Reference

Base URL produksi: `https://www.juikoprem.my.id`

> Ganti domain kalau kamu deploy di alamat lain.

Semua endpoint mengembalikan JSON dengan bentuk `{ "status": "success" | "error", "message": "..." }`.

### Autentikasi

Dua cara, pilih salah satu:

| Metode | Header / Cookie | Dipakai untuk |
| --- | --- | --- |
| Session cookie | `amsess` (JWT, `HttpOnly`, `Secure`, 30 hari) | Browser |
| API key | `x-api-key: am_xxxxxxxx` | Bot, script, integrasi server |

Endpoint yang butuh identitas: `/api/inject`, seluruh `/api/auth/*` (kecuali `login`/`register`), seluruh `/api/payment/*`, seluruh `/api/admin/*`.

### `GET /api/health`

Cek status deploy dan kelengkapan env. Berguna setelah setup.

```json
{
  "ok": true,
  "version": "5.1.0",
  "env": { "apiKey": true, "alightToken": true, "firebaseToken": true,
           "redisUrl": true, "redisToken": true, "jwtSecret": true,
           "pixpayz": true, "owner": true }
}
```

---

### Auth

#### `POST /api/auth/register`

**Body**
```json
{ "email": "kamu@email.com", "password": "minimal6" }
```
**200** — user + kuota, sekaligus set cookie sesi. Email sudah dipakai → `409`. Email tidak valid / password < 6 karakter → `400`.

#### `POST /api/auth/login`

**Body** `{ "email": "...", "password": "..." }`
**200** — user + kuota + cookie sesi. Salah kredensial → `401`.

#### `GET /api/auth/me`

Tanpa sesi tetap `200` dengan `{ "user": null, "quota": null }`, jadi aman dipanggil di setiap load.

#### `POST /api/auth/logout`

Hapus cookie sesi.

#### `POST /api/auth/key`

Rotasi API key. Key lama langsung dicabut dari Redis. **401** kalau belum login.

---

### `POST /api/magic-link`

Memicu pengiriman email verifikasi ke akun target. Tidak butuh login.

**Body**
```json
{ "email": "buyer@email.com" }
```
**200**
```json
{ "status": "success", "message": "Magic Link berhasil dikirim!" }
```
**429** — lebih dari 40 request/jam dari IP yang sama.

---

### `POST /api/inject`

Login dengan OOB code lalu meneruskan payload ke `verifyPurchase`. CORS mencerminkan origin pemanggil dan mengizinkan credentials, jadi bisa dipakai dari bot maupun panel.

**Body**
```json
{
  "email": "buyer@email.com",
  "oobCode": "OOB_CODE_NYA",
  "orderId": "ZukaiDev-VIP-00001"
}
```
**200**
```json
{ "status": "success", "message": "Aktivasi Premium Berhasil!",
  "orderId": "ZukaiDev-VIP-00001", "quota": { "remaining": 19 } }
```
**401 `LOGIN_REQUIRED`** — belum login / API key tidak valid.
**429 `QUOTA_EXCEEDED`** — kuota harian habis, disertai objek `quota`.
**500** — kegagalan dari sisi Google atau Alight.

### Contoh integrasi

**Node.js**
```js
const axios = require('axios');

// 1. Kirim magic link
await axios.post('https://www.juikoprem.my.id/api/magic-link', {
  email: 'buyer@email.com'
});

// 2. Inject setelah buyer dapat link
await axios.post('https://www.juikoprem.my.id/api/inject', {
  email: 'buyer@email.com',
  oobCode: 'OOB_CODE_NYA',
  orderId: 'ZukaiDev-VIP-00001'
}, { headers: { 'x-api-key': 'am_xxxxxxxx' } });
```

**Python**
```python
import requests

requests.post("https://www.juikoprem.my.id/api/magic-link",
  json={"email": "buyer@email.com"})

requests.post("https://www.juikoprem.my.id/api/inject",
  json={"email": "buyer@email.com",
        "oobCode": "OOB_CODE_NYA",
        "orderId": "ZukaiDev-VIP-00001"},
  headers={"x-api-key": "am_xxxxxxxx"})
```

**PHP**
```php
<?php
$c1 = curl_init('https://www.juikoprem.my.id/api/magic-link');
curl_setopt($c1, CURLOPT_POSTFIELDS, json_encode(['email'=>'buyer@email.com']));
curl_setopt($c1, CURLOPT_HTTPHEADER, ['Content-Type:application/json']);
curl_setopt($c1, CURLOPT_RETURNTRANSFER, true);
echo curl_exec($c1);

$c2 = curl_init('https://www.juikoprem.my.id/api/inject');
curl_setopt($c2, CURLOPT_POSTFIELDS, json_encode([
  'email'=>'buyer@email.com', 'oobCode'=>'OOB', 'orderId'=>'ID']));
curl_setopt($c2, CURLOPT_HTTPHEADER, ['Content-Type:application/json', 'x-api-key: am_xxxxxxxx']);
curl_setopt($c2, CURLOPT_RETURNTRANSFER, true);
echo curl_exec($c2);
```

---

### Payment

#### `POST /api/payment/create`

Buat invoice QRIS. **401** kalau belum login, **400** kalau sudah premium.

**200**
```json
{ "status": "success", "invoiceId": "...", "total": 3500,
  "paymentLink": "https://...", "qrisImage": "https://...", "expiredAt": "..." }
```

#### `GET /api/payment/status?id=<invoiceId>`

Status invoice. Dipolling frontend sampai `paid`.

#### `GET /api/payment/history`

20 order terakhir milik user.

#### `POST /api/payment/webhook`

Callback dari Pixpayz. Menerima pelunasan dan memanggil `grantPremium`.

---

### Admin (khusus owner)

Owner ditentukan lewat env `OWNER_EMAIL` (bisa banyak, dipisah koma). Akun owner selalu unlimited dan tidak pernah kena kuota.

#### `GET /api/admin/stats`
```json
{ "status": "success", "totalUsers": 128, "injectToday": 74 }
```

#### `POST /api/admin/grant`
**Body** `{ "email": "...", "days": 30 }` — tambah masa premium manual.

#### `GET | POST | DELETE /api/admin/announcement`
Baca / set / hapus banner pengumuman global.

#### `GET | POST /api/admin/maintenance`
Baca / set saklar maintenance (`{ "active": true }`).

---

## 🗄️ Model data

Semua state di Redis, key-nya berpola:

| Key | Isi |
| --- | --- |
| `user:<id>` | Record user (hash password bcrypt, plan, `premiumUntil`, apiKey) |
| `email:<email>` | Pemetaan email → id |
| `key:<apiKey>` | Pemetaan API key → id |
| `quota:<id>:<hari>` | Counter inject harian, TTL 48 jam |
| `quota:global:<hari>` | Counter inject global buat statistik |
| `order:<invoiceId>` | Invoice Pixpayz, TTL 3 hari |
| `orders:<id>` | Set invoice milik user, TTL 90 hari |
| `acts:<id>` | 100 aktivitas terakhir |
| `rl:<prefix>:<ip>` | Rate limit, TTL 1 jam |
| `users:all` | Set seluruh user terdaftar |

Batas kuota free memakai offset `+7 jam`, jadi `dayKey` berganti tepat 00:00 WIB.

---

## 🚀 Deploy sendiri

Butuh akun [Vercel](https://vercel.com/), database [Upstash Redis](https://upstash.com/), dan akun Pixpayz.

### 1. Fork / clone

```bash
git clone https://github.com/kyedeveloper/am-premium.git
cd am-premium
```

### 2. Set environment variables

Di dashboard Vercel → **Settings → Environment Variables**:

| Variable | Isi | Dipakai di |
| --- | --- | --- |
| `API_KEY` | Web API key project Firebase Alight Creative | `magic-link.js`, `inject.js` |
| `ALIGHT_TOKEN` | Purchase token langganan sebagai payload | `inject.js` |
| `FIREBASE_TOKEN` | Firebase instance ID token | `inject.js` |
| `KV_REST_API_URL` | URL REST Upstash Redis | `lib/db.js` |
| `KV_REST_API_TOKEN` | Token REST Upstash Redis | `lib/db.js` |
| `JWT_SECRET` | String acak panjang buat tanda tangan sesi | `lib/auth.js` |
| `PIXPAYZ_API_KEY` | API key Pixpayz buat invoice QRIS | `api/payment` |
| `OWNER_EMAIL` | Email owner, pisah koma kalau lebih dari satu | `lib/premium.js` |
| `PREMIUM_PRICE` | Harga premium, default `3500` | `lib/premium.js` |
| `PREMIUM_DAYS` | Durasi premium, default `30` | `lib/premium.js` |
| `FREE_DAILY_LIMIT` | Limit harian akun free, default `20` | `lib/quota.js` |

Semuanya wajib hidup di server. Jangan pernah ditaruh di `index.html`. Ganti `JWT_SECRET` sebelum produksi — default-nya cuma placeholder.

### 3. Deploy

```bash
vercel --prod
```

Atau import repo langsung dari dashboard Vercel — framework preset **Other**, tanpa build command.

### 4. Verifikasi

Buka `https://domain-kamu/api/health`. Semua field `env` harus `true`.

### 5. Sesuaikan domain

Kalau pakai domain sendiri, ganti `https://www.juikoprem.my.id` di contoh kode dan panel API pada `index.html`.

---

## 🔐 Keamanan

- Password di-hash bcrypt cost 10, tidak pernah dikembalikan ke client.
- Sesi JWT `HttpOnly` + `Secure` + `SameSite=Lax`, umur 30 hari.
- Token Alight & Firebase tidak pernah menyentuh browser.
- Kuota dihitung di server, per user per hari.
- `/api/magic-link` dibatasi 40 request/jam per IP.
- API key bisa dicabut seketika lewat rotasi.
- Endpoint admin dijaga `isOwner`, bukan cuma cek login.
- CORS mengizinkan credentials hanya untuk origin pemanggil, dengan header `Vary: Origin`.

---

## ⚠️ Batasan

- Bukan produk resmi **Alight Creative** dan tidak berafiliasi dengan mereka.
- Bergantung penuh pada skema `identitytoolkit` Google dan endpoint `verifyPurchase` milik Alight. Perubahan di sisi mereka bisa mematahkan alur sampai kode diperbarui.
- `ALIGHT_TOKEN` punya masa berlaku; kalau aktivasi mulai gagal konsisten, itu kandidat pertama yang perlu diganti.
- `api/payment/[action].js` masih menyisakan `handleStatus` dan `handleWebhook` sebagai placeholder — isi dulu sebelum pembayaran otomatis jalan.
- `api/admin/maintenance.js` dan `api/admin/announcement.js` memakai `@vercel/kv`, sementara `lib/db.js` memakai `@upstash/redis`. Samakan client-nya biar konsisten.
- Kuota dan pembatasan email sepenuhnya mengikuti kebijakan Google Identity Toolkit.
- Riwayat aktivitas sisi browser hilang kalau `localStorage` dibersihkan atau ganti perangkat.

---

## 🗺️ Roadmap

- [ ] Selesaikan `payment/status` dan `payment/webhook`
- [ ] Samakan client KV di seluruh endpoint admin
- [ ] Sinkronisasi riwayat lintas perangkat lewat Redis
- [ ] Retry terpisah per baris pada antrian bulk
- [ ] Webhook keluar setelah inject sukses
- [ ] Panel owner untuk rotasi token
- [ ] Dukungan produk selain `am.full.sub.annual.19q4`

---

## ❓ FAQ

**Ini legal atau bukan?**
Metodenya meniru alur verifikasi pembelian dari aplikasi resmi, jadi akun akan terbaca premium di Alight Motion. Risikonya cuma satu: kalau server Google atau Alight mengubah skema, endpoint bisa berhenti sampai diperbaiki.

**Kenapa ada limit 20x sehari?**
Biar server nggak kebanjiran dan biaya token tetap wajar. Reset 00:00 WIB. Butuh lebih? Premium Rp3.500 sebulan tanpa batas.

**Premium aktif otomatis setelah bayar?**
Ya, begitu QRIS discan dan dibayar, status berubah dalam beberapa detik. Halaman pembayaran mengecek sendiri, jadi nggak perlu kirim bukti transfer.

**Email magic link nggak masuk, kenapa?**
Cek folder spam/promosi, tunggu 1–2 menit, lalu kirim ulang. Pastikan email diketik lengkap tanpa spasi. Beberapa domain email kantor memblokir pengirim pihak ketiga.

**Link yang ditempel bentuknya aneh, masih bisa?**
Bisa. Parser mendekode URL, membuka parameter bersarang, dan mengambil nilai `oobCode` saja. Validator langsung memberi tahu hasilnya sebelum kamu menembak API.

**Data email saya disimpan?**
Email akun disimpan di database untuk login dan hitung kuota. Riwayat aktivasi tetap di `localStorage` browser kamu dan bisa dihapus kapan saja.

**Bisa dipakai buat jualan?**
Itu tujuan fitur antrian dan order ID urut. Pakai mode **Urut** supaya ID transaksi konsisten, dan ekspor riwayat sebagai CSV untuk pembukuan.

**Bisa dipanggil dari bot?**
Ya, pakai header `x-api-key`. Rate limit dan retry tetap tanggung jawab sisi kamu.

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

**SYSTEM CORE v5.1.0** © 2026 ZUKAI DEVELOPER

`zukai_kernel v5.1.0` · `mount /api/magic-link` **OK** · `mount /api/inject` **OK** · `auth + quota module` **OK** · `node asia-se-01` **14ms** · **READY**

[Repo](https://github.com/kyedeveloper/am-premium) · [Live](https://www.juikoprem.my.id/)
