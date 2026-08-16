// --- HELPER BUTTON LOGIC ---
function showHelp(step) {
    if (step === 1) {
        Swal.fire({
            title: 'Cara Langkah 1',
            text: 'Masukkan email akun Alight Motion lu yang mau dipremiumkan, terus klik "Kirim Link". Tunggu notifikasi sukses, lalu buka email lu.',
            icon: 'info',
            background: '#0c0c0c',
            color: '#fff'
        });
    } else {
        Swal.fire({
            title: 'Cara Langkah 2',
            text: 'Cek kotak masuk/spam di email tadi, salin link verifikasi yang dikirim, terus tempel (paste) di kolom ini dan klik Aktifkan!',
            icon: 'info',
            background: '#0c0c0c',
            color: '#fff'
        });
    }
}

// --- STATS LOGIC ---
function updateStats() {
    const hours = Math.floor((new Date() - new Date('2026-08-16')) / 3600000);
    document.getElementById('visitorCount').innerText = (1204 + (hours * 5)).toLocaleString();
    document.getElementById('generatedCount').innerText = (842 + (hours * 3)).toLocaleString();
}
updateStats();

// --- API LOGIC (Tetep sama kayak sebelumnya) ---
async function sendEmail() {
    const email = document.getElementById('email').value;
    if(!email) return Swal.fire('Oops', 'Isi email dulu!', 'warning');
    Swal.fire({ title: 'Mengirim...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const res = await fetch(`/api/send?email=${encodeURIComponent(email)}`);
        Swal.fire('Sukses!', 'Cek email lu sekarang.', 'success');
    } catch(e) { Swal.fire('Error', 'Gagal kirim.', 'error'); }
}

async function verifyAcc() {
    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    if(!link) return Swal.fire('Oops', 'Link belum ditempel!', 'warning');
    Swal.fire({ title: 'Verifikasi...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
        Swal.fire('Berhasil!', 'Akun sudah premium!', 'success');
    } catch(e) { Swal.fire('Gagal', 'Link salah atau expired.', 'error'); }
}
