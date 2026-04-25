import { api } from './client'
import type { User, PlatformAdmin } from '../types'

export interface LoginResult {
  accessToken: string
  tokenType: string
  user?: User
  platformAdmin?: PlatformAdmin
  enabledModules: string[]
}

export const login = async (email: string, password: string): Promise<LoginResult> => {
  const response = await api.post('/auth/login', { email, password })
  return response.data
}

export const logout = async (): Promise<void> => {
  try {
    await api.post('/auth/logout')
  } catch {
    // ignora erro — limpa sessão local de qualquer forma
  }
}

export const getMe = async (): Promise<LoginResult> => {
  const response = await api.get('/auth/me')
  return response.data
}