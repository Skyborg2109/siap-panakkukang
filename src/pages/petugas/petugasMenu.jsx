import { LayoutDashboard, History, Settings, Coffee } from 'lucide-react'

// Menu sidebar tunggal untuk semua halaman petugas — tambah/ubah label
// cukup di sini (judul top bar otomatis mengikuti label yang aktif).
export const petugasMenu = [
  { to: '/petugas/queue', label: 'Panel Pelayanan', icon: <LayoutDashboard size={17} /> },
  { to: '/petugas/history', label: 'Riwayat Hari Ini', icon: <History size={17} /> },
  { to: '/petugas/rest', label: 'Notifikasi Istirahat', icon: <Coffee size={17} /> },
  { to: '/petugas/profile', label: 'Pengaturan Profil', icon: <Settings size={17} /> },
]
