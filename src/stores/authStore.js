import { create } from 'zustand'
import { getSession } from '../services/authService.js'

export const useAuthStore = create((set) => ({
  user: getSession(),
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))
