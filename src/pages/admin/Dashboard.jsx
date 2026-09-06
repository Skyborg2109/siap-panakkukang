import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Clock, CheckCircle, SkipForward, MonitorPlay, Wrench } from 'lucide-react'
import AdminShell from './AdminShell.jsx'
import { StatCard } from '../../components/ui/ui.jsx'
import { getStats } from '../../services/queueService.js'
import { getServices, getAnnouncements } from '../../services/masterService.js'
import { getUsers } from '../../services/authService.js'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [sys, setSys] = useState({ services: 0, users: 0, announcements: 0 })

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    Promise.all([getServices().catch(() => []), getUsers().catch(() => []), getAnnouncements(false).catch(() => [])])
      .then(([s, u, a]) => setSys({ services: s.length, users: u.length, announcements: a.length }))
  }, [])

  return (
    <AdminShell title="Dashboard Admin" subtitle="Ringkasan antrean & sistem SIAP Panakkukang hari ini">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <StatCard title="Total Hari Ini" value={stats?.total ?? '-'} icon={<Users size={20} />} color="text-slate-900" />
        <StatCard title="Menunggu" value={stats?.waiting ?? '-'} icon={<Clock size={20} />} color="text-orange-600" />
        <StatCard title="Dilayani" value={(stats?.called ?? 0) + (stats?.serving ?? 0)} icon={<MonitorPlay size={20} />} color="text-blue-600" />
        <StatCard title="Selesai" value={stats?.completed ?? '-'} icon={<CheckCircle size={20} />} color="text-emerald-600" />
        <StatCard title="Dilewati" value={stats?.skipped ?? '-'} icon={<SkipForward size={20} />} color="text-slate-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold mb-3">Antrean per Layanan</h3>
          {!stats?.perService?.length ? <p className="text-sm text-slate-400">Belum ada antrean hari ini.</p> : (
            <div className="space-y-2">
              {stats.perService.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium">{s.name}</span><span className="text-slate-500">{s.completed}/{s.total} selesai</span></div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${s.total ? Math.round((s.completed / s.total) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-bold mb-3">Ringkasan Sistem</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[['Layanan aktif', sys.services, '/admin/services', <Wrench key="a" size={15} />], ['Pengguna', sys.users, '/admin/users', <Users key="c" size={15} />], ['Pengumuman', sys.announcements, '/admin/announcements', <MonitorPlay key="d" size={15} />]].map(([l, v, to, icon]) => (
              <Link key={l} to={to} className="bg-slate-50 hover:bg-orange-50 rounded-xl p-3.5 flex items-center gap-2.5 transition">
                <span className="text-orange-600">{icon}</span>
                <span><b className="text-lg block leading-none">{v}</b><span className="text-xs text-slate-500">{l}</span></span>
              </Link>
            ))}
          </div>
          <Link to="/display" target="_blank" className="btn-primary w-full mt-4"><MonitorPlay size={16} /> Buka Display TV (Monitor Ruang Pelayanan)</Link>
        </div>
      </div>
    </AdminShell>
  )
}
