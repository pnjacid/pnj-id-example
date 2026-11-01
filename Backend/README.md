# Backend contoh PNJ ID

Backend ini adalah API (resource server). Login dilakukan oleh client app di `Frontend/nodejs`. Pilih salah satu backend: Node.js, Go, atau [PHP](php/README.md). Ketiganya menyediakan endpoint yang sama:

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

Server memakai port 90 secara default. Atur `PORT` pada `.env.dev` bila diperlukan; sesuaikan juga `BACKEND_URL` pada client app.

## Memeriksa contoh

Jalankan `node --test` di `nodejs` atau `go test ./...` di `golang`. Tes menggunakan respons provider simulasi dan tidak memerlukan client secret asli.

Gunakan tombol **Periksa akses backend** pada client app setelah login untuk menguji integrasi dengan PNJ ID.

## Batas contoh

Audience access token belum divalidasi; tambahkan setelah audience resource server ditentukan. Go mendukung JWT RSA (RS256, RS384, RS512) dan mengambil JWKS setiap request, sedangkan Node.js memakai library `jose`. Untuk production, gunakan HTTPS dan cache JWKS pada Go.
