import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Volume2, VolumeX, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react'
import { getTodayQueueList } from '../../services/queueService.js'
import { getAnnouncements, getServices } from '../../services/masterService.js'
import { getDisplayImages, getLatestKK, getLatestBroadcast, getRestConfig, imageUrl } from '../../services/displayService.js'
import { useSpeech, useClock } from '../../hooks/hooks.js'
import { GovLogos, BG_KANTOR } from '../../layouts/layouts.jsx'
import { formatClock, formatDateFull } from '../utils-imports.js'
import { isRestNow, activeRestSchedule } from '../../utils/date.js'
import { hasRealName, kkCallNote } from '../../utils/queue.js'
import { isLoketService, isNameCallService } from '../../lib/constants.js'

// Judul header slideshow per kategori gambar (ditampilkan realtime mengikuti slide)
const CATEGORY_META = {
  'staff-dukcapil': 'Petugas Dukcapil Panakkukang',
  'staff-kecamatan': 'Pimpinan Kecamatan Panakkukang',
  'alur': 'Alur Pelayanan',
}
// Urutan slide: pimpinan kecamatan dulu, lalu petugas dukcapil, lalu alur (permintaan operasional).
const CATEGORY_ORDER = ['staff-kecamatan', 'staff-dukcapil', 'alur']

// Penanda panggilan yang sudah diumumkan — localStorage (bukan memori /
// sessionStorage) agar tidak diumumkan ulang saat window Display ditutup
// lalu dibuka kembali dan suaranya diaktifkan.
function loadLastKey(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
function saveLastKey(key, val) {
  try { localStorage.setItem(key, val) } catch { /* abaikan */ }
}
const LS_LAST_CALL = 'siap_last_call'
const LS_LAST_KK = 'siap_last_kk'
const LS_LAST_BC = 'siap_last_bc'

// Durasi tiap slide papan informasi (milis) — ubah satu angka ini bila ingin
// perpindahan konten lebih cepat / lambat.
const SLIDE_INTERVAL_MS = 15_000

// Panah kiri/kanan di sisi dalam panel informasi — pindah slide tanpa
// menunggu auto-slide (auto-slide 15 dtk tetap lanjut dari slide terpilih).
// Hanya terlihat saat kursor/sentuhan berada di area panel (`visible`).
function SlideArrows({ onPrev, onNext, visible }) {
  const btn = `absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 hover:bg-black/60 text-white items-center justify-center backdrop-blur-sm transition-all no-print flex ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
  return (
    <>
      <button type="button" onClick={onPrev} aria-label="Slide sebelumnya" title="Sebelumnya" className={`${btn} left-2 md:left-3`}>
        <ChevronLeft size={22} />
      </button>
      <button type="button" onClick={onNext} aria-label="Slide berikutnya" title="Berikutnya" className={`${btn} right-2 md:right-3`}>
        <ChevronRight size={22} />
      </button>
    </>
  )
}

// Indikator dot slideshow — berupa tombol agar operator bisa langsung
// melompat ke slide tertentu dengan menekan dot-nya (auto-slide 15 dtk
// tetap jalan dari slide yang dipilih).
function SlideDots({ count, active, onGo, dim }) {
  return (
    <div className="absolute bottom-4 md:bottom-5 left-0 right-0 flex gap-1.5 justify-center">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onGo(i)}
          aria-label={`Tampilkan slide ${i + 1}`}
          title={`Slide ${i + 1}`}
          className={`h-2 rounded-full transition-all cursor-pointer hover:scale-125 ${i === active ? 'w-8 bg-orange-500' : `w-2 ${dim ? 'bg-white/20' : 'bg-white/50'}`}`}
        />
      ))}
    </div>
  )
}

export default function Display() {
  const [queues, setQueues] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [services, setServices] = useState([])
  const [images, setImages] = useState([])
  const [kk, setKk] = useState(null)
  const [broadcast, setBroadcast] = useState(null)
  const [rest, setRest] = useState(null)
  const [slide, setSlide] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const lastCalledRef = useRef(loadLastKey(LS_LAST_CALL))
  const { enabled, supported, toggle, wake, announceQueue, announceQueues, announceKK, announceBroadcast } = useSpeech()
  const now = useClock()

  // Browser memblokir suara sebelum ada interaksi user: klik/sentuh/tekan tombol
  // sekali di halaman Display untuk membuka suara. Panggilan BARU tetap
  // dibunyikan setelah unlock; yang sudah pernah diumumkan tidak diulang
  // (penanda tersimpan di localStorage).
  useEffect(() => {
    const unlock = () => {
      wake()
      setUnlocked(true)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [wake])

  const refresh = useCallback(async () => {
    try {
      const [q, a, s, img, latestKK, latestBc, restCfg] = await Promise.all([
        getTodayQueueList(),
        getAnnouncements(),
        getServices(),
        getDisplayImages().catch(() => []),
        getLatestKK().catch(() => null),
        getLatestBroadcast().catch(() => null),
        getRestConfig().catch(() => null),
      ])
      setQueues(q)
      setAnnouncements(a)
      setServices(s.filter((x) => x.is_active !== false))
      setImages(img)
      setRest(restCfg)
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

  // TTS: umumkan nomor CALLED terbaru. Nomor yang dipanggil serentak (satu batch
  // callDirectMany berbagi called_at identik) diumumkan sekaligus dalam satu kalimat.
  // Ditahan sampai ada interaksi user pertama (kebijakan autoplay browser).
  useEffect(() => {
    if (!unlocked || !enabled) return
    const actives = queues.filter((q) => q.status === 'CALLED' || q.status === 'SERVING').sort((a, b) => new Date(b.called_at || b.updated_at) - new Date(a.called_at || a.updated_at))
    const newest = actives[0]
    if (!newest || !newest.called_at) return
    const t = new Date(newest.called_at).getTime()
    const companions = queues
      .filter((q) => q.id !== newest.id && q.service_id === newest.service_id && q.status === 'CALLED' && q.called_at && new Date(q.called_at).getTime() === t)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    const batch = [newest, ...companions]
    const key = batch.map((q) => `${q.id}@${q.called_at}`).sort().join('|')
    if (key !== lastCalledRef.current) {
      lastCalledRef.current = key
      saveLastKey(LS_LAST_CALL, key)
      if (companions.length) announceQueues(batch)
      else announceQueue(newest)
    }
  }, [queues, unlocked, enabled, announceQueue, announceQueues])

  // TTS: umumkan tiap panggilan KK baru tepat satu kali
  useEffect(() => {
    if (!kk) return
    const kkKey = `kk-${kk.id}`
    try {
      if (loadLastKey(LS_LAST_KK) !== kkKey) {
        saveLastKey(LS_LAST_KK, kkKey)
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
      if (loadLastKey(LS_LAST_BC) !== bcKey) {
        saveLastKey(LS_LAST_BC, bcKey)
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
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), SLIDE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [slides.length])

  // Kartu kanan: panggilan terakhir per jenis antrean + kawan satu batch
  // (CALLED lain di layanan sama dengan called_at identik = dipanggil serentak)
  const perService = useMemo(() => {
    return services.map((s) => {
      const called = queues
        .filter((q) => q.service_id === s.id && ['CALLED', 'SERVING'].includes(q.status))
        .sort((a, b) => new Date(b.called_at || b.updated_at) - new Date(a.called_at || a.updated_at))[0]
      const companions = called?.called_at
        ? queues
          .filter((q) => q.id !== called.id && q.service_id === s.id && q.status === 'CALLED' && q.called_at && new Date(q.called_at).getTime() === new Date(called.called_at).getTime())
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
          .slice(0, 4)
        : []
      return { service: s, called, companions, nameCall: isNameCallService(s) }
    })
  }, [services, queues])

  const ticker = announcements.map((a) => a.message).join('  •••  ') || 'Selamat datang di Kantor Kecamatan Panakkukang.'
  // Diulang 4x agar satu paruh trek selalu lebih lebar dari layar (syarat loop mulus),
  // dirender 2 salinan identik oleh footer di bawah.
  const tickerLoop = Array(4).fill(ticker).join('  •••  ')

  const current = slides[slide % slides.length]
  // Slide pimpinan: bingkai baris & badan dibuka (overflow-visible) agar
  // foto Camat & Sekcam yang diperbesar tampil utuh sampai tepi card —
  // panel terluar tetap overflow-hidden sebagai batas akhirnya.
  const isPimpinanSlide = current?.kind === 'photos' && current?.category === 'staff-kecamatan'

  // Navigasi manual: panah kiri/kanan + dot melompat ke slide mana pun,
  // auto-slide 15 dtk lanjut dari posisi terpilih.
  const goPrev = useCallback(() => setSlide((s) => (s - 1 + slides.length) % slides.length), [slides.length])
  const goNext = useCallback(() => setSlide((s) => (s + 1) % slides.length), [slides.length])

  // Panah navigasi hanya tampil saat kursor di atas panel informasi
  // (layar TV bersih saat tidak dipakai). Di layar sentuh: tampil 3,5 dtk
  // setiap ada sentuhan di panel, lalu menghilang lagi.
  const [navOn, setNavOn] = useState(false)
  const navTimer = useRef(null)
  useEffect(() => () => clearTimeout(navTimer.current), [])
  const pokeNav = useCallback(() => {
    setNavOn(true)
    clearTimeout(navTimer.current)
    navTimer.current = setTimeout(() => setNavOn(false), 3500)
  }, [])

  // Gambar istirahat: tampil terus memenuhi panel kiri selama jam istirahat
  // (tanpa teks — semua info sudah ada di gambarnya), cukup dot slideshow.
  // `now` berdetak tiap detik sehingga muncul/hilang tepat waktu tanpa refresh.
  // Panel kanan (kartu antrean), banner & ticker tetap jalan seperti biasa.
  // Gambar mengikuti jadwal yang berlaku hari itu (Jumat bisa gambar sendiri).
  const inRest = useMemo(() => isRestNow(rest, now), [rest, now])
  const restImg = useMemo(() => {
    const img = activeRestSchedule(rest, now).image
    return img ? imageUrl(img) : ''
  }, [rest, now])

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
        {/* Kiri: slideshow informasi (diganti gambar istirahat selama jam istirahat).
            Chrome tetap (sapaan atas + bawah, dots, panah) untuk semua jenis
            slide — gambar tidak pernah tertutup teks. */}
        <div
          className={`bg-[#0f1b33] text-white rounded-2xl flex flex-col min-h-0 overflow-hidden relative ${!inRest ? 'p-4 md:p-6' : ''}`}
          onMouseEnter={() => setNavOn(true)}
          onMouseLeave={() => { clearTimeout(navTimer.current); setNavOn(false) }}
          onTouchStart={pokeNav}
        >
          {/* BG foto kantor di balik panel informasi + overlay gelap agar
              teks & foto slide tetap terbaca. */}
          <img
            src={BG_KANTOR}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          />
          <div className="absolute inset-0 bg-[#0f1b33]/70 pointer-events-none" />
          {inRest ? (
          <div key="rest" className="animate-slide-in absolute inset-0 overflow-hidden">
            <img
              src={restImg}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-60"
            />
            <div className="absolute inset-0 p-3 md:p-4 flex items-center justify-center">
              <img
                src={restImg}
                alt="Informasi istirahat pelayanan"
                className="max-h-full max-w-full object-contain rounded-3xl"
              />
            </div>
            <SlideDots count={slides.length} active={slide % slides.length} onGo={setSlide} />
            <SlideArrows onPrev={goPrev} onNext={goNext} visible={navOn} />
          </div>
          ) : (
          <>
          {/* Latar blur dari gambar yang sama (hanya slide foto tunggal) agar
              panel tetap terisi penuh di balik bingkai teks. */}
          {current?.kind === 'photo' && (
            <img
              src={current.item.url || current.item.file_path}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-60 pointer-events-none"
            />
          )}
          <div className="text-center shrink-0 relative">
            {/* Sapaan hanya di slide berisi foto petugas (terletak di atas);
                slide gambar tunggal alur tampil bersih tanpa teks.
                Di slide pimpinan dipakai versi ringkas agar foto
                Camat & Sekcam tetap besar. */}
            {current?.kind !== 'photo' && (
              current?.category === 'staff-kecamatan' ? (
              <>
                <div className="text-xl md:text-2xl font-extrabold text-white tracking-wide">Selamat Datang</div>
                <div className="text-sm md:text-base font-bold text-white mt-0.5">Di Kantor Kecamatan Panakkukang</div>
              </>
              ) : (
              <>
                <div className="text-2xl md:text-3xl font-extrabold text-white tracking-wide">Selamat Datang</div>
                <div className="text-base md:text-xl font-bold text-white mt-1">Di Kantor Kecamatan Panakkukang</div>
              </>
              )
            )}
          </div>
          <div key={`body-${slide}`} className={`animate-slide-in mt-3 flex-1 min-h-0 flex flex-col relative ${isPimpinanSlide ? 'overflow-visible' : 'overflow-hidden'}`}>
            {current?.kind === 'photo' ? (
              // Foto tunggal (alur): gambar utuh tanpa crop, di tengah antara
              // bar sapaan atas dan bawah — tidak ada teks menutupinya.
              <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                <img
                  src={current.item.url || current.item.file_path}
                  alt={current.item.title || current.item.name}
                  className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
                />
              </div>
            ) : current?.kind === 'photos' ? (
              // Slide pimpinan (Camat & Sekcam di kiri-kanan): foto sisi
              // diberi porsi flex jauh lebih besar, tengah mengecil.
              <div className={`flex-1 min-h-0 flex gap-3 ${isPimpinanSlide ? 'overflow-visible' : 'overflow-hidden'}`}>
                {current.items.map((im, i) => {
                  const isPimpinan = current.category === 'staff-kecamatan' && current.items.length >= 3
                  const isSide = isPimpinan && (i === 0 || i === current.items.length - 1)
                  const isMiddle = isPimpinan && !isSide
                  // Foto Camat & Sekcam: tampil UTUH dan besar — bingkai dibuat
                  // tembus (overflow-visible) sehingga zoom tidak terpotong;
                  // arah zoom keluar (kiri ke kiri, kanan ke kanan) agar tidak
                  // menutupi gambar tengah yang sudah pas. Kelebihan zoom ke
                  // atas tertampung di area sapaan (teks sapaan di tengah,
                  // foto di tepi) dan tepi panel.
                  if (isSide) {
                    const origin = i === 0 ? 'origin-bottom-right' : 'origin-bottom-left'
                    return (
                    <figure key={im.id} className="flex-[1.65] min-w-0 min-h-0 flex flex-col items-center overflow-visible relative z-[1]">
                      <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-visible">
                        {/* Ubah angka 1.12 untuk mengatur besarnya. */}
                        <img
                          src={im.url || im.file_path}
                          alt={im.title || im.name}
                          className={`max-h-full max-w-full object-contain rounded-xl scale-[1.12] ${origin}`}
                        />
                      </div>
                      {/* Tanpa kotak bayangan — hanya teks berbayang tipis agar
                          tak ada garis potongan gradasi di atas foto. */}
                      <div className="absolute bottom-0 inset-x-0 pb-2.5 px-2 text-center pointer-events-none">
                        {!!(im.title || im.name) && (
                          <div className="font-bold text-base md:text-lg text-white truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{im.title || im.name}</div>
                        )}
                        {!!im.description && <div className="text-white text-xs md:text-sm mt-0.5 whitespace-pre-line leading-snug line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{String(im.description).replace(/\\n/g, '\n')}</div>}
                      </div>
                    </figure>
                    )
                  }
                  return (
                  <figure key={im.id} className={`${isMiddle ? 'flex-[2]' : 'flex-1'} min-w-0 min-h-0 flex flex-col items-center overflow-hidden`}>
                    {/* Gambar tengah pimpinan (logo + jam operasional) diratakan
                        ke bawah agar menutupi pintu pada foto background. */}
                    <div className={`flex-1 min-h-0 w-full flex justify-center overflow-hidden ${isMiddle ? 'items-end' : 'items-center'}`}>
                      <img
                        src={im.url || im.file_path}
                        alt={im.title || im.name}
                        className="max-h-full max-w-full object-contain rounded-xl"
                      />
                    </div>
                    {!!(im.title || im.name) && (
                      <figcaption className="font-bold text-sm md:text-base mt-1.5 truncate max-w-full shrink-0">{im.title || im.name}</figcaption>
                    )}
                    {!!im.description && <div className="text-slate-300 text-xs md:text-sm mt-1 max-w-full shrink-0 text-center whitespace-pre-line leading-snug line-clamp-4">{String(im.description).replace(/\\n/g, '\n')}</div>}
                  </figure>
                  )
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-2xl md:text-3xl font-extrabold text-orange-200 text-center">{current?.title}</div>
                <div className="whitespace-pre-line text-slate-200 text-base md:text-lg mt-3 leading-relaxed text-center">{current?.body}</div>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 justify-center mt-3 shrink-0 relative">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={`Tampilkan slide ${i + 1}`}
                title={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer hover:scale-125 ${i === slide % slides.length ? 'w-8 bg-orange-500' : 'w-2 bg-white/20'}`}
              />
            ))}
          </div>
          <SlideArrows onPrev={goPrev} onNext={goNext} visible={navOn} />
          </>
          )}
        </div>

        {/* Kanan: kartu panggilan per jenis antrean.
            Di layar TV (lg) tiap kartu jadi container query: font diskala proporsional
            terhadap tinggi kartu (cqh) agar tak saling tumpuk walau layanannya banyak
            dan viewport pendek. Di layar kecil pakai ukuran fixed biasa. */}
        <div className="grid gap-2 lg:gap-3 content-start lg:content-stretch lg:auto-rows-fr lg:h-full min-h-0 overflow-hidden">
          {perService.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">Belum ada jenis antrean aktif.</div>}
          {perService.map(({ service, called, companions, nameCall }) => (
            <div key={service.id} className="bg-white rounded-xl border-2 border-slate-300 shadow-md px-4 py-2.5 lg:px-[3cqw] lg:py-[2cqh] text-center flex flex-col min-h-0 h-full overflow-hidden lg:[container-type:size]">
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1.5 lg:px-[2.5cqw] lg:py-[1.2cqh] text-xs lg:text-[8.5cqh] font-bold tracking-wider text-orange-700 uppercase leading-none whitespace-nowrap max-w-full overflow-hidden">
                  <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                  <span className="truncate">{service.name}</span>
                </span>
              </div>
              {called ? (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
                  {/* Perekaman KTP: panggil berbasis nama — nama tampil besar, nomor kecil di bawah */}
                  {nameCall && hasRealName(called.name) ? (
                    <>
                      <div className="font-extrabold text-[clamp(1.5rem,5vh,2.5rem)] lg:text-[26cqh] leading-tight tracking-tight text-slate-900 break-words">{String(called.name).trim()}</div>
                      <div className="text-sm lg:text-[10cqh] text-slate-400 mt-1 lg:mt-[0.8cqh] font-mono tabular-nums">{called.number}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-extrabold text-[clamp(2.5rem,9vh,4.5rem)] lg:text-[42cqh] leading-none tracking-tight text-slate-900 tabular-nums truncate">{called.number}</div>
                      {hasRealName(called.name) && (
                        <div className="text-sm lg:text-[8.5cqh] text-slate-500 mt-1 lg:mt-[0.8cqh] truncate">a.n. <b className="text-slate-700">{String(called.name).trim()}</b></div>
                      )}
                    </>
                  )}
                  {companions.length > 0 && (
                    <div className="mt-1.5 lg:mt-[1cqh] min-h-0 overflow-hidden">
                      <div className="text-[10px] lg:text-[7cqh] font-bold tracking-[0.14em] text-slate-400">JUGA DIPANGGIL</div>
                      <div className="flex justify-center gap-1.5 mt-1 flex-wrap">
                        {companions.map((c) => (
                          <span key={c.id} className="rounded-md bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs lg:text-[8cqh] font-extrabold text-orange-700 max-w-full truncate">{nameCall && hasRealName(c.name) ? String(c.name).trim() : <span className="tabular-nums">{c.number}</span>}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
                  <div className="font-extrabold text-[clamp(1.25rem,6vw,2rem)] lg:text-[13cqw] leading-tight text-slate-300 tracking-tight break-words">Menunggu</div>
                </div>
              )}
              {called && (
                <div className="shrink-0 border-t border-slate-100 mt-2 lg:mt-[1cqh] pt-2 lg:pt-[1cqh] text-sm lg:text-[8.5cqh] tabular-nums leading-snug">
                  <span className="font-semibold text-orange-700">{isLoketService(service) ? 'Silakan maju ke depan loket pelayanan' : 'Sedang Dilayani di Ruang Operator'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status suara: perlu 1x klik agar browser mengizinkan audio */}
      {(!supported || !unlocked || !enabled) && (
        <div className="mx-3 md:mx-4 mb-1 shrink-0">
          <button
            onClick={() => { wake(); if (supported && enabled) setUnlocked(true); else toggle() }}
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold flex items-center justify-center gap-2 no-print ${!supported ? 'bg-rose-500 text-white' : 'bg-amber-400 text-amber-950 hover:bg-amber-300'}`}
          >
            {!supported
              ? <><VolumeX size={18} /> Browser ini tidak mendukung suara otomatis — gunakan Chrome/Edge terbaru.</>
              : !enabled
                ? <><VolumeX size={18} /> Suara dimatikan — klik untuk menyalakan.</>
                : <><Volume2 size={18} /> Klik sekali untuk mengaktifkan suara panggilan.</>}
          </button>
        </div>
      )}
      {/* Ticker pengumuman */}      <footer className="bg-[#0b1220] text-white mt-1 shrink-0">
        <div className="flex items-center gap-4 px-4 py-4 overflow-hidden">
          <span className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm md:text-base font-extrabold tracking-wider">PENGUMUMAN</span>
          <div className="overflow-hidden whitespace-nowrap flex-1">
            <div className="flex w-max animate-ticker text-lg md:text-2xl font-bold text-white">
              <span className="whitespace-nowrap pr-24">{tickerLoop}</span>
              <span className="whitespace-nowrap pr-24" aria-hidden="true">{tickerLoop}</span>
            </div>
          </div>
        </div>
        <div className="h-[3px] bg-orange-500" />
      </footer>
    </div>
  )
}
