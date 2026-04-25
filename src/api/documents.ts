import { api } from './client'
import type {
  DocumentInstanceDetail,
  DashboardSummary,
} from '../types'


export type WorkflowRuntimeTransition = {
  id?: string
  targetStepId: string
  outcome?: string
  isDefault?: boolean
  conditionType?: 'always' | 'expression' | 'metadata-value'
  metadataFieldId?: string
  expectedValue?: string
  expression?: string
}

export type WorkflowRuntimeStep = {
  id: string
  name: string
  elementId?: string
  elementType?: string
  isInitial?: boolean
  orderIndex?: number
  transitions?: WorkflowRuntimeTransition[]
}

export type CreateDocumentPayload = {
  title: string
  description?: string
  workflowId: string
  workflowName?: string
  accountId: string
  processId?: string
  processName?: string
  createdById: string
  createdByName: string
  steps?: WorkflowRuntimeStep[]
  initialMetadataValues?: Record<string, any>
}

export type ExecuteDocumentActionPayload = {
  outcome: string
  comment?: string
  actionId?: string
}

export type UploadDocumentFilePayload = {
  file: File
  attachmentType?: string
  description?: string
}

export type DocumentReferenceItem = {
  id: string

  relationGroupId?: string | null
  relationType?: string | null
  relationStatus?: string | null

  direction?: 'child' | 'parent'
  label?: string | null

  documentId?: string | null
  documentInstanceId?: string | null
  code?: string | null
  title?: string | null
  status?: string | null
  revision?: string | null
  currentStepName?: string | null

  parentDocumentId?: string | null
  parentDocumentInstanceId?: string | null
  parentCode?: string | null
  parentTitle?: string | null
  parentStatus?: string | null
  parentRevision?: string | null

  childDocumentId?: string | null
  childDocumentInstanceId?: string | null
  childCode?: string | null
  childTitle?: string | null
  childStatus?: string | null
  childRevision?: string | null

  parentProcessId?: string | null
  parentProcessName?: string | null

  childProcessId?: string | null
  childProcessName?: string | null
  childWorkflowId?: string | null
  childWorkflowName?: string | null

  sourceTableMetadataDefinitionId?: string | null
  sourceTableName?: string | null
  sourceRowKey?: string | null
  sourceRowIndex?: number | null
  sourceRowValue?: Record<string, any> | null

  waitForCompletion?: boolean | null
  waitPolicy?: string | null

  parentWaitingElementId?: string | null
  parentNextElementId?: string | null

  createdById?: string | null
  createdByName?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export async function getDocuments(params?: {
  accountId?: string
  processId?: string
  status?: string
  createdById?: string
}) {
  const res = await api.get('/document-instances', {
    params,
  })

  return res.data
}

export async function getDocument(id: string) {
  const res = await api.get<DocumentInstanceDetail>(
    `/document-instances/${id}`,
  )

  return res.data
}

export async function getDocumentInstances(id: string) {
  const res = await api.get(`/document-instances/${id}/instances`)

  return Array.isArray(res.data) ? res.data : []
}

export async function createDocument(payload: CreateDocumentPayload) {
  const res = await api.post<DocumentInstanceDetail>(
    '/document-instances',
    payload,
  )

  return res.data
}

export async function updateDocument(
  id: string,
  payload: Partial<CreateDocumentPayload>,
) {
  const res = await api.patch<DocumentInstanceDetail>(
    `/document-instances/${id}`,
    payload,
  )

  return res.data
}

export async function cancelDocument(id: string, payload?: {
  executorName?: string
  userName?: string
  comment?: string
}) {
  const res = await api.patch(`/document-instances/${id}/cancel`, payload ?? {})

  return res.data
}

export async function removeDocument(id: string) {
  const res = await api.delete(`/document-instances/${id}`)

  return res.data
}

export async function executeDocumentAction(
  id: string,
  outcome: string,
  comment?: string,
  actionId?: string,
) {
  const normalizedOutcome = String(outcome ?? '').trim()
  const normalizedComment = String(comment ?? '').trim()
  const normalizedActionId = String(actionId ?? '').trim()

  const payload: ExecuteDocumentActionPayload = {
    outcome: normalizedOutcome,
    ...(normalizedComment ? { comment: normalizedComment } : {}),
    ...(normalizedActionId ? { actionId: normalizedActionId } : {}),
  }

  console.log('[FRONT] executeDocumentAction =>', {
    id,
    payload,
  })

  const res = await api.post(
    `/document-instances/${id}/actions`,
    payload,
  )

  return res.data
}

export async function getDocumentReferences(documentInstanceId: string) {
  const res = await api.get<DocumentReferenceItem[]>(
    `/document-instances/${documentInstanceId}/references`,
  )

  return Array.isArray(res.data) ? res.data : []
}

export async function uploadFile(
  documentInstanceId: string,
  payload: File | UploadDocumentFilePayload,
) {
  const formData = new FormData()

  const file = payload instanceof File ? payload : payload.file

  formData.append('file', file)

  if (!(payload instanceof File)) {
    if (payload.attachmentType) {
      formData.append('attachmentType', payload.attachmentType)
    }

    if (payload.description) {
      formData.append('description', payload.description)
    }
  }

  const res = await api.post(
    `/document-instances/${documentInstanceId}/files`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )

  return res.data
}

export async function downloadFile(
  documentInstanceId: string,
  fileId: string,
) {
  const res = await api.get(
    `/document-instances/${documentInstanceId}/files/${fileId}/download`,
    {
      responseType: 'blob',
    },
  )

  return res.data
}

export async function deleteFile(
  documentInstanceId: string,
  fileId: string,
) {
  const res = await api.delete(
    `/document-instances/${documentInstanceId}/files/${fileId}`,
  )

  return res.data
}

export async function getDashboardSummary(params?: {
  accountId?: string
  processId?: string
  scopeLevel?: 'account' | 'process'
}) {
  const res = await api.get<DashboardSummary>('/dashboard/summary', {
    params,
  })

  return res.data
}

export async function getDashboard(params?: {
  accountId?: string
  processId?: string
  scopeLevel?: 'account' | 'process'
}) {
  return getDashboardSummary(params)
}

export async function getMyDocuments(params?: {
  status?: string
  accountId?: string
  processId?: string
}) {
  const res = await api.get('/document-instances/my', {
    params,
  })

  return Array.isArray(res.data) ? res.data : []
}

export async function getPendingDocuments(params?: {
  accountId?: string
  processId?: string
}) {
  const res = await api.get('/document-instances', {
    params: {
      ...params,
      status: 'in_progress',
    },
  })

  return Array.isArray(res.data) ? res.data : []
}

export async function getDocumentByCode(code: string) {
  const res = await api.get('/document-instances', {
    params: {
      code,
    },
  })

  const items = Array.isArray(res.data) ? res.data : []

  return items[0] ?? null
}

export async function reopenDocument(id: string, payload?: {
  comment?: string
  executorName?: string
}) {
  const res = await api.patch(
    `/document-instances/${id}/reopen`,
    payload ?? {},
  )

  return res.data
}

export async function archiveDocument(id: string, payload?: {
  comment?: string
  executorName?: string
}) {
  const res = await api.patch(
    `/document-instances/${id}/archive`,
    payload ?? {},
  )

  return res.data
}

export async function publishDocument(id: string, payload?: {
  comment?: string
  executorName?: string
}) {
  const res = await api.patch(
    `/document-instances/${id}/publish`,
    payload ?? {},
  )

  return res.data
}

export async function getDocumentAuditLogs(id: string) {
  const res = await api.get(`/document-instances/${id}/audit-logs`)

  return Array.isArray(res.data) ? res.data : []
}

export async function getDocumentActionHistory(id: string) {
  const res = await api.get(`/document-instances/${id}/action-history`)

  return Array.isArray(res.data) ? res.data : []
}

export async function getDocumentFiles(id: string) {
  const res = await api.get(`/document-instances/${id}/files`)

  return Array.isArray(res.data) ? res.data : []
}