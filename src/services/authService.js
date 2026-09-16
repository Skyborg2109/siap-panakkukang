import { supabase, isSupabaseConfigured, assertSupabaseSession } from '../lib/supabase.js'
import { DEMO_USERS } from '../lib/constants.js'

function saveSession(user) {
  localStorage.setItem('siap_session', JSON.stringify(user))
}

export function getSession() {
  try {
    const user = JSON.parse(localStorage.getItem('siap_session') || 'null')
    // Normalisasi sesi lama (mis. role huruf kecil) agar guard rute konsisten
    if (user && user.role) user.role = String(user.role).trim().toUpperCase()
    return user
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem('siap_session')
}

export async function login(email, password) {
  const e = email.trim().toLowerCase()
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: e, password })
    if (error) throw new Error('Email atau password salah.')
    // maybeSingle: profil belum ada → null (bukan error coerce), agar pesan di bawah tampil jelas
    const { data: profile, error: pErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
    if (pErr) throw pErr
    if (!profile) throw new Error('Akun login OK, tapi profil belum terdaftar di tabel profiles. Minta admin menambahkan baris profil (id = user id, role ADMIN/PETUGAS).')
    const role = String(profile.role || '').trim().toUpperCase()
    if (!['ADMIN', 'PETUGAS'].includes(role)) throw new Error(`Role akun ini tidak valid ("${profile.role}"). Minta admin ubah role di tabel profiles menjadi ADMIN / PETUGAS.`)
    const user = { id: data.user.id, email: e, name: profile.full_name || e, role, counter_id: null, counter_name: null }
    saveSession(user)
    return user
  }
  const found = DEMO_USERS.find((u) => u.email === e && u.password === password)
  if (found) {
    const user = { id: found.id, email: found.email, name: found.name, role: found.role, counter_id: null, counter_name: null }
    saveSession(user)
    return user
  }
  // User custom yang dibuat via Tambah Pengguna (demo) — password tersimpan
  // di siap_users sejak perbaikan (entri lama tanpa password tetap ditolak).
  const custom = JSON.parse(localStorage.getItem('siap_users') || '[]')
  const hit = custom.find((u) => String(u.email || '').toLowerCase() === e && u.password && u.password === password)
  if (!hit) throw new Error('Email atau password salah. Coba admin@panakkukang.go.id / admin123')
  const cu = { id: hit.id, email: hit.email, name: hit.full_name || hit.email, role: String(hit.role || 'PETUGAS').toUpperCase(), counter_id: null, counter_name: null }
  saveSession(cu)
  return cu
}

export async function logout() {
  if (isSupabaseConfigured) await supabase.auth.signOut()
  clearSession()
}

// Admin: daftar & kelola pengguna (demo mode: localStorage)
export async function getUsers() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
  const custom = JSON.parse(localStorage.getItem('siap_users') || '[]')
  return [...custom, ...DEMO_USERS.map((u) => ({ id: u.id, email: u.email, full_name: u.name, role: u.role, demo: true }))]
}

export async function createUser(payload) {
  if (isSupabaseConfigured) {
    // Prod satu-klik: buat user Auth via signUp + insert baris profiles
    // dengan UID yang dikembalikan (profiles.id FK ke auth.users, tanpa
    // default — tak bisa dibuat tanpa UID). Tanpa Edge Function + service_role
    // key, signUp adalah satu-satunya cara client-side membuat auth user.
    // signUp MENIMPA sesi lokal dengan user baru bila konfirmasi email MATI —
    // sesi admin disimpan dulu dan dikembalikan setelahnya agar admin tidak
    // ter-logout. Bila konfirmasi email NYALA, sesi tak berubah tapi user baru
    // wajib klik link verifikasi di inbox sebelum bisa login.
    const name = String(payload.name || '').trim()
    const email = String(payload.email || '').trim().toLowerCase()
    const password = String(payload.password || '')
    const role = String(payload.role || 'PETUGAS').trim().toUpperCase()
    if (!name) throw new Error('Nama wajib diisi.')
    if (!email) throw new Error('Email wajib diisi.')
    if (password.length < 6) throw new Error('Password minimal 6 karakter.')
    if (!['ADMIN', 'PETUGAS'].includes(role)) throw new Error('Role harus ADMIN / PETUGAS.')
    await assertSupabaseSession()
    let adminSession = null
    try {
      adminSession = (await supabase.auth.getSession()).data?.session || null
    } catch { /* abaikan */ }
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) {
        if (/already registered|already been registered|already exists/i.test(error.message || '')) {
          throw new Error('Email ini sudah terdaftar di Authentication. Gunakan email lain, atau hapus user lama di Supabase Dashboard → Authentication → Users.')
        }
        throw new Error(`Gagal membuat user Auth: ${error.message}`)
      }
      const uid = data?.user?.id
      if (!uid) throw new Error('Pendaftaran tidak mengembalikan user baru — email mungkin sudah terdaftar. Cek Authentication di dashboard.')
      // Kembalikan sesi admin DULU agar insert profiles lolos RLS admin.
      try {
        if (adminSession) await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token })
      } catch { /* abaikan — admin cukup login ulang bila gagal */ }
      const { data: profile, error: pErr } = await supabase.from('profiles').insert({
        id: uid, email, full_name: name, role,
      }).select().single()
      if (pErr) {
        if (pErr.code === '23505') throw new Error('Profil untuk email ini sudah ada di tabel profiles.')
        throw pErr
      }
      return profile
    } finally {
      // Pastikan sesi admin kembali (signUp tanpa konfirmasi email menimpa sesi lokal).
      try {
        if (adminSession) await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token })
      } catch { /* abaikan */ }
    }
  }
  const custom = JSON.parse(localStorage.getItem('siap_users') || '[]')
  const item = { id: `u-${Date.now()}`, email: String(payload.email || '').trim().toLowerCase(), full_name: payload.name, role: payload.role, password: payload.password || '' }
  localStorage.setItem('siap_users', JSON.stringify([item, ...custom]))
  window.dispatchEvent(new Event('siap:master-changed'))
  return item
}

export async function deleteUser(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) throw error
    return true
  }
  const custom = JSON.parse(localStorage.getItem('siap_users') || '[]')
  localStorage.setItem('siap_users', JSON.stringify(custom.filter((u) => u.id !== id)))
  window.dispatchEvent(new Event('siap:master-changed'))
  return true
}
