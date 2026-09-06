import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { SEED_SERVICES, SEED_REQUIREMENTS, SEED_INFORMATION, SEED_ANNOUNCEMENTS, SEED_IKD } from '../lib/constants.js'

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  localStorage.setItem(key, JSON.stringify(fallback))
  return fallback
}

function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val))
  window.dispatchEvent(new Event('siap:master-changed'))
}

// ---------- SERVICES ----------
export async function getServices() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('sort_order')
    if (error) throw error
    return data
  }
  return lsGet('siap_services_v2', SEED_SERVICES).filter((s) => s.is_active)
}

export async function getAllServices() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('services').select('*').order('sort_order')
    if (error) throw error
    return data
  }
  return lsGet('siap_services_v2', SEED_SERVICES)
}

export async function upsertService(payload) {
  if (isSupabaseConfigured) {
    if (payload.id) {
      const { data, error } = await supabase.from('services').update(payload).eq('id', payload.id).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('services').insert(payload).select().single()
    if (error) throw error
    return data
  }
  const all = lsGet('siap_services_v2', SEED_SERVICES)
  if (payload.id) {
    const next = all.map((s) => (s.id === payload.id ? { ...s, ...payload } : s))
    lsSet('siap_services_v2', next)
    return payload
  }
  const item = { ...payload, id: `svc-${Date.now()}` }
  lsSet('siap_services_v2', [...all, item])
  return item
}

export async function deleteService(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) throw error
    return true
  }
  lsSet('siap_services_v2', lsGet('siap_services_v2', SEED_SERVICES).filter((s) => s.id !== id))
  return true
}

// ---------- REQUIREMENTS / INFORMATION / ANNOUNCEMENTS ----------
export async function getRequirements(serviceId) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('service_requirements').select('*').eq('service_id', serviceId).order('sort_order')
    if (error) throw error
    return data
  }
  const all = lsGet('siap_requirements', SEED_REQUIREMENTS)
  const found = all.find((r) => r.service_id === serviceId)
  return (found?.items || []).map((text, i) => ({ id: `${serviceId}-${i}`, requirement: text }))
}

export async function getInformation() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('information').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
  return lsGet('siap_information', SEED_INFORMATION).filter((i) => i.is_active)
}

export async function getAllInformation() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('information').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
  return lsGet('siap_information', SEED_INFORMATION)
}

export async function upsertInformation(payload) {
  if (isSupabaseConfigured) {
    if (payload.id) {
      const { data, error } = await supabase.from('information').update(payload).eq('id', payload.id).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('information').insert(payload).select().single()
    if (error) throw error
    return data
  }
  const all = lsGet('siap_information', SEED_INFORMATION)
  if (payload.id) {
    const next = all.map((i) => (i.id === payload.id ? { ...i, ...payload } : i))
    lsSet('siap_information', next)
    return payload
  }
  const item = { ...payload, id: `info-${Date.now()}` }
  lsSet('siap_information', [item, ...all])
  return item
}

export async function deleteInformation(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('information').delete().eq('id', id)
    if (error) throw error
    return true
  }
  lsSet('siap_information', lsGet('siap_information', SEED_INFORMATION).filter((i) => i.id !== id))
  return true
}

export async function getAnnouncements(activeOnly = true) {
  if (isSupabaseConfigured) {
    let q = supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q
    if (error) throw error
    return data
  }
  const all = lsGet('siap_announcements', SEED_ANNOUNCEMENTS)
  return activeOnly ? all.filter((a) => a.is_active) : all
}

export async function upsertAnnouncement(payload) {
  if (isSupabaseConfigured) {
    if (payload.id) {
      const { data, error } = await supabase.from('announcements').update(payload).eq('id', payload.id).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase.from('announcements').insert(payload).select().single()
    if (error) throw error
    return data
  }
  const all = lsGet('siap_announcements', SEED_ANNOUNCEMENTS)
  if (payload.id) {
    const next = all.map((a) => (a.id === payload.id ? { ...a, ...payload } : a))
    lsSet('siap_announcements', next)
    return payload
  }
  const item = { ...payload, id: `ann-${Date.now()}` }
  lsSet('siap_announcements', [item, ...all])
  return item
}

export async function deleteAnnouncement(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) throw error
    return true
  }
  lsSet('siap_announcements', lsGet('siap_announcements', SEED_ANNOUNCEMENTS).filter((a) => a.id !== id))
  return true
}

export async function getIKD() {
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('display_contents').select('*').eq('key', 'ikd').maybeSingle()
    if (data) return { title: data.title, content: data.content }
  }
  return lsGet('siap_ikd', SEED_IKD)
}

export async function saveIKD(payload) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('display_contents').upsert({ key: 'ikd', ...payload }).select().single()
    if (error) throw error
    return data
  }
  lsSet('siap_ikd', payload)
  return payload
}
