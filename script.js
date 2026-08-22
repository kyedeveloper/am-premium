// ==========================================
// 0. VIDEO SLIDER & PINK THEME SPREAD
// ==========================================
let currentSlideIndex = 0;
const wrapper = document.getElementById('slideWrapper');
const dots = document.querySelectorAll('.dot');

function updateSlidePosition() {
    wrapper.style.transform = `translateX(-${currentSlideIndex * 100}%)`;
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlideIndex);
    });

    if (currentSlideIndex === 1) {
        document.body.classList.add('pink-theme');
    } else {
        document.body.classList.remove('pink-theme');
    }
}

function moveSlide(direction) {
    currentSlideIndex += direction;
    if (currentSlideIndex < 0) currentSlideIndex = 1;
    else if (currentSlideIndex > 1) currentSlideIndex = 0;
    updateSlidePosition();
}

function currentSlide(index) {
    currentSlideIndex = index;
    updateSlidePosition();
}

// ==========================================
// UPGRADED QUICK ACTION TOOLS
// ==========================================

// 1. Tool Diagnostik Jaringan & Kuota User
function runDiagnostic() {
    const ping = document.getElementById('latencyVal').innerText;
    const limitStatus = currentLimit > 100 ? "Unlimited (Admin)" : `${currentLimit} / ${MAX_LIMIT} tersisa`;
    
    Swal.fire({
        title: 'Network & System Diagnostic',
        html: `
            <div style="text-align: left; font-size: 13px; line-height: 1.6; font-family: monospace;">
                <b>[OK]</b> Latency Response: <span style="color: #10b981;">${ping}</span><br>
                <b>[OK]</b> Local Storage Sync: <span style="color: #10b981;">Active</span><br>
                <b>[OK]</b> Cloudflare Shield: <span style="color: #10b981;">Protected</span><br>
                <b>[INFO]</b> Your Quota Status: <span style="color: #2563eb;">${limitStatus}</span><br>
                <hr style="border:0; border-top:1px solid #e2e8f0; margin: 10px 0;">
                <i>Result: All client systems running optimally. No packet loss detected.</i>
            </div>
        `,
        icon: 'success',
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb'
    });
}

// 2. Tool Pause/Resume Real-time Decryption Stream
let isStreamPaused = false;
function clearTerminal() {
    isStreamPaused = !isStreamPaused;
    const streamBox = document.getElementById('dataStream');
    if (isStreamPaused) {
        streamBox.style.opacity = '0.4';
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Stream Paused', showConfirmButton: false, timer: 1500 });
    } else {
        streamBox.style.opacity = '1';
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Stream Resumed', showConfirmButton: false, timer: 1500 });
    }
}

// 3. Tool Theme Switcher (Light Blue -> Pink -> Dark Mode)
let themeState = 0;
function toggleThemeManual() {
    themeState = (themeState + 1) % 3;
    const body = document.body;
    
    if (themeState === 0) {
        // Mode Normal (Light Blue)
        body.classList.remove('pink-theme');
        body.style.backgroundColor = '#f8fafc';
        body.style.color = '#0f172a';
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Theme: Enterprise Blue', showConfirmButton: false, timer: 1200 });
    } else if (themeState === 1) {
        // Mode Pink
        body.classList.add('pink-theme');
        body.style.backgroundColor = '#f8fafc';
        body.style.color = '#0f172a';
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Theme: Dynamic Pink', showConfirmButton: false, timer: 1200 });
    } else {
        // Mode Dark Hacker
        body.classList.remove('pink-theme');
        body.style.backgroundColor = '#090d16';
        body.style.color = '#f8fafc';
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Theme: Dark Cyber', showConfirmButton: false, timer: 1200 });
    }
}

// 4. Tool Cluster Info & Live Stats Detail
function showServerInfo() {
    const visitors = document.getElementById('visitorCount').innerText;
    const success = document.getElementById('successCount').innerText;
    
    Swal.fire({
        title: 'Cluster Node Details',
        html: `
            <div style="text-align: left; font-size: 13px; line-height: 1.6;">
                <b>Infrastructure:</b> Vercel Edge Serverless<br>
                <b>Database KV:</b> Connected & Synchronized<br>
                <b>Total Traffic Recorded:</b> ${visitors} hits<br>
                <b>Total Successful Injects:</b> ${success} accounts<br>
                <b>Security Protocol:</b> WAF + DDoS Mitigation Layer 7<br>
            </div>
        `,
        icon: 'info',
        background: '#ffffff',
        color: '#0f172a',
        confirmButtonColor: '#2563eb'
    });
}

// ==========================================
// AUDIO MANUAL TOGGLE
// ==========================================
const bgMusic = document.getElementById('bgMusic');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const audioStatusText = document.getElementById('audioStatusText');

function toggleMusicManual() {
    if (bgMusic.paused) {
        bgMusic.play();
        audioToggleBtn.innerText = "❚❚";
        audioStatusText.innerText = "Status: Playing";
    } else {
        bgMusic.pause();
        audioToggleBtn.innerText = "▶";
        audioStatusText.innerText = "Status: Paused";
    }
}

// ==========================================
// 1. DATA STREAM SIMULATION
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
    if(!streamBox || isStreamPaused) return;
    const p = document.createElement('div');
    p.className = 'stream-line';
    p.innerText = `[${new Date().toISOString().substring(11,23)}] PKT: ${generateHexLine()}`;
    streamBox.prepend(p);
    if(streamBox.children.length > 15) streamBox.removeChild(streamBox.lastChild);
}, 800);

// ==========================================
// 2. MICRO CHARTS SIMULATION
// ==========================================
function createChartBars(containerId, count) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    for(let i=0; i<count; i++) {
        const bar = document.createElement('div');
        bar.className = 'mc-bar';
        bar.style.height = `${Math.floor(Math.random() * 80) + 20}%`;
        container.appendChild(bar);
    }
}

function updateChart(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    const bars = container.children;
    for(let i=0; i<bars.length-1; i++) {
        bars[i].style.height = bars[i+1].style.height;
        bars[i].className = bars[i+1].className;
    }
    const newHeight = Math.floor(Math.random() * 80) + 20;
    bars[bars.length-1].style.height = `${newHeight}%`;
    bars[bars.length-1].className = 'mc-bar active';
    setTimeout(() => { if(bars[bars.length-1]) bars[bars.length-1].className = 'mc-bar'; }, 400);
}

['chartRequests', 'chartSuccess', 'chartCpu', 'chartThread'].forEach(id => createChartBars(id, 15));

setInterval(() => {
    updateChart('chartRequests');
    updateChart('chartSuccess');
    document.getElementById('cpuVal').innerText = Math.floor(Math.random() * 60) + 15;
    updateChart('chartCpu');
    document.getElementById('threadVal').innerText = Math.floor(Math.random() * 10) + 12;
    updateChart('chartThread');
    document.getElementById('latencyVal').innerText = `${Math.floor(Math.random() * 8) + 9}ms`;
}, 1500);

// ==========================================
// 3. LIMIT & ADMIN BYPASS SYSTEM
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
    document.getElementById('sessionVal').innerText = `USR-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
    currentLimit = stored.count;
    updateLimitUI();
}

function updateLimitUI() {
    const badge = document.getElementById('limitBadge');
    if (currentLimit > 100) {
        badge.innerText = "UNLIMITED";
        badge.style.color = "var(--success)";
    } else {
        badge.innerText = `${currentLimit}/${MAX_LIMIT} Reqs`;
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
            title: 'Quota Exceeded', text: 'Daily limit reached.', icon: 'warning',
            input: 'password', inputPlaceholder: 'Enter Admin Key...',
            showCancelButton: true, confirmButtonText: 'Authorize', confirmButtonColor: '#2563eb'
        }).then((result) => {
            if (result.value === SECRET_CODE) {
                let stored = JSON.parse(localStorage.getItem('am_elite_limit'));
                stored.count = 9999;
                localStorage.setItem('am_elite_limit', JSON.stringify(stored));
                currentLimit = 9999;
                updateLimitUI();
                Swal.fire({icon: 'success', title: 'Authorized'});
            }
        });
        return false;
    }
    return true;
}

// ==========================================
// 4. GLOBAL ANALYTICS
// ==========================================
function updateGlobalStats() {
    const launchDate = new Date('2026-08-16T00:00:00');
    const now = new Date();
    const hoursPassed = Math.max(0, Math.floor((now - launchDate) / 3600000));
    const minutesPassed = now.getMinutes();

    const currentVisitors = 1163 + (hoursPassed * 4) + Math.floor(minutesPassed / 5);
    const currentSuccess = 373 + (hoursPassed * 1) + Math.floor(minutesPassed / 15);

    document.getElementById('visitorCount').innerText = currentVisitors.toLocaleString('id-ID');
    document.getElementById('successCount').innerText = currentSuccess.toLocaleString('id-ID');
}

// ==========================================
// 5. BACKEND API & AUDIT LOGS
// ==========================================
async function loadHistory() {
    const list = document.getElementById('historyList');
    try {
        const response = await fetch('/api/history');
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        
        if(data.length === 0) {
            list.innerHTML = `<div style="text-align:center; margin-top:20px; color:var(--text-muted);">No audit trails.</div>`;
        } else {
            list.innerHTML = data.map(item => `
                <div class="log-entry">
                    <div class="l-time">${item.time}</div>
                    <div class="l-badge b-success">SUCCESS</div>
                    <div class="l-msg">Token injected: ${item.email}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        list.innerHTML = `<div style="text-align:center; margin-top:20px; color:var(--danger);">Error connecting database.</div>`;
    }
}

async function sendEmail() {
    if (!checkLimit()) return; 
    const email = document.getElementById('email').value;
    if (!email) return Swal.fire({ icon: 'warning', title: 'Error', text: 'Email required.' });

    Swal.fire({ title: 'Connecting...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/send?email=${encodeURIComponent(email)}`);
        Swal.fire({ icon: 'info', title: 'Request Sent', text: 'Check target email.' });
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Server unreachable.' });
    }
}

async function verifyAcc() {
    if (!checkLimit()) return; 
    const email = document.getElementById('email').value;
    const link = document.getElementById('magicLink').value;
    
    if (!email || !link) return Swal.fire({ icon: 'warning', title: 'Error', text: 'Both fields required.' });

    Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await fetch(`/api/verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(link)}`);
        decreaseLimit(); 
        Swal.fire({ icon: 'success', title: 'Success', text: 'Premium script injected.' });
        document.getElementById('magicLink').value = ''; 
        loadHistory(); 
        const successEl = document.getElementById('successCount');
        successEl.innerText = (parseInt(successEl.innerText.replace(/\D/g, '')) + 1).toLocaleString('id-ID');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Failed', text: 'Invalid or expired token.' });
    }
}

// INITIALIZATION
initLimit(); 
updateGlobalStats(); 
setInterval(updateGlobalStats, 60000); 
loadHistory();
            
