// Function switch tab
function switchTab(t) {
    document.getElementById('proc-tab').style.display = t === 'proc' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = t === 'music' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === (t==='proc'?'processor':t)));
}

// Clock
setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000);

// Load History dengan Error Handling
async function loadHistory() {
    const list = document.getElementById('historyList');
    try {
        const r = await fetch('/api/history');
        if (!r.ok) throw new Error('Database Error');
        const d = await r.json();
        if (d.length === 0) list.innerHTML = "Belum ada user sukses.";
        else list.innerHTML = d.map(i => `<div class="feed-item"><span>✅ ${i.email}</span><span style="color:#666">${i.time}</span></div>`).join('');
    } catch(e) {
        list.innerHTML = `<div style="color:red; font-size:11px;">Database not connected! Check Vercel KV settings.</div>`;
    }
}
loadHistory();

// Musik
async function searchMusic() {
    const q = document.getElementById('q').value;
    const res = await fetch(`https://saavn.me/search/songs?query=${encodeURIComponent(q)}`);
    const d = await res.json();
    document.getElementById('results').innerHTML = d.data.results.slice(0,5).map(s => `
        <div class="song-card" onclick="document.getElementById('audio').src='${s.downloadUrl[4].url}'; document.getElementById('audio').play();">
            ${s.name} <span>▶</span>
        </div>`).join('');
}

// API Premium
async function sendEmail() {
    const email = document.getElementById('email').value;
    if(!email) return Swal.fire('Error', 'Isi email dulu!', 'error');
    Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});
    await fetch(`/api/send?email=${encodeURIComponent(email)}`);
    Swal.fire('Sukses', 'Cek email lu!', 'success');
}

async function verifyAcc() {
    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    Swal.fire({title: 'Memproses...', didOpen: () => Swal.showLoading()});
    await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
    Swal.fire('Berhasil!', 'Akun sudah Premium!', 'success');
    loadHistory();
}
