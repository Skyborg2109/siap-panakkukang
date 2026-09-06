import { useEffect, useState } from 'react'
import { History, LayoutDashboard, Settings } from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import { getHistory } from '../../services/queueService.js'
import { Badge, Empty } from '../../components/ui/ui.jsx'
import { formatTime, todayKey } from '../../utils/date.js'

const menu = [
  { to: '/petugas/queue', label: 'Panel Pelayanan', icon: <LayoutDashboard size={17} /> },
  { to: '/petugas/history', label: 'Riwayat Hari Ini', icon: <History size={17} /> },
  { to: '/petugas/profile', label: 'Pengaturan Profil', icon: <Settings size={17} /> },
]

export default function PetugasHistory() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHistory({ date: todayKey() }).then(setRows).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const list = filter ? rows.filter((r) => r.status === filter) : rows

  return (
    <DashboardLayout menu={menu} title="Riwayat Pelayanan" subtitle="Seluruh antrean hari ini">
      <div className="card">
        <div className="flex gap-2 p-3 border-b border-slate-100">
          <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Semua status</option>
            <option value="WAITING">Menunggu</option>
            <option value="CALLED">Dipanggil</option>
            <option value="SERVING">Dilayani</option>
            <option value="COMPLETED">Selesai</option>
            <option value="SKIPPED">Dilewati</option>
          </select>
          <span className="text-sm text-slate-500 self-center">{list.length} data</span>
        </div>
        {loading ? <div className="p-10 text-center text-slate-400">Memuat…</div> : list.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2.5">Nomor</th><th className="px-4 py-2.5">Nama</th><th className="px-4 py-2.5">Layanan</th><th className="px-4 py-2.5">Masuk</th><th className="px-4 py-2.5">Status</th>
              </tr></thead>
              <tbody>
                {list.map((q) => (
                  <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold">{q.number}</td>
                    <td className="px-4 py-2.5">{q.name}</td>
                    <td className="px-4 py-2.5">{q.service_name}</td>
                    <td className="px-4 py-2.5">{formatTime(q.created_at)}</td>
                    <td className="px-4 py-2.5"><Badge status={q.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
