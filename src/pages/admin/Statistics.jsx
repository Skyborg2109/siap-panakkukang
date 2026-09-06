import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import AdminShell from './AdminShell.jsx'
import { getStats, getHistory } from '../../services/queueService.js'
import { todayKey } from '../../utils/date.js'

const COLORS = ['#1d4ed8', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16']

export default function AdminStatistics() {
  const [stats, setStats] = useState(null)
  const [date, setDate] = useState(todayKey())

  const load = (d) => {
    getStats(d).then(setStats).catch(() => {})
  }

  useEffect(() => { load(date) }, [date])

  const statusData = stats ? [
    { name: 'Menunggu', value: stats.waiting },
    { name: 'Dipanggil', value: stats.called },
    { name: 'Dilayani', value: stats.serving },
    { name: 'Selesai', value: stats.completed },
    { name: 'Dilewati', value: stats.skipped },
  ].filter((x) => x.value > 0) : []

  const exportCSV = async () => {
    const rows = await getHistory({ date, limit: 2000 })
    const header = 'nomor,nama,nik,layanan,status,masuk,dipanggil\n'
    const body = rows.map((q) => [q.number, `"${q.name}"`, q.nik || '', `"${q.service_name}"`, q.status, q.created_at, q.called_at || ''].join(',')).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `antrean-${date}.csv`
    a.click()
  }

  return (
    <AdminShell title="Statistik Pelayanan" subtitle="Volume & kinerja pelayanan — dasar laporan KKL">
      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Tanggal:</label>
        <input type="date" className="input !w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={exportCSV} className="btn-secondary !py-2">Export CSV</button>
        <span className="text-sm text-slate-500 ml-auto">Total: <b>{stats?.total ?? 0}</b> antrean</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold mb-3">Antrean per Layanan</h3>
          {!stats?.perService?.length ? <p className="text-sm text-slate-400">Belum ada data.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.perService} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#1d4ed8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-bold mb-3">Komposisi Status</h3>
          {!statusData.length ? <p className="text-sm text-slate-400">Belum ada data.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
