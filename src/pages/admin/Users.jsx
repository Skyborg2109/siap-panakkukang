import { useEffect, useState } from 'react'
import AdminShell from './AdminShell.jsx'
import { getUsers, createUser, deleteUser } from '../../services/authService.js'
import { Modal, Field, Empty } from '../../components/ui/ui.jsx'
import { isSupabaseConfigured } from '../../lib/supabase.js'

export default function AdminUsers() {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'PETUGAS' })

  const load = () => { getUsers().then(setRows).catch(() => {}) }
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email) return alert('Nama & email wajib diisi.')
    try {
      await createUser({ ...form })
      setOpen(false); setForm({ name: '', email: '', password: '', role: 'PETUGAS' }); load()
    } catch (err) { alert(err.message) }
  }
  const del = async (id) => { if (confirm('Hapus pengguna ini?')) { try { await deleteUser(id); load() } catch (e) { alert(e.message) } } }

  return (
    <AdminShell title="Kelola Pengguna" subtitle="Admin & petugas pelayanan (role disimpan di profiles)">
      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-3">
          Mode Demo: akun demo bawaan tidak bisa dihapus. Buat user baru untuk simulasi — tersimpan di browser (localStorage). Setelah Supabase dikonfigurasi, buat user Auth di Supabase Dashboard lalu tambah profilnya di sini.
        </div>
      )}
      <div className="card">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm text-slate-500">{rows.length} pengguna</span>
          <button onClick={() => setOpen(true)} className="btn-primary !py-2">+ Tambah Pengguna</button>
        </div>
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100"><th className="px-4 py-2.5">Nama</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 font-medium">{u.full_name || u.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2.5"><span className={`badge ${u.role === 'ADMIN' ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800'}`}>{u.role}</span></td>
                    <td className="px-4 py-2.5 text-right">{!u.demo && <button onClick={() => del(u.id)} className="btn-danger !py-1 !text-xs">Hapus</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Tambah Pengguna">
        <form onSubmit={save} className="space-y-3">
          <Field label="Nama Lengkap *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email *"><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          {isSupabaseConfigured && <p className="text-xs text-slate-500">Buat juga user Auth dengan email yang sama di Supabase Dashboard → Authentication → Add User, agar bisa login.</p>}
          <Field label="Role"><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="PETUGAS">PETUGAS</option><option value="ADMIN">ADMIN</option></select></Field>
          <button className="btn-primary w-full">Simpan</button>
        </form>
      </Modal>
    </AdminShell>
  )
}
