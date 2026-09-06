import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MonitorPlay, Info, Fingerprint, Megaphone, BadgeCheck } from 'lucide-react'
import { getServices, getAnnouncements } from '../../services/masterService.js'
import { getStats } from '../../services/queueService.js'
import { useClock } from '../../hooks/hooks.js'
import { formatDateFull, formatClock } from '../../utils/date.js'

export default function Home() {
  const [services, setServices] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [stats, setStats] = useState(null)
  const now = useClock()

  useEffect(() => {
    getServices().then(setServices).catch(() => {})
    getAnnouncements().then(setAnnouncements).catch(() => {})
    getStats().then(setStats).catch(() => {})
    const t = setInterval(() => getStats().then(setStats).catch(() => {}), 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-[#0b1220] via-[#14264a] to-[#1b3358] text-white p-6 md:p-10">
          <div className="text-sm text-slate-300">{formatDateFull(now)} · <span className="font-mono font-bold text-white">{formatClock(now)} WITA</span></div>
          <h1 className="text-2xl md:text-4xl font-extrabold mt-2 leading-tight">Sistem Informasi Antrian & Pelayanan<br />Kecamatan Panakkukang</h1>
          <p className="text-slate-300 mt-2 max-w-2xl text-sm md:text-base">Pantau panggilan antrean secara realtime dan akses informasi persyaratan, IKD, serta pengumuman — semua dari HP Anda.</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <Link to="/display" className="inline-flex items-center gap-2 bg-orange-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-orange-700 shadow-[0_4px_14px_rgba(234,88,12,0.4)]"><MonitorPlay size={18} /> Lihat Display Antrean</Link>
            <Link to="/information" className="inline-flex items-center gap-2 bg-white/15 border border-white/30 px-5 py-3 rounded-xl font-semibold hover:bg-white/25"><Info size={18} /> Informasi Layanan</Link>
          </div>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 text-center">
              {[
                { l: 'Antre Hari Ini', v: stats.total },
                { l: 'Menunggu', v: stats.waiting },
                { l: 'Dilayani', v: stats.serving + stats.called },
                { l: 'Selesai', v: stats.completed },
              ].map((s) => (
                <div key={s.l} className="bg-white/10 rounded-xl py-3">
                  <div className="text-2xl font-extrabold">{s.v}</div>
                  <div className="text-xs text-slate-300">{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Layanan */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2"><BadgeCheck size={18} className="text-orange-600" /> Jenis Antrean Pelayanan</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => (
            <Link key={s.id} to="/information" className="card p-5 hover:shadow-md hover:border-orange-300 transition group">
              <div className="flex items-center justify-between">
                <span className="badge bg-orange-100 text-orange-800 font-mono">{s.prefix}</span>
                <Info size={18} className="text-slate-300 group-hover:text-orange-600" />
              </div>
              <div className="font-bold text-slate-900 mt-2">{s.name}</div>
              <div className="text-sm text-slate-500 line-clamp-2">{s.description}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Jam pelayanan + pengumuman */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3"><BadgeCheck size={16} className="text-orange-600" /> Jam Pelayanan</h3>
          <div className="text-sm text-slate-600 space-y-1.5">
            <div>Senin–Kamis: <b>08.00–14.00 WITA</b></div>
            <div>Jumat: <b>08.00–11.30 WITA</b></div>
            <div>Sabtu–Minggu & libur nasional: <b>TUTUP</b></div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3"><Megaphone size={16} className="text-amber-600" /> Pengumuman</h3>
          <div className="space-y-2">
            {announcements.length === 0 && <div className="text-sm text-slate-400">Belum ada pengumuman.</div>}
            {announcements.slice(0, 4).map((a) => (
              <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-900">{a.message}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Shortcut */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { to: '/information', icon: <Info size={20} />, label: 'Info & Syarat' },
          { to: '/ikd', icon: <Fingerprint size={20} />, label: 'Aktivasi IKD' },
          { to: '/display', icon: <MonitorPlay size={20} />, label: 'Display TV' },
        ].map((m) => (
          <Link key={m.label} to={m.to} className="card p-4 text-center hover:border-orange-300 hover:shadow transition">
            <div className="mx-auto w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-2">{m.icon}</div>
            <div className="text-sm font-semibold">{m.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
