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
