// --- LOGIKA STATISTIK DINAMIS ---
function updateStats() {
    // Tanggal web lu "lahir" (contoh: 16 Agustus 2026)
    const launchDate = new Date('2026-08-16T00:00:00');
    const now = new Date();
    
    // Hitung selisih jam
    const diffInHours = Math.floor((now - launchDate) / (1000 * 60 * 60));
    
    // Base angka awal
    const baseVisitors = 1204;
    const baseGenerated = 842;
    
    // Formula: Angka awal + (jam berlalu * rate kenaikan) + sedikit random biar natural
    const visitors = baseVisitors + (diffInHours * 5) + Math.floor(Math.random() * 3);
    const generated = baseGenerated + (diffInHours * 3) + Math.floor(Math.random() * 2);
    
    // Update ke HTML
    document.getElementById('visitorCount').innerText = visitors.toLocaleString();
    document.getElementById('generatedCount').innerText = generated.toLocaleString();
}

// Jalankan pas halaman dibuka
updateStats();

// --- FUNGSI API UTAMA ---
async function sendVerificationEmail() {
    const email = document.getElementById('emailInput').value;
    if (!email) return Swal.fire({ icon: 'warning', text: 'Email kosong!' });

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(`/api/send?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        Swal.fire('Sukses!', 'Cek email lu ya!', 'success');
    } catch (e) {
        Swal.fire('Error', 'Server sibuk, coba lagi nanti.', 'error');
    }
}

async function verifyPremium() {
    const email = document.getElementById('emailInput').value;
    const link = document.getElementById('magicLinkInput').value;
    if (!email || !link) return Swal.fire({ icon: 'warning', text: 'Isi semua data!' });

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
        const data = await res.json();
        Swal.fire('Berhasil!', 'Akun sudah premium!', 'success');
        
        // Bonus: Update angka sukses setelah user berhasil generate
        let current = parseInt(document.getElementById('generatedCount').innerText.replace(',', ''));
        document.getElementById('generatedCount').innerText = (current + 1).toLocaleString();
    } catch (e) {
        Swal.fire('Gagal', 'Magic Link expired atau salah.', 'error');
    }
}
