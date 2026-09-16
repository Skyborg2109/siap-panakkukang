import { todayKey, makeQueueNumber } from './date.js'

const LS_KEYS = {
  queues: 'siap_queues',
  kk: 'siap_kk_announcements',
  broadcast: 'siap_broadcasts',
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    // picu event untuk tab lain (display TV)
    window.dispatchEvent(new Event('siap:queues-changed'))
  } catch {
    /* abaikan */
  }
}

export function getTodayQueues() {
  const all = readLS(LS_KEYS.queues, [])
  return all.filter((q) => q.queue_date === todayKey())
}

export function getAllLocalQueues() {
  return readLS(LS_KEYS.queues, [])
}

export function saveLocalQueue(queue) {
  const all = readLS(LS_KEYS.queues, [])
  all.push(queue)
  writeLS(LS_KEYS.queues, all)
  return queue
}

export function updateLocalQueue(id, patch) {
  const all = readLS(LS_KEYS.queues, [])
  const next = all.map((q) => (q.id === id ? { ...q, ...patch, updated_at: new Date().toISOString() } : q))
  writeLS(LS_KEYS.queues, next)
  return next.find((q) => q.id === id)
}

export function clearTodayLocalQueues() {
  const all = readLS(LS_KEYS.queues, [])
  writeLS(LS_KEYS.queues, all.filter((q) => q.queue_date !== todayKey()))
  return true
}

// Penanda reset ronde (localStorage, per browser panel): progress bar kuota
// dihitung dari baris yang terbit SETELAH reset terakhir hari ini, agar bar
// ikut nol saat "Reset Antrean Hari Ini" ditekan. Penegakan kuota harian
// (di RPC / kuota kupon fisik) tetap menghitung SELURUH baris hari ini.
const LS_RESET_AT = 'siap_reset_at'

export function markResetNow() {
  try {
    const v = new Date().toISOString()
    localStorage.setItem(LS_RESET_AT, v)
    return v
  } catch { return null }
}

// ISO timestamp reset bila terjadi hari ini (kalender lokal), selain itu null.
export function getTodayResetAt() {
  try {
    const raw = localStorage.getItem(LS_RESET_AT)
    if (!raw) return null
    const d = new Date(raw)
    const now = new Date()
    if (Number.isNaN(d.getTime())) return null
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    return sameDay ? raw : null
  } catch { return null }
}

export function nextSequenceForService(serviceId) {
  const today = getTodayQueues().filter((q) => q.service_id === serviceId)
  const max = today.reduce((m, q) => Math.max(m, q.sequence || 0), 0)
  return max + 1
}

export function createLocalQueue({ service, name, nik = '' }) {
  const seq = nextSequenceForService(service.id)
  const now = new Date().toISOString()
  const queue = {
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    queue_date: todayKey(),
    service_id: service.id,
    service_name: service.name,
    prefix: service.prefix,
    sequence: seq,
    number: makeQueueNumber(service.prefix, seq),
    name: name?.trim() || 'Tanpa Nama',
    nik: nik?.trim() || '',
    status: 'WAITING',
    counter_id: null,
    counter_name: null,
    called_at: null,
    created_at: now,
    updated_at: now,
  }
  return saveLocalQueue(queue)
}

// ---- Kunci pemanggilan antar-petugas (anti-tumpang pengumuman) ----
// Setiap panggilan antrean yang berhasil mencatat {at, by} ke localStorage
// (sinyal instan antar-tab satu browser). Siapa pun yang menekan tombol
// panggil dalam jendela cooldown — TERMASUK tab yang memanggil tadi —
// ditolak dengan notifikasi "coba lagi nanti", karena pengumuman audio
// (opening → 2x → closing, ±30 dtk) masih berbunyi dan rangkaian TTS baru
// akan membatalkan (menimpa) yang lama.
// `by` = id acak per tab (sessionStorage), hanya untuk diagnostik.
// Pemeriksaan utama ada di panel petugas: kunci instan ini + `called_at`
// terbaru dari server (lintas perangkat, via polling) — lihat callLockMsg.
const LS_CALL_LOCK = 'siap_call_lock'
export const CALL_LOCK_SECONDS = 30

function tabId() {
  try {
    let id = sessionStorage.getItem('siap_tab_id')
    if (!id) {
      id = `tab-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      sessionStorage.setItem('siap_tab_id', id)
    }
    return id
  } catch { return 'tab-unknown' }
}

export function markCallLock() {
  try {
    localStorage.setItem(LS_CALL_LOCK, JSON.stringify({ at: new Date().toISOString(), by: tabId() }))
  } catch { /* abaikan */ }
}

// Gabungan dua sinyal kunci dalam sisa detik (0 = bebas), diambil yang
// terpanjang: kunci instan localStorage (antar-tab satu browser, real-time)
// + `called_at` terbaru baris CALLED/SERVING (lintas perangkat via polling;
// buta maks ~3 dtk + selisih jam perangkat). Dipisah sebagai fungsi murni
// modul (tanpa Date.now di badan render) agar lolos aturan react/purity.
export function callLockRemaining(rows = []) {
  let remaining = 0
  const lock = otherCallInProgress()
  if (lock) remaining = Math.max(remaining, lock.remainingSec)
  const now = Date.now()
  let latest = 0
  for (const q of rows || []) {
    if (q?.status !== 'CALLED' && q?.status !== 'SERVING') continue
    const t = new Date(q.called_at || q.created_at || 0).getTime()
    if (Number.isFinite(t) && t > latest) latest = t
  }
  if (latest) {
    const ageSec = (now - latest) / 1000
    if (ageSec >= 0 && ageSec < CALL_LOCK_SECONDS) {
      remaining = Math.max(remaining, Math.max(1, Math.ceil(CALL_LOCK_SECONDS - ageSec)))
    }
  }
  return remaining
}

// Sisa cooldown (detik) kunci instan bila ada panggilan APAPUN yang masih
// dalam jendela — termasuk dari tab sendiri; null bila bebas. Kedaluwarsa
// otomatis lewat timestamp sehingga tidak ada macet permanen.
export function otherCallInProgress() {
  try {
    const raw = localStorage.getItem(LS_CALL_LOCK)
    if (!raw) return null
    const lock = JSON.parse(raw)
    if (!lock || !lock.at) return null
    const ageSec = (Date.now() - new Date(lock.at).getTime()) / 1000
    if (!(ageSec >= 0) || ageSec >= CALL_LOCK_SECONDS) return null
    return { remainingSec: Math.max(1, Math.ceil(CALL_LOCK_SECONDS - ageSec)) }
  } catch { return null }
}

// Nama kosong / placeholder "Tanpa Nama" (kupon dipanggil tanpa input nama)
// → perlakukan sebagai tanpa nama (voice + display cukup sebut nomor)
export function hasRealName(name) {
  const nm = String(name || '').trim()
  return nm !== '' && nm.toLowerCase() !== 'tanpa nama'
}

// Teks panggilan KK: catatan + tujuan ruang pelayanan.
// Tanpa duplikasi bila catatan sudah menyebut tujuannya sendiri.
export function kkCallNote(note, counterName) {
  const n = String(note || '').trim().replace(/[.]+$/, '')
  const tujuan = counterName ? `silakan menuju ${counterName}` : 'silakan masuk ke ruang pelayanan'
  if (!n) return 'silakan masuk ke ruang pelayanan untuk konsultasi ulang'
  const low = n.toLowerCase()
  if (low.includes('ruang pelayanan') || low.includes('menuju ')) return n
  return `${n}, ${tujuan}`
}

// ---- KK announcements (tanpa nomor, BR-09) ----
export function getLocalKK() {
  return readLS(LS_KEYS.kk, [])
}

export function addLocalKK({ name, note }) {
  const all = readLS(LS_KEYS.kk, [])
  const item = {
    id: `kk-${Date.now()}`,
    name,
    note: note || 'Berkas belum lengkap, silakan masuk ke ruang pelayanan untuk konsultasi ulang.',
    created_at: new Date().toISOString(),
  }
  all.unshift(item)
  writeLS(LS_KEYS.kk, all.slice(0, 20))
  return item
}

// ---- Broadcast pengumuman spontan petugas (one-off ke Display TV + audio) ----
export function getLocalBroadcasts() {
  return readLS(LS_KEYS.broadcast, [])
}

export function addLocalBroadcast({ message }) {
  const all = readLS(LS_KEYS.broadcast, [])
  const item = {
    id: `bc-${Date.now()}`,
    message,
    created_at: new Date().toISOString(),
  }
  all.unshift(item)
  writeLS(LS_KEYS.broadcast, all.slice(0, 20))
  return item
}
