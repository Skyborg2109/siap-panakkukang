import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, History, Settings, Search,
  Volume2, Check, ChevronsRight, FileText, RotateCcw, Pencil, Megaphone,
} from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import {
  getTodayQueueList, skipQueue,
  completeQueue, setStatus, resetToday, callDirect, callDirectMany, callNext,
  parseQueueNumbers,
} from '../../services/queueService.js'
import { getServices } from '../../services/masterService.js'
import { callKKCase, sendBroadcast, getRestConfig, saveRestConfig, uploadRestImage, deleteRestImage, imageUrl } from '../../services/displayService.js'
import { isSupabaseConfigured } from '../../lib/supabase.js'
import { quotaFor, isNameCallService, isSingleCallService } from '../../lib/constants.js'
import { hasRealName, getTodayResetAt, markCallLock, callLockRemaining } from '../../utils/queue.js'
import { isRestNow, makeQueueNumber } from '../../utils/date.js'
import { Modal, Field } from '../../components/ui/ui.jsx'

const menu = [
  { to: '/petugas/queue', label: 'Panel Pelayanan', icon: <LayoutDashboard size={17} /> },
  { to: '/petugas/history', label: 'Riwayat Hari Ini', icon: <History size={17} /> },
  { to: '/petugas/profile', label: 'Pengaturan Profil', icon: <Settings size={17} /> },
]

// Warna khas per layanan: KTP oranye, REKAM biru, IKD hijau
const PALETTE = {
  orange: {
    badge: 'bg-orange-500', text: 'text-orange-600', dot: 'bg-orange-500',
    btn: 'bg-orange-600 hover:bg-orange-700',
    pill: 'bg-orange-50 text-orange-700 border-orange-200', ring: 'ring-orange-500 border-orange-400',
  },
  blue: {
    badge: 'bg-blue-600', text: 'text-blue-700', dot: 'bg-blue-600',
    btn: 'bg-blue-700 hover:bg-blue-800',
    pill: 'bg-blue-50 text-blue-700 border-blue-200', ring: 'ring-blue-500 border-blue-400',
  },
  green: {
    badge: 'bg-emerald-600', text: 'text-emerald-700', dot: 'bg-emerald-500',
    btn: 'bg-emerald-600 hover:bg-emerald-700',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', ring: 'ring-emerald-500 border-emerald-400',
  },
  violet: {
    badge: 'bg-violet-600', text: 'text-violet-700', dot: 'bg-violet-500',
    btn: 'bg-violet-600 hover:bg-violet-700',
    pill: 'bg-violet-50 text-violet-700 border-violet-200', ring: 'ring-violet-500 border-violet-400',
  },
  rose: {
    badge: 'bg-rose-500', text: 'text-rose-600', dot: 'bg-rose-500',
    btn: 'bg-rose-600 hover:bg-rose-700',
    pill: 'bg-rose-50 text-rose-700 border-rose-200', ring: 'ring-rose-500 border-rose-400',
  },
  cyan: {
    badge: 'bg-cyan-600', text: 'text-cyan-700', dot: 'bg-cyan-500',
    btn: 'bg-cyan-600 hover:bg-cyan-700',
    pill: 'bg-cyan-50 text-cyan-700 border-cyan-200', ring: 'ring-cyan-500 border-cyan-400',
  },
}
const FALLBACK = ['violet', 'rose', 'cyan']

function colorFor(service, index) {
  const p = (service.prefix || '').toUpperCase()
  if (p === 'KTP') return PALETTE.orange
  if (p === 'REKAM') return PALETTE.blue
  if (p === 'IKD') return PALETTE.green
  if (p === 'KKO') return PALETTE.violet
  if (p === 'KKB') return PALETTE.rose
  return PALETTE[FALLBACK[index % FALLBACK.length]]
}

// Batasi query 20 dtk: backend yang menggantung (mis. database bermasalah)
// tidak boleh membuat panel stuck "Memuat..." selamanya
function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export default function PetugasQueue() {
  const [queues, setQueues] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [selected, setSelected] = useState({})
  const [kkOpen, setKkOpen] = useState(false)
  const [kkName, setKkName] = useState('')
  const [kkNote, setKkNote] = useState('')
  const [bcOpen, setBcOpen] = useState(false)
  const [bcMessage, setBcMessage] = useState('')
  const [specOpen, setSpecOpen] = useState(null)
  const [specificNum, setSpecificNum] = useState('')
  const [directName, setDirectName] = useState('')
  // Error submit "Panggil Nomor" wajib tampil DI DALAM modal — banner flash()
  // di atas halaman tertutup overlay modal sehingga kegagalan tampak "sunyi".
  const [specErr, setSpecErr] = useState(null)
  // Konfirmasi penyelesaian saat nomor BARU diminta selagi masih ada aktif:
  // { raw, numbers } — tombol Selesaikan/Lewati & panggil memanggil
  // handleDirect(null, completeQueue|skipQueue).
  const [specPending, setSpecPending] = useState(null)
  const openSpec = (svc, num = '', name = '') => { dismissNotice(); setSpecOpen(svc); setSpecificNum(num); setDirectName(name); setSpecErr(null); setSpecPending(null) }
  const [editOpen, setEditOpen] = useState(null)
  const [editName, setEditName] = useState('')
  // Notifikasi istirahat Display TV (gambar + jam tampil) — dikelola dari
  // panel ini agar petugas jaga bisa menyalakan/mematikan langsung.
  const [rest, setRest] = useState({ enabled: false, start: '12:00', end: '13:00', image: '' })
  const [restFile, setRestFile] = useState(null)
  const [restPreview, setRestPreview] = useState('')
  const [restKey, setRestKey] = useState(0)
  const [restSaving, setRestSaving] = useState(false)
  const restFileRef = useRef(null)
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)
  // Konfirmasi hasil Selesai/Berikutnya (nomor apa → otomatis memanggil nomor apa)
  const flash = (text, tone = 'ok') => {
    setNotice({ text, tone })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 6000)
  }
  // Banner lama wajib dibuang setiap popup dibuka — kalau tidak, sisa banner
  // dari aksi sebelumnya (mis. Ulangi yang terblokir) tertinggal di belakang
  // overlay modal dan tampak seperti notifikasi yang tak terbaca.
  const dismissNotice = () => { clearTimeout(noticeTimer.current); setNotice(null) }
  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  // Kuota kupon fisik per layanan per hari — dihitung dari baris yang terbit
  // SETELAH reset terakhir hari ini, agar progress bar ikut nol saat reset.
  const issuedOf = (serviceId) => {
    const since = getTodayResetAt()
    return queues.filter((q) => q.service_id === serviceId && (!since || (q.created_at || '') >= since)).length
  }

  const refresh = useCallback(async () => {
    try {
      const [q, s] = await Promise.all([
        withTimeout(getTodayQueueList()),
        withTimeout(getServices()),
      ])
      setQueues(q)
      setServices(s)
      setLoadError(null)
    } catch (e) {
      console.error(e)
      setLoadError('Server tidak merespons. Periksa status project Supabase, lalu coba lagi.')
    }
    finally { setLoading(false) }
  }, [])

  const retry = () => {
    setLoadError(null)
    setLoading(true)
    refresh()
  }

  useEffect(() => {
    refresh()
    const onCh = () => refresh()
    window.addEventListener('siap:queues-changed', onCh)
    window.addEventListener('storage', onCh)
    const t = setInterval(refresh, 3000)
    return () => { clearInterval(t); window.removeEventListener('siap:queues-changed', onCh); window.removeEventListener('storage', onCh) }
  }, [refresh])

  // Muat konfigurasi istirahat sekali saat dibuka (+ saat ada perubahan dari
  // tab lain). Sengaja TIDAK ikut polling 3 dtk agar ketikan/gambar yang
  // sedang diubah petugas tidak tertimpa saat mengetik jam.
  useEffect(() => {
    let on = true
    const loadRest = async () => {
      try {
        const r = await getRestConfig()
        if (!on) return
        setRest(r)
        if (!restFileRef.current) setRestPreview(r.image ? imageUrl(r.image) : '')
      } catch { /* abaikan */ }
    }
    loadRest()
    const onMaster = () => loadRest()
    window.addEventListener('siap:master-changed', onMaster)
    window.addEventListener('storage', onMaster)
    return () => { on = false; window.removeEventListener('siap:master-changed', onMaster); window.removeEventListener('storage', onMaster) }
  }, [])

  // Jenis antrean aktif dari master (KTP, Perekaman, IKD, KK Online, KK Biasa, …)
  const visibleServices = services

  const activeByService = useMemo(() => {
    const map = {}
    visibleServices.forEach((s) => {
      map[s.id] = queues
        .filter((q) => q.service_id === s.id && ['CALLED', 'SERVING'].includes(q.status))
        .sort((a, b) => new Date(b.called_at || b.updated_at) - new Date(a.called_at || a.updated_at))
    })
    return map
  }, [queues, visibleServices])

  const targetOf = (serviceId) => {
    const list = activeByService[serviceId] || []
    const sel = list.find((q) => q.id === selected[serviceId])
    return sel || list[0] || null
  }

  // Pesan error jadi teks banner dalam aplikasi (bukan alert()) — browser
  // TV/kios sering memblokir dialog alert sehingga kegagalan tampak "sunyi".
  const errText = (e) => {
    const m = e?.message || 'Operasi gagal.'
    if (/timeout/i.test(m)) return 'Server tidak merespons dalam 20 detik. Periksa koneksi & status project Supabase, lalu coba lagi.'
    return m
  }

  const runOn = async (key, id, fn) => {
    setBusy(key)
    try { await withTimeout(fn(), 20000); await refresh() } catch (e) { flash(errText(e), 'warn') }
    finally { setBusy(null) }
  }

  // Kunci anti-tumpang pengumuman: tolak panggilan baru (siapa pun, termasuk
  // diri sendiri) bila ada panggilan yang pengumumannya kemungkinan masih
  // berbunyi — lihat callLockRemaining (kunci instan + called_at server).
  const callLockMsg = () => {
    const remaining = callLockRemaining(queues)
    return remaining > 0 ? `Sedang ada pemanggilan berlangsung. Silakan coba lagi ±${remaining} detik.` : null
  }

  // Ulangi: batch serentak dipanggil ulang SEMUA sekaligus dengan satu
  // called_at bersama agar Display tetap mengelompokkannya (chip tak bisa
  // dipilih satuan, jadi tidak ada "recall satu nomor" di mode batch).
  const recallTarget = async (svc) => {
    const actives = activeByService[svc.id] || []
    const target = targetOf(svc.id)
    if (!target) return
    const lockMsg = callLockMsg()
    if (lockMsg) return flash(lockMsg, 'warn')
    const now = new Date().toISOString()
    const list = actives.length > 1 ? actives : [target]
    setBusy(`recall-${svc.id}`)
    try {
      await withTimeout(Promise.all(list.map((q) => setStatus(q.id, 'CALLED', { called_at: now }))), 20000)
      markCallLock()
      await refresh()
    } catch (e) { flash(errText(e), 'warn') }
    finally { setBusy(null) }
  }

  // Berikutnya → selesaikan nomor aktif lalu langsung panggil nomor
  // berikutnya (tertinggi dari batch aktif + 1) DARI JENIS YANG SAMA dengan
  // kartu yang tombolnya ditekan.
  // Kupon fisik: nomor berikut dibuatkan otomatis bila belum terdaftar
  // (callDirect), atau dipanggil ulang bila sudah ada.
  // Nomor aktif selalu ditandai COMPLETED — tidak ada tombol Selesai
  // terpisah; SKIPPED hanya dari "Lewati & panggil" di modal Panggil Nomor.
  // `nextName` opsional dari popup konfirmasi Berikutnya ('' = tanpa nama).
  const finishAndCallNext = async (svc, key, finishFn, verb, nextName = '') => {
    const actives = activeByService[svc.id] || []
    const target = targetOf(svc.id)
    if (!target) return
    setBusy(key)
    try {
      // Batch serentak (>1 nomor aktif): chip tidak bisa dipilih satuan, jadi
      // Berikutnya menghabiskan SEMUA nomor aktif sekaligus (COMPLETED), lalu
      // fokus pindah ke nomor berikutnya.
      const multi = actives.length > 1
      const done = multi ? actives : [target]
      // Nomor berikut = sequence TERTINGGI dari batch yang dihabiskan + 1.
      const batchSeqs = done
        .map((q) => Number(q.sequence))
        .filter((n) => Number.isFinite(n))
      const baseSeq = batchSeqs.length ? Math.max(...batchSeqs) : Number(target.sequence)
      const doneLabel = multi ? `${done.length} nomor (${done.map((q) => q.number).join(', ')})` : target.number
      await withTimeout(Promise.all(done.map((q) => finishFn(q.id))), 20000)
      let next = null
      if (Number.isFinite(baseSeq)) {
        try {
          next = await withTimeout(callDirect({ service: svc, number: `${svc.prefix}-${baseSeq + 1}`, name: nextName }), 20000)
        } catch (e) {
          // Kuota habis → nomor aktif tetap diselesaikan, tanpa panggil berikutnya
          if (!/kuota/i.test(e.message || '')) throw e
          flash(`${doneLabel} ${verb}. Kuota ${svc.name} hari ini sudah penuh.`, 'warn')
        }
      } else {
        next = await withTimeout(callNext({ serviceIds: [svc.id] }), 20000)
      }
      if (next) {
        setSelected((prev) => ({ ...prev, [svc.id]: next.id }))
        markCallLock()
        flash(`${doneLabel} ${verb}. Otomatis memanggil ${next.number} (${svc.name}).`)
      }
      await refresh()
    } catch (e) { flash(errText(e), 'warn') }
    finally { setBusy(null) }
  }

  // Panggil nomor kupon langsung + nama warga opsional (satu nomor).
  // Perekaman KTP: panggil berbasis NAMA saja — nomor tidak diketik,
  // dibuat otomatis berurutan (handleDirect menghitung max+1).
  // Beberapa nomor sekaligus: pisah koma ("5,6,7") atau rentang ("5-8") —
  // dibuatkan sesuai kupon berurutan menaik lalu dipanggil serentak.
  // Anti-menumpuk: nomor BARU (mis. KTP-24 saat KTP-23 aktif) hanya bisa
  // dipanggil setelah nomor aktif diselesaikan — pilih Selesaikan atau Lewati
  // pada kotak konfirmasi di modal (atau via tombol Selesai/Berikutnya di
  // kartu kiri). Panggil ulang nomor yang sudah aktif langsung jalan tanpa
  // konfirmasi (semua nomor yang diminta sudah aktif = recall via chip).
  // KTP & Perekaman KTP: satu nomor per panggilan (isSingleCallService).
  // Perekaman KTP: panggil berbasis nama — nama wajib & satu nama per panggilan.
  const handleDirect = async (e, finishFn) => {
    if (e && e.preventDefault) e.preventDefault()
    const svc = specOpen
    // specFail: tampilkan di dalam modal (selalu terlihat) + banner global
    const specFail = (msg) => { setSpecErr(msg); flash(msg, 'warn') }
    if (!svc) { setSpecPending(null); return specFail('Pilih layanan dulu.') }
    // Pemanggilan tab lain sedang berlangsung → minta coba lagi nanti.
    // Dilewati bila petugas sudah menekan Selesaikan/Lewati & panggil
    // (keputusan eksplisit setelah melihat konfirmasi).
    // Khusus pesan kunci: inline saja TANPA flash — banner flash tertutup
    // overlay modal sehingga tak terbaca (jalur Ulangi tanpa modal tetap flash).
    if (typeof finishFn !== 'function') {
      const lockMsg = callLockMsg()
      if (lockMsg) { setSpecPending(null); setSpecErr(lockMsg); return }
    }
    const nameCall = isNameCallService(svc)
    // Perekaman KTP dipanggil berbasis NAMA saja: nomor tidak diketik,
    // dibuat otomatis berurutan (max sequence hari ini + 1) di belakang layar.
    const freshNameCall = nameCall && !specificNum.trim()
    let numbers
    if (freshNameCall) {
      if (directName.trim().length < 3) { setSpecPending(null); return specFail('Masukkan nama warga (minimal 3 huruf) — nama yang tampil di monitor & diumumkan.') }
      const seqs = queues.filter((q) => q.service_id === svc.id).map((q) => Number(q.sequence)).filter((n) => Number.isFinite(n))
      const seq = (seqs.length ? Math.max(...seqs) : 0) + 1
      numbers = [makeQueueNumber((svc.prefix || '').toUpperCase(), seq)]
    } else {
      if (!specificNum.trim()) { setSpecPending(null); return specFail('Masukkan nomor antrean.') }
      try {
        numbers = parseQueueNumbers(svc, specificNum)
      } catch (err) { setSpecPending(null); return specFail(errText(err)) }
    }
    if (nameCall && numbers.length > 1) { setSpecPending(null); return specFail('Perekaman KTP dipanggil satu nama per panggilan — masukkan satu nomor saja.') }
    if (numbers.length > 1 && isSingleCallService(svc)) { setSpecPending(null); return specFail(`${svc.prefix || svc.name} hanya satu nomor per panggilan — masukkan satu nomor saja.`) }
    if (nameCall) {
      if (directName.trim().length < 3) { setSpecPending(null); return specFail('Untuk Perekaman KTP, nama wajib diisi (minimal 3 huruf) — nama yang tampil di monitor & diumumkan.') }
    }
    // Nomor baru selagi masih ada nomor aktif → minta konfirmasi penyelesaian
    // dulu (cegah penumpukan seperti KTP-13..KTP-22 aktif bersamaan).
    const actives = activeByService[svc.id] || []
    const sortBySeq = (a, b) => (a.sequence || 0) - (b.sequence || 0)
    if (actives.length > 0) {
      const activeNums = new Set(actives.map((q) => String(q.number || '').toUpperCase()))
      const hasNew = numbers.some((n) => !activeNums.has(String(n).toUpperCase()))
      if (hasNew && typeof finishFn !== 'function') {
        setSpecPending({ raw: freshNameCall ? numbers[0] : specificNum, numbers })
        setSpecErr(null)
        return
      }
    }
    setSpecPending(null)
    setSpecErr(null)
    setBusy(`direct-${svc.id}`)
    try {
      // Konfirmasi penyelesaian: habiskan nomor aktif dulu (seperti
      // finishAndCallNext), baru panggil nomor yang diminta.
      let doneMsg = ''
      if (typeof finishFn === 'function' && actives.length > 0) {
        const verb = finishFn === completeQueue ? 'selesai' : 'dilewati'
        const doneLabel = actives.length > 1
          ? `${actives.length} nomor (${[...actives].sort(sortBySeq).map((q) => q.number).join(', ')})`
          : actives[0].number
        await withTimeout(Promise.all(actives.map((q) => finishFn(q.id))), 20000)
        doneMsg = `${doneLabel} ${verb}. `
      }
      const res = await withTimeout(callDirectMany({ service: svc, raw: freshNameCall ? numbers[0] : specificNum, name: directName }), 20000)
      markCallLock()
      if (res.length > 1) {
        setSelected((prev) => ({ ...prev, [svc.id]: res[res.length - 1].id }))
        flash(`${doneMsg}Memanggil ${res.length} nomor sekaligus: ${res.map((r) => r.number).join(', ')} (${svc.name}).`)
      } else if (res.length === 1) {
        setSelected((prev) => ({ ...prev, [svc.id]: res[0].id }))
        if (doneMsg) flash(`${doneMsg}Memanggil ${res[0].number} (${svc.name}).`)
      }
      setSpecOpen(null); setSpecificNum(''); setDirectName(''); setSpecErr(null); setSpecPending(null)
      await refresh()
    } catch (err) { console.error(err); specFail(errText(err)) }
    finally { setBusy(null) }
  }

  const handleKK = async (e) => {
    e.preventDefault()
    if (kkName.trim().length < 3) return flash('Nama minimal 3 huruf.', 'warn')
    try {
      await withTimeout(callKKCase({ name: kkName.trim(), note: kkNote.trim() }), 20000)
      setKkOpen(false); setKkName(''); setKkNote('')
      flash('Panggilan KK dikirim ke Display TV + audio.')
    } catch (err) { flash(errText(err), 'warn') }
  }

  // Pengumuman spontan ke masyarakat (banner + audio di Display TV)
  const handleBroadcast = async (e) => {
    e.preventDefault()
    try {
      await withTimeout(sendBroadcast({ message: bcMessage }), 20000)
      setBcOpen(false); setBcMessage('')
      flash('Pengumuman dikirim ke Display TV + audio.')
    } catch (err) { flash(errText(err), 'warn') }
  }

  const openEdit = (q) => {
    setEditOpen(q)
    setEditName(q.name)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!editOpen || editName.trim().length < 3) return flash('Nama minimal 3 huruf.', 'warn')
    await runOn(`edit-${editOpen.id}`, editOpen.id, () => setStatus(editOpen.id, editOpen.status, { name: editName.trim(), called_at: editOpen.called_at || undefined }))
    setEditOpen(null)
  }

  const handleReset = async () => {
    if (!window.confirm('Reset antrean hari ini? Antrean yang masih aktif (menunggu/dipanggil/dilayani) akan ditandai Dilewati. Riwayat hari ini tetap tersimpan.')) return
    setBusy('reset')
    try { await withTimeout(resetToday(), 20000); setSelected({}); await refresh() } catch (e) { flash(errText(e), 'warn') }
    finally { setBusy(null) }
  }

  const maxRestMB = isSupabaseConfigured ? 5 : 2

  const onRestFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > maxRestMB * 1024 * 1024) return flash(`Gambar maksimal ${maxRestMB}MB.`, 'warn')
    setRestFile(f)
    restFileRef.current = f
    const r = new FileReader()
    r.onload = () => setRestPreview(r.result)
    r.readAsDataURL(f)
  }

  const handleRestSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setRestSaving(true)
    try {
      let image = rest.image
      if (restFile || (restPreview && restPreview.startsWith('data:'))) {
        const path = await withTimeout(uploadRestImage({ file: restFile, base64: restPreview }), 20000)
        // Ganti file lama di Storage agar tak menumpuk (abaikan bila gagal)
        if (isSupabaseConfigured && image && image !== path) deleteRestImage(image).catch(() => {})
        image = path
      }
      if (!image) return flash('Pilih file gambar istirahat dulu.', 'warn')
      const saved = await withTimeout(saveRestConfig({ ...rest, image }), 20000)
      setRest(saved)
      setRestFile(null)
      restFileRef.current = null
      setRestPreview(saved.image ? imageUrl(saved.image) : '')
      setRestKey((k) => k + 1)
      flash(saved.enabled
        ? `Notifikasi istirahat AKTIF (${saved.start}–${saved.end}). Display TV menampilkan gambar istirahat pada jam tersebut.`
        : 'Notifikasi istirahat dinonaktifkan. Display TV kembali ke slideshow biasa.')
    } catch (err) { flash(errText(err), 'warn') }
    finally { setRestSaving(false) }
  }

  // Status live untuk label kartu (render ulang tiap polling 3 dtk)
  const restShowing = rest.enabled && rest.image ? isRestNow(rest, new Date()) : false

  // Nomor aktif di layanan yang modal "Panggil Nomor"-nya sedang terbuka —
  // untuk peringatan anti-menumpuk di dalam modal.
  const specActives = specOpen ? (activeByService[specOpen.id] || []) : []
  const specActivesLabel = [...specActives].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)).map((q) => q.number).join(', ')

  // Popup konfirmasi "Berikutnya": field nama OPSIONAL — petugas tetap bisa
  // memanggil nomor berikutnya walau dikosongkan. Nama yang diisi menjadi
  // nama pemegang nomor berikutnya (ikut tampil di Display + diumumkan).
  const [nextOpen, setNextOpen] = useState(null)
  const [nextName, setNextName] = useState('')
  // Error di popup Berikutnya wajib tampil DI DALAM modal (seperti specErr) —
  // banner flash() tertutup overlay modal sehingga tak terlihat.
  const [nextErr, setNextErr] = useState(null)
  const openNext = (svc) => { dismissNotice(); setNextOpen(svc); setNextName(''); setNextErr(null) }

  // Pratinjau isi popup: nomor yang diselesaikan + nomor yang akan dipanggil.
  const nextPreview = nextOpen ? (() => {
    const actives = activeByService[nextOpen.id] || []
    const seqs = actives.map((q) => Number(q.sequence)).filter((n) => Number.isFinite(n))
    const base = seqs.length ? Math.max(...seqs) : null
    return {
      done: actives.length
        ? [...actives].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)).map((q) => q.number).join(', ')
        : '—',
      next: base != null && nextOpen.prefix ? `${nextOpen.prefix}-${base + 1}` : 'nomor berikutnya',
    }
  })() : null

  const confirmNext = async () => {
    const svc = nextOpen
    if (!svc) return
    // Popup tetap terbuka bila terblokir agar petugas tinggal tekan Panggil lagi.
    // Inline saja tanpa flash (banner-nya tertutup overlay modal).
    const lockMsg = callLockMsg()
    if (lockMsg) { setNextErr(lockMsg); return }
    const name = nextName.trim()
    setNextOpen(null)
    setNextName('')
    setNextErr(null)
    await finishAndCallNext(svc, `next-${svc.id}`, completeQueue, 'selesai', name)
  }

  return (
    <DashboardLayout
      menu={menu}
      title="Dashboard — Kecamatan Panakkukang"
      subtitle="Panggil & kelola seluruh jenis antrean aktif"
    >
      {notice && (
        <div className={`card p-3 mb-4 text-sm font-semibold border flex items-center gap-2 animate-slide-in ${notice.tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${notice.tone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {notice.text}
        </div>
      )}
      <div className="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        {/* Kiri: antrean sedang dilayani */}
        <section className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full bg-orange-500" />
            <h2 className="font-bold text-slate-900">Antrean Sedang Dilayani</h2>
          </div>
          {!loading && !loadError && visibleServices.length > 0 && Object.values(activeByService).every((a) => a.length === 0) && (
            <div className="card p-3 mb-4 text-sm text-slate-600 bg-blue-50/60 border border-blue-100">
              Belum ada nomor yang dipanggil — tombol <b>Ulangi / Berikutnya</b> aktif setelah ada nomor aktif.
              Untuk memanggil, gunakan tombol <b>Panggil Nomor</b> di panel kanan.
            </div>
          )}
          {loading ? (
            <div className="card p-10 text-center text-slate-400">Memuat…</div>
          ) : loadError ? (
            <div className="card p-10 text-center">
              <div className="font-bold text-slate-700">Tidak dapat memuat data.</div>
              <div className="text-sm text-slate-500 mt-1">{loadError}</div>
              <button onClick={retry} className="btn-primary mt-4">Coba Lagi</button>
            </div>
          ) : visibleServices.length === 0 ? (
            <div className="card p-10 text-center text-slate-400">Belum ada jenis antrean aktif. Tambahkan di menu Admin → Layanan.</div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {visibleServices.map((svc, i) => {
                const c = colorFor(svc, i)
                const actives = activeByService[svc.id] || []
                const target = targetOf(svc.id)
                const multi = actives.length > 1
                return (
                  <div key={svc.id} className="card overflow-hidden flex flex-col flex-1 min-w-[230px]">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100">
                      <span className={`badge ${c.badge} text-white !text-[10px] font-mono shrink-0`}>{svc.prefix}</span>
                      <span className="text-[13px] font-bold text-slate-800 flex-1 truncate">{svc.name}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${target ? c.dot : 'bg-slate-300'} shrink-0`} />
                      <button
                        title="Ubah nama antrean aktif"
                        disabled={!target}
                        onClick={() => target && openEdit(target)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                    <div className="px-4 pt-4 pb-3 text-center flex-1 flex flex-col justify-center min-h-[104px]">
                      {!target ? (
                        <>
                          <div className="text-[10px] font-bold tracking-[0.14em] text-slate-400">NOMOR AKTIF</div>
                          <div className="text-2xl font-extrabold text-slate-300 mt-1">—</div>
                        </>
                      ) : multi ? (
                        <>
                          <div className="text-[10px] font-bold tracking-[0.14em] text-slate-400">{actives.length} NOMOR</div>
                          <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
                            {actives.slice(0, 10).map((q) => (
                              // Chip batch: tampilan saja, tidak bisa dipilih satuan —
                              // Selesai/Berikutnya/Ulangi selalu berlaku untuk semuanya.
                              <span
                                key={q.id}
                                title={`a.n. ${q.name}`}
                                className={`rounded-lg border px-2.5 py-1.5 text-[13px] font-extrabold tabular-nums ${c.pill}`}
                              >
                                {q.number}
                              </span>
                            ))}
                            {actives.length > 10 && (
                              <span
                                title={`${actives.length - 10} nomor aktif lainnya — selesaikan antrean agar tidak menumpuk`}
                                className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[13px] font-bold text-slate-500"
                              >
                                +{actives.length - 10} lainnya
                              </span>
                            )}
                          </div>
                        </>
                      ) : isNameCallService(svc) && hasRealName(target.name) ? (
                        <>
                          <div className="text-[10px] font-bold tracking-[0.14em] text-slate-400">NAMA DIPANGGIL</div>
                          <div className={`text-[28px] leading-9 font-extrabold mt-0.5 break-words ${c.text}`}>{String(target.name).trim()}</div>
                          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">{target.number}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[10px] font-bold tracking-[0.14em] text-slate-400">NOMOR AKTIF</div>
                          <div className={`text-[34px] leading-10 font-extrabold tabular-nums mt-0.5 ${c.text}`}>{target.number}</div>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      <button
                        disabled={!target || busy === `recall-${svc.id}`}
                        onClick={() => recallTarget(svc)}
                        className="btn-secondary !px-2 !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Volume2 size={14} /> Ulangi
                      </button>
                      <button
                        disabled={!target || busy === `next-${svc.id}`}
                        onClick={() => target && openNext(svc)}
                        title="Selesaikan nomor aktif & panggil nomor berikutnya"
                        className="btn-success !px-2 !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronsRight size={14} /> Berikutnya
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Kanan: panggil antrean */}
        <aside className="min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1 h-5 rounded-full bg-slate-800" />
            <h2 className="font-bold text-slate-900">Panggil Antrean</h2>
          </div>
          <div className="space-y-4">
            {visibleServices.map((svc, i) => {
              const c = colorFor(svc, i)
              const quota = quotaFor(svc)
              const issued = issuedOf(svc.id)
              const full = issued >= quota
              // Nomor yang sudah dipanggil pada RONDE ini (acuan panggil ulang) —
              // aktif (CALLED/SERVING) + yang sudah selesai (COMPLETED), agar
              // semua nomor yang pernah dipanggil tampil sebagai chip.
              // SKIPPED dikecualikan, DAN hanya baris yang tersentuh setelah
              // reset terakhir hari ini (create/called/update >= siap_reset_at)
              // yang tampil — resetToday() hanya menandai WAITING/CALLED/SERVING
              // jadi SKIPPED (COMPLETED ikut tersisa), sehingga tanpa filter
              // ronde ini chip COMPLETED tetap tampil setelah reset.
              // Nomor lama tetap bisa dipanggil ulang manual via "Panggil Nomor";
              // begitu dipanggil ulang (called_at/updated_at baru) chip-nya
              // muncul lagi di ronde ini.
              const resetSince = getTodayResetAt()
              const inRound = (q) => !resetSince
                || (q.created_at || '') >= resetSince
                || (q.called_at || '') >= resetSince
                || (q.updated_at || '') >= resetSince
              const handled = queues
                .filter((q) => q.service_id === svc.id && ['CALLED', 'SERVING', 'COMPLETED'].includes(q.status) && inRound(q))
                .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
              return (
                <div key={svc.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${c.badge} text-white !text-[10px] font-mono shrink-0`}>{svc.prefix}</span>
                    <span className="text-[13px] font-semibold text-slate-700 flex-1 truncate">{svc.name}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2" title={getTodayResetAt() ? `Kupon terbit ${issued} dari ${quota} (ronde ini, setelah reset)` : `Kupon terbit ${issued} dari ${quota} hari ini`}>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${full ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (issued / quota) * 100)}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${full ? 'text-rose-600' : 'text-slate-500'}`}>{full ? 'Kuota penuh' : `${issued}/${quota}`}</span>
                  </div>
                  <button
                    onClick={() => openSpec(svc)}
                    title={isNameCallService(svc) ? 'Panggil nama warga' : 'Panggil nomor kupon'}
                    className={`btn ${c.btn} text-white w-full !py-2.5 !rounded-lg !text-[13px] mt-2`}
                  >
                    <Search size={15} /> {isNameCallService(svc) ? 'Panggil Nama' : 'Panggil Nomor'}
                  </button>
                  {handled.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 mb-1.5">SUDAH DIPANGGIL ({handled.length}) — KLIK UNTUK PANGGIL ULANG</div>
                      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                        {handled.map((q) => (
                          <button
                            key={q.id}
                            title={`${q.number}${hasRealName(q.name) ? ` a.n. ${String(q.name).trim()}` : ''} — klik untuk panggil ulang`}
                            onClick={() => openSpec(svc, q.number, isNameCallService(svc) && hasRealName(q.name) ? String(q.name).trim() : '')}
                            className={`rounded-md border px-2 py-1 text-[11px] font-extrabold tabular-nums transition hover:ring-2 ${c.pill} ${c.ring}`}
                          >
                            {q.number}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div className="card p-4 space-y-3">
              <button onClick={() => setKkOpen(true)} className="btn w-full !py-2.5 !rounded-lg !text-[13px] bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 font-semibold">
                <FileText size={15} /> Kasus KK / Konsultasi
              </button>
              <button onClick={() => setBcOpen(true)} className="btn w-full !py-2.5 !rounded-lg !text-[13px] bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 font-semibold">
                <Megaphone size={15} /> Pengumuman ke Masyarakat
              </button>
            </div>
          </div>
          <div className="card p-4 mt-4">
            <button
              disabled={busy === 'reset'}
              onClick={handleReset}
              className="btn w-full !py-2.5 !rounded-lg !text-[13px] bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-semibold"
            >
              <RotateCcw size={15} /> {busy === 'reset' ? 'Mereset…' : 'Reset Antrean Hari Ini'}
            </button>
          </div>
          <div className="card p-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-slate-800 flex-1">Notifikasi Istirahat</span>
              <span className={`badge !text-[10px] ${restShowing ? 'bg-emerald-100 text-emerald-700' : rest.enabled ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {restShowing ? 'Sedang tampil di TV' : rest.enabled ? 'Terjadwal' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Gambar ini menggantikan slideshow kiri Display TV selama jam istirahat (panel antrean & ticker tetap jalan).</p>
            <form onSubmit={handleRestSave} className="space-y-2.5 mt-3">
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
              <Field label={`Gambar (maks ${maxRestMB}MB)`}><input key={restKey} type="file" accept="image/*" onChange={onRestFile} className="input" /></Field>
              {restPreview && <img src={restPreview} alt="pratinjau istirahat" className="rounded-xl max-h-40 mx-auto" />}
              <button disabled={restSaving} className="btn-primary w-full !py-2.5 !rounded-lg !text-[13px]">{restSaving ? 'Menyimpan…' : 'Simpan Notifikasi Istirahat'}</button>
            </form>
          </div>
        </aside>
      </div>

      {/* Modal: konfirmasi Berikutnya + nama opsional nomor berikutnya */}
      <Modal open={!!nextOpen} onClose={() => { setNextOpen(null); setNextErr(null) }} title={`Panggil Berikutnya — ${nextOpen?.name || ''}`}>
        <form onSubmit={(e) => { e.preventDefault(); confirmNext() }} className="space-y-3">
          <p className="text-sm text-slate-500">
            Menyelesaikan <b className="text-slate-700">{nextPreview?.done}</b> lalu memanggil <b className="text-slate-700">{nextPreview?.next}</b>.
          </p>
          {nextErr && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-semibold text-rose-700">{nextErr}</div>
          )}
          {/* IKD diumumkan nomor saja (tanpa nama) — field nama disembunyikan seperti di Panggil Nomor */}
          {nextOpen && (nextOpen.prefix || '').toUpperCase() !== 'IKD' && (
            <Field label="Nama Warga (opsional — kosongkan bila tanpa nama)">
              <input
                className="input"
                value={nextName}
                onChange={(e) => setNextName(e.target.value)}
                placeholder="cth: Andi Pratama"
                maxLength={60}
                autoFocus
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setNextOpen(null)} className="btn-secondary w-full">Batal</button>
            {/* type=button + onClick (bukan andalkan submit form): konsisten dengan
                modal Panggil Nomor yang submit-nya pernah terbukti tidak sampai. */}
            <button type="button" onClick={confirmNext} className="btn-success w-full" disabled={busy === `next-${nextOpen?.id}`}><ChevronsRight size={15} /> {busy === `next-${nextOpen?.id}` ? 'Memanggil…' : 'Panggil'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: panggil nomor kupon langsung (REKAM: panggil nama saja) */}
      <Modal open={!!specOpen} onClose={() => setSpecOpen(null)} title={`Panggil ${specOpen && isNameCallService(specOpen) ? 'Nama' : 'Nomor'} — ${specOpen?.name || ''}`}>
        <form onSubmit={handleDirect} className="space-y-3">
          {specOpen && isNameCallService(specOpen) ? (
            <p className="text-sm text-slate-500">Cukup masukkan <b className="text-slate-700">nama warga</b> di bawah — nomor antrean dibuat otomatis berurutan dan tidak perlu diketik. Nama yang tampil di monitor & diumumkan via audio (satu nama per panggilan).</p>
          ) : (
            <p className="text-sm text-slate-500">Satu nomor (cth: {specOpen ? `${specOpen.prefix}-5` : 'KTP-5'} atau cukup 5) atau beberapa sekaligus: pisahkan dengan koma (cth: 5,6,7) atau rentang (cth: 5-8, maks 10 nomor). Nomor yang belum terdaftar dibuat otomatis lalu dipanggil serentak. Nomor mana pun boleh dipanggil langsung, termasuk yang terlewati.</p>
          )}
          {specActives.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-800">
              Masih aktif: {specActivesLabel} — nomor baru akan meminta konfirmasi penyelesaian dulu. Nomor aktif yang sama tetap bisa dipanggil ulang langsung.
            </div>
          )}
          {specPending && (specPending.raw === specificNum || (specOpen && isNameCallService(specOpen) && !specificNum.trim())) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800 space-y-2">
              <div className="font-semibold">Masih aktif: {specActivesLabel}. Panggil {specOpen && isNameCallService(specOpen) ? <>atas nama <b>{directName.trim() || '—'}</b></> : specPending.numbers.join(', ')} sebagai berikutnya?</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleDirect(null, completeQueue)} disabled={busy === `direct-${specOpen?.id}`} className="btn-success !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><Check size={14} /> Selesaikan & panggil</button>
                <button type="button" onClick={() => handleDirect(null, skipQueue)} disabled={busy === `direct-${specOpen?.id}`} className="btn-secondary !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"><ChevronsRight size={14} /> Lewati & panggil</button>
              </div>
            </div>
          )}
          {specErr && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-semibold text-rose-700">{specErr}</div>
          )}
          {/* REKAM panggil baru: nomor disembunyikan (otomatis). REKAM panggil
              ulang via chip: nomor tampil terkunci + nama terisi (bisa diubah). */}
          {specOpen && isNameCallService(specOpen) && !specificNum.trim() ? null : (
          <Field label={specOpen && isNameCallService(specOpen) ? 'Nomor Antrean (panggil ulang)' : 'Nomor Antrean *'}>
            <input
              className="input font-mono"
              value={specificNum}
              onChange={(e) => setSpecificNum(e.target.value)}
              placeholder={specOpen ? `${specOpen.prefix}-5,6,7 atau 5-8` : 'KTP-5,6,7 atau 5-8'}
              readOnly={!!(specOpen && isNameCallService(specOpen))}
              disabled={!!(specOpen && isNameCallService(specOpen))}
            />
          </Field>
          )}
          {/* IKD: hanya input nomor, tanpa nama. REKAM: nama wajib (identitas panggilan) */}
          {(specOpen?.prefix || '').toUpperCase() !== 'IKD' && (
            <Field label={specOpen && isNameCallService(specOpen) ? 'Nama Warga * (tampil di monitor & diumumkan)' : 'Nama Warga (opsional, hanya untuk 1 nomor)'}>
              <input
                className="input"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="cth: Andi Pratama"
                maxLength={60}
                autoFocus={!!(specOpen && isNameCallService(specOpen) && !specificNum.trim())}
              />
            </Field>
          )}
          {/* type=button + onClick (bukan andalkan submit form): event submit
              pernah terbukti tidak sampai di browser lapangan, sementara klik biasa jalan. */}
          <button type="button" onClick={handleDirect} className="btn-primary w-full" disabled={busy === `direct-${specOpen?.id}`}><Search size={16} /> {busy === `direct-${specOpen?.id}` ? 'Memanggil…' : 'Panggil Sekarang'}</button>
        </form>
      </Modal>

      {/* Modal: ubah nama antrean aktif */}
      <Modal open={!!editOpen} onClose={() => setEditOpen(null)} title={`Ubah Nama — ${editOpen?.number || ''}`}>
        <form onSubmit={handleEdit} className="space-y-3">
          <Field label="Nama Pemegang Nomor">
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} />
          </Field>
          <button className="btn-primary w-full"><Pencil size={15} /> Simpan Perubahan</button>
        </form>
      </Modal>

      {/* Modal KK */}
      <Modal open={kkOpen} onClose={() => setKkOpen(false)} title="Panggil Kasus KK (tanpa nomor)">
        <form onSubmit={handleKK} className="space-y-3">
          <p className="text-sm text-slate-500">Untuk berkas KK belum lengkap / konsultasi ulang (BR-09: KK tidak memakai nomor antrean).</p>
          <Field label="Nama pada KK *">
            <input className="input" value={kkName} onChange={(e) => setKkName(e.target.value)} placeholder="cth: Budi Santoso" />
          </Field>
          <Field label="Catatan">
            <textarea className="input" rows={3} value={kkNote} onChange={(e) => setKkNote(e.target.value)} placeholder="Berkas belum lengkap, silakan masuk ke ruang pelayanan…" />
          </Field>
          <button className="btn-warning w-full"><Megaphone size={16} /> Kirim ke Display + Audio</button>
        </form>
      </Modal>

      {/* Modal pengumuman spontan ke masyarakat */}
      <Modal open={bcOpen} onClose={() => setBcOpen(false)} title="Pengumuman ke Masyarakat">
        <form onSubmit={handleBroadcast} className="space-y-3">
          <p className="text-sm text-slate-500">Tampil sebagai banner + dibacakan audio di Display TV (±20 detik). Untuk info dadakan, mis. jeda pelayanan atau imbauan.</p>
          <Field label="Isi Pengumuman *">
            <textarea className="input" rows={3} value={bcMessage} onChange={(e) => setBcMessage(e.target.value)} placeholder="cth: Pelayanan IKD jeda 15 menit, harap menunggu." maxLength={300} />
          </Field>
          <button className="btn-primary w-full"><Megaphone size={16} /> Kirim ke Display + Audio</button>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
