async function sendVerificationEmail() {
    const email = document.getElementById('emailInput').value;
    if (!email) return Swal.fire({ icon: 'warning', text: 'Email kosong!' });

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // Kita pakai mode 'no-cors' biar browser ga nolak mentah-mentah
        const url = `https://free-restapi.biz.id/api/alight-send?email=${encodeURIComponent(email)}&apikey=`;
        
        console.log("Menghubungkan ke:", url);
        
        await fetch(url, { mode: 'no-cors' });
        
        Swal.fire({ icon: 'success', title: 'Permintaan Terkirim', text: 'Cek email lu ya!' });
    } catch (error) {
        console.error("Error Detail:", error);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal menghubungi server API.' });
    }
}

async function verifyPremium() {
    const email = document.getElementById('emailInput').value;
    const magicLink = document.getElementById('magicLinkInput').value;

    if (!email || !magicLink) return Swal.fire({ icon: 'warning', text: 'Isi semua data!' });

    Swal.fire({ title: 'Verifikasi...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const url = `https://free-restapi.biz.id/api/alight-verify?email=${encodeURIComponent(email)}&magicLink=${encodeURIComponent(magicLink)}`;
        
        console.log("Verifikasi ke:", url);
        
        await fetch(url, { mode: 'no-cors' });
        
        Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Proses premium selesai!' });
    } catch (error) {
        console.error("Error Detail:", error);
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Server tidak merespons.' });
    }
}
