// ==========================================
// 1. SISTEM LIMIT & OWNER BYPASS
// ==========================================
const SECRET_CODE = "ELITE2026"; // <-- Ganti kode rahasia lu di sini
const MAX_LIMIT = 5;
let currentLimit = MAX_LIMIT;

function initLimit() {
    const todayStr = new Date().toDateString();
    let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
    
    // Kalau belum pernah buka atau beda hari, reset ke 5
    if (!stored || stored.date !== todayStr) {
        stored = { date: todayStr, count: MAX_LIMIT };
        localStorage.setItem('am_elite_limit', JSON.stringify(stored));
    }
    
    currentLimit = stored.count;
    updateLimitUI();
}

function updateLimitUI() {
    const badge = document.getElementById('limitBadge');
    if (currentLimit > 100) {
        badge.innerText = "ACCESS: UNLIMITED (OWNER)";
        badge.style.borderColor = "#00d2ff";
        badge.style.color = "#00d2ff";
        badge.style.background = "rgba(0, 210, 255, 0.15)";
    } else {
        badge.innerText = `LIMIT HARIAN: ${currentLimit} / ${MAX_LIMIT}`;
    }
}

function decreaseLimit() {
    if (currentLimit > 100) return; // Kalau owner ga usah dikurangin
    currentLimit--;
    let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
    stored.count = currentLimit;
    localStorage.setItem('am_elite_limit', JSON.stringify(stored));
    updateLimitUI();
}

function checkLimit() {
    if (currentLimit <= 0) {
        Swal.fire({
            title: 'Limit Harian Habis 🚫',
            text: 'Server membatasi 5 Request per hari untuk mencegah spam API. Silakan coba lagi besok.',
            icon: 'warning',
            input: 'password',
            inputPlaceholder: 'Masukkan Kode Akses Owner...',
            background: '#141419',
            color: '#fff',
            showCancelButton: true,
            confirmButtonText: 'Bypass Limit',
            cancelButtonText: 'Tutup',
            confirmButtonColor: '#9d50bb'
        }).then((result) => {
            if (result.value === SECRET_CODE) {
                let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
                stored.count = 9999;
                localStorage.setItem('am_elite_limit', JSON.stringify(stored));
                currentLimit = 9999;
                updateLimitUI();
                Swal.fire({icon: 'success', title: 'Akses Owner Dibuka!', text: 'Sistem limit telah dinonaktifkan.', background: '#141419', color: '#fff'});
            } else if (result.value) {
                Swal.fire({icon: 'error', title: 'Akses Ditolak', text: 'Kode bypass salah. Sistem mendeteksi anomali.', background: '#141419', color: '#fff'});
            }
        });
        return false;
    }
    return true;
}

// ==========================================
// 2. UI LOGIC & BACKGROUND MUSIC
// ==========================================
initLimit(); // Panggil saat web diload

function switchTab(tabId) {
    document.getElementById('proc-tab').style.display = tabId === 'proc' ? 'block' : 'none';
    document.getElementById('music-tab').style.display = tabId === 'music' ? 'block' : 'none';
    const buttons = document.querySelectorAll('.tab-btn');
    buttons[0].classList.toggle('active', tabId === 'proc');
    buttons[1].classList.toggle('active', tabId === 'music');
}

setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
}, 1000);

const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
let isMusicInitialized = false;

function initAudio() {
    if (!isMusicInitialized) {
        bgMusic.volume = 0.4;
        bgMusic.play().then(() => {
            isMusicInitialized = true;
            musicBtn.classList.add('playing');
        }).catch(() => console.log("Autoplay ditahan browser."));
    }
}

function toggleMusic(e) {
    e.stopPropagation();
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
// 3. API & DATABASE LOGIC (VERCEL KV)
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
                    <div class="feed-email"><span style="color:#00d2ff;">✔</span> ${item.email}</div>
                    <div class="feed-time">${item.time}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = `<div style="text-align:center; padding:15px; color:#ff4d4d; font-size:12px;">Database connection closed.</div>`;
    }
}

loadHistory();

async function sendEmail() {
    if (!checkLimit()) return; // Cek limit dulu sebelum lanjut!

    const email = document.getElementById('email').value;
    if (!email) return Swal.fire({ icon: 'warning', title: 'Akses Ditolak', text: 'Masukkan email terlebih dahulu.', background: '#141419', color: '#fff' });

    Swal.fire({ title: 'Menghubungi Server...', allowOutsideClick: false, background: '#141419', color: '#fff', didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/send?email=${encodeURIComponent(email)}`);
        decreaseLimit(); // Kurangi jatah limit kalau sukses
        Swal.fire({ icon: 'success', title: 'Link Terkirim', text: 'Silakan periksa kotak masuk atau folder spam email Anda.', background: '#141419', color: '#fff' });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Server Sibuk', text: 'Gagal mengirim permintaan.', background: '#141419', color: '#fff' });
    }
}

async function verifyAcc() {
    if (!checkLimit()) return; // Cek limit dulu sebelum lanjut!

    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    
    if (!email || !link) return Swal.fire({ icon: 'warning', title: 'Data Tidak Lengkap', text: 'Email dan Magic Link wajib diisi.', background: '#141419', color: '#fff' });

    Swal.fire({ title: 'Inisialisasi Premium...', allowOutsideClick: false, background: '#141419', color: '#fff', didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
        decreaseLimit(); // Kurangi jatah limit kalau sukses
        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Status Premium telah diaktifkan untuk akun Anda.', background: '#141419', color: '#fff' });
        
        document.getElementById('magicLink').value = ''; 
        loadHistory(); 
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Verifikasi Gagal', text: 'Link tidak valid atau telah kadaluarsa.', background: '#141419', color: '#fff' });
    }
            }
