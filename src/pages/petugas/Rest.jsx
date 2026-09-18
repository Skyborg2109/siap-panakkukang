import { useEffect, useRef, useState } from 'react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import { useAuthStore } from '../../stores/authStore.js'
import { getRestConfig, saveRestConfig, uploadRestImage, deleteRestImage, imageUrl } from '../../services/displayService.js'
import { isSupabaseConfigured } from '../../lib/supabase.js'
import { isRestNow } from '../../utils/date.js'
import { Field } from '../../components/ui/ui.jsx'
import { adminMenu } from '../admin/AdminShell.jsx'
import { petugasMenu } from './petugasMenu.jsx'

// Batasi query 20 dtk: backend yang menggantung tidak boleh membuat halaman
// stuck "Menyimpan…" selamanya (TV/kiosk sering memblokir dialog alert,
// jadi semua error tampil sebagai banner dalam aplikasi).
function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function PetugasRest() {
  const { user } = useAuthStore()
  // Halaman ini dipakai dua role — sidebar mengikuti role yang login.
  const menu = user?.role === 'ADMIN' ? adminMenu : petugasMenu

  // Dua jadwal: harian + khusus Jumat (tab terpisah, satu kali simpan).
  const [rest, setRest] = useState({ enabled: false, start: '12:00', end: '13:00', image: '', friday: { enabled: true, start: '11:30', end: '13:30', image: '' } })
  const [restTab, setRestTab] = useState('daily')
  const [restFile, setRestFile] = useState(null)
  const [restPreview, setRestPreview] = useState('')
  const [restKey, setRestKey] = useState(0)
  const [restSaving, setRestSaving] = useState(false)
  const restFileRef = useRef(null)
  const [restFridayFile, setRestFridayFile] = useState(null)
  const [restFridayPreview, setRestFridayPreview] = useState('')
  const [restFridayKey, setRestFridayKey] = useState(0)
  const restFridayFileRef = useRef(null)
  // Patch jadwal Jumat tanpa mengganggu field harian.
  const setRestFriday = (patch) => setRest((r) => ({ ...r, friday: { ...(r.friday || {}), ...patch } }))

  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)
  useEffect(() => () => clearTimeout(noticeTimer.current), [])
  const flash = (text, tone = 'ok') => {
    setNotice({ text, tone })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 6000)
  }
  const errText = (e) => {
    const m = e?.message || 'Operasi gagal.'
    if (/timeout/i.test(m)) return 'Server tidak merespons dalam 20 detik. Periksa koneksi & status project Supabase, lalu coba lagi.'
    return m
  }

  // Muat konfigurasi sekali saat dibuka (+ saat ada perubahan dari tab lain).
  useEffect(() => {
    let on = true
    const loadRest = async () => {
      try {
        const r = await getRestConfig()
        if (!on) return
        setRest(r)
        if (!restFileRef.current) setRestPreview(r.image ? imageUrl(r.image) : '')
        if (!restFridayFileRef.current) setRestFridayPreview(r.friday?.image ? imageUrl(r.friday.image) : '')
      } catch { /* abaikan */ }
    }
    loadRest()
    const onMaster = () => loadRest()
    window.addEventListener('siap:master-changed', onMaster)
    window.addEventListener('storage', onMaster)
    return () => { on = false; window.removeEventListener('siap:master-changed', onMaster); window.removeEventListener('storage', onMaster) }
  }, [])

  const maxRestMB = isSupabaseConfigured ? 5 : 2

  const onRestFile = (e, which = 'daily') => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > maxRestMB * 1024 * 1024) return flash(`Gambar maksimal ${maxRestMB}MB.`, 'warn')
    const r = new FileReader()
    if (which === 'friday') {
      setRestFridayFile(f)
      restFridayFileRef.current = f
      r.onload = () => setRestFridayPreview(r.result)
    } else {
      setRestFile(f)
      restFileRef.current = f
      r.onload = () => setRestPreview(r.result)
    }
    r.readAsDataURL(f)
  }

  // Simpan SATU gambar jadwal (harian / jumat): pakai yang tersimpan bila
  // tak ada file baru (permanen, cukup upload 1x), upload bila ada file baru.
  const storeRestImage = async (which) => {
    const isFriday = which === 'friday'
    const cur = isFriday ? (rest.friday || {}) : rest
    const file = isFriday ? restFridayFile : restFile
    const preview = isFriday ? restFridayPreview : restPreview
    const localImage = String(cur.image || '').trim()
    let serverImage = ''
    if (!localImage) {
      try {
        const cfg = await withTimeout(getRestConfig(), 20000)
        serverImage = String((isFriday ? cfg?.friday?.image : cfg?.image) || '').trim()
        if (serverImage) {
          if (isFriday) setRestFriday({ image: serverImage })
          else setRest((r) => (r.image ? r : { ...r, image: serverImage }))
        }
      } catch { /* abaikan, validasi di bawah yang bicara */ }
    }
    const storedImage = localImage || serverImage
    let uploadedPath = ''
    if (file) {
      uploadedPath = await withTimeout(uploadRestImage({ file, base64: preview }), 20000)
      // Ganti file lama di Storage agar tak menumpuk (abaikan bila gagal)
      if (isSupabaseConfigured && storedImage && storedImage !== uploadedPath) deleteRestImage(storedImage).catch(() => {})
    }
    return uploadedPath || storedImage
  }

  const handleRestSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setRestSaving(true)
    try {
      // Ambil ulang dari server sebagai fallback agar simpan cepat sebelum
      // load awal selesai tidak menimpa image yang sudah ada menjadi kosong.
      const image = await storeRestImage('daily')
      const fridayImage = await storeRestImage('friday')
      const dailyOn = rest.enabled !== false
      if (dailyOn && !image) return flash('Pilih file gambar istirahat Harian dulu (cukup 1x — selanjutnya tersimpan permanen).', 'warn')
      const saved = await withTimeout(saveRestConfig({ ...rest, image, friday: { ...(rest.friday || {}), image: fridayImage } }), 20000)
      setRest(saved)
      setRestFile(null)
      restFileRef.current = null
      setRestPreview(saved.image ? imageUrl(saved.image) : '')
      setRestKey((k) => k + 1)
      setRestFridayFile(null)
      restFridayFileRef.current = null
      setRestFridayPreview(saved.friday?.image ? imageUrl(saved.friday.image) : '')
      setRestFridayKey((k) => k + 1)
      const dailyTxt = saved.enabled ? `Harian AKTIF (${saved.start}–${saved.end})` : 'Harian nonaktif'
      const friTxt = saved.friday?.image
        ? (saved.friday.enabled ? `Jumat AKTIF (${saved.friday.start}–${saved.friday.end})` : 'Jumat ikut Harian')
        : 'Jumat ikut Harian (belum ada gambar)'
      flash(`Notifikasi istirahat disimpan. ${dailyTxt} • ${friTxt}.`)
    } catch (err) { flash(errText(err), 'warn') }
    finally { setRestSaving(false) }
  }

  // Status live (sadar-hari: Jumat mengikuti jadwal Jumat bila ada gambarnya)
  const restShowing = isRestNow(rest, new Date())

  return (
    <DashboardLayout menu={menu} title="Notifikasi Istirahat" subtitle="Jadwal & gambar istirahat yang tampil di Display TV">
      <div className="max-w-2xl">
        {notice && (
          <div className={`card p-3 mb-4 text-sm font-semibold border flex items-center gap-2 animate-slide-in ${notice.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${notice.tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {notice.text}
          </div>
        )}
        <div className="card p-4 md:p-5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-800 flex-1">Notifikasi Istirahat</span>
            <span className={`badge !text-[10px] ${restShowing ? 'bg-emerald-100 text-emerald-700' : rest.enabled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {restShowing ? 'Sedang tampil di TV' : rest.enabled ? 'Terjadwal' : 'Nonaktif'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Cukup upload gambar 1x — gambar tersimpan permanen dan otomatis tampil di Display TV pada jam istirahat (panel antrean & ticker tetap jalan). Tab <b>Jumat</b> untuk jadwal + gambar khusus Sholat Jumat.</p>
          <div className="flex rounded-xl bg-slate-100 p-1 mt-3" role="tablist" aria-label="Jadwal istirahat">
            {[{ id: 'daily', label: 'Harian' }, { id: 'friday', label: 'Jumat' }].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={restTab === t.id}
                onClick={() => setRestTab(t.id)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${restTab === t.id ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleRestSave} className="space-y-2.5 mt-3">
            {restTab === 'friday' ? (
            <>
            <Field label="Status Jumat">
              <select className="input" value={(rest.friday || {}).enabled !== false ? '1' : '0'} onChange={(e) => setRestFriday({ enabled: e.target.value === '1' })}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif (ikut Harian)</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Jam Mulai"><input type="time" className="input" value={(rest.friday || {}).start || '11:30'} onChange={(e) => setRestFriday({ start: e.target.value })} /></Field>
              <Field label="Jam Selesai"><input type="time" className="input" value={(rest.friday || {}).end || '13:30'} onChange={(e) => setRestFriday({ end: e.target.value })} /></Field>
            </div>
            <Field label={(rest.friday || {}).image && !restFridayFile ? `Ganti gambar Jumat (opsional — kosongkan bila tetap pakai yang tersimpan, maks ${maxRestMB}MB)` : `Gambar Jumat (maks ${maxRestMB}MB)`}><input key={restFridayKey} type="file" accept="image/*" onChange={(e) => onRestFile(e, 'friday')} className="input" /></Field>
            {(rest.friday || {}).image && !restFridayFile && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">✓ Gambar Jumat tersimpan — tidak perlu upload ulang. Ganti jam lalu Simpan saja.</div>
            )}
            {!(rest.friday || {}).image && !restFridayFile && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-500">Belum ada gambar Jumat — hari Jumat ikut jadwal Harian.</div>
            )}
            {restFridayFile && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                Gambar Jumat baru dipilih — klik Simpan untuk mengganti yang tersimpan.
                <button type="button" onClick={() => { setRestFridayFile(null); restFridayFileRef.current = null; setRestFridayPreview((rest.friday || {}).image ? imageUrl(rest.friday.image) : ''); setRestFridayKey((k) => k + 1) }} className="ml-2 underline font-bold">Batalkan</button>
              </div>
            )}
            {restFridayPreview && <img src={restFridayPreview} alt="pratinjau istirahat Jumat" className="rounded-xl max-h-64 mx-auto" />}
            </>
            ) : (
            <>
            <Field label="Status">
              <select className="input" value={rest.enabled ? '1' : '0'} onChange={(e) => setRest({ ...rest, enabled: e.target.value === '1' })}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Jam Mulai"><input type="time" className="input" value={rest.start} onChange={(e) => setRest({ ...rest, start: e.target.value })} /></Field>
              <Field label="Jam Selesai"><input type="time" className="input" value={rest.end} onChange={(e) => setRest({ ...rest, end: e.target.value })} /></Field>
            </div>
            <Field label={rest.image && !restFile ? `Ganti gambar (opsional — kosongkan bila tetap pakai yang tersimpan, maks ${maxRestMB}MB)` : `Gambar (maks ${maxRestMB}MB)`}><input key={restKey} type="file" accept="image/*" onChange={(e) => onRestFile(e, 'daily')} className="input" /></Field>
            {rest.image && !restFile && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">✓ Gambar tersimpan — tidak perlu upload ulang. Ganti jam lalu Simpan saja.</div>
            )}
            {restFile && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                Gambar baru dipilih — klik Simpan untuk mengganti yang tersimpan.
                <button type="button" onClick={() => { setRestFile(null); restFileRef.current = null; setRestPreview(rest.image ? imageUrl(rest.image) : ''); setRestKey((k) => k + 1) }} className="ml-2 underline font-bold">Batalkan</button>
              </div>
            )}
            {restPreview && <img src={restPreview} alt="pratinjau istirahat" className="rounded-xl max-h-64 mx-auto" />}
            </>
            )}
            <button disabled={restSaving} className="btn-primary w-full !py-2.5 !rounded-lg !text-[13px]">{restSaving ? 'Menyimpan…' : 'Simpan Notifikasi Istirahat'}</button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}
