// --- JAM DIGITAL ---
function updateClock() {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// --- AMBIL HISTORY ---
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        const list = document.getElementById('historyList');
        list.innerHTML = data.map(item => `
            <div style="margin-bottom: 5px; border-bottom: 1px solid #111; padding-bottom: 5px;">
                ✅ ${item.email} - <span style="color:#666">${item.time}</span>
            </div>
        `).join('');
    } catch(e) {}
}
loadHistory();

// --- MODIFIKASI FUNGSI VERIFIKASI (Tambahin loadHistory() di akhir) ---
async function verifyAcc() {
    // ... (kode sebelumnya) ...
    try {
        await fetch(`/api/verify?email=...`);
        Swal.fire('Berhasil!', 'Akun sudah premium!', 'success');
        loadHistory(); // Refresh feed biar user baru muncul
    } catch(e) { /* ... */ }
}
