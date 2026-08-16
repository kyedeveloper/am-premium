// Function switch tab
function switchTab(t) {
    document.getElementById('proc-tab').style.display = t === 'proc' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = t === 'music' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase() === (t==='proc'?'processor':t)));
}

// Clock
setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000);

async function searchMusic() {
    const q = document.getElementById('q').value;
    const resDiv = document.getElementById('results');
    const loading = document.getElementById('loadingMusic');
    
    if(!q) return Swal.fire('Oops', 'Mau cari lagu apa?', 'warning');

    resDiv.innerHTML = '';
    loading.style.display = 'block';

    try {
        // API BhariyaMusic
        const res = await fetch(`https://bhariyamusic.vercel.app/search/songs?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        loading.style.display = 'none';
        resDiv.innerHTML = data.data.results.slice(0, 5).map(s => `
            <div class="song-card" style="background:#111; padding:15px; border-radius:15px; margin-bottom:10px; display:flex; align-items:center; cursor:pointer;" 
                 onclick="playSong('${s.downloadUrl[4].url}', '${s.name}', '${s.image[2].url}')">
                <img src="${s.image[0].url}" style="width:40px; height:40px; border-radius:8px; margin-right:15px;">
                <span>${s.name}</span>
            </div>
        `).join('');
    } catch(e) {
        loading.style.display = 'none';
        resDiv.innerHTML = "Gagal memuat lagu.";
    }
}

function playSong(url, title, img) {
    document.getElementById('audio').src = url;
    document.getElementById('thumb').src = img;
    document.getElementById('songTitle').innerText = title;
    document.getElementById('player-box').style.display = 'block';
    document.getElementById('audio').play();
}

// FIX FEED LOADING
async function loadHistory() {
    const list = document.getElementById('historyList');
    try {
        const r = await fetch('/api/history');
        const d = await r.json();
        if (d.length === 0) {
            list.innerHTML = "<div style='color:#444; font-size:12px; text-align:center;'>Belum ada aktivitas.</div>";
        } else {
            list.innerHTML = d.map(i => `
                <div class="history-item"><span>✅ ${i.email}</span><span style="color:#666">${i.time}</span></div>
            `).join('');
        }
    } catch(e) {
        list.innerHTML = "Database tidak terhubung.";
    }
}
loadHistory();


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
