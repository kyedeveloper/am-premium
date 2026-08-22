// ==========================================
// 1. DATA STREAM SIMULATION (SCROLLING HEX)
// ==========================================
function generateHexLine() {
    const chars = '0123456789ABCDEF';
    let line = '0x';
    for(let i=0; i<32; i++) {
        line += chars[Math.floor(Math.random() * chars.length)];
        if(i % 8 === 7 && i !== 31) line += ' ';
    }
    return line;
}

const streamBox = document.getElementById('dataStream');
setInterval(() => {
    const p = document.createElement('div');
    p.className = 'stream-line';
    p.innerText = `[${new Date().toISOString().substring(11,23)}] DECRYPT: ${generateHexLine()}`;
    streamBox.prepend(p);
    if(streamBox.children.length > 20) streamBox.removeChild(streamBox.lastChild);
}, 800);


// ==========================================
// 2. MICRO CHARTS SIMULATION
// ==========================================
function createChartBars(containerId, count) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for(let i=0; i<count; i++) {
        const bar = document.createElement('div');
        bar.className = 'mc-bar';
        bar.style.height = `${Math.floor(Math.random() * 80) + 20}%`;
        container.appendChild(bar);
    }
}

function updateChart(containerId, isWarning = false) {
    const container = document.getElementById(containerId);
    const bars = container.children;
    // Shift bars left
    for(let i=0; i<bars.length-1; i++) {
        bars[i].style.height = bars[i+1].style.height;
        bars[i].className = bars[i+1].className;
    }
    // New bar on right
    const newHeight = Math.floor(Math.random() * 80) + 20;
    bars[bars.length-1].style.height = `${newHeight}%`;
    
    if(isWarning && newHeight > 85) bars[bars.length-1].className = 'mc-bar warn';
    else bars[bars.length-1].className = 'mc-bar active';
    
    // Dim older bars
    setTimeout(() => { if(bars[bars.length-1]) bars[bars.length-1].className = 'mc-bar'; }, 500);
}

// Initialize Charts
['chartRequests', 'chartSuccess', 'chartCpu', 'chartThread'].forEach(id => createChartBars(id, 20));

setInterval(() => {
    updateChart('chartRequests');
    updateChart('chartSuccess');
    
    const cpu = Math.floor(Math.random() * 60) + 15;
    document.getElementById('cpuVal').innerText = cpu;
    updateChart('chartCpu', true);
    
    document.getElementById('threadVal').innerText = Math.floor(Math.random() * 10) + 12;
    updateChart('chartThread');
    
    document.getElementById('latencyVal').innerText = `${Math.floor(Math.random() * 10) + 8}ms`;
}, 1500);


// ==========================================
// 3. LIMIT & QUOTA SYSTEM
// ==========================================
const SECRET_CODE = "ELITE2026";
const MAX_LIMIT = 5;
let currentLimit = MAX_LIMIT;

function initLimit() {
    const todayStr = new Date().toDateString();
    let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
    if (!stored || stored.date !== todayStr) {
        stored = { date: todayStr, count: MAX_LIMIT };
        localStorage.setItem('am_elite_limit', JSON.stringify(stored));
    }
    
    // Set random session ID
    document.getElementById('sessionVal').innerText = `USR-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
    
    currentLimit = stored.count;
    updateLimitUI();
}

function updateLimitUI() {
    const badge = document.getElementById('limitBadge');
    if (currentLimit > 100) {
        badge.innerText = "UNLIMITED (ADMIN)";
        badge.style.color = "var(--success)";
    } else {
        badge.innerText = `${currentLimit} / ${MAX_LIMIT} Reqs`;
        badge.style.color = currentLimit === 0 ? "var(--danger)" : "var(--primary)";
    }
}

function decreaseLimit() {
    if (currentLimit > 100) return;
    currentLimit--;
    let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
    stored.count = currentLimit;
    localStorage.setItem('am_elite_limit', JSON.stringify(stored));
    updateLimitUI();
}

function checkLimit() {
    if (currentLimit <= 0) {
        Swal.fire({
            title: 'Quota Exceeded',
            text: 'Your daily API request quota has been reached.',
            icon: 'warning',
            input: 'password',
            inputPlaceholder: 'Enter Admin Authorization Key...',
            showCancelButton: true, confirmButtonText: 'Authorize', cancelButtonText: 'Close',
            confirmButtonColor: '#2563eb'
        }).then((result) => {
            if (result.value === SECRET_CODE) {
                let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
                stored.count = 9999;
                localStorage.setItem('am_elite_limit', JSON.stringify(stored));
                currentLimit = 9999;
                updateLimitUI();
                Swal.fire({icon: 'success', title: 'Authorized', text: 'Admin limits disabled.'});
            } else if (result.value) {
                Swal.fire({icon: 'error', title: 'Rejected', text: 'Invalid authorization key.'});
            }
        });
        return false;
    }
    return true;
}

// ==========================================
// 4. GLOBAL ANALYTICS (GROWTH)
// ==========================================
function updateGlobalStats() {
    const launchDate = new Date('2026-08-16T00:00:00');
    const now = new Date();
    const hoursPassed = Math.max(0, Math.floor((now - launchDate) / 3600000));
    const minutesPassed = now.getMinutes();

    const baseVisitors = 1163;
    const baseSuccess = 373;

    const currentVisitors = baseVisitors + (hoursPassed * 4) + Math.floor(minutesPassed / 5);
    const currentSuccess = baseSuccess + (hoursPassed * 1) + Math.floor(minutesPassed / 15);

    document.getElementById('visitorCount').innerText = currentVisitors.toLocaleString('id-ID');
    document.getElementById('successCount').innerText = currentSuccess.toLocaleString('id-ID');
}


// ==========================================
// 5. AUDIO SYSTEM (MINIMAL)
// ==========================================
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
const aText = document.querySelector('.a-text');
let isMusicInitialized = false;

function initAudio() {
    if (!isMusicInitialized) {
        bgMusic.volume = 0.4;
        bgMusic.play().then(() => {
            isMusicInitialized = true;
            musicBtn.classList.add('playing');
            aText.innerText = "BGM: Active";
        }).catch(() => {});
    }
}

function toggleMusic(e) {
    e.stopPropagation();
    if (bgMusic.paused) {
        bgMusic.play();
        musicBtn.classList.add('playing');
        aText.innerText = "BGM: Active";
        isMusicInitialized = true;
    } else {
        bgMusic.pause();
        musicBtn.classList.remove('playing');
        aText.innerText = "BGM: Paused";
    }
}


// ==========================================
// 6. BACKEND API & AUDIT LOGS
// ==========================================
async function loadHistory() {
    const list = document.getElementById('historyList');
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        
        if(data.length === 0) {
            list.innerHTML = `<div style="text-align:center; margin-top:20px; color:var(--text-muted);">No audit trails available.</div>`;
        } else {
            list.innerHTML = data.map(item => `
                <div class="log-entry">
                    <div class="l-time">${item.time}</div>
                    <div class="l-badge b-success">SUCCESS</div>
                    <div class="l-msg">Token injected for user: ${item.email}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = `<div style="text-align:center; margin-top:20px; color:var(--danger);">Error fetching database records.</div>`;
    }
}

async function sendEmail() {
    if (!checkLimit()) return; 

    const email = document.getElementById('email').value;
    if (!email) return Swal.fire({ icon: 'warning', title: 'Validation Error', text: 'Target email is required.' });

    Swal.fire({ title: 'Establishing Connection...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/send?email=${encodeURIComponent(email)}`);
        Swal.fire({ icon: 'info', title: 'Request Sent', text: 'Check the target email for the authentication link.' });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Network Error', text: 'Server is currently unreachable.' });
    }
}

async function verifyAcc() {
    if (!checkLimit()) return; 

    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    
    if (!email || !link) return Swal.fire({ icon: 'warning', title: 'Missing Data', text: 'Both Email and Magic Link are required.' });

    Swal.fire({ title: 'Processing Transaction...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
        
        decreaseLimit(); 
        
        Swal.fire({ icon: 'success', title: 'Success', text: 'Premium script successfully injected to target account.' });
        
        document.getElementById('magicLink').value = ''; 
        loadHistory(); 
        
        const successEl = document.getElementById('successCount');
        successEl.innerText = (parseInt(successEl.innerText.replace(/\D/g, '')) + 1).toLocaleString('id-ID');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Verification Failed', text: 'The token provided is invalid or expired.' });
    }
}

// INITIALIZATION
initLimit(); 
updateGlobalStats(); 
setInterval(updateGlobalStats, 60000); 
loadHistory();
    
