# Node.js Example Client for Apereo CAS

Folder ini berisi contoh client Node.js/Express untuk login SSO menggunakan
Apereo CAS.

## Alur Login

1. User membuka client di `http://localhost:3000`.
2. Jika belum punya session lokal, aplikasi redirect ke CAS login.
3. Setelah login berhasil, CAS redirect balik ke client dengan parameter
   `ticket`.
4. Client memvalidasi ticket ke endpoint CAS:

   ```text
   /cas/p3/serviceValidate
   ```

5. Jika valid, username disimpan ke session lokal Express.
6. Logout akan menghapus session lokal dan redirect ke CAS logout.

## Kebutuhan

- Node.js
- npm
- CAS server berjalan, contoh:

  ```text
  https://anwar-dev.internal:8443/cas
  ```

## Konfigurasi

Konfigurasi utama ada di [app.js](./app.js):

```js
const CAS_SERVER = "https://anwar-dev.internal:8443/cas";
const SERVICE_URL = "http://localhost:3000";
```

Sesuaikan `CAS_SERVER` dengan alamat CAS yang sedang berjalan.

`SERVICE_URL` harus sama dengan URL client yang didaftarkan di CAS service
registry.

## Service Registry CAS

Pastikan CAS memiliki service registry untuk client ini.

Contoh file service di CAS:

```json
{
  "@class": "org.apereo.cas.services.CasRegisteredService",
  "serviceId": "^http://localhost:3000(/.*)?$",
  "name": "Node Client",
  "id": 1002,
  "description": "Client lokal untuk tes CAS",
  "theme": "midone"
}
```

Jika CAS server menggunakan folder service registry:

```text
/root/CodePNJ/sso/pnj-id-overlay/services
```

Pastikan file JSON untuk `localhost:3000` sudah ada di folder tersebut.

## Install Dependency

```bash
cd /root/CodePNJ/sso/pnj-id-example/nodejs
npm install
```

## Menjalankan Client

```bash
node app.js
```

Jika berhasil, akan muncul:

```text
Client running at http://localhost:3000
```

Buka browser:

```text
http://localhost:3000
```

## Menjalankan di Background

Untuk development sederhana:

```bash
nohup node app.js > node-client.log 2>&1 &
```

Cek proses:

```bash
ps aux | grep app.js
```

Lihat log:

```bash
tail -f node-client.log
```

Stop proses:

```bash
pkill -f "node app.js"
```

## HTTPS Self-Signed Certificate

Di [app.js](./app.js), validasi ticket menggunakan:

```js
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
```

Ini membuat client tetap bisa memanggil CAS HTTPS yang memakai sertifikat
self-signed untuk development.

Jangan gunakan konfigurasi ini untuk production. Untuk production, gunakan
sertifikat SSL yang valid dan hapus `rejectUnauthorized: false`.

## Endpoint

### `GET /`

- Jika belum login, redirect ke CAS login.
- Jika ada `ticket`, client validasi ticket ke CAS.
- Jika session lokal sudah ada, menampilkan username.

### `GET /logout`

- Menghapus session lokal Express.
- Redirect ke CAS logout.

## Troubleshooting

### Application Not Authorized

Penyebab paling umum: `SERVICE_URL` tidak cocok dengan `serviceId` di CAS.

Pastikan:

```js
const SERVICE_URL = "http://localhost:3000";
```

cocok dengan:

```json
"serviceId": "^http://localhost:3000(/.*)?$"
```

### Error validating ticket

Cek:

- CAS server sedang berjalan.
- `CAS_SERVER` benar.
- Client bisa mengakses endpoint CAS.
- Sertifikat HTTPS CAS tidak diblokir.

### Login berhasil tapi kembali login lagi

Cek session Express dan pastikan browser menerima cookie dari client
`localhost:3000`.

### Ticket validation failed

CAS memvalidasi ticket berdasarkan nilai `service`. Nilai `service` saat login
dan saat validasi harus sama persis.

Di client ini, nilai tersebut berasal dari:

```js
const SERVICE_URL = "http://localhost:3000";
```
