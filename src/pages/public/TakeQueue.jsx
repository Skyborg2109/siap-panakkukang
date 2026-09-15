import { useCallback, useEffect, useState } from 'react'
import { Ticket, RotateCcw, Loader2, BellRing, Check } from 'lucide-react'
import { getServices, getRequirements } from '../../services/masterService.js'
import { takeQueue, getTodayQueueList, estimateWait } from '../../services/queueService.js'
import { quotaFor, callDestination } from '../../lib/constants.js'
import { todayKey, formatDateID } from '../../utils/date.js'
import { Field } from '../../components/ui/ui.jsx'

// Nomor milik warga ini tersimpan di HP-nya (per hari) agar status
// panggilan tetap dipantau walau halaman di-refresh.
const MY_KEY = 'siap_my_tickets'

function loadMine() {
  try {
    const raw = JSON.parse(localStorage.getItem(MY_KEY) || 'null')
    if (raw && raw.date === todayKey() && Array.isArray(raw.tickets)) return raw.tickets
  } catch { /* abaikan */ }
  return []
}

function saveMine(tickets) {
  try {
    localStorage.setItem(MY_KEY, JSON.stringify({ date: todayKey(), tickets }))
  } catch { /* abaikan */ }
}

function buzz() {
  try {
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 700])
  } catch { /* abaikan */ }
}

const STATUS_LABEL = { WAITING: 'Menunggu', CALLED: 'Dipanggil!', SERVING: 'Dilayani', COMPLETED: 'Selesai', SKIPPED: 'Dilewati' }

export default function TakeQueue() {
  const [services, setServices] = useState([])
  const [queues, setQueues] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])
  const [name, setName] = useState('')
  const [nik, setNik] = useState('')
  const [reqs, setReqs] = useState({})
  const [tickets, setTickets] = useState(loadMine)
  const [notified, setNotified] = useState({})
  const [showForm, setShowForm] = useState(() => loadMine().length === 0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([getServices(), getTodayQueueList().catch(() => [])])
      setServices(s)
      setQueues(q)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('siap:queues-changed', refresh)
    window.addEventListener('siap:master-changed', refresh)
    window.addEventListener('storage', refresh)
    const t = setInterval(refresh, 3000)
    return () => {
      window.removeEventListener('siap:queues-changed', refresh)
      window.removeEventListener('siap:master-changed', refresh)
      window.removeEventListener('storage', refresh)
      clearInterval(t)
      document.title = 'SIAP Panakkukang'
    }
  }, [refresh])

  // Deteksi panggilan nomor milik warga → getarkan HP + spanduk.
  // Berjalan tiap ada pembaruan antrean; idempotent via state `notified`.
  useEffect(() => {
    const newly = tickets.filter((t) => {
      const live = queues.find((x) => x.id === t.id)
      const st = live?.status || t.status
      return (st === 'CALLED' || st === 'SERVING') && !notified[t.id]
    })
    if (!newly.length) return
    setNotified((prev) => ({ ...prev, ...Object.fromEntries(newly.map((t) => [t.id, true])) }))
    buzz()
    document.title = '🔔 Nomor Anda dipanggil!'
  }, [queues, tickets, notified])

  // Syarat berkas tiap layanan yang dicentang
  useEffect(() => {
    if (!selected.length) { setReqs({}); return }
    Promise.all(selected.map((id) =>
      getRequirements(id).then((r) => [id, r.map((x) => x.requirement || x.text || x)]).catch(() => [id, []]),
    )).then((pairs) => setReqs(Object.fromEntries(pairs)))
  }, [selected])

  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const issuedOf = (id) => queues.filter((q) => q.service_id === id).length
  const waitingOf = (id) => queues.filter((q) => q.service_id === id && q.status === 'WAITING').length
  const liveOf = (t) => queues.find((q) => q.id === t.id) || t

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!selected.length) return setError('Centang minimal satu jenis antrean.')
    if (name.trim().length < 3) return setError('Nama minimal 3 huruf.')
    if (nik.trim() && !/^\d{6,16}$/.test(nik.trim())) return setError('NIK harus 6–16 digit angka.')
    setBusy(true)
    try {
      const done = []
      const failed = []
      for (const id of selected) {
        const svc = services.find((s) => s.id === id)
        if (!svc) continue
        try {
          done.push(await takeQueue({ service: svc, name: name.trim(), nik: nik.trim() }))
        } catch (err) {
          failed.push(`${svc.name}: ${err.message}`)
        }
      }
      if (!done.length) return setError(failed.join(' '))
      const next = [...tickets, ...done]
      setTickets(next)
      saveMine(next)
      if (failed.length) setError(`Sebagian gagal — ${failed.join(' ')}`)
      setSelected([])
      setShowForm(false)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="card p-10 text-center text-slate-400">Memuat jenis antrean…</div>

  // ---- Karcis: seluruh nomor milik warga + status live ----
  if (!showForm && tickets.length) {
    const called = tickets.filter((t) => ['CALLED', 'SERVING'].includes(liveOf(t).status))
    return (
      <div className="max-w-[560px] mx-auto space-y-3">
        {called.length > 0 && (
          <div className="rounded-2xl bg-orange-600 text-white px-5 py-4 flex items-start gap-3 animate-blink">
            <BellRing size={22} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold">Nomor Anda dipanggil!</div>
              <div className="text-sm text-orange-100 mt-0.5">
                {called.map((t) => t.number).join(', ')} — {callDestination(called[0])}.
              </div>
            </div>
          </div>
        )}
        <div className="card p-6 md:p-8 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Ticket size={14} /> Karcis Antrean Anda ({tickets.length})
          </div>
          <div className="space-y-3 mt-5 text-left">
            {tickets.map((t) => {
              const live = liveOf(t)
              const isCalled = ['CALLED', 'SERVING'].includes(live.status)
              let wait = null
              try { if (live.status === 'WAITING') wait = estimateWait(queues, live) } catch { /* abaikan */ }
              return (
                <div key={t.id} className={`rounded-xl border px-4 py-3 ${isCalled ? 'border-orange-500 ring-2 ring-orange-500 bg-orange-50/60' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 flex-1">{live.service_name || t.service_name}</span>
                    <span className={`badge ${isCalled ? 'bg-orange-600 text-white' : live.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {isCalled && notified[t.id] ? <BellRing size={11} className="mr-1" /> : null}
                      {STATUS_LABEL[live.status] || live.status}
                    </span>
                  </div>
                  <div className="font-extrabold text-4xl tracking-tight text-slate-900 tabular-nums mt-1">{live.number || t.number}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    a.n. <b className="text-slate-700">{live.name || t.name}</b> · {formatDateID(live.created_at || t.created_at)}
                  </div>
                  {wait && wait.ahead > 0 && (
                    <div className="text-xs text-slate-500 mt-1.5">Ada <b>{wait.ahead} antrean</b> di depan · estimasi ±<b>{wait.estMinutes} menit</b>.</div>
                  )}
                  <div className="text-xs font-semibold text-orange-700 mt-1">{callDestination(live)}.</div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-4">
            Biarkan halaman ini terbuka — HP Anda akan <b>bergetar</b> saat nomor dipanggil petugas.
          </p>
          <button onClick={() => { setShowForm(true); setError('') }} className="btn-primary w-full mt-3">
            <RotateCcw size={15} /> Ambil Nomor Lain
          </button>
        </div>
      </div>
    )
  }

  // ---- Form ambil nomor (boleh beberapa jenis sekaligus) ----
  return (
    <div className="max-w-[640px] mx-auto">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-extrabold text-slate-900">Ambil Nomor Antrean</h1>
        <p className="text-sm text-slate-500 mt-1">Centang satu atau beberapa jenis layanan, isi nama, lalu dapatkan nomor Anda.</p>
      </div>
      {tickets.length > 0 && (
        <button onClick={() => setShowForm(false)} className="btn-secondary w-full mb-3">
          <Ticket size={15} /> Lihat Karcis Saya ({tickets.length})
        </button>
      )}
      <div className="card p-5 md:p-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Jenis Antrean * (boleh lebih dari satu)">
            <div className="grid gap-2">
              {services.length === 0 && <div className="text-sm text-slate-400">Belum ada layanan aktif.</div>}
              {services.map((s) => {
                const quota = quotaFor(s)
                const issued = issuedOf(s.id)
                const full = issued >= quota
                const active = selected.includes(s.id)
                return (
                  <button
                    type="button"
                    key={s.id}
                    disabled={full}
                    onClick={() => toggle(s.id)}
                    className={`text-left rounded-xl border px-4 py-3 transition ${active ? 'border-orange-500 ring-2 ring-orange-500 bg-orange-50/50' : 'border-slate-200 bg-white hover:border-slate-300'} ${full ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${active ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                        <Check size={14} strokeWidth={3} />
                      </span>
                      <span className="badge bg-slate-800 text-white font-mono !text-[10px]">{s.prefix}</span>
                      <span className="font-bold text-sm text-slate-800 flex-1">{s.name}</span>
                      <span className={`text-[11px] font-bold tabular-nums ${full ? 'text-rose-600' : 'text-slate-400'}`}>
                        {full ? 'Kuota penuh' : `${waitingOf(s.id)} menunggu`}
                      </span>
                    </div>
                    {s.description && <div className="text-xs text-slate-500 mt-1">{s.description}</div>}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nama Lengkap *">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth: Andi Pratama" maxLength={60} />
            </Field>
            <Field label="NIK (opsional)">
              <input className="input font-mono" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="cth: 7371…" inputMode="numeric" />
            </Field>
          </div>
          {selected.map((id) => {
            const s = services.find((x) => x.id === id)
            const items = reqs[id] || []
            if (!s || !items.length) return null
            return (
              <div key={id} className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-slate-600">
                <div className="font-bold text-amber-800 mb-1">Syarat / berkas untuk {s.name}:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {items.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )
          })}
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-2.5">{error}</div>}
          <button className="btn-primary w-full !py-3" disabled={busy || !selected.length}>
            {busy ? <><Loader2 className="animate-spin" size={17} /> Mengambil…</> : <><Ticket size={17} /> Ambil Nomor Antrean{selected.length > 1 ? ` (${selected.length})` : ''}</>}
          </button>
        </form>
      </div>
    </div>
  )
}
