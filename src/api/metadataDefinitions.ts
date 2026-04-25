import { api } from './client'

export interface MetadataOptionDto {
  value: string
  label: string
  sigla?: string
}

export interface MetadataTableColumnDto {
  id: string
  metadataDefinitionId: string
  internalName: string
  externalName: string
  fieldType: string
  orderIndex: number
}

export interface MetadataDefinitionDto {
  id: string
  name: string
  label: string
  fieldType: string
  maskType?: string | null
  isRequired: boolean
  isActive: boolean
  orderIndex: number
  metadataSetId?: string
  metadataSetName?: string
  documentTypeId?: string
  options?: MetadataOptionDto[]
  tableColumns?: MetadataTableColumnDto[]
}

export interface MetadataValueDto {
  metadataDefinitionId: string
  name: string
  label: string
  fieldType: string
  maskType?: string | null
  isRequired: boolean
  value: any
  options?: MetadataOptionDto[]
  tableColumns?: MetadataTableColumnDto[]
}

export interface MetadataDefinitionListItem {
  id: string
  name: string
  label: string
  fieldType: string
  isRequired: boolean
  isActive: boolean
  orderIndex: number
  metadataSetId?: string
  metadataSetName?: string
  documentTypeId?: string
}

export type GetMetadataDefinitionsParams = {
  metadataSetId?: string
  documentTypeId?: string
}

export const getMetadataDefinitions = async (
  params?: GetMetadataDefinitionsParams,
): Promise<MetadataDefinitionListItem[]> => {
  const data = (
    await api.get('/metadata/definitions', {
      params: {
        ...(params?.metadataSetId ? { metadataSetId: params.metadataSetId } : {}),
        ...(params?.documentTypeId ? { documentTypeId: params.documentTypeId } : {}),
      },
    })
  ).data as MetadataDefinitionDto[]

  return data
    .filter((item) => item.isActive !== false)
    .sort((a, b) => {
      const bySet = (a.metadataSetName ?? '').localeCompare(b.metadataSetName ?? '')
      if (bySet !== 0) return bySet
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      label: item.label,
      fieldType: item.fieldType,
      isRequired: item.isRequired,
      isActive: item.isActive,
      orderIndex: item.orderIndex,
      metadataSetId: item.metadataSetId,
      metadataSetName: item.metadataSetName,
      documentTypeId: item.documentTypeId,
    }))
}

export const createMetadataDefinition = async (
  data: Partial<MetadataDefinitionDto>,
): Promise<MetadataDefinitionDto> =>
  (await api.post('/metadata/definitions', data)).data as MetadataDefinitionDto

export const updateMetadataDefinition = async (
  id: string,
  data: Partial<MetadataDefinitionDto>,
): Promise<MetadataDefinitionDto> =>
  (await api.put(`/metadata/definitions/${id}`, data)).data as MetadataDefinitionDto

export const deleteMetadataDefinition = async (id: string) =>
  api.delete(`/metadata/definitions/${id}`)

export const getMetadataValues = async (
  documentInstanceId: string,
): Promise<MetadataValueDto[]> =>
  (await api.get(`/metadata/values/${documentInstanceId}`)).data as MetadataValueDto[]

export const saveMetadataValues = async (
  documentInstanceId: string,
  values: { metadataDefinitionId: string; value: any }[],
) => api.post(`/metadata/values/${documentInstanceId}`, { values })