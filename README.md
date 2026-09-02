# Contoh SSO Apereo CAS

Repository ini berisi contoh integrasi **Single Sign-On (SSO)** dengan
[Apereo CAS](https://apereo.github.io/cas/) menggunakan dua aplikasi client:

| Client | Teknologi | URL lokal | Service registry |
| --- | --- | --- | --- |
| Node.js | Express | `http://localhost:3000` | `1002-node-client.json` |
| Go | `net/http` | `http://localhost:3001` | `1005-go-client.json` |

Kedua contoh menggunakan CAS Protocol 3 untuk login, validasi service ticket,
session lokal aplikasi, dan logout.

## Alur SSO

1. Pengguna membuka aplikasi client.
2. Jika session lokal belum tersedia, client mengarahkan pengguna ke endpoint
   `/cas/login` dengan parameter `service`.
3. Pengguna login pada CAS.
4. CAS mengarahkan pengguna kembali ke URL client dengan parameter `ticket`.
5. Client memvalidasi ticket ke endpoint `/cas/p3/serviceValidate`.
6. Jika ticket valid, client membuat session lokal dan menampilkan username.
7. Saat logout, session lokal dihapus dan pengguna diarahkan ke
   `/cas/logout`.

```text
Browser ──► Client ──► CAS Login
   ▲                      │
   └──── ticket ──────────┘
   │
Client ── serviceValidate ──► CAS
   │
   └── session lokal ──► Browser
```

Nilai parameter `service` yang digunakan ketika login dan validasi ticket
harus sama persis. URL tersebut juga harus cocok dengan `serviceId` pada
service registry CAS.

## Struktur Proyek

```text
pnj-id-example/
├── go/
│   ├── main.go
│   ├── go.mod
│   └── README.md
├── nodejs/
│   ├── app.js
│   ├── package.json
│   ├── package-lock.json
│   └── README.md
└── README.md
```

## Prasyarat

- Apereo CAS yang dapat diakses oleh browser dan aplikasi client
- Node.js dan npm untuk contoh Node.js
- Go 1.22 atau lebih baru untuk contoh Go
- Service registry CAS untuk URL masing-masing client

Secara default, kedua client terhubung ke:

```text
https://id.pnj.ac.id/cas
```

Pastikan alamat tersebut memang ditujukan untuk pengujian sebelum mencoba
login. Untuk CAS lokal atau staging, sesuaikan konfigurasi client terlebih
dahulu.

## Menyiapkan Service Registry CAS

Jika repository `pnj-id-overlay` berada di sebelah repository ini, contoh
service registry tersedia di:

```text
../pnj-id-overlay/services/1002-node-client.json
../pnj-id-overlay/services/1005-go-client.json
```

Konfigurasi Node.js:

```json
{
  "@class": "org.apereo.cas.services.CasRegisteredService",
  "serviceId": "^http://localhost:3000(/.*)?$",
  "name": "Node Client",
  "id": 1002
}
```

Konfigurasi Go:

```json
{
  "@class": "org.apereo.cas.services.CasRegisteredService",
  "serviceId": "^http://localhost:3001(/.*)?$",
  "name": "Go Client",
  "id": 1005
}
```

Salin atau aktifkan konfigurasi tersebut pada service registry CAS, kemudian
restart atau reload CAS sesuai konfigurasi deployment yang digunakan.

## Menjalankan Client Node.js

Masuk ke direktori Node.js dan install dependency dari lockfile:

```bash
cd nodejs
npm ci
```

Jalankan aplikasi:

```bash
node app.js
```

Buka <http://localhost:3000>. Konfigurasi CAS dan service URL berada di
`nodejs/app.js`:

```js
const CAS_SERVER = "https://id.pnj.ac.id/cas";
const SERVICE_URL = "http://localhost:3000";
```

## Menjalankan Client Go

Masuk ke direktori Go dan jalankan aplikasi:

```bash
cd go
go run .
```

Buka <http://localhost:3001>. Client Go dapat dikonfigurasi melalui environment
variable:

| Variable | Nilai default | Keterangan |
| --- | --- | --- |
| `CAS_SERVER` | `https://id.pnj.ac.id/cas` | Base URL server CAS |
| `SERVICE_URL` | `http://localhost:3001` | URL client yang terdaftar di CAS |
| `LISTEN_ADDR` | `:3001` | Alamat dan port HTTP client |
| `CAS_INSECURE_SKIP_VERIFY` | `false` | Lewati validasi TLS untuk development |

Contoh menggunakan CAS lokal:

```bash
CAS_SERVER="https://localhost:8443/cas" \
SERVICE_URL="http://localhost:3001" \
CAS_INSECURE_SKIP_VERIFY="true" \
go run .
```

`CAS_INSECURE_SKIP_VERIFY=true` hanya boleh digunakan untuk development dengan
sertifikat self-signed.

## Menguji SSO

1. Jalankan CAS dan pastikan kedua service registry sudah aktif.
2. Jalankan client Node.js dan Go pada terminal terpisah.
3. Buka <http://localhost:3000> dan login melalui CAS.
4. Buka <http://localhost:3001> pada browser yang sama.
5. CAS seharusnya mengenali session SSO sehingga pengguna tidak perlu mengisi
   kredensial lagi.
6. Klik **Logout** untuk menghapus session lokal dan menuju endpoint logout CAS.

## Troubleshooting

### Application Not Authorized

URL client tidak cocok dengan pola `serviceId` pada service registry. Periksa
protokol (`http`/`https`), hostname, port, path, dan trailing slash.

### Ticket tidak valid

Pastikan nilai `service` saat meminta ticket sama persis dengan nilai yang
digunakan saat memanggil `p3/serviceValidate`. Service ticket hanya dapat
digunakan satu kali dan memiliki masa berlaku singkat.

### Gagal terhubung ke CAS

Pastikan CAS dapat diakses dari mesin client, URL CAS benar, DNS dapat
di-resolve, dan sertifikat TLS dipercaya. Jangan menonaktifkan validasi TLS di
production.

### Login berulang kali

Pastikan cookie session lokal diterima browser. Periksa juga apakah aplikasi
berpindah hostname, port, atau protokol setelah callback dari CAS.

## Catatan Keamanan

Contoh ini dibuat untuk pembelajaran dan pengujian integrasi. Sebelum digunakan
di production:

- ganti secret session Node.js dan simpan melalui environment variable atau
  secret manager;
- aktifkan cookie `secure`, `httpOnly`, dan kebijakan `sameSite` yang sesuai;
- gunakan session store persisten, bukan memory store;
- gunakan parser XML yang aman dan tervalidasi;
- gunakan HTTPS dengan sertifikat yang dipercaya;
- jangan gunakan `rejectUnauthorized: false` atau
  `CAS_INSECURE_SKIP_VERIFY=true`; dan
- batasi pola `serviceId` hanya untuk URL aplikasi yang diperlukan.

Dokumentasi lebih rinci tersedia pada [client Node.js](./nodejs/README.md) dan
[client Go](./go/README.md).
