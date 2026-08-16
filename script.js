// Tab Switch
function switchTab(t) {
    document.getElementById('proc-tab').style.display = t === 'proc' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = t === 'music' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === (t==='proc'?'premium':t)));
}
// Clock
setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000);

// Music
async function searchMusic() {
    const q = document.getElementById('q').value;
    const r = await fetch(`https://saavn.me/search/songs?query=${encodeURIComponent(q)}`);
    const d = await r.json();
    document.getElementById('results').innerHTML = d.data.results.slice(0,5).map(s => `
        <div class="history-item" onclick="document.getElementById('audio').src='${s.downloadUrl[4].url}'; document.getElementById('audio').play();">
            ${s.name} <span>▶</span>
        </div>`).join('');
}

// API
async function sendEmail() {
    await fetch(`/api/send?email=${encodeURIComponent(document.getElementById('email').value)}`);
    Swal.fire('Sukses', 'Cek email!', 'success');
}

async function verifyAcc() {
    await fetch(`/api/verify?email=${encodeURIComponent(document.getElementById('email').value)}&magicLink=${encodeURIComponent(document.getElementById('magicLink').value)}`);
    Swal.fire('Berhasil!', 'Aktif!', 'success');
    loadHistory();
}

async function loadHistory() {
    try {
        const r = await fetch('/api/history');
        const d = await r.json();
        document.getElementById('historyList').innerHTML = d.map(i => `<div class="history-item">✅ ${i.email} <span>${i.time}</span></div>`).join('');
    } catch(e) {}
}
loadHistory();
