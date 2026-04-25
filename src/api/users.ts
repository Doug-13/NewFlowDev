import { api } from './client'

export type UserItem = {
  id: string
  name: string
  email: string
  role: string
  cpf?: string
  phone?: string
  photoUrl?: string
  department?: string
  jobTitle?: string
  position?: string
  isActive: boolean
  notes?: string
  createdAt?: string
}

export type UpdateUserPayload = {
  id: string
  name: string
  email: string
  password?: string
  role: string
  cpf?: string
  phone?: string
  photoUrl?: string
  department?: string
  jobTitle?: string
  position?: string
  isActive: boolean
  notes?: string
}

export type CreateUserPayload = Omit<UpdateUserPayload, 'id'> & {
  accountId: string  // obrigatório para o backend
}

export async function getUsers(): Promise<UserItem[]> {
  const res  = await api.get('/users')
  const data = res.data
  if (Array.isArray(data)) return data
  if (data?.items) return data.items
  return []
}

export async function createUser(payload: CreateUserPayload): Promise<UserItem> {
  const res = await api.post('/users', payload)
  return res.data
}

export async function updateUser(payload: UpdateUserPayload): Promise<UserItem> {
  const { id, ...body } = payload
  const res = await api.put(`/users/${id}`, body)
  return res.data
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`)
}