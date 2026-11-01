# Client Next.js PNJ ID

Ini salah satu pilihan [frontend](../README.md). Pilih Next.js saja untuk port **5173** dan satu backend (Node.js, Go, atau PHP) untuk port **90**. Hentikan frontend lain dan backend sebelumnya saat berganti pilihan. Tidak perlu menjalankan frontend Node.js secara terpisah.

Contoh Next.js App Router yang mengikuti fitur `../nodejs`: login Authorization Code + PKCE, profil/email dari UserInfo, akses API, dan logout PNJ ID. Server OIDC Node.js dipakai bersama agar validasi token, cookie, serta session Redis tetap satu implementasi. Browser hanya membaca profil dan hasil API; token dan client secret tetap di server.

## Menjalankan

Gunakan Node.js 22.12+ dan Redis 6.2+. Instal dependency server OIDC dan Next.js:

```bash
cd ../nodejs
npm install
cd ../nextjs
npm install
cp .env.example .env.dev
```

Isi kredensial OIDC dan Redis pada `.env.dev`. File ini diabaikan Git. Jangan memberi prefix `NEXT_PUBLIC_` pada secret atau token.

Dari direktori `nextjs`:

```bash
npm run dev
```

Buka **http://localhost:5173**. Hentikan contoh Vue/Node.js yang memakai port 5173 terlebih dahulu. Next.js dan handler OIDC berjalan dalam satu proses pada port 5173. Redirect URI tetap `http://localhost:5173/auth/callback`. Tidak diperlukan port 5174 atau proses proxy tambahan.

Jalankan salah satu backend contoh di `Backend` pada port **90**. `.env.dev` frontend memakai `PORT=5173` dan `BACKEND_URL=http://localhost:90`.

## Urutan membaca kode

- `app/page.js`: state sesi, profil, tombol API, dan logout. Login memakai anchor biasa agar browser mengikuti redirect provider.
- `app/layout.js`: metadata dan bahasa halaman.
- `app/globals.css`: gaya satu kolom yang mengikuti frontend Node.js.
- `server.js`: memasang request handler Next.js pada server OIDC bersama. `/auth/*` dan `/api/*` ditangani OIDC, sedangkan halaman dan aset ditangani Next.js.
- `next.config.js`: konfigurasi Next.js.
- `../nodejs/server.js`, `oidc.js`, `session.js`: alur OIDC, validasi ID token, Redis, dan cookie.

`npm test` menguji handler halaman dengan respons simulasi, bukan rendering React. Jalankan `npm run build` dan uji browser serta login PNJ ID sebelum deployment.

## Production

Jalankan `npm run build`, lalu `npm start`. Isi environment deployment dengan `NODE_ENV=production`, `PORT=5173`, redirect URI HTTPS publik yang terdaftar, konfigurasi Redis, OIDC dan backend API. `npm start` membaca environment proses; `.env.dev` hanya dimuat otomatis oleh `npm run dev`.

Gunakan reverse proxy HTTPS di depan port 5173. Aplikasi memakai custom server Next.js sehingga harus dijalankan sebagai proses Node.js, bukan static export atau deployment serverless standar. CSP ketat milik contoh HTML Node.js hanya diterapkan pada endpoint OIDC/API; halaman Next.js memerlukan kebijakan CSP tersendiri yang mendukung script hidrasi Next.js.

Kebutuhan Redis, proteksi cookie, dan batas implementasi mengikuti `../nodejs/README.md`. Uji penerusan cookie Secure, callback, dan Origin logout pada reverse proxy deployment Anda.
