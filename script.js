let currentSlideIndex = 0;
const wrapper = document.getElementById('slideWrapper');
const dots = document.querySelectorAll('.dot');

function updateSlidePosition() {
    if(!wrapper) return;
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
    if(!streamBox) return;
    const p = document.createElement('div');
    p.className = 'stream-line';
    p.innerText = `[${new Date().toISOString().substring(11,23)}] PKT: ${generateHexLine()}`;
    streamBox.prepend(p);
    if(streamBox.children.length > 15) streamBox.removeChild(streamBox.lastChild);
}, 800);

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

['chartRequests', 'chartSuccess', 'chartCpu', 'chartThread'].forEach(id => createChartBars(id, 20));

setInterval(() => {
    updateChart('chartRequests');
    updateChart('chartSuccess');
    const cpuEl = document.getElementById('cpuVal');
    if(cpuEl) cpuEl.innerText = Math.floor(Math.random() * 60) + 15;
    updateChart('chartCpu');
    const threadEl = document.getElementById('threadVal');
    if(threadEl) threadEl.innerText = Math.floor(Math.random() * 10) + 12;
    updateChart('chartThread');
    const latEl = document.getElementById('latencyVal');
    if(latEl) latEl.innerText = `${Math.floor(Math.random() * 8) + 9}ms`;
}, 1500);

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
    const sesEl = document.getElementById('sessionVal');
    if(sesEl) sesEl.innerText = `USR-${Math.random().toString(36).substring(2,6).toUpperCase()}`;
    currentLimit = stored.count;
    updateLimitUI();
}

function updateLimitUI() {
    const badge = document.getElementById('limitBadge');
    if(!badge) return;
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

function updateGlobalStats() {
    const launchDate = new Date('2026-08-16T00:00:00');
    const now = new Date();
    const hoursPassed = Math.max(0, Math.floor((now - launchDate) / 3600000));
    const minutesPassed = now.getMinutes();

    const currentVisitors = 1163 + (hoursPassed * 4) + Math.floor(minutesPassed / 5);
    const currentSuccess = 373 + (hoursPassed * 1) + Math.floor(minutesPassed / 15);

    const visEl = document.getElementById('visitorCount');
    const sucEl = document.getElementById('successCount');
    if(visEl) visEl.innerText = currentVisitors.toLocaleString('id-ID');
    if(sucEl) sucEl.innerText = currentSuccess.toLocaleString('id-ID');
}

async function loadHistory() {
    const list = document.getElementById('historyList');
    if(!list) return;
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
        list.innerHTML = `<div style="text-align:center; margin-top:20px; color:var(--text-muted);">Audit sync active.</div>`;
    }
}

async function sendEmail() {
    const isHuman = document.getElementById('robotCheck').checked;
    if (!isHuman) {
        return Swal.fire({ 
            icon: 'warning', 
            title: 'Verifikasi Diperlukan', 
            text: 'Centang kotak "Saya bukan robot" terlebih dahulu!' 
        });
    }

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
    const isHuman = document.getElementById('robotCheck').checked;
    if (!isHuman) {
        return Swal.fire({ 
            icon: 'warning', 
            title: 'Verifikasi Diperlukan', 
            text: 'Centang kotak "Saya bukan robot" terlebih dahulu!' 
        });
    }

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
        if(successEl) successEl.innerText = (parseInt(successEl.innerText.replace(/\D/g, '')) + 1).toLocaleString('id-ID');
    } catch(e) {
        Swal.fire({ icon: 'error', title: 'Failed', text: 'Invalid or expired token.' });
    }
}

initLimit(); 
updateGlobalStats(); 
setInterval(updateGlobalStats, 60000); 
loadHistory();
    
