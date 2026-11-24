import { api } from './client'

export type DocumentGovernance = {
  documentId: string
  currentInstanceId: string | null
  code: string
  title: string
  revisionCount: number
  publishedCount: number
  activeRevision: string | null
  revisions: Array<{
    id: string
    revision: string
    title: string
    status: string
    isCurrent: boolean
    createdAt: string
    updatedAt: string
    dueDate: string | null
    reviewOverdue: boolean
    createdByName: string | null
  }>
  audit: Array<{
    id: string
    revisionInstanceId: string
    action: string
    userName: string | null
    comment: string | null
    createdAt: string
  }>
}

export async function getDocumentGovernance(id: string) {
  const { data } = await api.get<DocumentGovernance>(`/document-instances/${id}/governance`)
  return data
}

export async function createDocumentRevision(id: string, revision: string, reason: string) {
  const { data } = await api.post<{ id: string; revision: string }>(`/document-instances/${id}/governance/revisions`, { revision, reason })
  return data
}

export async function publishControlledRevision(id: string, comment: string, reviewIntervalMonths = 12) {
  const { data } = await api.post(`/document-instances/${id}/governance/publish`, { comment, reviewIntervalMonths })
  return data
}
