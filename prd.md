PRD SIAP PANAKKUKANG — Versi React + Supabase
PRODUCT REQUIREMENTS DOCUMENT (PRD)
SIAP PANAKKUKANG
Sistem Informasi Antrian & Informasi Pelayanan Kecamatan Panakkukang

Versi Dokumen: 3.0
Tanggal: 5 September 2026
Status: Technical Stack Migration — React + Supabase

RIWAYAT PERUBAHAN DOKUMEN
Versi	Tanggal	Perubahan
3.0	5 September 2026	Migrasi arsitektur dari Laravel Full-Stack ke React.js + Supabase
2.1	5 September 2026	Penyesuaian implementasi Laravel sebelumnya
2.0	28 Agustus 2026	Draft / Initial Development PRD
1. PRODUCT OVERVIEW
1.1 Nama Produk

SIAP Panakkukang

Sistem Informasi Antrian & Informasi Pelayanan Kecamatan Panakkukang

1.2 Product Vision

Membangun sistem pelayanan berbasis web yang membantu masyarakat memperoleh informasi pelayanan dengan mudah, membantu petugas mengelola antrean secara digital, serta mengoptimalkan monitor yang tersedia pada ruang pelayanan sebagai media informasi publik.

SIAP Panakkukang dirancang sebagai:

Digital Queue & Public Information System

yang menggabungkan:

pengelolaan antrean;
pemanggilan nomor secara realtime;
audio announcement;
informasi pelayanan;
informasi IKD;
pengumuman;
statistik pelayanan;
public display.

Visi dan tujuan produk ini tetap mengikuti PRD sebelumnya.

2. BACKGROUND

Latar belakang tetap menggunakan hasil observasi KKL pada bagian pelayanan masyarakat Kantor Kecamatan Panakkukang.

Permasalahan utama:

monitor belum dimanfaatkan secara optimal;
masyarakat masih bergantung kepada petugas;
informasi antrean belum terintegrasi;
pemanggilan belum terpusat;
informasi IKD belum tersampaikan secara digital.

Sistem kemudian mengintegrasikan:

Pengambilan Nomor
       ↓
Pengelolaan Antrean
       ↓
Pemanggilan
       ↓
Public Display
       ↓
Audio Announcement
       ↓
Informasi Pelayanan
       ↓
IKD
       ↓
Pengumuman
       ↓
Statistik

Hal ini mempertahankan kebutuhan produk yang telah ditetapkan sebelumnya.

3. PROBLEM STATEMENT

Masalah utama tetap:

Belum tersedianya sistem berbasis web yang mengintegrasikan pengelolaan antrean dan media informasi pelayanan masyarakat pada ruang pelayanan Kecamatan Panakkukang.

4. PRODUCT GOALS
Primary Goal

Membangun sistem informasi berbasis web yang mampu mengelola antrean pelayanan dan menampilkan informasi pelayanan secara realtime pada monitor ruang pelayanan.

Secondary Goals

Sistem diharapkan:

meningkatkan keteraturan antrean;
mempermudah masyarakat memperoleh informasi;
mengurangi pertanyaan berulang;
meningkatkan efisiensi pelayanan;
mengoptimalkan monitor;
membantu petugas;
menyediakan statistik;
menjadi dasar digitalisasi pelayanan.

Target tersebut tetap mengikuti PRD sebelumnya.

5. TECHNOLOGY STACK

Ini bagian yang paling banyak berubah.

5.1 Frontend
React.js

React digunakan sebagai framework/library utama antarmuka.

Digunakan untuk:

halaman masyarakat;
dashboard petugas;
dashboard admin;
public display;
queue management;
CMS;
statistik;
authentication interface.
Vite

Vite digunakan sebagai development server dan build tool.

React
   ↓
Vite
   ↓
dist/
5.2 Routing
React Router

Seluruh routing frontend menggunakan React Router.

Contoh:

/
 /queue
 /queue/take
 /queue/ticket/:id
 /display
 /information
 /ikd

 /login

 /petugas
 /petugas/queue
 /petugas/history
 /petugas/profile

 /admin
 /admin/services
 /admin/counters
 /admin/users
 /admin/information
 /admin/announcements
 /admin/display
 /admin/statistics
6. BACKEND SERVICE
Supabase

Supabase digunakan sebagai platform backend utama.

Supabase menangani:

Authentication
Database
Realtime
Storage
API
Security

Sehingga aplikasi tidak membutuhkan Laravel sebagai backend.

7. DATABASE

Database menggunakan:

PostgreSQL melalui Supabase

Entitas utama:

profiles
services
service_requirements
counters
queues
information
announcements
display_contents
display_images
kk_announcements

Relasi utama:

profiles
   │
   └── counters

services
   ├── queues
   └── service_requirements

counters
   └── queues

queues
   ├── services
   └── counters
8. AUTHENTICATION

Sistem menggunakan:

Supabase Auth

Role:

ADMIN
PETUGAS

Authentication mencakup:

login;
logout;
password;
session;
authorization;
protected routes.

Data role pengguna disimpan pada tabel profiles.

Frontend menggunakan:

Supabase Auth
      ↓
Session
      ↓
React Auth Context / Zustand
      ↓
Protected Route
9. REALTIME SYSTEM

Laravel Reverb pada PRD sebelumnya digantikan oleh:

Supabase Realtime

Alur baru:

Petugas React
      ↓
Update Queue
      ↓
Supabase PostgreSQL
      ↓
Supabase Realtime
      ↓
React Display
      ↓
Update UI
      ↓
Play TTS

Fitur realtime mencakup:

queue called;
queue updated;
queue reset;
KK announcement;
master data update.
10. QUEUE MANAGEMENT

Fitur tetap mempertahankan:

generate nomor;
pemilihan layanan;
status antrean;
panggil berikutnya;
batch calling;
recall;
panggil nomor spesifik;
panggil kasus KK;
edit antrean;
skip;
serving;
complete;
reset harian.

Status:

WAITING
CALLED
SERVING
COMPLETED
SKIPPED

Business rule antrean tetap dipertahankan.

11. GENERATE QUEUE

Contoh:

KTP-001
KTP-002
KTP-003

REKAM-001
REKAM-002

IKD-001

Nomor:

unik per hari;
menggunakan prefix layanan;
otomatis;
reset setiap hari.
Mekanisme keamanan nomor

Generate nomor tidak dilakukan dengan sekadar SELECT MAX(number) di React.

Sebaliknya:

React
 ↓
Supabase RPC / PostgreSQL Function
 ↓
Database Transaction
 ↓
Generate nomor
 ↓
Return queue

Tujuannya mencegah duplicate queue ketika dua masyarakat mengambil nomor hampir bersamaan.

12. PUBLIC DISPLAY

Route:

/display

Public Display dibuat khusus untuk monitor besar.

Tidak membutuhkan login.

Layout:

┌──────────────────────────────────────────────────┐
│ LOGO    KANTOR KECAMATAN PANAKKUKANG    JAM      │
├───────────────────────┬──────────────────────────┤
│                       │                          │
│     INFORMATION       │      KTP                 │
│                       │      KTP-023              │
│     SLIDESHOW         │      LOKET 2              │
│                       │                          │
│     FOTO PETUGAS      ├──────────────────────────┤
│                       │      REKAM               │
│     FOTO PIMPINAN     │      REKAM-012           │
│                       │      LOKET 1              │
│                       │                          │
│     ALUR PELAYANAN    ├──────────────────────────┤
│                       │      IKD                 │
│                       │      IKD-008              │
│                       │      LOKET 3              │
├───────────────────────┴──────────────────────────┤
│ PENGUMUMAN: .................................... │
└──────────────────────────────────────────────────┘

Behavior tetap mengikuti requirement sebelumnya.

13. AUDIO ANNOUNCEMENT

Menggunakan:

Web Speech API

Prioritas suara:

Browser/OS Voice
      ↓
Indonesian Female Voice
      ↓
SpeechSynthesis

Contoh:

"Nomor antrean KTP 4, atas nama Budi, silakan masuk ke ruang pelayanan."

Kasus KK:

"Kartu Keluarga atas nama Budi, berkas belum lengkap, silakan masuk ke ruang pelayanan untuk konsultasi ulang."

Requirement ini dipertahankan dari PRD sebelumnya.

14. DISPLAY IMAGE MANAGEMENT

File gambar tidak lagi dikelola melalui:

public/images/
meta.json

seperti pada arsitektur Laravel lama.

Diganti menjadi:

Supabase Storage
       +
display_images table

Kategori:

staff-dukcapil
staff-kecamatan
alur

Data:

id
category
file_path
name
position
title
description
sort_order
is_active
created_at

Admin dapat:

upload;
multiple upload;
mengubah nama;
mengubah jabatan;
mengubah judul;
mengubah deskripsi;
menghapus;
mengaktifkan/nonaktifkan.

Perubahan langsung tersedia pada display.

15. ADMIN DASHBOARD

Dashboard:

Total Antrean Hari Ini
Menunggu
Sedang Dilayani
Selesai
Dilewati

Kemudian:

Antrean per Layanan

dan:

Ringkasan Sistem
- Layanan aktif
- Ruang aktif
- Pengguna
16. INFORMATION MANAGEMENT

Admin dapat mengelola:

Layanan
Persyaratan
Prosedur
Informasi
IKD
Pengumuman

Tidak perlu mengubah source code.

Data disimpan di Supabase.

17. REACT PROJECT ARCHITECTURE

Struktur project:

siap-panakkukang/
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── queue/
│   │   ├── display/
│   │   ├── admin/
│   │   └── petugas/
│   │
│   ├── layouts/
│   │   ├── PublicLayout.jsx
│   │   ├── AdminLayout.jsx
│   │   └── PetugasLayout.jsx
│   │
│   ├── pages/
│   │   ├── public/
│   │   ├── auth/
│   │   ├── admin/
│   │   ├── petugas/
│   │   └── display/
│   │
│   ├── routes/
│   │   ├── AppRoutes.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── RoleRoute.jsx
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── queueService.js
│   │   ├── serviceService.js
│   │   ├── counterService.js
│   │   ├── announcementService.js
│   │   └── displayService.js
│   │
│   ├── stores/
│   │   ├── authStore.js
│   │   ├── queueStore.js
│   │   └── displayStore.js
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useQueue.js
│   │   ├── useRealtime.js
│   │   └── useSpeech.js
│   │
│   ├── lib/
│   │   ├── supabase.js
│   │   └── constants.js
│   │
│   ├── utils/
│   │   ├── queue.js
│   │   ├── date.js
│   │   └── format.js
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── .env
├── package.json
├── vite.config.js
└── README.md
18. SUPABASE ARCHITECTURE
Supabase
│
├── Authentication
│
├── PostgreSQL Database
│   │
│   ├── profiles
│   ├── services
│   ├── service_requirements
│   ├── counters
│   ├── queues
│   ├── information
│   ├── announcements
│   ├── display_contents
│   ├── display_images
│   └── kk_announcements
│
├── Realtime
│   ├── queues
│   ├── announcements
│   ├── display_images
│   └── master data
│
├── Storage
│   └── display-images
│
└── Edge Functions
    └── server-side operations
19. SECURITY

Karena sekarang tidak ada Laravel middleware, keamanan akan menggunakan fitur Supabase.

Row Level Security — RLS

Contoh konsep:

Masyarakat
    ↓
Read active services
    ↓
Create queue

Petugas
    ↓
Read assigned counter
    ↓
Manage queue

Admin
    ↓
CRUD master data

Database tidak boleh bergantung hanya pada validasi React.

RLS harus menjadi lapisan keamanan utama database.

20. API / DATA ACCESS

React berkomunikasi dengan Supabase:

React Component
      ↓
Service Layer
      ↓
Supabase Client
      ↓
PostgreSQL

Contoh:

queueService.js
serviceService.js
counterService.js
userService.js
displayService.js

Dengan demikian business/data access tidak ditulis langsung berantakan di komponen UI.

21. REALTIME FLOW

Contoh pemanggilan:

PETUGAS

Klik:
"Panggil Berikutnya"

       ↓

queueService.callNext()

       ↓

Supabase Database

       ↓

Queue berubah:
WAITING → CALLED

       ↓

Supabase Realtime

       ↓
┌──────┴─────────┐
↓                ↓
Display       Petugas lain
↓
Update UI
↓
TTS
22. ROUTE STRUCTURE
/
├── /login
│
├── /queue
│   ├── /take
│   └── /ticket/:id
│
├── /display
│
├── /information
├── /ikd
│
├── /petugas
│   ├── /dashboard
│   ├── /queue
│   ├── /history
│   └── /profile
│
└── /admin
    ├── /dashboard
    ├── /services
    ├── /counters
    ├── /users
    ├── /information
    ├── /announcements
    ├── /display
    └── /statistics
23. DEPLOYMENT ARCHITECTURE

Ini salah satu perubahan terbesar.

Sebelumnya:

Local Server
     ↓
Laravel
     ↓
MySQL
     ↓
Reverb

Sekarang:

                    INTERNET
                       │
                       ▼
                Custom Domain
                       │
                       ▼
                React Frontend
                       │
                GitHub Pages
                  / Vercel
                       │
                       ▼
                  Supabase
             ┌─────────┼─────────┐
             │         │         │
            Auth      DB      Realtime
             │         │         │
             └─────────┼─────────┘
                       │
                    Storage
24. DEVELOPMENT ENVIRONMENT

Tidak membutuhkan Laragon lagi.

Requirements:

Node.js
NPM
Git
VS Code
Browser

Setup:

npm create vite@latest siap-panakkukang

Kemudian:

npm install

Dan dependencies:

react-router-dom
@supabase/supabase-js
axios
zustand
recharts
lucide-react

Tailwind digunakan untuk styling.

25. HOSTING
Frontend

Pilihan:

GitHub Pages
GitHub Repository
       ↓
GitHub Actions
       ↓
Vite Build
       ↓
dist/
       ↓
GitHub Pages

atau:

Vercel
GitHub
   ↓
Vercel
   ↓
React

Untuk kemudahan deployment React, Vercel akan lebih nyaman, sedangkan GitHub Pages cocok jika kamu memang ingin semuanya sederhana dan murah.

26. CUSTOM DOMAIN

Misalnya:

antridukcapil.my.id

Struktur:

antridukcapil.my.id
        ↓
React Application
        ↓
Supabase

Tidak diperlukan:

VPS
Laravel Hosting
MySQL Hosting
Reverb Server

untuk frontend/backend dasar.

27. FUNCTIONAL REQUIREMENTS

Requirement lama tetap dipertahankan:

ID	Requirement
FR-01	Sistem dapat melakukan autentikasi
FR-02	Sistem menerapkan role Admin dan Petugas
FR-03	Sistem dapat menghasilkan nomor antrean
FR-04	Sistem dapat memanggil nomor berikutnya
FR-05	Sistem dapat memanggil ulang nomor
FR-06	Sistem dapat melewati nomor
FR-07	Sistem dapat menyelesaikan antrean
FR-08	Display menerima perubahan realtime
FR-09	Sistem dapat memainkan audio
FR-10	Admin dapat mengelola layanan
FR-11	Admin dapat mengelola persyaratan
FR-12	Admin dapat mengelola informasi
FR-13	Admin dapat mengelola pengumuman
FR-14	Admin dapat mengelola pengguna
FR-15	Admin dapat mengelola loket
FR-16	Sistem menyediakan statistik
FR-17	Petugas dapat memanggil nomor spesifik
FR-18	Petugas dapat memanggil kasus KK
FR-19	Admin dapat mengelola gambar display
FR-20	Panel petugas realtime

Requirement tersebut memang sudah ditetapkan pada PRD awal.

28. NON-FUNCTIONAL REQUIREMENTS

Tetap:

Performance

Operasi harus responsif pada kondisi jaringan normal.

Realtime

Perubahan antrean diterima tanpa refresh.

Usability

Panel petugas sederhana.

Accessibility

Nomor pada display berukuran besar dan kontras tinggi.

Reliability

Sistem dapat digunakan selama jam operasional.

Security

Menggunakan:

Supabase Auth
RLS
Input Validation
Protected Routes
Secure Environment Variables
Database Policies
Maintainability

Frontend menggunakan:

Components
Hooks
Services
Stores
Pages
Layouts
Utils

sehingga tanggung jawab kode tetap terpisah.

29. BUSINESS RULES

Semua business rule utama tetap:

BR-01
Nomor hanya dibuat ketika pelayanan aktif.

BR-02
Nomor reset setiap hari.

BR-03
Nomor unik pada hari berjalan.

BR-04
Petugas hanya mengelola loket yang ditugaskan.

BR-05
Satu antrean tidak boleh dilayani dua petugas bersamaan.

BR-06
Antrean skip tetap dicatat.

BR-07
Informasi nonaktif tidak ditampilkan.

BR-08
Pengumuman nonaktif tidak ditampilkan.

BR-09
KK tidak menggunakan nomor antrean.

BR-10
Recall hanya nomor yang sudah tercatat.

BR-11
Antrean ≤2 detik dapat digabung menjadi batch.

30. MVP DEFINITION

MVP tetap dianggap selesai apabila:

Masyarakat
     ↓
Pilih Layanan
     ↓
Ambil Nomor
     ↓
Menunggu
     ↓
Petugas Login
     ↓
Panggil Nomor
     ↓
Supabase Database
     ↓
Supabase Realtime
     ↓
Public Display
     ↓
Audio
     ↓
Masyarakat menuju loket
     ↓
Pelayanan
     ↓
Selesai

Dan admin dapat mengelola:

Layanan
Loket
Petugas
Informasi
IKD
Pengumuman
Display
Statistik

Fungsi MVP tersebut sesuai definisi sebelumnya.

31. DEVELOPMENT ROADMAP

Saya akan mengubah roadmap Laravel sebelumnya menjadi:

PHASE 1 — Analysis
observasi;
wawancara;
validasi kebutuhan;
identifikasi layanan;
identifikasi loket.
PHASE 2 — System Design
use case;
user flow;
ERD;
database schema;
system architecture;
wireframe;
UI design.
PHASE 3 — React Foundation
setup Vite;
setup React;
Tailwind;
React Router;
Supabase;
Zustand;
layout;
authentication.
PHASE 4 — Supabase Foundation
database;
tables;
relationships;
RLS;
authentication;
storage;
realtime;
PostgreSQL functions/RPC.
PHASE 5 — Queue System
service;
counter;
queue;
generate number;
call;
recall;
specific call;
KK case;
skip;
complete;
daily reset.
PHASE 6 — Public Display
monitor UI;
realtime;
queue cards;
slideshow;
TTS;
announcement ticker.
PHASE 7 — Admin CMS
service management;
counter management;
user management;
information;
announcement;
display images.
PHASE 8 — Statistics
dashboard;
daily statistics;
service statistics;
history.
PHASE 9 — Testing
functional testing;
database testing;
RLS testing;
realtime testing;
audio testing;
usability testing;
UAT.
PHASE 10 — Deployment
GitHub
   ↓
Build
   ↓
Vercel / GitHub Pages
   ↓
Custom Domain
   ↓
Supabase Production
32. FINAL ARCHITECTURE

Jadi blueprint final SIAP Panakkukang menjadi:

                         ┌──────────────────────┐
                         │    CUSTOM DOMAIN     │
                         │ antridukcapil.my.id  │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    REACT + VITE      │
                         │                      │
                         │ React Router         │
                         │ Tailwind CSS         │
                         │ Zustand              │
                         │ Axios                │
                         │ Recharts             │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   SUPABASE CLIENT    │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
      ┌────────────┐        ┌──────────────┐       ┌─────────────┐
      │ Supabase   │        │ PostgreSQL   │       │ Supabase    │
      │ Auth       │        │ Database     │       │ Realtime    │
      └────────────┘        └──────────────┘       └──────┬──────┘
             │                      │                      │
             │                      │                      │
             └──────────────────────┼──────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ Supabase Storage     │
                         │ Display Images       │
                         └──────────────────────┘