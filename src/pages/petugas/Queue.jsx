import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard, History, Settings, Search,
  Volume2, Check, ChevronsRight, FileText, RotateCcw, Pencil, Megaphone,
} from 'lucide-react'
import { DashboardLayout } from '../../layouts/layouts.jsx'
import {
  getTodayQueueList, recallQueue, skipQueue,
  completeQueue, setStatus, resetToday, callDirect, callNext,
} from '../../services/queueService.js'
import { getServices } from '../../services/masterService.js'
import { callKKCase, sendBroadcast } from '../../services/displayService.js'
import { quotaFor } from '../../lib/constants.js'
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

  // Tiga jenis antrean: Antrian KTP, Perekaman KTP, IKD
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

  const runOn = async (key, id, fn) => {
    setBusy(key)
    try { await fn(); await refresh() } catch (e) { alert(e.message) }
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
      await finishFn(target.id)
      let next = null
      const nextSeq = Number(target.sequence)
      if (Number.isFinite(nextSeq)) {
        try {
          next = await callDirect({ service: svc, number: `${svc.prefix}-${nextSeq + 1}`, name: '' })
        } catch (e) {
          // Kuota habis → nomor aktif tetap diselesaikan, tanpa panggil berikutnya
          if (!/kuota/i.test(e.message || '')) throw e
          flash(`${target.number} ${verb}. Kuota ${svc.name} hari ini sudah penuh.`, 'warn')
        }
      } else {
        next = await callNext({ serviceIds: [svc.id] })
      }
      if (next) {
        setSelected((prev) => ({ ...prev, [svc.id]: next.id }))
        flash(`${target.number} ${verb}. Otomatis memanggil ${next.number} (${svc.name}).`)
      }
      await refresh()
    } catch (e) { alert(e.message) }
    finally { setBusy(null) }
  }

  // Panggil nomor kupon langsung + nama warga opsional
  // (belum terdaftar → dibuatkan sesuai kupon lalu dipanggil)
  const handleDirect = async (e) => {
    e.preventDefault()
    const svc = specOpen
    if (!svc || !specificNum.trim()) return alert('Masukkan nomor antrean.')
    setBusy(`direct-${svc.id}`)
    try {
      const res = await callDirect({ service: svc, number: specificNum, name: directName })
      if (res) setSelected((prev) => ({ ...prev, [svc.id]: res.id }))
      setSpecOpen(null); setSpecificNum(''); setDirectName('')
      await refresh()
    } catch (err) { alert(err.message) }
    finally { setBusy(null) }
  }

  const handleKK = async (e) => {
    e.preventDefault()
    if (kkName.trim().length < 3) return alert('Nama minimal 3 huruf.')
    try {
      await callKKCase({ name: kkName.trim(), note: kkNote.trim() })
      setKkOpen(false); setKkName(''); setKkNote('')
      alert('Panggilan KK dikirim ke Display TV + audio.')
    } catch (err) { alert(err.message) }
  }

  // Pengumuman spontan ke masyarakat (banner + audio di Display TV)
  const handleBroadcast = async (e) => {
    e.preventDefault()
    try {
      await sendBroadcast({ message: bcMessage })
      setBcOpen(false); setBcMessage('')
      alert('Pengumuman dikirim ke Display TV + audio.')
    } catch (err) { alert(err.message) }
  }

  const openEdit = (q) => {
    setEditOpen(q)
    setEditName(q.name)
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!editOpen || editName.trim().length < 3) return alert('Nama minimal 3 huruf.')
    await runOn(`edit-${editOpen.id}`, editOpen.id, () => setStatus(editOpen.id, editOpen.status, { name: editName.trim() }))
    setEditOpen(null)
  }

  const handleReset = async () => {
    if (!window.confirm('Reset seluruh antrean hari ini? Data antrean hari ini akan dihapus dan nomor mulai dari awal.')) return
    setBusy('reset')
    try { await resetToday(); await refresh() } catch (e) { alert(e.message) }
    finally { setBusy(null) }
  }

  return (
    <DashboardLayout
      menu={menu}
      title="Dashboard — Kecamatan Panakkukang"
      subtitle="Panggil & kelola tiga jenis antrean: KTP, Perekaman KTP, IKD"
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
                            {actives.slice(0, 5).map((q) => (
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
                        className="btn-secondary !px-2 !py-2 !text-xs !rounded-lg"
                      >
                        <Volume2 size={14} /> Ulangi
                      </button>
                      <button
                        disabled={!target || busy === `done-${svc.id}`}
                        onClick={() => finishAndCallNext(svc, `done-${svc.id}`, completeQueue, 'selesai')}
                        className="btn-success !px-2 !py-2 !text-xs !rounded-lg"
                      >
                        <Check size={14} /> Selesai
                      </button>
                      <button
                        disabled={!target || busy === `skip-${svc.id}`}
                        onClick={() => finishAndCallNext(svc, `skip-${svc.id}`, skipQueue, 'dilewati')}
                        title="Lewati nomor aktif & panggil nomor berikutnya"
                        className="btn-secondary !px-2 !py-2 !text-xs !rounded-lg"
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
          <div className="card p-4 space-y-5">
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
                <div key={svc.id}>
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
                    onClick={() => { setSpecOpen(svc); setSpecificNum(''); setDirectName('') }}
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
                            onClick={() => { setSpecOpen(svc); setSpecificNum(q.number); setDirectName('') }}
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
            <button onClick={() => setKkOpen(true)} className="btn w-full !py-2.5 !rounded-lg !text-[13px] bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 font-semibold">
              <FileText size={15} /> Kasus KK / Konsultasi
            </button>
            <button onClick={() => setBcOpen(true)} className="btn w-full !py-2.5 !rounded-lg !text-[13px] bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 font-semibold">
              <Megaphone size={15} /> Pengumuman ke Masyarakat
            </button>
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
      <Modal open={!!specOpen} onClose={() => setSpecOpen(null)} title={`Panggil Nomor — ${specOpen?.name || ''}`}>
        <form onSubmit={handleDirect} className="space-y-3">
          <p className="text-sm text-slate-500">Ketik nomor kupon (cth: {specOpen ? `${specOpen.prefix}-5` : 'KTP-5'} atau cukup 5). Nomor yang belum terdaftar dibuat otomatis lalu langsung dipanggil. Nomor harus berurutan — tidak bisa melompati nomor di bawahnya yang belum dipanggil.</p>
          <Field label="Nomor Antrean *">
            <input
              className="input font-mono"
              value={specificNum}
              onChange={(e) => setSpecificNum(e.target.value)}
              placeholder={specOpen ? `${specOpen.prefix}-1` : 'KTP-1'}
            />
          </Field>
          {/* IKD: hanya input nomor, tanpa nama */}
          {(specOpen?.prefix || '').toUpperCase() !== 'IKD' && (
            <Field label="Nama Warga (opsional)">
              <input
                className="input"
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="cth: Andi Pratama"
                maxLength={60}
              />
            </Field>
          )}
          <button className="btn-primary w-full" disabled={busy === `direct-${specOpen?.id}`}><Search size={16} /> {busy === `direct-${specOpen?.id}` ? 'Memanggil…' : 'Panggil Sekarang'}</button>
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
