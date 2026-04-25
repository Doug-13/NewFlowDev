export interface User {
  id: string
  name: string
  email: string
  role: string
  /** Identificador principal da conta neste sistema */
  accountId: string
  accountName?: string
  /** Alias legado — mesmo valor que accountId */
  tenantId?: string
  tenantName?: string
}

export interface PlatformAdmin {
  id: string
  name: string
  email: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  modules: string[]
  userCount?: number
}

export const ALL_MODULES = [
  { key: 'document_types', label: 'Tipos de Documento' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'metadata', label: 'Metadados' },
  { key: 'organization', label: 'Organização' },
  { key: 'users', label: 'Usuários' },
] as const

export type ModuleKey = typeof ALL_MODULES[number]['key']

export interface DocumentType {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

/* =========================================================
   WORKFLOWS
========================================================= */

export type WorkflowEventType =
  | 'notification'
  | 'flow-change'
  | 'extra-check'
  | 'webhook'
  | 'integration'
  | 'task'

export type WorkflowEventTrigger =
  | 'on-start'
  | 'on-enter'
  | 'on-exit'
  | 'on-transition'
  | 'on-end'
  | 'manual'
  | 'scheduled'

export type WorkflowExtraCheckType =
  | 'metadata'
  | 'document-status'
  | 'approval'
  | 'custom'

export type WorkflowEventDefinition = {
  id: string
  name: string
  type: WorkflowEventType
  trigger?: WorkflowEventTrigger
  description?: string
  active?: boolean
  notificationTemplateIds?: string[]
  notificationTemplateNames?: string[]
  targetWorkflowId?: string
  targetWorkflowName?: string
  targetStepId?: string
  targetStepName?: string
  verificationType?: WorkflowExtraCheckType
  blocking?: boolean
  config?: Record<string, unknown>
}

export type WorkflowStartConfig = {
  name?: string
  description?: string
  initialStepId?: string
  events?: WorkflowEventDefinition[]
}

export type WorkflowEndConfig = {
  name?: string
  description?: string
  events?: WorkflowEventDefinition[]
}

export type WorkflowNodePosition = {
  x: number
  y: number
}

export type WorkflowEdgeControl = {
  bendX?: number
  routeY?: number
}

export type WorkflowLayout = {
  nodePositions?: Record<string, WorkflowNodePosition>
  edgeControls?: Record<string, WorkflowEdgeControl>
}

export type WorkflowTransition = {
  id?: string
  triggerAction: string
  toStepId?: string
  toStepOrderIndex?: number
  toStepName?: string
  events?: WorkflowEventDefinition[]
}

export type WorkflowResponsible =
  | string
  | {
      id?: string
      name: string
    }

export type WorkflowMetadata = {
  id?: string
  name?: string
  label?: string
  type?: string
  required?: boolean
  isRequired?: boolean
  multiple?: boolean
  options?: string[]
}

export type WorkflowStep = {
  id: string
  name: string
  description?: string
  orderIndex: number
  isInitial?: boolean
  isFinal?: boolean
  slaHours?: number
  allowedActions: string[]
  transitions: WorkflowTransition[]
  responsibles?: WorkflowResponsible[]
  receivesNotification?: boolean
  requiredNotification?: boolean
  metadata?: WorkflowMetadata[]
  events?: WorkflowEventDefinition[]
}

export type Workflow = {
  id: string
  name: string
  description?: string
  version: string | number
  isActive?: boolean
  steps: WorkflowStep[]
  startConfig?: WorkflowStartConfig
  endConfig?: WorkflowEndConfig
  layout?: WorkflowLayout
  bpmnXml?: string
}

/* =========================================================
   DOCUMENTOS
========================================================= */

export interface DocumentFile {
  id: string
  versionNumber: number
  originalFilename: string
  fileSizeBytes: number
  mimeType: string
  isCurrent: boolean
  uploadedByUserName: string
  uploadedAt: string
}

export interface ApprovalTask {
  id: string
  /** ID do documento ao qual esta task pertence */
  documentInstanceId: string
  /** Título do documento (populado pelo backend no enrich) */
  documentTitle?: string
  workflowStepId: string
  stepName: string
  assignedToUserName: string
  assignedToUserId: string
  status: string
  actionTaken?: string
  comment?: string
  dueAt?: string
  completedAt?: string
  createdAt: string
  taskActions?: Array<{
    id: string
    label: string
    color: string
    outcome: string
    requiresComment: boolean
  }>
}

export interface AuditLog {
  id: string
  action: string
  stepName?: string
  userName?: string
  comment?: string
  createdAt: string
}

export interface DocumentInstance {
  id: string
  title: string
  description?: string
  status: string
  documentTypeId?: string
  documentTypeName?: string
  workflowId: string
  workflowName: string
  currentStepId?: string
  currentStepName?: string
  currentStepOrderIndex?: number
  processId?: string
  processName?: string
  createdByName?: string
  createdByUserName?: string
  responsibleId?: string
  responsibleName?: string
  createdAt: string
  updatedAt: string
}

export interface DocumentInstanceDetail extends DocumentInstance {
  availableActions: string[]
  stepMetadataFields: any[]
  files?: DocumentFile[]
  tasks: ApprovalTask[]
  auditLogs: AuditLog[]
  workflowSteps?: WorkflowStep[]
}

export interface DashboardSummary {
  pendingTasks: number
  inProgress: number
  approvedToday: number
  rejectedToday: number
  myUrgentTasks: ApprovalTask[]
}

export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}