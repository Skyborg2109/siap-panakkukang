import { supabase, isSupabaseConfigured, assertSupabaseSession, friendlySupabaseError } from '../lib/supabase.js'
import { getLocalKK, getLocalBroadcasts } from '../utils/queue.js'

export async function getDisplayImages() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('display_images').select('*').eq('is_active', true).order('sort_order')
    if (error) throw error
    return data.map((d) => ({ ...d, url: imageUrl(d.file_path) }))
  }
  return JSON.parse(localStorage.getItem('siap_display_images') || '[]').filter((d) => d.is_active !== false)
}

export async function getAllDisplayImages() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('display_images').select('*').order('sort_order')
    if (error) throw error
    return (data || []).map((d) => ({ ...d, url: imageUrl(d.file_path) }))
  }
  return JSON.parse(localStorage.getItem('siap_display_images') || '[]')
}

export function imageUrl(filePath) {
  if (!filePath) return ''
  if (filePath.startsWith('http') || filePath.startsWith('data:')) return filePath
  if (!isSupabaseConfigured) return filePath
  return supabase.storage.from('display-images').getPublicUrl(filePath).data.publicUrl
}

export async function uploadDisplayImage({ file, base64, category, name, title, description }) {
  if (isSupabaseConfigured) {
    if (!file) throw new Error('Pilih file gambar dulu.')
    const path = `${category}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('display-images').upload(path, file)
    if (error) throw new Error(`Upload Storage gagal: ${error.message}`)
    const { data, error: dbErr } = await supabase.from('display_images').insert({
      category, file_path: path, name, title, description, is_active: true,
    }).select().single()
    if (dbErr) throw new Error(`Simpan database gagal: ${dbErr.message}`)
    return { ...data, url: imageUrl(data.file_path) }
  }
  // Demo: simpan base64 di localStorage
  const all = JSON.parse(localStorage.getItem('siap_display_images') || '[]')
  const item = { id: `img-${Date.now()}`, category, file_path: base64, url: base64, name, title, description, is_active: true, created_at: new Date().toISOString() }
  localStorage.setItem('siap_display_images', JSON.stringify([item, ...all]))
  window.dispatchEvent(new Event('siap:master-changed'))
  return item
}

export async function deleteDisplayImage(id, filePath) {
  if (isSupabaseConfigured) {
    if (filePath && !filePath.startsWith('http')) {
      await supabase.storage.from('display-images').remove([filePath])
    }
    const { error } = await supabase.from('display_images').delete().eq('id', id)
    if (error) throw error
    return true
  }
  const all = JSON.parse(localStorage.getItem('siap_display_images') || '[]')
  localStorage.setItem('siap_display_images', JSON.stringify(all.filter((x) => x.id !== id)))
  window.dispatchEvent(new Event('siap:master-changed'))
  return true
}

// ---- Gambar informasi istirahat (tampil di Display TV selama jam istirahat) ----
// Disimpan sebagai SATU baris display_contents key='rest' (tanpa migrasi DB):
// content = JSON { enabled, start "HH:MM", end "HH:MM", image }.
// image = path Storage (prod) / base64 / http — resolve via imageUrl().
const REST_KEY = 'siap_rest'

export function defaultRestConfig() {
  return { enabled: false, start: '12:00', end: '13:00', image: '' }
}

export async function getRestConfig() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('display_contents').select('*').eq('key', 'rest').maybeSingle()
    if (error) throw error
    if (!data) return defaultRestConfig()
    try {
      return { ...defaultRestConfig(), ...JSON.parse(data.content || '{}') }
    } catch {
      return defaultRestConfig()
    }
  }
  try {
    const raw = localStorage.getItem(REST_KEY)
    if (raw) return { ...defaultRestConfig(), ...JSON.parse(raw) }
  } catch { /* abaikan */ }
  return defaultRestConfig()
}

export async function saveRestConfig(payload) {
  const value = {
    enabled: payload.enabled !== false,
    start: String(payload.start || '12:00'),
    end: String(payload.end || '13:00'),
    image: String(payload.image || ''),
  }
  if (isSupabaseConfigured) {
    await assertSupabaseSession()
    const { error } = await supabase.from('display_contents').upsert({ key: 'rest', title: 'Gambar Istirahat', content: JSON.stringify(value) })
    if (error) throw friendlySupabaseError(error)
    return value
  }
  localStorage.setItem(REST_KEY, JSON.stringify(value))
  window.dispatchEvent(new Event('siap:master-changed'))
  return value
}

// Upload gambar istirahat: prod → Storage display-images path rest/... (publik,
// tanpa baris display_images agar tak kena check kategori); demo → base64.
export async function uploadRestImage({ file, base64 }) {
  if (isSupabaseConfigured) {
    await assertSupabaseSession()
    if (!file) throw new Error('Pilih file gambar dulu.')
    const path = `rest/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('display-images').upload(path, file)
    if (error) throw new Error(`Upload Storage gagal: ${error.message}`)
    return path
  }
  if (!base64) throw new Error('Pilih file gambar dulu.')
  return base64
}

export async function deleteRestImage(filePath) {
  if (isSupabaseConfigured) {
    if (filePath && !filePath.startsWith('http') && !filePath.startsWith('data:')) {
      await supabase.storage.from('display-images').remove([filePath])
    }
    return true
  }
  return true
}

// KK terbaru hari ini untuk Display TV (banner + audio)
export async function getLatestKK() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('kk_announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data || null
  }
  return getLocalKK()[0] || null
}

// KK announcement — panggil kasus KK tanpa nomor (BR-09)
export async function callKKCase({ name, note, counterName }) {
  if (isSupabaseConfigured) {
    await assertSupabaseSession()
    const { data, error } = await supabase.from('kk_announcements').insert({ name, note, counter_name: counterName }).select().single()
    if (error) throw friendlySupabaseError(error)
    return data
  }
  const { addLocalKK } = await import('../utils/queue.js')
  return addLocalKK({ name, note })
}

// Broadcast terbaru untuk Display TV (banner + audio, tampil ±20 detik)
export async function getLatestBroadcast() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data || null
  }
  return getLocalBroadcasts()[0] || null
}

// Pengumuman spontan petugas ke masyarakat (one-off, bukan ticker)
export async function sendBroadcast({ message }) {
  const msg = String(message || '').trim()
  if (msg.length < 3) throw new Error('Isi pengumuman minimal 3 huruf.')
  if (isSupabaseConfigured) {
    await assertSupabaseSession()
    const { data, error } = await supabase.from('broadcasts').insert({ message: msg }).select().single()
    if (error) throw friendlySupabaseError(error)
    return data
  }
  const { addLocalBroadcast } = await import('../utils/queue.js')
  return addLocalBroadcast({ message: msg })
}
