import { useEffect, useState } from 'react'
import { LayoutDashboard, History, Settings } from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import { updateMyAccount } from '../../services/authService.js'
import { getStats } from '../../services/queueService.js'
import { Field } from '../../components/ui/ui.jsx'
import { adminMenu } from '../admin/AdminShell.jsx'

const petugasMenu = [
  { to: '/petugas/queue', label: 'Panel Pelayanan', icon: <LayoutDashboard size={17} /> },
  { to: '/petugas/history', label: 'Riwayat Hari Ini', icon: <History size={17} /> },
  { to: '/petugas/profile', label: 'Pengaturan Profil', icon: <Settings size={17} /> },
]

export default function PetugasProfile() {
  const { user, setUser } = useAuthStore()
  const [stats, setStats] = useState(null)
  // Halaman ini dipakai dua role — sidebar mengikuti role yang login.
  const menu = user?.role === 'ADMIN' ? adminMenu : petugasMenu

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
  }, [])

  // Form ubah data akun sendiri (nama + password opsional)
  const [name, setName] = useState(user?.name || '')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const saveProfile = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (!name.trim()) return setMsg({ tone: 'err', text: 'Nama tidak boleh kosong.' })
    if ((pw1 || pw2) && pw1 !== pw2) return setMsg({ tone: 'err', text: 'Konfirmasi password tidak sama.' })
    if (pw1 && pw1.length < 6) return setMsg({ tone: 'err', text: 'Password baru minimal 6 karakter.' })
    setSaving(true)
    try {
      const updated = await updateMyAccount({ name: name.trim(), newPassword: pw1 || '' })
      setUser(updated)
      setPw1(''); setPw2('')
      setMsg({ tone: 'ok', text: 'Data akun berhasil diperbarui.' })
    } catch (err) {
      setMsg({ tone: 'err', text: err.message || 'Gagal menyimpan.' })
    } finally {
      setSaving(false)
    }
  }

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
      <div className="card p-6 mt-4 max-w-3xl">
        <div className="text-sm font-bold">Ubah Data Akun</div>
        <p className="text-xs text-slate-500 mt-0.5">Email & role tidak bisa diubah di sini (email butuh verifikasi Auth, role hanya via {user?.role === 'ADMIN' ? 'Kelola Pengguna' : 'admin'}).</p>
        <form onSubmit={saveProfile} className="space-y-3 mt-3">
          {msg && (
            <div className={`rounded-xl border px-3 py-2.5 text-[13px] font-semibold ${msg.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{msg.text}</div>
          )}
          <Field label="Nama Lengkap *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Password Baru (kosongkan bila tidak diganti)"><input type="password" className="input" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="Min. 6 karakter" /></Field>
            <Field label="Konfirmasi Password Baru"><input type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Ulangi password baru" /></Field>
          </div>
          <button disabled={saving} className="btn-primary w-full sm:w-auto">{saving ? 'Menyimpan…' : 'Simpan Perubahan'}</button>
        </form>
      </div>
    </DashboardLayout>
  )
}
