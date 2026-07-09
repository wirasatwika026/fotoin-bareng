# Fotoin Bareng — Status Project

> Photobox virtual untuk dua orang: satu strip foto berdua, dari mana saja.
> Update terakhir: 5 Juli 2026.

## Gambaran

- **Stack:** Next.js 16 (App Router, server actions), React 19, Tailwind 4, TypeScript, Postgres (postgres.js), MinIO (AWS SDK S3), WebRTC + WebSocket signaling (`ws`).
- **Infra target:** self-hosted di VPS k8s (`fotoin.wirasatwika.dev`), Postgres & MinIO sudah jalan di cluster. Tanpa layanan cloud pihak ketiga.
- **Menjalankan dev:**
  ```bash
  npm run dev        # Next.js di :3000
  npm run signaling  # WebSocket mode live di :3001 (terminal kedua)
  npm run db:setup   # terapkan/percepat skema (idempotent)
  npm run db:cleanup # hapus sesi kedaluwarsa + fotonya di MinIO
  ```
  Credential di `.env.local` (contoh di `.env.example`).

## ✅ Sudah jadi

### Produk
- **Landing page** (`/`) bertema tirai photobox + form masuk pakai kode.
- **Pemilihan template** (`/baru`): galeri per kategori, preview = **render asli** hasil akhir (canvas + placeholder siluet), pilihan mode **Gantian (async)** / **Bareng langsung (live)**.
- **Mode Async**: A foto → bagikan link/kode → B isi kapan pun → strip jadi. Halaman menunggu auto-refresh.
- **Mode Live**: video call P2P (WebRTC, STUN publik) dengan **audio dua arah** (echo cancellation, noise suppression), countdown serentak via DataChannel, tiap browser meng-capture kameranya sendiri full-res, preview foto pasangan dikirim P2P ke layar review. Fallback ke async saat peer putus / kamera gagal / signaling mati; room dibatasi 2 orang.
- **Kamera photobox**: countdown 3-2-1 per pose, efek flash, split screen dengan foto pasangan (atau siluet "dia nanti di sini" untuk orang pertama), toggle **ghost overlay** untuk menyamakan posisi, **WYSIWYG framing** (bingkai preview = persis crop hasil cetak), fallback upload galeri tanpa kamera.
- **Review & retake**: retake semua atau **per-pose** sebelum kirim; pembuat sesi bisa mengulang fotonya selama pasangan belum mengisi.
- **9 template** dalam 2 kategori (Couple, Klasik, Polaroid, Midnight, Grid Berdua 2×2, Scrapbook miring, Ulang Tahun, Sayang, Natal).
- **Hasil**: strip dirender di canvas klien, unduh PNG, footer brand + tanggal + kode.

### Teknis
- **Sistem template murni data** (`src/lib/templates.ts`): shots, kolom grid, nempel/bercelah, warna kertas, pola (garis/titik), ornamen SVG (posisi/rotasi fraksional), kemiringan per frame, bingkai kartu, ukuran sel/footer. Renderer (`src/lib/strip.ts`) menggambar berlapis: kertas → pola → foto → ornamen → footer. **Nambah template = nambah satu entri.**
- **Lifecycle & rules sesi**: slot sekali-isi (guard SQL, aman race), urutan giliran async ditegakkan server, otorisasi per sisi via cookie role (pembuat = A; pengisi B di-claim setelah upload), strip final terkunci permanen, sesi **kedaluwarsa 30 hari** (ditegakkan di satu pintu `getSession`).
- **Storage**: upload tervalidasi (jumlah per template, MIME, ≤8 MB), key bernonce (retake aman dari cache), foto disajikan lewat proxy `/api/photos/...` berpola ketat — MinIO tidak diekspos.
- **Signaling** (`server/signaling.mjs`): ~80 baris, relay SDP/ICE saja, video tidak lewat server.
- **OG metadata + OG image** (judul dinamis per state sesi) untuk preview WhatsApp.
- Skrip `db:setup` (idempotent) & `db:cleanup` (hapus DB + objek MinIO per prefix, termasuk foto yatim).

## ❌ Belum

### Menuju produksi (paling mendesak)
- **Deploy**: `output: "standalone"`, Dockerfile (app + signaling), manifest k8s (Deployment/Service/Ingress + rute `wss`), CronJob harian untuk `db:cleanup`, health endpoint untuk probe. Env produksi: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_SIGNALING_URL`.
- **TURN server**: manifest coturn disiapkan + `iceServers` di `live-booth.tsx` sudah nerima TURN lewat env (`NEXT_PUBLIC_TURN_URL/USERNAME/CREDENTIAL`, fallback STUN-only kalau kosong). Cek koneksi nyata setelah coturn benar-benar jalan di cluster.
- **Tes lintas perangkat nyata** (HP + laptop) — butuh HTTPS, berarti setelah deploy (atau tunnel sementara).

### Fitur
- **Editor** (fase berikutnya yang besar): filter warna, stiker, teks; edit setelah terkirim; edit kolaboratif real-time.
- **Template**: masih varian dari satu keluarga bentuk; belum ada teks custom per template (mis. "Happy Birthday"), belum ada UI admin/DB untuk template (fondasi data sudah siap).
- **Galeri riwayat** sesi di perangkat (localStorage — tanpa akun, sesuai keputusan).
- **Suara** ("cekrek", beep countdown) — penting untuk rasa photobox, belum ada.
- **Print-ready export** (300 DPI, ukuran cetak standar) — resolusi capture sekarang 800px, cukup layar, kepepet untuk cetak.

### Pengerasan (hardening)
- **Rate limiting** pembuatan sesi & upload — bisa di-spam.
- **Kompresi foto galeri** di klien (fallback upload bisa 8 MB×N).
- **Validasi magic bytes** file upload (sekarang percaya MIME browser).
- **Loading state** (`loading.tsx`) & pesan error 500 yang ramah.
- **Test otomatis** — belum ada sama sekali; minimal unit test untuk validasi upload, guard `savePhotos`, pola key proxy, geometri template.
- Race kecil mode live: dua orang menekan MULAI bersamaan bisa dobel countdown (recoverable via retake).

## ➡️ Selanjutnya (urutan yang disarankan)

1. **Deploy ke `fotoin.wirasatwika.dev`** — semua fitur inti sudah ada; kondisi nyata (HP, jaringan seluler, WA preview) akan memunculkan bug yang tidak terlihat di localhost. Sekalian CronJob cleanup jalan.
2. **Polish pasca-deploy** — perbaiki temuan tes nyata; tambah suara cekrek + loading states + kompresi galeri (murah, efeknya besar ke rasa produk).
3. **Editor** — mulai dari filter & teks di atas fondasi template yang ada; stiker menyusul.
4. **Galeri riwayat lokal** + template momen tambahan (fondasi sudah membuat ini kerjaan menit-menitan).
5. **Hardening** — rate limit, magic bytes, unit test — secukupnya untuk skala porto.

## Keputusan produk yang sudah dikunci

- Tanpa akun — sesi anonim berbasis link/kode; UI Bahasa Indonesia.
- Pembuat sesi selalu sisi A (kiri strip); async: A selalu foto duluan.
- Kiriman B final (review + retake per-pose tersedia sebelum kirim).
- Strip yang sudah lengkap terkunci permanen.
- Siapa pun pemegang link bisa melihat hasil (memudahkan berbagi — keputusan sadar).
- Sesi & foto terhapus setelah 30 hari.
