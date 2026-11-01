# Client OIDC Node.js

Gunakan Node.js 20.6 atau lebih baru. Salin `.env.example` ke `.env.dev`, isi client secret, lalu jalankan `npm run dev`. Buka http://localhost:5173.

Baca kode dalam urutan berikut:

1. `server.js`: `/auth/login` menyiapkan state dan PKCE, lalu mengarahkan browser ke PNJ ID.
2. `/auth/callback` memeriksa state, menukar code dengan token, mengambil UserInfo, lalu menyimpan hasilnya di session server.
3. `public/app.js`: `loadSession()` membaca `/api/session` dan mengisi profil di `public/index.html`, termasuk email.
4. Tombol dengan `data-url` memanggil proxy API di server. Server meneruskan access token ke API PNJ atau backend contoh.
5. Tombol Keluar menghapus session lokal dan membuka endpoint logout provider.

`oidc.js` berisi fungsi PKCE, discovery, dan URL logout. `public/styles.css` hanya mengatur keterbacaan halaman. Tidak ada dependency tambahan.

Jalankan `node --test` untuk memeriksa tampilan profil dan handler API/logout dengan respons simulasi.

Contoh ini memakai session dalam memori yang hilang saat server restart. Untuk production, gunakan session store, HTTPS dan cookie Secure, serta validasi ID token (signature, issuer, audience, expiry, nonce) dengan library OIDC. Contoh ini belum memvalidasi ID token; jangan gunakan sebagai implementasi production tanpa melengkapi validasi tersebut.
