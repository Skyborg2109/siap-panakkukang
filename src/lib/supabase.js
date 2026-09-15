import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null

// Guard sesi sebelum aksi staf (panggil/ubah antrean, KK, broadcast).
// Tanpa sesi Supabase yang valid, RLS menolak diam-diam (0 baris) sehingga
// .single() meledak dengan "Cannot coerce..." yang membingungkan.
export async function assertSupabaseSession() {
  if (!isSupabaseConfigured) return
  try {
    const { data } = await supabase.auth.getSession()
    if (!data?.session) throw new Error('Sesi login berakhir. Silakan logout lalu login ulang sebagai petugas.')
  } catch (e) {
    if (/sesi login/i.test(e?.message || '')) throw e
    // Pengecekan gagal (offline dsb) — lanjutkan request apa adanya
  }
}

// Terjemahkan error PostgREST yang samar menjadi pesan yang bisa ditindaklanjuti.
export function friendlySupabaseError(error, fallback = 'Operasi database gagal.') {
  if (!error) return new Error(fallback)
  const code = String(error.code || '')
  const msg = String(error.message || '')
  // PGRST116: .single() menerima 0 baris — biasanya RLS menolak (sesi
  // kedaluwarsa / profil hilang / role salah) atau data sudah tidak ada.
  if (code === 'PGRST116' || /cannot coerce/i.test(msg)) {
    return new Error('Data tidak ditemukan atau akses ditolak. Kemungkinan sesi login kedaluwarsa — logout lalu login ulang sebagai petugas. Bila berlanjut, pastikan akun terdaftar di tabel profiles dengan role PETUGAS/ADMIN dan schema.sql terbaru sudah dijalankan.')
  }
  return error
}
