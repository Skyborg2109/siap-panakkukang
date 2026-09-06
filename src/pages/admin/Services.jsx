import { useEffect, useState } from 'react'
import AdminShell from './AdminShell.jsx'
import { getAllServices, upsertService, deleteService } from '../../services/masterService.js'
import { quotaFor } from '../../lib/constants.js'
import { Modal, Field, Empty } from '../../components/ui/ui.jsx'

const blank = { name: '', prefix: '', description: '', is_active: true, sort_order: 0, daily_quota: '' }

export default function AdminServices() {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)

  const load = () => getAllServices().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.prefix) return alert('Nama & prefix wajib diisi.')
    const quota = form.daily_quota === '' || form.daily_quota == null ? null : Math.max(1, Number(form.daily_quota) || 0)
    await upsertService({ ...form, daily_quota: quota, prefix: form.prefix.toUpperCase().replace(/\s/g, '') })
    setOpen(false); setForm(blank); load()
  }
  const del = async (id) => { if (confirm('Hapus layanan ini?')) { await deleteService(id); load() } }

  return (
    <AdminShell title="Kelola Layanan" subtitle="Tambah / ubah / nonaktifkan layanan Dukcapil tanpa ubah kode">
      <div className="card">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm text-slate-500">{rows.length} layanan</span>
          <button onClick={() => { setForm(blank); setOpen(true) }} className="btn-primary !py-2">+ Tambah Layanan</button>
        </div>
        {rows.length === 0 ? <Empty /> : (
          <div className="divide-y divide-slate-100">
            {rows.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="badge bg-blue-100 text-blue-800 font-mono">{s.prefix}</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{s.name} {!s.is_active && <span className="badge bg-slate-200 text-slate-500 ml-1">nonaktif</span>}</div>
                  <div className="text-xs text-slate-500">{s.description} · Kuota <b className="tabular-nums">{quotaFor(s)}</b>/hari</div>
                </div>
                <button onClick={() => { setForm(s); setOpen(true) }} className="btn-secondary !py-1.5 !text-xs">Ubah</button>
                <button onClick={() => del(s.id)} className="btn-danger !py-1.5 !text-xs">Hapus</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Ubah Layanan' : 'Tambah Layanan'}>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama Layanan *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="KTP-el" /></Field>
            <Field label="Prefix Nomor *"><input className="input font-mono" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })} placeholder="KTP" maxLength={10} /></Field>
          </div>
          <Field label="Deskripsi"><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Urutan"><input type="number" className="input" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></Field>
            <Field label="Kuota Harian (kupon)"><input type="number" min={1} className="input" value={form.daily_quota ?? ''} onChange={(e) => setForm({ ...form, daily_quota: e.target.value })} placeholder="cth: 50" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><select className="input" value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field>
          </div>
          <button className="btn-primary w-full">Simpan</button>
        </form>
      </Modal>
    </AdminShell>
  )
}
