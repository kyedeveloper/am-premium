// Tab switcher
function switchTab(t) {
    document.getElementById('proc-tab').style.display = t === 'proc' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = t === 'music' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === (t==='proc'?'premium':t)));
}

// Clock
setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000);

// Music Search (Deezer API)
async function searchMusic() {
    const q = document.getElementById('q').value;
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`);
    const d = await res.json();
    document.getElementById('results').innerHTML = d.data.slice(0,5).map(s => `
        <div class="song-card" onclick="document.getElementById('player-box').style.display='block'; document.getElementById('audio').src='${s.preview}'; document.getElementById('audio').play();">
            <img src="${s.album.cover_small}" style="width:50px; border-radius:8px; margin-right:15px;">
            <div>
                <div style="font-weight:600; font-size:13px;">${s.title}</div>
                <div style="font-size:11px; color:#666;">${s.artist.name}</div>
            </div>
        </div>`).join('');
}

// API Premium & History
async function sendEmail() {
    await fetch(`/api/send?email=${encodeURIComponent(document.getElementById('email').value)}`);
    Swal.fire('Sukses', 'Cek email lu!', 'success');
}

async function verifyAcc() {
    await fetch(`/api/verify?email=${encodeURIComponent(document.getElementById('email').value)}&magicLink=${encodeURIComponent(document.getElementById('magicLink').value)}`);
    Swal.fire('Berhasil!', 'Aktif!', 'success');
    loadHistory();
}

async function loadHistory() {
    const list = document.getElementById('historyList');
    try {
        const r = await fetch('/api/history');
        const d = await r.json();
        if(d.length === 0) list.innerHTML = "<div style='text-align:center; color:#333;'>Belum ada data.</div>";
        else list.innerHTML = d.map(i => `<div class="history-item"><span>✅ ${i.email}</span><span style="color:#555">${i.time}</span></div>`).join('');
    } catch(e) { list.innerHTML = "<div style='text-align:center; color:red;'>Database offline!</div>"; }
}
loadHistory();
