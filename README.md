# Contoh OIDC PNJ ID

Repositori ini berisi contoh integrasi PNJ ID menggunakan Authorization Code + PKCE.

## Struktur contoh

Nama direktori menunjukkan **peran dalam flow OIDC**, bukan aturan bahwa setiap bahasa atau platform harus memiliki frontend dan backend:

- `Frontend/<bahasa>` berisi contoh **client app** yang memulai login, menerima callback, menukar authorization code dengan token, mengambil UserInfo, dan memakai access token untuk memanggil API. Pada contoh Node.js, access token disimpan di server-side session sehingga tidak dikirim ke JavaScript di browser.
- `Backend/<bahasa>` berisi contoh **resource server/API** yang menerima Bearer access token. API akan memverifikasi JWT melalui JWKS atau opaque token melalui endpoint introspection OIDC, lalu memastikan token memiliki scope `test.read` sebelum mengembalikan data.

Contoh bahasa atau platform baru cukup ditempatkan berdasarkan perannya. Aplikasi web, mobile, desktop, atau CLI yang menangani login termasuk client app meskipun tidak memiliki "frontend". Setiap contoh juga tidak wajib memiliki kedua bagian: client app dapat langsung memanggil API PNJ, sedangkan resource server dapat dipakai oleh client mana pun.

## Permintaan service SSO

Untuk meminta service SSO, buka tiket pada web [layanan.pnj.ac.id](https://layanan.pnj.ac.id).

## Menjalankan

### Backend Node.js

Gunakan Node.js 20 atau lebih baru.

```bash
cd Backend/nodejs
npm install
cp .env.example .env.dev
npm run dev
```

### Backend Go

Sebagai alternatif backend Node.js, gunakan Go 1.20 atau lebih baru:

```bash
cd Backend/golang
cp .env.example .env.dev
set -a
source .env.dev
set +a
go run .
```

### Backend PHP

Gunakan PHP 8.1 atau lebih baru, Composer, ekstensi cURL dan OpenSSL:

```bash
cd Backend/php
composer install
cp .env.example .env.dev
# Isi .env.dev sebelum menjalankan server.
set -a
source .env.dev
set +a
php -S "127.0.0.1:${PORT:-90}" server.php
```

Detail alur dan pengujian tersedia di [Backend/php/README.md](Backend/php/README.md).

### Client app Node.js

```bash
cd Frontend/nodejs
cp .env.example .env.dev
npm run dev
```

Buka <http://localhost:5173>, lalu pilih **Masuk dengan PNJ ID**.

Sesuaikan nilai di setiap `.env.dev` sebelum menjalankan aplikasi. File ini diabaikan oleh Git agar konfigurasi lokal dan client secret tidak ikut tersimpan. Script `npm run dev` pada Backend dan Frontend Node.js memuat `.env.dev` secara otomatis.

## Alur masuk dan akses API

Alur OIDC Authorization Code + PKCE berjalan seperti berikut:

```text
Browser                  Client app                    PNJ ID
   │── GET /auth/login ─────►│                            │
   │◄── redirect + PKCE ─────│                            │
   │── authorization request ────────────────────────────►│
   │◄── redirect ke callback + authorization code ───────│
   │── callback + code ─────►│                            │
   │                         │── code + verifier ─────────►│
   │                         │◄── token ──────────────────│
   │◄── session lokal ───────│                            │
```

1. Client app mengarahkan browser ke authorization endpoint PNJ ID dengan parameter PKCE.
2. PNJ ID mengembalikan authorization code ke `http://localhost:5173/auth/callback`.
3. Client app mengirim authorization code ke token endpoint untuk mendapatkan token, lalu mengambil data user, termasuk email, dari UserInfo endpoint.
4. Tombol **Lihat data test.read** meneruskan access token ke `https://dev-api.pnj.ac.id/testread` melalui server milik client app.
5. Tombol **Periksa akses backend** meneruskan access token ke resource server contoh. Resource server kemudian memverifikasi token dan scope `test.read`.

Endpoint `/api/profile` pada resource server tersedia sebagai contoh API yang dilindungi access token dan scope `test.read`.

## Alur keluar

Session milik aplikasi dan session SSO PNJ ID adalah dua hal yang berbeda. Menghapus cookie aplikasi saja tidak mengakhiri session SSO. Akibatnya, user dapat langsung masuk kembali tanpa diminta login. Tombol **Keluar** menangani keduanya dengan flow berikut:

1. Browser mengirim `POST /auth/logout` ke client app.
2. Client app mengambil ID token dari session untuk digunakan sebagai `id_token_hint`.
3. Client app menghapus session lokal beserta UserInfo dan token, lalu menghapus cookie `pnj_session`.
4. Client app membaca `end_session_endpoint` dari OIDC discovery metadata dan mengembalikan logout URL kepada browser.
5. Browser membuka logout URL tersebut agar PNJ ID dapat menghapus cookie SSO pada domainnya sendiri.

Navigasi browser pada langkah terakhir wajib dilakukan karena aplikasi di `localhost` tidak dapat menghapus cookie milik domain PNJ ID. Endpoint logout tidak di-hardcode agar implementasi tetap mengikuti metadata provider.

Untuk production, ganti in-memory session dengan shared session store, gunakan HTTPS dan cookie `Secure`, serta tambahkan audience validation jika audience untuk resource server sudah ditentukan.
