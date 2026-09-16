import { useEffect, useState } from 'react'
import AdminShell from './AdminShell.jsx'
import { getAllDisplayImages, uploadDisplayImage, updateDisplayImage, deleteDisplayImage } from '../../services/displayService.js'
import { isSupabaseConfigured } from '../../lib/supabase.js'
import { Field, Empty, Modal } from '../../components/ui/ui.jsx'

const CATS = [
  { id: 'staff-kecamatan', label: 'Foto Pimpinan Kecamatan' },
  { id: 'staff-dukcapil', label: 'Foto Petugas Dukcapil' },
  { id: 'alur', label: 'Alur Pelayanan' },
]

export default function AdminDisplay() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ category: 'staff-kecamatan', name: '', title: '', description: '' })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [fileKey, setFileKey] = useState(0)
  const [uploading, setUploading] = useState(false)

  const maxMB = isSupabaseConfigured ? 5 : 2

  const isAlur = form.category === 'alur'

  const onCategory = (e) => {
    const category = e.target.value
    // Alur hanya punya jenis alur (tanpa jabatan/deskripsi) — buang sisa deskripsi lama
    setForm((f) => ({ ...f, category, description: category === 'alur' ? '' : f.description }))
  }

  const load = () => getAllDisplayImages().then(setRows).catch(() => {})
  useEffect(() => { load() }, [])

  // Ubah judul/deskripsi tanpa upload ulang (mis. isi jadwal operasional
  // di bawah gambar logo kecamatan — tampil multi-baris di Display TV)
  const [editImg, setEditImg] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const openEdit = (img) => setEditImg({ id: img.id, title: img.title || img.name || '', description: img.description || '' })
  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editImg) return
    setEditSaving(true)
    try {
      await updateDisplayImage(editImg.id, { title: editImg.title.trim(), description: editImg.description.trim() })
      setEditImg(null); load()
    } catch (err) { alert(err.message) }
    finally { setEditSaving(false) }
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > maxMB * 1024 * 1024) return alert(`Maksimal ${maxMB}MB.`)
    setFile(f)
    const r = new FileReader()
    r.onload = () => setPreview(r.result)
    r.readAsDataURL(f)
  }

  const resetForm = () => {
    setPreview(''); setFile(null)
    setForm({ category: 'staff-kecamatan', name: '', title: '', description: '' })
    setFileKey((k) => k + 1)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!file && !preview) return alert('Pilih file gambar dulu.')
    if (isAlur && !(form.title || form.name).trim()) return alert('Isi jenis alur dulu.')
    setUploading(true)
    try {
      await uploadDisplayImage({ file, base64: preview, ...form })
      resetForm(); load()
    } catch (err) { alert(err.message) }
    finally { setUploading(false) }
  }

  return (
      <AdminShell title="Gambar Display TV" subtitle="Slideshow kiri display: foto pimpinan, petugas & alur (Supabase Storage / demo lokal)">
      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={save} className="card p-5 h-fit space-y-3">
          <div className="text-sm font-bold">Upload Baru</div>
          <Field label="Kategori">
            <select className="input" value={form.category} onChange={onCategory}>
              {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={`File Gambar (maks ${maxMB}MB${isSupabaseConfigured ? '' : ' demo'})`}><input key={fileKey} type="file" accept="image/*" onChange={onFile} className="input" /></Field>
          {preview && <img src={preview} alt="preview" className="rounded-xl max-h-40 mx-auto" />}
          {isAlur ? (
            <Field label="Jenis Alur *"><input className="input" value={form.title || form.name} onChange={(e) => setForm({ ...form, title: e.target.value, name: e.target.value })} placeholder="cth: Alur Pelayanan KTP-el" /></Field>
          ) : (
            <>
              <Field label="Nama / Judul"><input className="input" value={form.title || form.name} onChange={(e) => setForm({ ...form, title: e.target.value, name: e.target.value })} placeholder="cth: Hj. Fatmawati — Lurah" /></Field>
              <Field label="Jabatan / Deskripsi (mendukung beberapa baris)"><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={'cth jadwal operasional:\nSenin–Kamis: 08.00–14.00\nJumat: 08.00–11.30'} /></Field>
            </>
          )}
          <button disabled={uploading} className="btn-primary w-full">{uploading ? 'Mengunggah…' : 'Upload'}</button>
        </form>
        <div className="lg:col-span-2 space-y-4">
          {CATS.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="font-bold text-sm mb-3">{c.label} ({rows.filter((r) => r.category === c.id).length})</div>
              {rows.filter((r) => r.category === c.id).length === 0 ? <Empty title="Belum ada gambar" /> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rows.filter((r) => r.category === c.id).map((img) => (
                    <div key={img.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <img src={img.url || img.file_path} alt={img.title || img.name} className="h-32 w-full object-cover bg-slate-100" />
                      <div className="p-2.5">
                        <div className="text-xs font-bold truncate">{img.title || img.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{img.description}</div>
                        <div className="flex gap-3 mt-1">
                          <button onClick={() => openEdit(img)} className="text-xs text-sky-700 hover:underline">Ubah</button>
                          <button onClick={async () => { if (confirm('Hapus gambar?')) { await deleteDisplayImage(img.id, img.file_path); load() } }} className="text-xs text-rose-600 hover:underline">Hapus</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Modal ubah judul/deskripsi */}
      <Modal open={!!editImg} onClose={() => setEditImg(null)} title="Ubah Keterangan Gambar">
        <form onSubmit={saveEdit} className="space-y-3">
          <Field label="Nama / Judul"><input className="input" value={editImg?.title || ''} onChange={(e) => setEditImg({ ...editImg, title: e.target.value })} placeholder="cth: Logo Kecamatan Panakkukang" /></Field>
          <Field label="Jabatan / Deskripsi (mendukung beberapa baris — tampil di bawah gambar pada Display TV)">
            <textarea className="input" rows={4} value={editImg?.description || ''} onChange={(e) => setEditImg({ ...editImg, description: e.target.value })} placeholder={'cth jadwal operasional:\nSenin–Kamis: 08.00–14.00\nJumat: 08.00–11.30'} />
          </Field>
          <button disabled={editSaving} className="btn-primary w-full">{editSaving ? 'Menyimpan…' : 'Simpan Perubahan'}</button>
        </form>
      </Modal>
    </AdminShell>
  )
}
