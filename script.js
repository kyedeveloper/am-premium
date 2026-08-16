// Tab Switching
function switchTab(tab) {
    document.getElementById('processor-tab').style.display = tab === 'processor' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = tab === 'music' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === tab));
}

// Clock & Stats
setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000);
const h = Math.floor((new Date() - new Date('2026-08-16')) / 3600000);
document.getElementById('visitorCount').innerText = (1204 + (h * 5)).toLocaleString();
document.getElementById('generatedCount').innerText = (842 + (h * 3)).toLocaleString();

// Music Player
async function searchMusic() {
    const q = document.getElementById('searchQuery').value;
    const res = await fetch(`https://saavn.me/search/songs?query=${encodeURIComponent(q)}`);
    const data = await res.json();
    document.getElementById('songResults').innerHTML = data.data.results.slice(0,4).map(s => `
        <div class="song-item" onclick="document.getElementById('audioPlayer').src='${s.downloadUrl[4].url}'; document.getElementById('audioPlayer').play();">
            ${s.name} <span>▶</span>
        </div>`).join('');
}

// API Premium (Panggil backend vercel lu)
async function sendEmail() {
    const email = document.getElementById('email').value;
    await fetch(`/api/send?email=${encodeURIComponent(email)}`);
    Swal.fire('Sukses!', 'Cek email!', 'success');
}

async function verifyAcc() {
    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
    Swal.fire('Berhasil!', 'Akun Premium Aktif!', 'success');
}

// Load History Database
async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    document.getElementById('historyList').innerHTML = data.map(i => `<div style="padding:5px; border-bottom:1px solid #111;">✅ ${i.email}</div>`).join('');
}
loadHistory();
