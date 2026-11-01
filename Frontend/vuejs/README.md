# Client Vue PNJ ID

Ini salah satu pilihan [frontend](../README.md). Pilih Vue saja untuk port **5173** dan satu backend (Node.js, Go, atau PHP) untuk port **90**. Hentikan frontend lain dan backend sebelumnya saat berganti pilihan. Vue dan handler OIDC Node.js berjalan dalam satu proses pada port 5173.

Vue 3 menangani tampilan. Contoh ini memakai server OIDC di `../nodejs` untuk login Authorization Code + PKCE, validasi ID token, UserInfo, session Redis, proxy API, dan logout. Client secret dan token tidak disimpan di Vue atau localStorage.

## Menjalankan

Gunakan Node.js 22.12+ dan Redis 6.2+. Instal dependency kedua contoh:

```bash
cd ../nodejs
npm install
cd ../vuejs
npm install
cp .env.example .env.dev
```

Isi konfigurasi OIDC dan Redis di `.env.dev`. Jangan menambahkan prefix `VITE_` pada secret: variabel dengan prefix tersebut dapat masuk bundle browser.

Dari direktori `vuejs`:

```bash
npm run dev
```

Atau gunakan `bun run dev`. Script menjalankan Node.js dan memuat `.env.dev`, termasuk konfigurasi Redis/OIDC. Pastikan `PORT=5173`, `BACKEND_URL=http://localhost:90`, serta `OIDC_REDIRECT_URI=http://localhost:5173/auth/callback`.

Buka **http://localhost:5173**, sesuai origin redirect URI (jangan berganti ke `127.0.0.1` saat login). `server.js` memasang Vite sebagai middleware pada server OIDC yang sama, termasuk hot reload pada port 5173. Tidak diperlukan proses atau port 5174. Hentikan frontend lain sebelum menjalankan Vue.

Jalankan satu contoh `Backend` pada port 90 untuk tombol **Periksa akses backend**. Pertahankan `BACKEND_URL=http://localhost:90` pada `.env.dev`.

## Membaca kode

- `src/App.vue`: memuat sesi, menampilkan profil termasuk email, memanggil API, dan logout.
- `src/main.js`: memasang aplikasi Vue.
- `server.js`: menggabungkan Vite dan handler OIDC pada port 5173.
- `vite.config.js`: plugin Vue untuk development dan build.
- `../nodejs/server.js`, `oidc.js`, `session.js`: implementasi OIDC dan session server bersama.

## Build dan deployment

`npm test` menguji handler sesi, API, dan logout dari script komponen dengan respons simulasi. Tes ini tidak menguji rendering Vue; periksa juga tampilan, keyboard, dan login provider di browser setelah dependency terpasang.

`npm run build` menghasilkan `dist`. Untuk production, layani `dist` pada origin HTTPS aplikasi dan proxy `/auth/*` serta `/api/*` ke server OIDC Node.js. Callback harus menuju server OIDC, bukan fallback SPA. Set redirect URI HTTPS yang terdaftar, `NODE_ENV=production`, Redis dan secret pada server. Panduan keamanan server ada di `../nodejs/README.md`.

`server.js` memakai middleware Vite untuk development saja. Tidak perlu CORS karena browser memakai satu origin. Keterbatasan integrasi OIDC dan session mengikuti contoh Node.js.
