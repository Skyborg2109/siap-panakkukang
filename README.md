# SIAP Panakkukang — React + Supabase

Sistem Informasi Antrian & Informasi Pelayanan Kecamatan Panakkukang (Dukcapil), Makassar.
PRD v3.0 — migrasi Laravel → **React (Vite) + Supabase**.

## Fitur

Sistem ini hanya untuk **pemanggilan + penampil informasi** (tanpa pengambilan tiket oleh masyarakat, tanpa konsep loket). Tiga jenis antrean: **Antrian KTP, Perekaman KTP, IKD**.

- **Masyarakat**: info layanan & syarat (`/information`), IKD (`/ikd`), Display TV (`/display`)
- **Display TV** (`/display`): monitor ruang pelayanan — jam realtime, kartu panggilan per jenis antrean, slideshow informasi, ticker pengumuman, **audio TTS Bahasa Indonesia** (Web Speech API)
- **Petugas** (`/petugas`): tambah antrean, panggil berikutnya (bisa sekaligus), recall, skip, selesai, panggil nomor spesifik (klik chip tunggu / cari nomor), panggil kasus KK (tanpa nomor, BR-09), reset harian, riwayat, profil
- **Admin** (`/admin`): dashboard, layanan, pengguna, informasi & IKD, pengumuman, gambar display, statistik + export CSV

## Jalankan Lokal (Mode Demo — tanpa Supabase)

```bash
cd siap-panakkukang
npm install
npm run dev
```

Buka http://localhost:5173. Data tersimpan di `localStorage`, realtime antar-tab via storage event.

**Akun demo:**

| Role | Email | Password |
|---|---|---|
| Admin | admin@panakkukang.go.id | admin123 |
| Petugas | petugas1@panakkukang.go.id | petugas123 |

## Hubungkan Supabase (Produksi)

1. Buat project di https://supabase.com → catat **Project URL** & **anon key**.
2. **SQL Editor → New Query** → jalankan `supabase/schema.sql` (tabel, RPC `take_queue_number`, RLS, seed).
3. **Database → Replication** → aktifkan realtime untuk: `queues`, `announcements`, `display_images`, `kk_announcements`, `broadcasts`.
4. **Storage** → buat bucket public `display-images`.
5. **Authentication → Users → Add User**: buat admin & petugas, lalu tambah baris profil di tabel `profiles` (id = user id, role, counter_id).
6. Salin `.env.example` → `.env`, isi kredensial, restart dev server.

```bash
cp .env.example .env
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
npm run dev
```

## Struktur

```
src/
  lib/         supabase.js, constants.js (seed)
  services/    authService, queueService, masterService (service/info), displayService
  stores/      authStore (zustand)
  hooks/       hooks.js (useSpeech/TTS, useClock, useRealtimeQueues)
  utils/       date.js, queue.js (localStorage fallback + nomor PREFIX-001)
  layouts/     layouts.jsx (Public, Dashboard)
  pages/       public/ display/ auth/ petugas/ admin/
  routes/      AppRoutes.jsx
supabase/schema.sql
```

## Business Rules penting

- Nomor unik per hari, prefix layanan, reset harian (BR-01–BR-03); generate via RPC transaksi (anti-duplikat). Antrean baru dibuat petugas (tidak ada pengambilan mandiri).
- Guard BR-05 di `setStatus` (satu antrean tidak dilayani dua petugas bersamaan).
- KK tanpa nomor antrean (BR-09) via `kk_announcements` + TTS.
- Display & panel petugas realtime (Supabase Realtime / polling 3 dtk fallback).

## Deploy

```bash
npm run build   # → dist/
```

Deploy `dist/` ke **Vercel** (disarankan) atau GitHub Pages, lalu arahkan custom domain (mis. `antridukcapil.my.id`).
# siap-panakkukang
