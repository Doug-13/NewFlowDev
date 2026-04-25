import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface Props {
  children: React.ReactNode
  requirePlatformAdmin?: boolean
}

export function ProtectedRoute({ children, requirePlatformAdmin = false }: Props) {
  const token = useAuthStore((s) => s.token)
  const isPlatformAdmin = useAuthStore((s) => s.isPlatformAdmin)

  if (!token) return <Navigate to="/login" replace />

  // Tenant tentando acessar área de plataforma
  if (requirePlatformAdmin && !isPlatformAdmin) return <Navigate to="/" replace />

  // Platform admin tentando acessar área de tenant
  if (!requirePlatformAdmin && isPlatformAdmin) return <Navigate to="/platform" replace />

  return <>{children}</>
}
