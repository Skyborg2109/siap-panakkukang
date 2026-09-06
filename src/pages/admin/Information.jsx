import { useEffect, useState } from 'react'
import AdminShell from './AdminShell.jsx'
import { getAllInformation, upsertInformation, deleteInformation, getIKD, saveIKD } from '../../services/masterService.js'
import { Modal, Field, Empty } from '../../components/ui/ui.jsx'

export default function AdminInformation() {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'umum', content: '', is_active: true })
  const [ikd, setIkd] = useState({ title: '', content: '' })

  const load = () => { getAllInformation().then(setRows).catch(() => {}); getIKD().then(setIkd).catch(() => {}) }
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (!form.title || !form.content) return alert('Judul & isi wajib diisi.')
    await upsertInformation(form)
    setOpen(false); setForm({ title: '', category: 'umum', content: '', is_active: true }); load()
  }

  return (
    <AdminShell title="Informasi & IKD" subtitle="Kelola konten informasi pelayanan & halaman IKD">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="p-3 border-b border-slate-100 flex justify-between items-center">
            <span className="text-sm font-bold">Informasi Pelayanan</span>
            <button onClick={() => { setForm({ title: '', category: 'umum', content: '', is_active: true }); setOpen(true) }} className="btn-primary !py-1.5 !text-xs">+ Tambah</button>
          </div>
          {rows.length === 0 ? <Empty /> : (
            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {rows.map((i) => (
                <div key={i.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-slate-100 text-slate-600">{i.category}</span>
                    {!i.is_active && <span className="badge bg-slate-200 text-slate-500">nonaktif</span>}
                    <span className="flex-1 font-semibold text-sm">{i.title}</span>
                    <button onClick={() => { setForm(i); setOpen(true) }} className="btn-secondary !py-1 !text-xs">Ubah</button>
                    <button onClick={async () => { if (confirm('Hapus?')) { await deleteInformation(i.id); load() } }} className="btn-danger !py-1 !text-xs">Hapus</button>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-pre-line mt-1 line-clamp-3">{i.content?.replace(/\\n/g, '\n')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5 h-fit">
          <div className="text-sm font-bold mb-3">Konten Halaman IKD</div>
          <Field label="Judul"><input className="input" value={ikd.title} onChange={(e) => setIkd({ ...ikd, title: e.target.value })} /></Field>
          <div className="mt-3"><Field label="Isi"><textarea className="input font-mono !text-xs" rows={12} value={ikd.content} onChange={(e) => setIkd({ ...ikd, content: e.target.value })} /></Field></div>
          <button onClick={async () => { await saveIKD(ikd); alert('Konten IKD tersimpan.') }} className="btn-success w-full mt-3">Simpan IKD</button>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'Ubah Informasi' : 'Tambah Informasi'}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Judul *"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori"><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="umum">umum</option><option value="alur">alur</option><option value="syarat">syarat</option><option value="lainnya">lainnya</option></select></Field>
            <Field label="Status"><select className="input" value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></Field>
          </div>
          <Field label="Isi *"><textarea className="input" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
          <button className="btn-primary w-full">Simpan</button>
        </form>
      </Modal>
    </AdminShell>
  )
}
