import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
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
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
    if (!profile) throw new Error('Profil pengguna belum terdaftar di tabel profiles.')
    const role = String(profile.role || '').trim().toUpperCase()
    if (!['ADMIN', 'PETUGAS'].includes(role)) throw new Error(`Role akun ini tidak valid ("${profile.role}"). Minta admin ubah role di tabel profiles menjadi ADMIN / PETUGAS.`)
    const user = { id: data.user.id, email: e, name: profile.full_name || e, role, counter_id: null, counter_name: null }
    saveSession(user)
    return user
  }
  const found = DEMO_USERS.find((u) => u.email === e && u.password === password)
  if (!found) throw new Error('Email atau password salah. Coba admin@panakkukang.go.id / admin123')
  const user = { id: found.id, email: found.email, name: found.name, role: found.role, counter_id: null, counter_name: null }
  saveSession(user)
  return user
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
    // Admin membuat user via signUp lalu insert profile (disederhanakan: insert profile; user auth dibuat manual/Supabase dashboard)
    const { data, error } = await supabase.from('profiles').insert({
      email: payload.email,
      full_name: payload.name,
      role: payload.role,
    }).select().single()
    if (error) throw error
    return data
  }
  const custom = JSON.parse(localStorage.getItem('siap_users') || '[]')
  const item = { id: `u-${Date.now()}`, email: payload.email, full_name: payload.name, role: payload.role }
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
