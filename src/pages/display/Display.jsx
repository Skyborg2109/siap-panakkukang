import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Volume2, VolumeX, Maximize, Info, Megaphone } from 'lucide-react'
import { getTodayQueueList } from '../../services/queueService.js'
import { getAnnouncements, getServices } from '../../services/masterService.js'
import { getDisplayImages, getLatestKK, getLatestBroadcast } from '../../services/displayService.js'
import { useSpeech, useClock } from '../../hooks/hooks.js'
import { GovLogos } from '../../layouts/layouts.jsx'
import { formatClock, formatDateFull } from '../utils-imports.js'
import { hasRealName, kkCallNote } from '../../utils/queue.js'

// Judul header slideshow per kategori gambar (ditampilkan realtime mengikuti slide)
const CATEGORY_META = {
  'staff-dukcapil': 'Petugas Dukcapil Panakkukang',
  'staff-kecamatan': 'Pimpinan Kecamatan Panakkukang',
  'alur': 'Alur Pelayanan',
}
const CATEGORY_ORDER = ['staff-dukcapil', 'staff-kecamatan', 'alur']

export default function Display() {
  const [queues, setQueues] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [services, setServices] = useState([])
  const [images, setImages] = useState([])
  const [kk, setKk] = useState(null)
  const [broadcast, setBroadcast] = useState(null)
  const [slide, setSlide] = useState(0)
  const lastCalledRef = useRef('')
  const { enabled, toggle, announceQueue, announceKK, announceBroadcast } = useSpeech()
  const now = useClock()

  const refresh = useCallback(async () => {
    try {
      const [q, a, s, img, latestKK, latestBc] = await Promise.all([
        getTodayQueueList(),
        getAnnouncements(),
        getServices(),
        getDisplayImages().catch(() => []),
        getLatestKK().catch(() => null),
        getLatestBroadcast().catch(() => null),
      ])
      setQueues(q)
      setAnnouncements(a)
      setServices(s.filter((x) => x.is_active !== false))
      setImages(img)
      // Stabilkan identitas objek: refresh tiap 3 dtk membuat objek baru,
      // tanpa ini timer suara KK di-reset terus dan tak pernah bunyi
      const nid = latestKK ? latestKK.id : null
      setKk((prev) => (prev && nid && prev.id === nid ? prev : latestKK))
      const bid = latestBc ? latestBc.id : null
      setBroadcast((prev) => (prev && bid && prev.id === bid ? prev : latestBc))
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    refresh()
    const onCh = () => refresh()
    window.addEventListener('siap:queues-changed', onCh)
    window.addEventListener('siap:master-changed', onCh)
    window.addEventListener('storage', onCh)
    const t = setInterval(refresh, 3000)
    return () => {
      clearInterval(t)
      window.removeEventListener('siap:queues-changed', onCh)
      window.removeEventListener('siap:master-changed', onCh)
      window.removeEventListener('storage', onCh)
    }
  }, [refresh])

  // TTS: umumkan nomor CALLED terbaru
  useEffect(() => {
    const called = queues.filter((q) => q.status === 'CALLED' || q.status === 'SERVING').sort((a, b) => new Date(b.called_at || b.updated_at) - new Date(a.called_at || a.updated_at))[0]
    const key = called ? `${called.id}-${called.called_at}` : ''
    if (called && key !== lastCalledRef.current) {
      lastCalledRef.current = key
      announceQueue(called)
    }
  }, [queues, announceQueue])

  // TTS: umumkan tiap panggilan KK baru tepat satu kali
  useEffect(() => {
    if (!kk) return
    const kkKey = `kk-${kk.id}`
    try {
      if (sessionStorage.getItem('siap_last_kk') !== kkKey) {
        sessionStorage.setItem('siap_last_kk', kkKey)
        const t = setTimeout(() => announceKK(kk), 4000)
        return () => clearTimeout(t)
      }
    } catch { /* ignore */ }
  }, [kk, announceKK])

  // Banner KK hilang 20 detik setelah dipanggil
  const showKK = kk && (now.getTime() - new Date(kk.created_at).getTime() < 20 * 1000)

  // TTS: umumkan tiap broadcast petugas tepat satu kali
  useEffect(() => {
    if (!broadcast) return
    const bcKey = `bc-${broadcast.id}`
    try {
      if (sessionStorage.getItem('siap_last_bc') !== bcKey) {
        sessionStorage.setItem('siap_last_bc', bcKey)
        const t = setTimeout(() => announceBroadcast(broadcast), 4000)
        return () => clearTimeout(t)
      }
    } catch { /* ignore */ }
  }, [broadcast, announceBroadcast])

  // Banner broadcast hilang 20 detik setelah dikirim
  const showBroadcast = broadcast && (now.getTime() - new Date(broadcast.created_at).getTime() < 20 * 1000)

  // Slideshow kiri — hanya foto (teks/pengumuman cukup di ticker bawah).
  // Foto staf dikelompokkan satu slide per kategori; gambar alur satu-satu agar terbaca besar.
  const slides = useMemo(() => {
    const arr = []
    CATEGORY_ORDER.forEach((cat) => {
      const list = images.filter((im) => im.category === cat).slice(0, 6)
      if (!list.length) return
      if (cat === 'alur') {
        list.forEach((im) => arr.push({ kind: 'photo', heading: CATEGORY_META[cat], category: cat, item: im }))
      } else {
        arr.push({ kind: 'photos', heading: CATEGORY_META[cat] || cat, category: cat, items: list })
      }
    })
    const rest = images.filter((im) => !CATEGORY_ORDER.includes(im.category)).slice(0, 6)
    if (rest.length) arr.push({ kind: 'photos', heading: 'Dokumentasi', category: 'other', items: rest })
    if (!arr.length) arr.push({ kind: 'info', heading: 'Selamat Datang', title: 'Selamat Datang', body: 'Tunggu hingga nomor antrean Anda dipanggil.' })
    return arr
  }, [images])

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 8000)
    return () => clearInterval(t)
  }, [slides.length])

  // Kartu kanan: panggilan terakhir per jenis antrean
  const perService = useMemo(() => {
    return services.map((s) => {
      const called = queues
        .filter((q) => q.service_id === s.id && ['CALLED', 'SERVING'].includes(q.status))
        .sort((a, b) => new Date(b.called_at || b.updated_at) - new Date(a.called_at || a.updated_at))[0]
      return { service: s, called }
    })
  }, [services, queues])

  const ticker = announcements.map((a) => a.message).join('  •••  ') || 'Selamat datang di Kantor Kecamatan Panakkukang.'

  const current = slides[slide % slides.length]

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#eef2f7] text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-[#0b1220] text-white shrink-0">
        <div className="flex items-center gap-3 px-4 md:px-6 py-3">
          <GovLogos className="h-11" />
          <div className="flex-1 leading-tight border-l border-white/15 pl-3">
            <div className="text-[11px] font-bold tracking-widest text-amber-400">PEMERINTAH KOTA MAKASSAR</div>
            <div className="font-extrabold text-base md:text-xl tracking-wide">KANTOR KECAMATAN PANAKKUKANG</div>
          </div>
          <div className="text-right leading-tight">
            <div className="font-mono font-extrabold text-xl md:text-3xl tabular-nums tracking-tight">{formatClock(now).replaceAll(':', '.')}</div>
            <div className="text-[11px] text-slate-300">{formatDateFull(now)}</div>
          </div>
          <div className="hidden sm:flex gap-2 no-print">
            <button onClick={toggle} className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white" title="Suara">{enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
            <button onClick={() => document.documentElement.requestFullscreen?.()} className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white" title="Fullscreen"><Maximize size={18} /></button>
            <Link to="/information" className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white" title="Informasi"><Info size={18} /></Link>
          </div>
        </div>
        <div className="h-[3px] bg-orange-500" />
      </header>

      {/* Banner panggilan khusus KK (tanpa nomor) */}
      {showKK && (
        <div className="mx-3 md:mx-4 mt-3 rounded-xl bg-amber-400 text-amber-950 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-amber-950/10 flex items-center justify-center">
            <Megaphone size={18} />
          </span>
          <div className="text-sm leading-snug">
            <b>Panggilan khusus — Kartu Keluarga a.n. {kk.name}.</b>{' '}
            {kkCallNote(kk.note, kk.counter_name).replace(/^./, (c) => c.toUpperCase())}
          </div>
        </div>
      )}

      {/* Banner pengumuman spontan petugas */}
      {showBroadcast && (
        <div className="mx-3 md:mx-4 mt-3 rounded-xl bg-sky-400 text-sky-950 px-4 py-2.5 flex items-center gap-3 shrink-0">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-sky-950/10 flex items-center justify-center">
            <Megaphone size={18} />
          </span>
          <div className="text-sm leading-snug">
            <b>Pengumuman.</b>{' '}
            {broadcast.message}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_400px] gap-4 p-3 md:p-4 overflow-hidden">
        {/* Kiri: slideshow informasi */}
        <div className="bg-[#0f1b33] text-white rounded-2xl p-4 md:p-6 flex flex-col min-h-0 overflow-hidden relative">
          <div className="text-center">
            <div className="text-[11px] font-bold tracking-[0.18em] text-orange-300">LAYAR INFROMASI</div>
            <div key={slide} className="animate-slide-in text-lg md:text-xl font-extrabold mt-1">{current?.heading}</div>
          </div>
          <div key={`body-${slide}`} className="animate-slide-in mt-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            {current?.kind === 'photo' ? (
              <div className="flex-1 min-h-0 flex flex-col items-center overflow-hidden">
                <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
                  <img
                    src={current.item.url || current.item.file_path}
                    alt={current.item.title || current.item.name}
                    className="max-h-full max-w-full object-contain rounded-xl"
                  />
                </div>
                <div className="font-bold mt-2 shrink-0">{current.item.title || current.item.name}</div>
              </div>
            ) : current?.kind === 'photos' ? (
              <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
                {current.items.map((im) => (
                  <figure key={im.id} className="flex-1 min-w-0 min-h-0 flex flex-col items-center overflow-hidden">
                    <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
                      <img
                        src={im.url || im.file_path}
                        alt={im.title || im.name}
                        className="max-h-full max-w-full object-contain rounded-xl"
                      />
                    </div>
                    <figcaption className="font-bold text-sm md:text-base mt-1.5 truncate max-w-full shrink-0">{im.title || im.name}</figcaption>
                    {im.description && <div className="text-slate-300 text-xs md:text-sm truncate max-w-full shrink-0">{im.description}</div>}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-2xl md:text-3xl font-extrabold text-orange-200 text-center">{current?.title}</div>
                <div className="whitespace-pre-line text-slate-200 text-base md:text-lg mt-3 leading-relaxed text-center">{current?.body}</div>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 justify-center mt-4 shrink-0">
            {slides.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === slide % slides.length ? 'w-8 bg-orange-500' : 'w-2 bg-white/20'}`} />
            ))}
          </div>
        </div>

        {/* Kanan: kartu panggilan per jenis antrean */}
        <div className="grid gap-3 content-start lg:content-stretch lg:auto-rows-fr lg:h-full min-h-0 overflow-hidden">
          {perService.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">Belum ada jenis antrean aktif.</div>}
          {perService.map(({ service, called }) => (
            <div key={service.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm px-6 py-4 text-center flex flex-col min-h-0 h-full overflow-hidden">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-bold tracking-wider text-orange-700 uppercase leading-none">
                  <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                  Antrean {service.prefix}
                </span>
              </div>
              {called ? (
                <div className="flex-1 min-h-0 flex flex-col justify-center">
                  <div className="text-sm font-bold tracking-wider text-slate-500 mt-2 uppercase">{service.name}</div>
                  <div className="font-extrabold text-[clamp(2rem,6.5vh,3.5rem)] leading-tight tracking-tight text-slate-900 tabular-nums mt-0.5">{called.number}</div>
                  {hasRealName(called.name) && (
                    <div className="text-sm text-slate-500 mt-1.5 truncate">a.n. <b className="text-slate-700">{String(called.name).trim()}</b></div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col justify-center">
                  <div className="text-sm font-bold tracking-wider text-slate-500 mt-2 uppercase">{service.name}</div>
                  <div className="font-extrabold text-[clamp(1.6rem,5vh,2.5rem)] leading-8 text-slate-300 mt-1 tracking-tight">Menunggu</div>
                </div>
              )}
              {called && (
                <div className="border-t border-slate-100 mt-3 pt-2.5 text-sm tabular-nums">
                  <span className="font-semibold text-orange-700">Sedang Dilayani di Ruang Pelayanan</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ticker pengumuman */}
      <footer className="bg-[#0b1220] text-white mt-1 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 overflow-hidden">
          <span className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-extrabold tracking-wider">PENGUMUMAN</span>
          <div className="overflow-hidden whitespace-nowrap flex-1">
            <div className="inline-block animate-ticker text-sm font-medium text-slate-200">{ticker}</div>
          </div>
        </div>
        <div className="h-[2px] bg-orange-500" />
      </footer>
    </div>
  )
}
