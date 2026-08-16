// --- JAM DIGITAL ---
function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
}
setInterval(updateClock, 1000);
updateClock();

// --- HELPER BUTTON LOGIC ---
function showHelp(step) {
    if (step === 1) {
        Swal.fire({ title: 'Langkah 1', text: 'Masukkan email akun Alight Motion lu, klik "Kirim Link". Tunggu notifikasi, lalu buka email lu.', icon: 'info', background: '#0c0c0c', color: '#fff' });
    } else {
        Swal.fire({ title: 'Langkah 2', text: 'Salin link dari email, tempel di sini, klik Aktifkan!', icon: 'info', background: '#0c0c0c', color: '#fff' });
    }
}

// --- STATS LOGIC ---
function updateStats() {
    const hours = Math.floor((new Date() - new Date('2026-08-16')) / 3600000);
    document.getElementById('visitorCount').innerText = (1204 + (hours * 5)).toLocaleString();
    document.getElementById('generatedCount').innerText = (842 + (hours * 3)).toLocaleString();
}
updateStats();

// --- DATABASE LIVE FEED ---
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        const list = document.getElementById('historyList');
        
        if (data && data.length > 0) {
            list.innerHTML = data.map(item => `
                <div class="feed-item">
                    <span>✅ ${item.email}</span>
                    <span style="color:#666">${item.time}</span>
                </div>
            `).join('');
        } else {
            list.innerHTML = `<div style="font-size: 12px; color: #555; text-align: center;">Belum ada data terbaru.</div>`;
        }
    } catch(e) {
        console.log("Gagal memuat history", e);
    }
}
loadHistory();

// --- API LOGIC ---
async function sendEmail() {
    const email = document.getElementById('email').value;
    if(!email) return Swal.fire('Oops', 'Isi email dulu!', 'warning');
    Swal.fire({ title: 'Mengirim...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/send?email=${encodeURIComponent(email)}`);
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
        
        // Refresh Live Feed dan update angka sukses setelah berhasil
        loadHistory(); 
        let current = parseInt(document.getElementById('generatedCount').innerText.replace(',', ''));
        document.getElementById('generatedCount').innerText = (current + 1).toLocaleString();
    } catch(e) { Swal.fire('Gagal', 'Link salah atau expired.', 'error'); }
}
