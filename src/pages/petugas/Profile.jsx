import { useEffect, useState } from 'react'
import { LayoutDashboard, History, Settings } from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import { getStats } from '../../services/queueService.js'

const menu = [
  { to: '/petugas/queue', label: 'Panel Pelayanan', icon: <LayoutDashboard size={17} /> },
  { to: '/petugas/history', label: 'Riwayat Hari Ini', icon: <History size={17} /> },
  { to: '/petugas/profile', label: 'Pengaturan Profil', icon: <Settings size={17} /> },
]

export default function PetugasProfile() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
  }, [])

  return (
    <DashboardLayout menu={menu} title="Pengaturan Profil" subtitle="Informasi akun Anda">
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <div className="card p-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-500 text-white font-extrabold text-xl flex items-center justify-center">{user?.name?.[0]}</div>
          <div className="font-bold text-lg mt-3">{user?.name}</div>
          <div className="text-sm text-slate-500">{user?.email}</div>
          <span className="badge bg-violet-100 text-violet-800 mt-2">{user?.role}</span>
        </div>
        <div className="card p-6">
          <div className="text-sm font-bold text-slate-500">RINGKASAN HARI INI</div>
          {stats ? (
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[['Menunggu', stats.waiting], ['Selesai', stats.completed], ['Total', stats.total]].map(([l, v]) => (
                <div key={l} className="bg-slate-50 rounded-xl py-2.5"><div className="font-extrabold text-lg">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 mt-3">Memuat…</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
