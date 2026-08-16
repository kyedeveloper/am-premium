// ==========================================
// UI LOGIC (TABS & CLOCK)
// ==========================================
function switchTab(tabId) {
    document.getElementById('proc-tab').style.display = tabId === 'proc' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = tabId === 'music' ? 'block' : 'none';
    
    const buttons = document.querySelectorAll('.tab-btn');
    buttons[0].classList.toggle('active', tabId === 'proc');
    buttons[1].classList.toggle('active', tabId === 'music');
}

setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
}, 1000);


// ==========================================
// BACKGROUND MUSIC LOGIC
// ==========================================
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
let isMusicInitialized = false;

// Fungsi ini kepanggil otomatis pas user klik area manapun di web (Hack buat nembus aturan Autoplay Browser)
function initAudio() {
    if (!isMusicInitialized) {
        bgMusic.volume = 0.5; // Set volume 50% biar gak kaget
        bgMusic.play().then(() => {
            isMusicInitialized = true;
            musicBtn.classList.add('playing');
        }).catch(err => console.log("Autoplay ditahan browser, butuh interaksi user."));
    }
}

// Tombol manual buat Play/Pause
function toggleMusic(e) {
    e.stopPropagation(); // Biar gak trigger initAudio()
    if (bgMusic.paused) {
        bgMusic.play();
        musicBtn.classList.add('playing');
        isMusicInitialized = true;
    } else {
        bgMusic.pause();
        musicBtn.classList.remove('playing');
    }
}


// ==========================================
// API & DATABASE LOGIC (VERCEL KV)
// ==========================================
async function loadHistory() {
    const list = document.getElementById('historyList');
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error('Network error');
        
        const data = await response.json();
        
        if(data.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:15px; color:#555; font-size:12px;">Belum ada history aktivasi.</div>`;
        } else {
            list.innerHTML = data.map(item => `
                <div class="feed-item">
                    <div class="feed-email">
                        <span style="color:#00d2ff;">✔</span> ${item.email}
                    </div>
                    <div class="feed-time">${item.time}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = `<div style="text-align:center; padding:15px; color:#ff4d4d; font-size:12px;">Database connection closed.</div>`;
    }
}

// Panggil saat web diload
loadHistory();

async function sendEmail() {
    const email = document.getElementById('email').value;
    if (!email) return Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Masukkan email terlebih dahulu.', background: '#141419', color: '#fff' });

    Swal.fire({ title: 'Menghubungi Server...', allowOutsideClick: false, background: '#141419', color: '#fff', didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/send?email=${encodeURIComponent(email)}`);
        Swal.fire({ icon: 'success', title: 'Link Terkirim', text: 'Silakan periksa kotak masuk atau folder spam email Anda.', background: '#141419', color: '#fff' });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Server Sibuk', text: 'Gagal mengirim permintaan.', background: '#141419', color: '#fff' });
    }
}

async function verifyAcc() {
    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    
    if (!email || !link) return Swal.fire({ icon: 'warning', title: 'Data Tidak Lengkap', text: 'Email dan Magic Link wajib diisi.', background: '#141419', color: '#fff' });

    Swal.fire({ title: 'Inisialisasi Premium...', allowOutsideClick: false, background: '#141419', color: '#fff', didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Status Premium telah diaktifkan untuk akun Anda.', background: '#141419', color: '#fff' });
        
        document.getElementById('magicLink').value = ''; // Bersihkan input
        loadHistory(); // Update feed live
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Verifikasi Gagal', text: 'Link tidak valid atau telah kadaluarsa.', background: '#141419', color: '#fff' });
    }
                   }
                   
