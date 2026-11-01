# Backend PHP

Contoh resource server yang mengikuti `Backend/nodejs`. Membutuhkan PHP 8.1+, Composer, ekstensi cURL dan OpenSSL.

```bash
composer install
cp .env.example .env.dev
# Isi client ID dan secret pada .env.dev.
set -a
source .env.dev
set +a
php -S "127.0.0.1:${PORT:-90}" server.php
```

Perintah di atas memakai Bash untuk memuat environment. PHP tidak memuat `.env.dev` secara otomatis. Port default 90 sama dengan contoh Node.js; gunakan port berbeda jika backend lain masih berjalan dan sesuaikan `BACKEND_URL` di frontend.

- `GET /health` mengembalikan `{"status":"ok"}` tanpa token.
- `GET /api/profile` memerlukan `Authorization: Bearer <access_token>` dan scope `test.read`.
- Method/path lain menghasilkan 404; token hilang/tidak valid atau scope kurang menghasilkan 401, mengikuti contoh Node.js.

`server.php` menangani request dan respons JSON. `auth.php` memverifikasi JWT dengan `firebase/php-jwt` dan JWKS provider, lalu memeriksa issuer. Library memeriksa signature, expiry dan nbf bila tersedia. Opaque token diperiksa melalui introspection dengan Basic authentication; status `active` dan client ID harus cocok. Kedua jalur memeriksa scope melalui `hasScope()`.

Email diambil dari claim `email` atau `mail`, bukan dari UserInfo. Token, secret, dan URL provider tidak dikirim ke browser sebagai bagian respons profil.

Jalankan `composer test` untuk tes scope, introspection, signature JWT, issuer, expiry, nbf, dan scope JWT dengan provider simulasi. Setelah itu uji integrasi dari tombol **Periksa akses backend** pada frontend.

Sama seperti backend contoh lain, audience belum divalidasi; tambahkan setelah audience resource server ditentukan. JWKS diambil tiap request JWT, sehingga deployment produksi memerlukan cache. PHP built-in server hanya untuk development; production memakai PHP-FPM/web server dengan route API diarahkan ke `server.php`, HTTPS, environment dari secret manager, serta document root yang tidak mengekspos `.env.dev` atau vendor.
