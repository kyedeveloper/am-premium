// Fungsi Kirim Email
async function sendVerificationEmail() {
    const email = document.getElementById('emailInput').value;
    if (!email) return Swal.fire({ icon: 'warning', text: 'Masukkan email dulu, Bang!' });

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        await fetch(`https://free-restapi.biz.id/api/alight-send?email=${email}&apikey=`);
        Swal.fire({ icon: 'success', title: 'Email Terkirim!', text: 'Cek kotak masuk email lu.' });
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Coba lagi nanti.' });
    }
}

// Fungsi Verifikasi
async function verifyPremium() {
    const email = document.getElementById('emailInput').value;
    const magicLink = document.getElementById('magicLinkInput').value;

    if (!email || !magicLink) return Swal.fire({ icon: 'warning', text: 'Isi semua kolom!' });

    Swal.fire({ title: 'Verifikasi...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const encodedLink = encodeURIComponent(magicLink);
        await fetch(`https://free-restapi.biz.id/api/alight-verify?email=${email}&magicLink=${encodedLink}`);
        
        Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Akun sudah Premium!' });
        
        // Update angka stats
        let count = parseInt(document.getElementById('generatedCount').innerText);
        document.getElementById('generatedCount').innerText = count + 1;
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Gagal', text: 'Magic link tidak valid.' });
    }
}
