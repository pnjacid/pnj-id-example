# Backend contoh PNJ ID

Backend ini adalah API (resource server). Login dilakukan oleh salah satu [frontend](../Frontend/README.md): Node.js, Vue.js, atau Next.js. **Pilih dan jalankan satu backend saja**: Node.js, Go, atau [PHP](php/README.md), pada **http://localhost:90**. Hentikan backend sebelumnya sebelum mengganti implementasi agar port 90 tidak konflik.

Backend dapat dipasangkan dengan frontend apa pun pada port 5173; tidak harus menggunakan bahasa yang sama. Ketiga backend menyediakan kontrak endpoint yang sama:

| Endpoint | Fungsi |
| --- | --- |
| `GET /health` | Memeriksa apakah server berjalan, tanpa token. |
| `GET /api/profile` | Mengembalikan subject, email, dan scope dari access token yang valid. |

## Urutan membaca kode

1. `nodejs/server.js` atau `golang/main.go` menerima request dan membaca header `Authorization: Bearer <access_token>`.
2. `auth.js` atau `auth.go`: `verifyAccessToken()` memilih cara verifikasi. JWT diperiksa signature-nya melalui JWKS dan issuer-nya. Opaque token dikirim ke endpoint introspection, lalu diperiksa status aktif dan client ID-nya.
3. Setelah verifikasi berhasil, fungsi yang sama memeriksa scope `test.read` sekali melalui `hasScope()`.
4. Handler mengirim claims profil sebagai JSON. Token tidak valid atau scope tidak cukup menghasilkan HTTP 401, sesuai perilaku contoh ini.

Email hanya muncul jika token atau respons introspection memuat claim `email` atau `mail`. Backend ini tidak mengambil UserInfo; contoh client app menunjukkan cara mengambilnya.

## Menjalankan

Isi `.env.dev` dari `.env.example` pada direktori backend yang dipilih. Gunakan client ID dan secret yang sesuai dengan pendaftaran service SSO.

Node.js (20.6 atau lebih baru):

```bash
cd nodejs
npm install
cp .env.example .env.dev
# Isi .env.dev sebelum menjalankan server.
npm run dev
```

Go (1.20 atau lebih baru):

```bash
cd golang
cp .env.example .env.dev
# Isi .env.dev sebelum menjalankan server.
set -a
source .env.dev
set +a
go run .
```

Untuk percobaan standar, pertahankan `PORT=90` dan `BACKEND_URL=http://localhost:90` pada frontend. Pilih salah satu perintah menjalankan di atas atau ikuti [panduan PHP](php/README.md); jangan menjalankan semua backend sekaligus.

## Memeriksa contoh

Jalankan `node --test` di `nodejs` atau `go test ./...` di `golang`. Tes menggunakan respons provider simulasi dan tidak memerlukan client secret asli.

Gunakan tombol **Periksa akses backend** pada client app setelah login untuk menguji integrasi dengan PNJ ID.

## Batas contoh

Audience access token belum divalidasi; tambahkan setelah audience resource server ditentukan. Go mendukung JWT RSA (RS256, RS384, RS512) dan mengambil JWKS setiap request, sedangkan Node.js memakai library `jose`. Untuk production, gunakan HTTPS dan cache JWKS pada Go.
