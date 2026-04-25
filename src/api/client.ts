import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

type RetryableAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean
}

type RefreshResponse = {
  accessToken: string
  enabledModules?: string[]
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null
let pendingRequests: Array<(token: string | null) => void> = []

function resolvePendingRequests(token: string | null) {
  pendingRequests.forEach((callback) => callback(token))
  pendingRequests = []
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post<RefreshResponse>(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    )

    const { accessToken, enabledModules } = response.data
    const state = useAuthStore.getState()

    useAuthStore.getState().setAuth({
      user: state.user,
      platformAdmin: state.platformAdmin,
      token: accessToken,
      enabledModules: enabledModules ?? state.enabledModules,
    })

    return accessToken
  } catch (error) {
    useAuthStore.getState().clearAuth()
    window.location.href = '/login'
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined
    const authState = useAuthStore.getState()
    const { isPlatformAdmin } = authState

    if (!originalRequest) {
      return Promise.reject(error)
    }

    if ((status === 401 || status === 403) && isPlatformAdmin) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (status !== 401) {
      return Promise.reject(error)
    }

    if (originalRequest._retry) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    originalRequest._retry = true

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push((token) => {
          if (!token) {
            reject(error)
            return
          }

          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(api(originalRequest))
        })
      })
    }

    isRefreshing = true
    refreshPromise = refreshAccessToken()

    try {
      const newAccessToken = await refreshPromise

      resolvePendingRequests(newAccessToken)

      if (!newAccessToken) {
        return Promise.reject(error)
      }

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest)
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  },
)