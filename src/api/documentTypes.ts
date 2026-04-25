import { api } from './client'
import type { DocumentType } from '../types'

export const getDocumentTypes = async (active?: boolean) => {
  const res = await api.get('/document-types', { params: active !== undefined ? { active } : {} })
  return res.data as DocumentType[]
}

export const createDocumentType = async (data: { name: string; description?: string }) => {
  const res = await api.post('/document-types', data)
  return res.data as DocumentType
}

export const updateDocumentType = async (id: string, data: { name: string; description?: string }) => {
  const res = await api.put(`/document-types/${id}`, data)
  return res.data as DocumentType
}

export const deleteDocumentType = async (id: string) => {
  await api.delete(`/document-types/${id}`)
}
