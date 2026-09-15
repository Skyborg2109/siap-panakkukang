import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, History, Settings, Search,
  Volume2, Check, ChevronsRight, FileText, RotateCcw, Pencil, Megaphone,
} from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import {
  getTodayQueueList, recallQueue, skipQueue,
  completeQueue, setStatus, resetToday, callDirect, callDirectMany, callNext,
  parseQueueNumbers,
} from '../../services/queueService.js'
import { getServices } from '../../services/masterService.js'
import { callKKCase, sendBroadcast } from '../../services/displayService.js'
import { quotaFor, isNameCallService } from '../../lib/constants.js'
import { hasRealName } from '../../utils/queue.js'
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
  const openSpec = (svc, num = '') => { setSpecOpen(svc); setSpecificNum(num); setDirectName(''); setSpecErr(null) }
  const [editOpen, setEditOpen] = useState(null)
  const [editName, setEditName] = useState('')
  const [notice, setNotice] = useState(null)
  const noticeTimer = useRef(null)

  // Konfirmasi hasil Selesai/Berikutnya (nomor apa → otomatis memanggil nomor apa)
  const flash = (text, tone = 'ok') => {
    setNotice({ text, tone })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 6000)
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  // Kuota kupon fisik per layanan per hari
  const issuedOf = (serviceId) => queues.filter((q) => q.service_id === serviceId).length

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

  // Selesai / Berikutnya → langsung panggil nomor berikutnya (seq + 1)
  // DARI JENIS YANG SAMA dengan kartu yang tombolnya ditekan.
  // Kupon fisik: nomor berikut dibuatkan otomatis bila belum terdaftar
  // (callDirect), atau dipanggil ulang bila sudah ada.
  // Selesai = nomor aktif COMPLETED; Berikutnya = nomor aktif SKIPPED (dilewati).
  const finishAndCallNext = async (svc, key, finishFn, verb) => {
    const target = targetOf(svc.id)
    if (!target) return
    setBusy(key)
    try {
      await withTimeout(finishFn(target.id), 20000)
      let next = null
      const nextSeq = Number(target.sequence)
      if (Number.isFinite(nextSeq)) {
        try {
          next = await withTimeout(callDirect({ service: svc, number: `${svc.prefix}-${nextSeq + 1}`, name: '' }), 20000)
        } catch (e) {
          // Kuota habis → nomor aktif tetap diselesaikan, tanpa panggil berikutnya
          if (!/kuota/i.test(e.message || '')) throw e
          flash(`${target.number} ${verb}. Kuota ${svc.name} hari ini sudah penuh.`, 'warn')
        }
      } else {
        next = await withTimeout(callNext({ serviceIds: [svc.id] }), 20000)
      }
      if (next) {
        setSelected((prev) => ({ ...prev, [svc.id]: next.id }))
        flash(`${target.number} ${verb}. Otomatis memanggil ${next.number} (${svc.name}).`)
      }
      await refresh()
    } catch (e) { flash(errText(e), 'warn') }
    finally { setBusy(null) }
  }

  // Panggil nomor kupon langsung + nama warga opsional (satu nomor).
  // Beberapa nomor sekaligus: pisah koma ("5,6,7") atau rentang ("5-8") —
  // dibuatkan sesuai kupon berurutan menaik lalu dipanggil serentak.
  // Perekaman KTP: panggil berbasis nama — nama wajib & satu nama per panggilan.
  const handleDirect = async (e) => {
    e.preventDefault()
    const svc = specOpen
    // specFail: tampilkan di dalam modal (selalu terlihat) + banner global
    const specFail = (msg) => { setSpecErr(msg); flash(msg, 'warn') }
    if (!svc || !specificNum.trim()) return specFail('Masukkan nomor antrean.')
    const nameCall = isNameCallService(svc)
    if (nameCall) {
      if (directName.trim().length < 3) return specFail('Untuk Perekaman KTP, nama wajib diisi (minimal 3 huruf) — nama yang tampil di monitor & diumumkan.')
      try {
        if (parseQueueNumbers(svc, specificNum).length > 1) return specFail('Perekaman KTP dipanggil satu nama per panggilan — masukkan satu nomor saja.')
      } catch (err) { return specFail(errText(err)) }
    }
    setSpecErr(null)
    setBusy(`direct-${svc.id}`)
    try {
      const res = await withTimeout(callDirectMany({ service: svc, raw: specificNum, name: directName }), 20000)
      if (res.length > 1) {
        setSelected((prev) => ({ ...prev, [svc.id]: res[res.length - 1].id }))
        flash(`Memanggil ${res.length} nomor sekaligus: ${res.map((r) => r.number).join(', ')} (${svc.name}).`)
      } else if (res.length === 1) {
        setSelected((prev) => ({ ...prev, [svc.id]: res[0].id }))
      }
      setSpecOpen(null); setSpecificNum(''); setDirectName(''); setSpecErr(null)
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
    await runOn(`edit-${editOpen.id}`, editOpen.id, () => setStatus(editOpen.id, editOpen.status, { name: editName.trim() }))
    setEditOpen(null)
  }

  const handleReset = async () => {
    if (!window.confirm('Reset antrean hari ini? Antrean yang masih aktif (menunggu/dipanggil/dilayani) akan ditandai Dilewati. Riwayat hari ini tetap tersimpan.')) return
    setBusy('reset')
    try { await withTimeout(resetToday(), 20000); await refresh() } catch (e) { flash(errText(e), 'warn') }
    finally { setBusy(null) }
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
              Belum ada nomor yang dipanggil — tombol <b>Ulangi / Selesai / Berikutnya</b> aktif setelah ada nomor aktif.
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
                              <button
                                key={q.id}
                                onClick={() => setSelected((prev) => ({ ...prev, [svc.id]: q.id }))}
                                title={`a.n. ${q.name}`}
                                className={`rounded-lg border px-2.5 py-1.5 text-[13px] font-extrabold tabular-nums transition ${c.pill} ${target.id === q.id ? `ring-2 ${c.ring}` : ''}`}
                              >
                                {q.number}
                              </button>
                            ))}
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
                    <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                      <button
                        disabled={!target || busy === `recall-${svc.id}`}
                        onClick={() => target && runOn(`recall-${svc.id}`, target.id, () => recallQueue(target.id))}
                        className="btn-secondary !px-2 !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Volume2 size={14} /> Ulangi
                      </button>
                      <button
                        disabled={!target || busy === `done-${svc.id}`}
                        onClick={() => target && finishAndCallNext(svc, `done-${svc.id}`, completeQueue, 'selesai')}
                        title="Tandai nomor aktif selesai & panggil nomor berikutnya"
                        className="btn-success !px-2 !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Check size={14} /> Selesai
                      </button>
                      <button
                        disabled={!target || busy === `skip-${svc.id}`}
                        onClick={() => target && finishAndCallNext(svc, `skip-${svc.id}`, skipQueue, 'dilewati')}
                        title="Lewati nomor aktif & panggil nomor berikutnya"
                        className="btn-secondary !px-2 !py-2 !text-xs !rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
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
              // Nomor yang sudah dipanggil / dilewati (acuan petugas untuk panggil spesifik)
              const handled = queues
                .filter((q) => q.service_id === svc.id && q.status !== 'WAITING')
                .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
              return (
                <div key={svc.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${c.badge} text-white !text-[10px] font-mono shrink-0`}>{svc.prefix}</span>
                    <span className="text-[13px] font-semibold text-slate-700 flex-1 truncate">{svc.name}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2" title={`Kupon terbit ${issued} dari ${quota} hari ini`}>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${full ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (issued / quota) * 100)}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold tabular-nums shrink-0 ${full ? 'text-rose-600' : 'text-slate-500'}`}>{full ? 'Kuota penuh' : `${issued}/${quota}`}</span>
                  </div>
                  <button
                    onClick={() => openSpec(svc)}
                    title="Panggil nomor kupon"
                    className={`btn ${c.btn} text-white w-full !py-2.5 !rounded-lg !text-[13px] mt-2`}
                  >
                    <Search size={15} /> Panggil Nomor
                  </button>
                  {handled.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 mb-1.5">SUDAH DIPANGGIL ({handled.length}) — KLIK UNTUK PANGGIL ULANG</div>
                      <div className="flex flex-wrap gap-1.5">
                        {handled.map((q) => (
                          <button
                            key={q.id}
                            title={q.status === 'SKIPPED' ? `${q.number} (dilewati) — klik untuk panggil ulang` : `${q.number} — klik untuk panggil ulang`}
                            onClick={() => openSpec(svc, q.number)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-extrabold tabular-nums transition hover:ring-2 ${c.pill} ${c.ring} ${q.status === 'SKIPPED' ? 'line-through opacity-60' : ''}`}
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
        </aside>
      </div>

      {/* Modal: panggil nomor kupon langsung */}
      <Modal open={!!specOpen} onClose={() => setSpecOpen(null)} title={`Panggil ${specOpen && isNameCallService(specOpen) ? 'Nama' : 'Nomor'} — ${specOpen?.name || ''}`}>
        <form onSubmit={handleDirect} className="space-y-3">
          <p className="text-sm text-slate-500">Satu nomor (cth: {specOpen ? `${specOpen.prefix}-5` : 'KTP-5'} atau cukup 5) atau beberapa sekaligus: pisahkan dengan koma (cth: 5,6,7) atau rentang (cth: 5-8, maks 10 nomor). Nomor yang belum terdaftar dibuat otomatis lalu dipanggil serentak. Nomor mana pun boleh dipanggil langsung, termasuk yang terlewati.</p>
          {specOpen && isNameCallService(specOpen) && (
            <p className="text-sm font-semibold text-blue-700">Perekaman KTP dipanggil berbasis nama: nama di bawah yang tampil di monitor & diumumkan via audio (satu nama per panggilan).</p>
          )}
          {specErr && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-semibold text-rose-700">{specErr}</div>
          )}
          <Field label="Nomor Antrean *">
            <input
              className="input font-mono"
              value={specificNum}
              onChange={(e) => setSpecificNum(e.target.value)}
              placeholder={specOpen ? `${specOpen.prefix}-5,6,7 atau 5-8` : 'KTP-5,6,7 atau 5-8'}
            />
          </Field>
          {/* IKD: hanya input nomor, tanpa nama. REKAM: nama wajib (identitas panggilan) */}
          {(specOpen?.prefix || '').toUpperCase() !== 'IKD' && (
            <Field label={specOpen && isNameCallService(specOpen) ? 'Nama Warga * (tampil di monitor & diumumkan)' : 'Nama Warga (opsional, hanya untuk 1 nomor)'}>
              <input
                className="input"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="cth: Andi Pratama"
                maxLength={60}
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
