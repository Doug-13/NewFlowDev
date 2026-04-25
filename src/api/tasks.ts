import { api } from './client'
import type { ApprovalTask } from '../types'

export const getTasks = async (status?: string) => {
  const normalizedStatus =
    status?.toLowerCase() === 'pendente' ? 'pending' : status

  const res = await api.get('/tasks/my', {
    params: normalizedStatus ? { status: normalizedStatus } : {},
  })

  return res.data as ApprovalTask[]
}