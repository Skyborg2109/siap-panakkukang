import { useEffect, useState } from 'react'
import AdminShell from './AdminShell.jsx'
import { getAnnouncements, upsertAnnouncement, deleteAnnouncement } from '../../services/masterService.js'
import { Modal, Field, Empty } from '../../components/ui/ui.jsx'

export default function AdminAnnouncements() {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ message: '', is_active: true })

  const load = () => getAnnouncements(false).then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.message.trim()) return alert('Isi pengumuman wajib diisi.')
    await upsertAnnouncement(form)
    setOpen(false); setForm({ message: '', is_active: true }); load()
  }

  return (
    <AdminShell title="Kelola Pengumuman" subtitle="Teks berjalan (ticker) di Display TV — realtime">
      <div className="card">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm text-slate-500">{rows.length} pengumuman</span>
          <button onClick={() => { setForm({ message: '', is_active: true }); setOpen(true) }} className="btn-primary !py-2">+ Tambah</button>
        </div>
        {rows.length === 0 ? <Empty /> : (
          <div className="divide-y divide-slate-100">
            {rows.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 text-sm">{a.message} {!a.is_active && <span className="badge bg-slate-200 text-slate-500 ml-1">nonaktif</span>}</div>
                <button onClick={() => { setForm(a); setOpen(true) }} className="btn-secondary !py-1.5 !text-xs">Ubah</button>
                <button onClick={async () => { if (confirm('Hapus?')) { await deleteAnnouncement(a.id); load() } }} className="btn-danger !py-1.5 !text-xs">Hapus</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Ubah Pengumuman' : 'Tambah Pengumuman'}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Isi Pengumuman *"><textarea className="input" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="cth: Pelayanan Hari Jumat tutup pukul 11.30 WITA" /></Field>
          <Field label="Status"><select className="input" value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}><option value="1">Aktif (tampil di TV)</option><option value="0">Nonaktif</option></select></Field>
          <button className="btn-primary w-full">Simpan</button>
        </form>
      </Modal>
    </AdminShell>
  )
}
