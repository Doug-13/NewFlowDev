import { api } from './client'

export interface ProcessPermissions {
  userIds: string[]
  groupIds: string[]
}

export interface Process {
  id: string
  name: string
  code: string
  description?: string
  accountId: string
  isActive: boolean
  parentProcessId?: string | null
  permissions?: ProcessPermissions
  documentCreation?: ProcessPermissions
  documentVisualization?: ProcessPermissions
}

export type CreateProcessPayload = {
  name: string
  code: string
  description?: string
  accountId: string
  isActive: boolean
  parentProcessId?: string | null
  permissions?: ProcessPermissions
  documentCreation?: ProcessPermissions
  documentVisualization?: ProcessPermissions
}

export type UpdateProcessPayload = Partial<CreateProcessPayload>

export async function getProcesses(accountId: string): Promise<Process[]> {
  const { data } = await api.get<Process[]>('/processes', {
    params: { accountId },
  })

  return Array.isArray(data) ? data : []
}

export async function getProcessById(id: string | undefined | null): Promise<Process | null> {
  if (!id) return null
  const { data } = await api.get<Process>(`/processes/${id}`)
  return data ?? null
}

export async function createProcess(payload: CreateProcessPayload): Promise<Process> {
  const { data } = await api.post<Process>('/processes', payload)
  return data
}

export async function updateProcess(
  id: string | undefined | null,
  payload: UpdateProcessPayload,
): Promise<Process> {
  if (!id) {
    throw new Error('updateProcess chamado sem um ID válido de processo.')
  }

  const { data } = await api.patch<Process>(`/processes/${id}`, payload)
  return data
}

export async function deleteProcess(id: string | undefined | null): Promise<void> {
  if (!id) {
    throw new Error('deleteProcess chamado sem um ID válido de processo.')
  }

  await api.delete(`/processes/${id}`)
}