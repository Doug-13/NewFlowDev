import { api } from './client'

export interface MetadataSetDto {
  id: string
  name: string
  code: string
  description?: string
  isActive: boolean
  orderIndex: number
}

export const getMetadataSets = async (): Promise<MetadataSetDto[]> =>
  (await api.get('/metadata/sets')).data as MetadataSetDto[]

export const createMetadataSet = async (
  data: Partial<MetadataSetDto>,
): Promise<MetadataSetDto> =>
  (await api.post('/metadata/sets', data)).data as MetadataSetDto

export const updateMetadataSet = async (
  id: string,
  data: Partial<MetadataSetDto>,
): Promise<MetadataSetDto> =>
  (await api.put(`/metadata/sets/${id}`, data)).data as MetadataSetDto

export const deleteMetadataSet = async (id: string) =>
  api.delete(`/metadata/sets/${id}`)