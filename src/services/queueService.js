import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { todayKey, makeQueueNumber } from '../utils/date.js'
import { quotaFor } from '../lib/constants.js'
import { createLocalQueue, getTodayQueues, updateLocalQueue, getAllLocalQueues, saveLocalQueue } from '../utils/queue.js'

// Ambil nomor antrean — via RPC Supabase (anti-duplikat + cek kuota) atau local fallback
export async function takeQueue({ service, name, nik }) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('take_queue_number', {
      p_service_id: service.id,
      p_name: name,
      p_nik: nik || null,
    })
    if (error) throw error
    return Array.isArray(data) ? data[0] : data
  }
  const quota = quotaFor(service)
  const issued = getTodayQueues().filter((q) => q.service_id === service.id).length
  if (issued >= quota) throw new Error(`Kuota ${service.name} hari ini sudah penuh (${quota}).`)
  return createLocalQueue({ service, name, nik })
}

export async function getTodayQueueList() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('queues')
      .select('*, services(name,prefix)')
      .eq('queue_date', todayKey())
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(normalizeRow)
  }
  return getTodayQueues()
}

export async function getQueueById(id) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('queues').select('*, services(name,prefix)').eq('id', id).single()
    if (error) throw error
    return normalizeRow(data)
  }
  return getAllLocalQueues().find((q) => q.id === id) || null
}

function normalizeRow(r) {
  if (!r) return r
  return {
    ...r,
    service_name: r.service_name || r.services?.name,
    prefix: r.prefix || r.services?.prefix,
    counter_name: r.counter_name || null,
  }
}

// Estimasi posisi & waktu tunggu
export function estimateWait(list, queue) {
  const waitingSameService = list.filter(
    (q) => q.service_id === queue.service_id && q.status === 'WAITING' && new Date(q.created_at) < new Date(queue.created_at),
  )
  const position = waitingSameService.length + 1
  return { ahead: waitingSameService.length, position, estMinutes: waitingSameService.length * 5 }
}

// ---- Aksi petugas ----
export async function callNext({ serviceIds }) {
  const list = await getTodayQueueList()
  // Batch calling BR-11: antrean ≤2 detik digabung — disederhanakan: ambil WAITING terlama
  let candidates = list.filter((q) => q.status === 'WAITING')
  if (serviceIds?.length) candidates = candidates.filter((q) => serviceIds.includes(q.service_id))
  candidates.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const next = candidates[0]
  if (!next) return null
  return setStatus(next.id, 'CALLED')
}

export async function setStatus(id, status, extra = {}) {
  const patch = { status, ...extra, updated_at: new Date().toISOString() }
  if (status === 'CALLED' || status === 'SERVING') patch.called_at = patch.called_at || new Date().toISOString()
  if (status === 'COMPLETED') patch.completed_at = new Date().toISOString()

  if (isSupabaseConfigured) {
    // Guard BR-05: cegah dua petugas melayani bersamaan (optimistic check)
    const { data, error } = await supabase.from('queues').update(patch).eq('id', id).select('*, services(name,prefix)').single()
    if (error) throw error
    return normalizeRow(data)
  }
  return updateLocalQueue(id, patch)
}

export const recallQueue = (id) => setStatus(id, 'CALLED')
export const skipQueue = (id) => setStatus(id, 'SKIPPED')
export const serveQueue = (id) => setStatus(id, 'SERVING')
export const completeQueue = (id) => setStatus(id, 'COMPLETED')

// Parse nomor kupon fisik: "KTP-5" atau cukup "5" (prefix mengikuti layanan)
function parseQueueNumber(service, raw) {
  const t = String(raw || '').trim().toUpperCase()
  const prefix = (service.prefix || '').toUpperCase()
  let seqPart = t
  if (t.includes('-')) {
    const [p, ...rest] = t.split('-')
    if (p !== prefix) throw new Error(`Nomor harus diawali ${prefix}- untuk layanan ini.`)
    seqPart = rest.join('-')
  }
  const seq = Number.parseInt(seqPart, 10)
  if (!Number.isFinite(seq) || seq < 1 || seq > 999) {
    throw new Error(`Nomor tidak valid. Contoh: ${prefix}-5 (atau cukup ketik 5).`)
  }
  return { prefix, seq }
}

// Panggilan kupon fisik bebas — nomor mana pun boleh dipanggil langsung
// (termasuk nomor yang terlewati / melompati nomor di bawahnya).
// rows tidak lagi dipakai, dipertahankan sebagai argumen opsional agar kompatibel.

// Batas nomor dalam sekali panggil serentak (cegah spam panggil + TTS kepanjangan)
export const MAX_BATCH_CALL = 10

// Parse input multi-nomor: "5", "KTP-5", "5,6,7", "5-8", "KTP-5, 7-8".
// Kembalian: array nomor penuh terurut menaik tanpa duplikat.
export function parseQueueNumbers(service, raw, max = MAX_BATCH_CALL) {
  const text = String(raw || '').trim()
  if (!text) throw new Error('Masukkan nomor antrean.')
  const seqs = []
  for (const tok of text.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean)) {
    const range = tok.match(/^(\d{1,3})\s*-\s*(\d{1,3})$/)
    if (range) {
      let a = Number.parseInt(range[1], 10)
      let b = Number.parseInt(range[2], 10)
      if (a > b) [a, b] = [b, a]
      if (b - a + 1 > max) throw new Error(`Rentang ${tok} melebihi batas ${max} nomor sekaligus.`)
      for (let n = a; n <= b; n++) seqs.push(n)
    } else {
      // Satu token bisa berisi beberapa nomor pisah-spasi ("5 6 7");
      // bentuk "PREFIX-N" tidak mengandung spasi sehingga aman dipecah.
      for (const part of tok.split(/\s+/).filter(Boolean)) {
        seqs.push(parseQueueNumber(service, part).seq)
      }
    }
  }
  const uniq = [...new Set(seqs)].sort((x, y) => x - y)
  if (!uniq.length) throw new Error('Masukkan nomor antrean.')
  if (uniq.length > max) throw new Error(`Maksimal ${max} nomor dalam sekali panggil.`)
  const prefix = (service.prefix || '').toUpperCase()
  return uniq.map((seq) => makeQueueNumber(prefix, seq))
}

// Panggil langsung nomor kupon: kalau nomor belum terdaftar hari ini, dibuatkan
// persis sesuai kupon lalu langsung CALLED. Nomor yang sudah ada → panggil ulang.
// `calledAt` opsional: cap waktu CALLED eksplisit agar satu batch serentak
// berbagi called_at identik (dipakai Display untuk mengelompokkan + mengumumkan gabungan).
export async function callDirect({ service, number, name, calledAt }) {
  const { prefix, seq } = parseQueueNumber(service, number)
  const fullNumber = makeQueueNumber(prefix, seq)
  const now = calledAt || new Date().toISOString()
  const holder = (name || '').trim() || 'Tanpa Nama'

  if (isSupabaseConfigured) {
    const { data: existing } = await supabase
      .from('queues')
      .select('*, services(name,prefix)')
      .eq('queue_date', todayKey())
      .eq('service_id', service.id)
      .eq('number', fullNumber)
      .maybeSingle()
    if (existing) return setStatus(existing.id, 'CALLED', { called_at: now })

    const { data: todayRows, error: rowsErr } = await supabase
      .from('queues')
      .select('sequence,status')
      .eq('queue_date', todayKey())
      .eq('service_id', service.id)
    if (rowsErr) throw rowsErr

    const quota = quotaFor(service)
    if ((todayRows || []).length >= quota) throw new Error(`Kuota ${service.name} hari ini sudah penuh (${quota}).`)

    const { data, error } = await supabase.from('queues').insert({
      queue_date: todayKey(),
      service_id: service.id,
      service_name: service.name,
      prefix,
      sequence: seq,
      number: fullNumber,
      name: holder,
      status: 'CALLED',
      called_at: now,
    }).select('*, services(name,prefix)').single()
    if (error) {
      // Balapan dengan petugas lain: nomor keburu dibuat → panggil yang sudah ada
      if (error.code === '23505') {
        const { data: retry } = await supabase
          .from('queues')
          .select('*, services(name,prefix)')
          .eq('queue_date', todayKey())
          .eq('service_id', service.id)
          .eq('number', fullNumber)
          .single()
        if (retry) return setStatus(retry.id, 'CALLED', { called_at: now })
      }
      throw error
    }
    return normalizeRow(data)
  }

  const all = getAllLocalQueues()
  const found = all.find(
    (q) => q.queue_date === todayKey() && q.service_id === service.id && String(q.number).toUpperCase() === fullNumber,
  )
  if (found) return updateLocalQueue(found.id, { status: 'CALLED', called_at: now })

  const rows = all.filter((q) => q.queue_date === todayKey() && q.service_id === service.id)

  const quota = quotaFor(service)
  if (rows.length >= quota) throw new Error(`Kuota ${service.name} hari ini sudah penuh (${quota}).`)
  return saveLocalQueue({
    id: `q-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    queue_date: todayKey(),
    service_id: service.id,
    service_name: service.name,
    prefix,
    sequence: seq,
    number: fullNumber,
    name: holder,
    nik: '',
    status: 'CALLED',
    counter_id: null,
    counter_name: null,
    called_at: now,
    created_at: now,
    updated_at: now,
  })
}

// Panggil beberapa nomor kupon sekaligus (batch): parse input multi-nomor,
// panggil menaik — tanpa aturan urutan, nomor terlewati pun boleh dipanggil —
// dengan satu called_at bersama agar Display mengelompokkannya.
export async function callDirectMany({ service, raw, name }) {
  const numbers = parseQueueNumbers(service, raw)
  const calledAt = new Date().toISOString()
  const out = []
  for (const number of numbers) {
    out.push(await callDirect({ service, number, name: numbers.length === 1 ? name : '', calledAt }))
  }
  return out
}

// Reset seluruh antrean hari ini (tombol Reset Antrean Hari Ini)
export async function resetToday() {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('queues').delete().eq('queue_date', todayKey())
    if (error) throw error
    return true
  }
  const { clearTodayLocalQueues } = await import('../utils/queue.js')
  return clearTodayLocalQueues()
}

export async function getHistory({ date = todayKey(), status, limit = 200 } = {}) {
  if (isSupabaseConfigured) {
    let q = supabase.from('queues').select('*, services(name,prefix)').eq('queue_date', date).order('created_at', { ascending: false }).limit(limit)
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw error
    return (data || []).map(normalizeRow)
  }
  let all = getAllLocalQueues().filter((x) => x.queue_date === date)
  if (status) all = all.filter((x) => x.status === status)
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit)
}

export async function getStats(date = todayKey()) {
  const list = isSupabaseConfigured
    ? await getHistory({ date, limit: 2000 })
    : getAllLocalQueues().filter((x) => x.queue_date === date)
  const by = (s) => list.filter((q) => q.status === s).length
  const perService = {}
  list.forEach((q) => {
    const k = q.service_name || q.service_id
    perService[k] = perService[k] || { name: k, total: 0, waiting: 0, completed: 0, skipped: 0 }
    perService[k].total += 1
    if (q.status === 'WAITING') perService[k].waiting += 1
    if (q.status === 'COMPLETED') perService[k].completed += 1
    if (q.status === 'SKIPPED') perService[k].skipped += 1
  })
  return {
    total: list.length,
    waiting: by('WAITING'),
    called: by('CALLED'),
    serving: by('SERVING'),
    completed: by('COMPLETED'),
    skipped: by('SKIPPED'),
    perService: Object.values(perService),
  }
}
