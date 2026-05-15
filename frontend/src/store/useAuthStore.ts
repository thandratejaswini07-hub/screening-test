import { create } from 'zustand'

interface AuthUser {
  id:          string
  email:       string
  full_name:   string | null
  avatar_url:  string | null
}

interface AuthStore {
  user:       AuthUser | null
  token:      string | null
  isLoading:  boolean

  setAuth:    (user: AuthUser, token: string) => void
  clearAuth:  () => void
  setLoading: (v: boolean) => void
  loadFromStorage: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:      null,
  token:     null,
  isLoading: false,

  setAuth: (user, token) => {
    localStorage.setItem('mnr_token', token)
    localStorage.setItem('mnr_user',  JSON.stringify(user))
    set({ user, token })
  },

  clearAuth: () => {
    localStorage.removeItem('mnr_token')
    localStorage.removeItem('mnr_user')
    set({ user: null, token: null })
  },

  setLoading: (isLoading) => set({ isLoading }),

  loadFromStorage: () => {
    const token = localStorage.getItem('mnr_token')
    const raw   = localStorage.getItem('mnr_user')
    if (token && raw) {
      try {
        const user = JSON.parse(raw)
        set({ user, token })
      } catch {}
    }
  },
}))