import { api } from './client'

export interface LdRow {
  rowNumber: number
  code: string | null
  title: string
  discipline: string | null
  documentTypeName: string
  documentTypeId: string
  workflowName: string
  workflowId: string
  description: string | null
  isValid: boolean
  errors: string[]
}

export interface LdImportRow {
  rowNumber: number
  code: string | null
  title: string
  discipline: string | null
  documentTypeId: string
  workflowId: string
  description: string | null
}

export interface LdImportResult {
  created: number
  errors: string[]
}

export const ldPreview = async (file: File): Promise<LdRow[]> => {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/ld/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export const ldImport = async (rows: LdImportRow[]): Promise<LdImportResult> => {
  const res = await api.post('/ld/import', { rows })
  return res.data
}

export const ldDownloadTemplate = async (): Promise<void> => {
  const res = await api.get('/ld/template', { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'template_ld.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
