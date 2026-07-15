# PNJ ID CAS Client - Go

Jalankan aplikasi:

```powershell
go run .
```

Buka `http://localhost:3001`. Aplikasi akan mengarahkan browser ke CAS, memvalidasi service ticket, lalu membuat session lokal selama satu jam.

Konfigurasi dapat diubah melalui environment variable:

```powershell
$env:CAS_SERVER = "https://cas.example.go.id/cas"
$env:SERVICE_URL = "https://aplikasi.example.go.id"
$env:LISTEN_ADDR = ":3001"
$env:CAS_INSECURE_SKIP_VERIFY = "false"
go run .
```

`SERVICE_URL` harus sama persis saat login dan validasi ticket, serta harus terdaftar pada service registry CAS.

Untuk menyesuaikan contoh Node.js dan sertifikat CAS development, `CAS_INSECURE_SKIP_VERIFY` bernilai `true` secara default. Atur ke `false` pada staging/production dan gunakan sertifikat yang dipercaya sistem.
