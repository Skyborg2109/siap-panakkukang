import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { LogIn, Loader2, Mail, Lock, Info } from 'lucide-react'
import { login } from '../../services/authService.js'
import { useAuthStore } from '../../stores/authStore.js'
import { Field } from '../../components/ui/ui.jsx'
import { GovLogos } from '../../layouts/layouts.jsx'
import { isSupabaseConfigured } from '../../lib/supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser, user: current } = useAuthStore()

  // Sudah login → langsung ke dashboard rolenya (jangan tampilkan form lagi)
  if (current) return <Navigate to={current.role === 'ADMIN' ? '/admin' : '/petugas'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      setUser(user)
      // Kembali ke halaman asal hanya bila masih di area role-nya,
      // agar login admin tidak nyangkut kembali ke halaman petugas (dan sebaliknya)
      const home = user.role === 'ADMIN' ? '/admin' : '/petugas'
      const from = location.state?.from
      const back = typeof from === 'string' && (from === home || from.startsWith(home + '/')) ? from : home
      navigate(back, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#eef2f7]">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="flex items-center gap-4 mb-5">
          <GovLogos className="h-20" divider />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">SIAP PANAKKUKANG</h1>
        <p className="text-[13px] text-slate-500 mb-6">Sistem Informasi Antrian & Informasi Pelayanan</p>

        <div className="card w-full max-w-[440px] p-6 md:p-7">
          <h2 className="text-lg font-extrabold text-slate-900">Masuk ke Akun Petugas</h2>
          <p className="text-[13px] text-slate-500 mt-1 pb-4 border-b border-slate-100">
            Gunakan email dan kata sandi yang telah didaftarkan oleh administrator.
          </p>
          <form onSubmit={submit} className="space-y-4 mt-4">
            <Field label="Alamat Email">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                <input className="input pl-9" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@panakkukang.go.id" />
              </div>
            </Field>
            <Field label="Kata Sandi">
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
                <input className="input pl-9" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </Field>
            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5">{error}</div>}
            <button className="btn-primary w-full !py-3 !rounded-xl" disabled={loading}>
              {loading ? <><Loader2 className="animate-spin" size={17} /> Masuk…</> : <><LogIn size={17} /> Masuk ke Sistem</>}
            </button>
          </form>
        </div>

        <div className="w-full max-w-[440px] mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 flex gap-2.5 text-xs text-slate-600">
          <Info size={15} className="text-orange-600 shrink-0 mt-0.5" />
          <p>
            Akses khusus petugas dan staf ruang pelayanan. Pendaftaran akun petugas baru dikelola langsung oleh{' '}
            <b>Administrator</b> melalui panel admin.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="w-full max-w-[440px] mt-3 bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600">
            <div className="font-bold mb-1">Akun demo (Mode Demo):</div>
            <div className="font-mono">admin@panakkukang.go.id / admin123</div>
            <div className="font-mono">petugas1@panakkukang.go.id / petugas123</div>
            <div className="font-mono">petugas2@panakkukang.go.id / petugas123</div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex flex-col sm:flex-row gap-1 sm:items-center justify-between">
          <div>© 2026 Kantor Kecamatan Panakkukang, Kota Makassar.</div>
          <div>Jl. Batu Raya No. 1, Panakkukang, Makassar, Sulawesi Selatan</div>
        </div>
      </footer>
    </div>
  )
}
