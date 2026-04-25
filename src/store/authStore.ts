import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, PlatformAdmin } from '../types'

interface AuthState {
  user: User | null
  platformAdmin: PlatformAdmin | null
  token: string | null
  enabledModules: string[]
  isPlatformAdmin: boolean
  setAuth: (data: {
    user?: User | null
    platformAdmin?: PlatformAdmin | null
    token: string
    enabledModules: string[]
  }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      platformAdmin: null,
      token: null,
      enabledModules: [],
      isPlatformAdmin: false,
      setAuth: ({ user, platformAdmin, token, enabledModules }) =>
        set({
          user: user ?? null,
          platformAdmin: platformAdmin ?? null,
          token,
          enabledModules,
          isPlatformAdmin: !!platformAdmin,
        }),
      clearAuth: () =>
        set({ user: null, platformAdmin: null, token: null, enabledModules: [], isPlatformAdmin: false }),
    }),
    { name: 'gestao-auth' }
  )
)
