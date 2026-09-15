import { useEffect } from 'react'
import AppRoutes from './routes/AppRoutes.jsx'
import { supabase, isSupabaseConfigured } from './lib/supabase.js'
import { clearSession } from './services/authService.js'
import { useAuthStore } from './stores/authStore.js'

function App() {
  // Selaraskan sesi aplikasi (siap_session) dengan sesi Supabase Auth.
  // Bila token kedaluwarsa / dicabut (refresh gagal → SIGNED_OUT), paksa
  // logout bersih — kalau tidak, panel tampak "bisa dipakai" padahal semua
  // mutasi staf ditolak assertSupabaseSession. RequireAuth otomatis
  // mengarahkan ke /login setelah user dikosongkan.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSession()
        useAuthStore.getState().setUser(null)
      }
    })
    return () => data?.subscription?.unsubscribe()
  }, [])

  return <AppRoutes />
}

export default App
