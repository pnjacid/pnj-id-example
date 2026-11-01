# Pilih satu frontend

Pilih **satu** contoh berikut dan jalankan pada **http://localhost:5173**:

| Pilihan | Panduan |
| --- | --- |
| Node.js | [nodejs/README.md](nodejs/README.md) |
| Fastify.js | [fastifyjs/README.md](fastifyjs/README.md) |
| Vue.js | [vuejs/README.md](vuejs/README.md) |
| Next.js | [nextjs/README.md](nextjs/README.md) |

Hentikan frontend sebelumnya sebelum berganti contoh agar port 5173 tidak konflik. Fastify, Vue dan Next.js memakai kode server OIDC dari direktori Node.js; menginstal dependency Node.js untuk contoh tersebut tidak berarti Anda harus menjalankan frontend Node.js secara terpisah. Ikuti proses yang disebutkan README frontend pilihan Anda saja.

Pilih juga **satu** [backend](../Backend/README.md): Node.js, Go, atau PHP, pada **http://localhost:90**. Setiap frontend dapat dipasangkan dengan setiap backend; tidak harus berbahasa sama.

Pertahankan konfigurasi lokal berikut pada frontend yang dipilih:

```env
BACKEND_URL=http://localhost:90
OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
```

Node.js, Fastify, Vue.js, dan Next.js menggabungkan halaman dan handler OIDC pada port 5173. Jalankan perintah frontend pilihan Anda saja; tidak diperlukan proses OIDC tambahan pada port 5174.

## Hasil percobaan yang sama

Dengan provider, client, scope dan user yang sama, semua contoh frontend menyediakan:

1. Login PNJ ID menggunakan Authorization Code + PKCE.
2. Profil UserInfo: subject, email (fallback `mail`), dan username bila tersedia.
3. Tombol **Lihat data test.read** untuk API PNJ.
4. Tombol **Periksa akses backend** untuk `GET /api/profile` pada backend pilihan.
5. Logout sesi aplikasi dan SSO PNJ ID.

Tampilan mengikuti framework, sedangkan alur dan kontrak API tetap sama. Token dan client secret tetap di server. Saat berganti frontend, mulai login baru; sesi lama dapat tidak berlaku lagi. Pengujian lintas implementasi tetap perlu dilakukan dengan provider PNJ ID yang sebenarnya.
