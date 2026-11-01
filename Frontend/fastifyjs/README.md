# Client Fastify PNJ ID

Pilih **satu frontend** pada **http://localhost:5173** dan **satu backend** (Node.js, Go, atau PHP) pada **http://localhost:90**. Hentikan frontend sebelumnya sebelum menjalankan Fastify agar port 5173 tidak konflik. Backend bebas dipasangkan lintas bahasa.

Contoh ini memakai Fastify 5 sebagai HTTP server dan memakai handler, tampilan, OIDC serta session Redis dari `../nodejs`. Tidak perlu menjalankan frontend Node.js secara terpisah. Hasilnya sama: login Authorization Code + PKCE, profil termasuk email, tombol API PNJ/backend, dan logout aplikasi serta SSO. Token dan client secret tetap di server.

## Menjalankan

Gunakan Node.js 22.12+ dan Redis 6.2+. Instal dependency kedua direktori:

```bash
cd ../nodejs
npm install
cd ../fastifyjs
npm install
cp .env.example .env.dev
```

Isi konfigurasi OIDC dan Redis di `.env.dev`, lalu jalankan:

```bash
npm run dev
```

Atau `bun run dev`. Script tetap menjalankan Node.js dan memuat `.env.dev`. Buka **http://localhost:5173**, sesuai `OIDC_REDIRECT_URI`. Pertahankan `PORT=5173` dan `BACKEND_URL=http://localhost:90`. Tidak ada proses atau port OIDC tambahan.

## Urutan membaca kode

- `app.js`: route Fastify meneruskan request/response HTTP ke handler bersama menggunakan `reply.hijack()`.
- `server.js`: membuat aplikasi, membuka port, dan menutup Redis ketika aplikasi berhenti.
- `../nodejs/server.js`: handler halaman, aset, login, callback, sesi, API dan logout.
- `../nodejs/oidc.js` dan `session.js`: validasi ID token, UserInfo, Redis, dan cookie.
- `../nodejs/public`: tampilan dan interaksi browser yang sama dengan contoh Node.js.

Jalankan `npm test` untuk tes adapter HTTP tanpa membuka port dan tanpa Redis/provider nyata. Jalankan juga tes di `../nodejs` untuk handler OIDC dan sesi. Tes simulasi belum menggantikan pengujian login PNJ ID di browser.

## Production

Set `NODE_ENV=production`, `PORT=5173`, redirect URI HTTPS publik yang terdaftar, Redis dan konfigurasi OIDC/backend melalui environment deployment, lalu `npm start`. Perintah ini tidak memuat `.env.dev`. Gunakan reverse proxy HTTPS dan ikuti persyaratan session store, secret dan pembatasan traffic pada `../nodejs/README.md`.

Adapter memakai response HTTP mentah agar kontrak contoh tetap sama. Serialisasi dan header respons ditangani handler bersama, bukan serializer atau hook `onSend` Fastify. Jangan mengandalkan hook tersebut untuk menggantikan proteksi pada handler bersama.
