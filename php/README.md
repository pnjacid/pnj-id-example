# PNJ ID CAS Client - PHP

Contoh client PHP native untuk Single Sign-On (SSO) Apereo CAS tanpa dependensi eksternal / Composer.

## Menjalankan Aplikasi

Jalankan built-in web server PHP:

```bash
php -S 0.0.0.0:8081 index.php
```

Buka `http://localhost:8081`. Aplikasi akan mengarahkan browser ke CAS login, memvalidasi service ticket, lalu membuat session lokal.

## Konfigurasi

Konfigurasi dapat diubah melalui environment variable:

| Variable | Nilai default              | Keterangan |
| --- |----------------------------| --- |
| `CAS_SERVER` | `https://id.pnj.ac.id/cas` | Base URL server CAS |
| `SERVICE_URL` | `http://localhost:8081`    | URL client yang terdaftar di CAS |
| `CAS_INSECURE_SKIP_VERIFY` | `false`                    | Lewati validasi TLS untuk development |

Contoh menggunakan CAS lokal:

```bash
CAS_SERVER="https://localhost:8443/cas" \
SERVICE_URL="http://localhost:8081" \
CAS_INSECURE_SKIP_VERIFY="true" \
php -S 0.0.0.0:8081 index.php
```

## Pengujian Mandiri

Jalankan assertion test parsing response CAS:

```bash
php test.php
```
