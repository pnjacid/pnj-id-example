# Client Vue PNJ ID

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

Terminal pertama di direktori `vuejs`:

```bash
npm run server
```

Terminal kedua di direktori yang sama:

```bash
npm run dev
```

Buka **http://localhost:5173**. Vite memakai port 5173, sedangkan server OIDC memakai port 5174. Hentikan contoh Node.js yang memakai port 5173 terlebih dahulu. Redirect URI tetap `http://localhost:5173/auth/callback`; Vite meneruskan `/auth` dan `/api` ke server OIDC tanpa mengubah Origin, sehingga cookie sesi dan proteksi logout tetap bekerja.

Jalankan salah satu contoh `Backend` untuk tombol **Periksa akses backend**, lalu sesuaikan `BACKEND_URL` bila port backend berbeda.

## Membaca kode

- `src/App.vue`: memuat sesi, menampilkan profil termasuk email, memanggil API, dan logout.
- `src/main.js`: memasang aplikasi Vue.
- `vite.config.js`: konfigurasi Vue dan proxy development.
- `../nodejs/server.js`, `oidc.js`, `session.js`: implementasi OIDC dan session server bersama.

## Build dan deployment

`npm test` menguji handler sesi, API, dan logout dari script komponen dengan respons simulasi. Tes ini tidak menguji rendering Vue; periksa juga tampilan, keyboard, dan login provider di browser setelah dependency terpasang.

`npm run build` menghasilkan `dist`. Untuk production, layani `dist` pada origin HTTPS aplikasi dan proxy `/auth/*` serta `/api/*` ke server OIDC Node.js. Callback harus menuju server OIDC, bukan fallback SPA. Set redirect URI HTTPS yang terdaftar, `NODE_ENV=production`, Redis dan secret pada server. Panduan keamanan server ada di `../nodejs/README.md`.

Vite dev server dan proxy pada `vite.config.js` hanya untuk development. Tidak perlu CORS karena browser memakai satu origin. Keterbatasan integrasi OIDC dan session mengikuti contoh Node.js.
