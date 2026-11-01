# Client OIDC Node.js

Ini salah satu pilihan [frontend](../README.md). Jalankan frontend Node.js saja pada port **5173**, lalu pilih satu backend (Node.js, Go, atau PHP) pada port **90**. Hentikan frontend lain sebelum menjalankan contoh ini; pertahankan `BACKEND_URL=http://localhost:90`.

Gunakan Node.js 22.12 atau lebih baru dan Redis 6.2 atau lebih baru. Jalankan `npm install`, salin `.env.example` ke `.env.dev`, isi konfigurasi, lalu `npm run dev`. Redis wajib tersedia, termasuk untuk development. Buka http://localhost:5173.

## Alur kode

- `server.js` mengatur login, callback, profil, proxy API, dan logout.
- `oidc.js` memakai `openid-client` untuk discovery, pertukaran code, validasi ID token dan UserInfo. Signature ID token diperiksa melalui JWKS secara eksplisit. Library memeriksa issuer, audience, expiry, nonce, state, dan PKCE; subject UserInfo harus sesuai dengan ID token.
- `session.js` menyimpan sesi di Redis. Cookie hanya berisi ID acak, sedangkan token tetap di server. Transaksi login berlaku 10 menit dan dikonsumsi secara atomik. Login berhasil menghasilkan ID sesi baru; sesi berlaku paling lama satu jam atau sampai access token kedaluwarsa bila provider memberikan `expires_in`.
- `public/app.js` membaca profil dan menangani tombol API/logout.

Jalankan `npm test` untuk tes. Pengujian provider menggunakan respons simulasi; lakukan juga uji integrasi dengan konfigurasi service PNJ ID sebelum deployment.

## Deployment

Set `NODE_ENV=production`, `REDIS_URL`, `OIDC_CLIENT_SECRET`, `OIDC_CLIENT_ID`, `OIDC_ISSUER`, `OIDC_REDIRECT_URI`, dan `BACKEND_URL` melalui secret manager atau environment deployment, lalu jalankan `npm start`. Redirect URI harus berupa URL HTTPS publik dengan path `/auth/callback` yang terdaftar pada PNJ ID.

Gunakan reverse proxy untuk terminasi TLS; port Node.js hanya boleh diakses proxy. URL callback dibentuk dari konfigurasi, bukan header Host atau X-Forwarded-Host. Semua instance harus memakai konfigurasi dan Redis yang sama. Gunakan Redis privat dengan autentikasi, TLS (`rediss://`), pengaturan persistence/HA, dan kebijakan eviction yang sesuai kebutuhan. Data Redis mengandung token: batasi aksesnya.

Pada HTTPS, cookie memakai `__Host-pnj_session`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, tanpa Domain. HTTP hanya diperbolehkan di localhost untuk development. POST logout memerlukan Origin aplikasi yang sama. Response memakai no-store, CSP, nosniff, referrer policy, dan HSTS pada HTTPS. Request API upstream memiliki timeout dan menolak redirect.

Terapkan pembatasan request dan koneksi pada ingress, terutama `/auth/login` dan `/auth/callback`, serta monitoring dan batas kapasitas Redis. Session Redis menghilangkan kebutuhan sticky session. Sesi berakhir saat TTL habis; refresh token dan silent renewal belum diimplementasikan, sehingga pengguna masuk lagi setelah sesi berakhir.

Deployment tetap memerlukan pengujian integrasi PNJ ID, konfigurasi TLS/proxy, pembatasan traffic, dan pengelolaan secret operasional. Endpoint backend contoh tetap memerlukan validasi audience sendiri.
