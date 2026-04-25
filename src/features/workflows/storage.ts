import { getStudioElementKind } from './studioElementKinds'

export type ScopeLevel = 'account' | 'environment' | 'process'

export type ScopeContext = {
  accountId: string
  environmentId?: string | null
  processId?: string | null
}

export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'archived'

export type WorkflowPermissionEntry = {
  userIds: string[]
  groupIds: string[]
  environmentIds: string[]
  processIds: string[]
  areaIds: string[]
  disciplineIds: string[]
  roleIds: string[]
  unitIds: string[]
}

export type WorkflowPermissions = {
  visualization: WorkflowPermissionEntry
  creation: WorkflowPermissionEntry
}

function createEmptyPermissionEntry(): WorkflowPermissionEntry {
  return {
    userIds: [], groupIds: [], environmentIds: [], processIds: [],
    areaIds: [], disciplineIds: [], roleIds: [], unitIds: [],
  }
}

export const EMPTY_PERMISSION_ENTRY: WorkflowPermissionEntry = createEmptyPermissionEntry()
export const EMPTY_WORKFLOW_PERMISSIONS: WorkflowPermissions = {
  visualization: createEmptyPermissionEntry(),
  creation: createEmptyPermissionEntry(),
}

export type WorkflowScopedBase = {
  accountId: string
  accountName?: string
  environmentId?: string | null
  environmentName?: string | null
  processId?: string | null
  processName?: string | null
  scopeLevel: ScopeLevel
  tenantId?: string
}

export type WorkflowDefinition = WorkflowScopedBase & {
  id: string
  name: string
  description?: string
  version: string
  status: WorkflowStatus
  documentTypeId?: string
  documentTypeName?: string
  bpmnXml: string
  stepsCount: number
  permissions?: WorkflowPermissions
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export type WorkflowValidationIssue = {
  id: string
  workflowId: string
  elementId?: string
  severity: 'error' | 'warning'
  code: string
  message: string
}

export type ActivityActionOutcome =
  | 'approve'
  | 'reject'
  | 'request-changes'
  | 'forward'
  | 'custom'

export type ActivityAction = {
  id: string
  label: string
  color: 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gold' | 'default'
  outcome: ActivityActionOutcome
  confirmText?: string
  requiresComment: boolean
}

// export type ActivityMetadataFieldRule = {
//   metadataDefinitionId: string
//   name?: string
//   label?: string
//   fieldType?: string
//   metadataSetId?: string
//   metadataSetName?: string
//   isRequired: boolean
//   isReadOnly: boolean
// }

export type ActivityMetadataFieldRule = {
  metadataDefinitionId: string
  name?: string
  label?: string
  fieldType?: string
  metadataSetId?: string
  metadataSetName?: string
  isRequired: boolean
  isReadOnly: boolean
}

export type SendTaskConfig = {
  notificationTemplateId?: string
  channel: 'email' | 'in-app' | 'whatsapp' | 'sms' | 'all'
  recipientRoleIds: string[]
  recipientUserIds: string[]
  recipientAreaIds: string[]
  notifyInitiator: boolean
  notifyPreviousAssignees: boolean
  customSubject?: string
  customBody?: string
  contextVariables: string[]
}

export type StartEventConfig = {
  initialMetadataDefinitionIds: string[]
  metadataSetIds: string[]
  metadataFields?: ActivityMetadataFieldRule[]
  requiredAttachmentTypes: string[]
  notificationTemplateIds: string[]
  allowedStarterRoleIds: string[]
  instructions?: string
  formTitle?: string
}

export type ActivityConfig = {
  assignmentMode: 'user' | 'role' | 'area' | 'function' | 'group' | 'positions' | 'mixed'
  responsibleUserIds: string[]
  responsibleRoleIds: string[]
  responsibleAreaIds: string[]
  responsibleFunctionIds: string[]
  responsibleGroupIds: string[]
  deadlineMode: 'hours' | 'days' | 'fixed-date' | 'metadata'
  deadlineValue?: number | string
  deadlineMetadataFieldId?: string
  metadataSetIds: string[]
  metadataDefinitionIds: string[]
  metadataFields?: ActivityMetadataFieldRule[]
  notificationTemplateIds: string[]
  allowApprove: boolean
  allowReject: boolean
  allowRequestChanges: boolean
  allowForward: boolean
  instructions?: string
  helpText?: string
  actions?: ActivityAction[]
  linkedWorkflowId?: string
  sendTask?: SendTaskConfig
}

export type EndEventConfig = {
  finalMetadataDefinitionIds: string[]
  metadataSetIds: string[]
  metadataFields?: ActivityMetadataFieldRule[]
  summarySections: string[]
  notificationTemplateIds: string[]
  finalAction: 'complete' | 'archive' | 'publish' | 'open-linked-workflow'
  linkedWorkflowId?: string
  instructions?: string
}

export type GatewayConfig = {
  decisionMode: 'manual' | 'metadata-rule' | 'expression'
  decisionDescription?: string
  decisionFieldId?: string
  notificationTemplateIds: string[]
  instructions?: string
  // ADICIONE:
  actionRoutes?: Array<{
    actionId: string
    actionLabel: string
    sequenceFlowId?: string
  }>
}

export type FlowConfig = {
  label?: string
  conditionType: 'always' | 'expression' | 'metadata-value'
  expression?: string
  metadataFieldId?: string
  expectedValue?: string
  isDefault?: boolean
  notificationTemplateIds: string[]
  description?: string
  // NOVO: IDs do source e target do arco BPMN — preenchidos automaticamente ao salvar
  sourceId?: string
  targetId?: string
}

// export type EndEventConfig = {
//   finalMetadataDefinitionIds: string[]
//   metadataSetIds: string[]
//   metadataFields?: ActivityMetadataFieldRule[]
//   summarySections: string[]
//   notificationTemplateIds: string[]
//   finalAction: 'complete' | 'archive' | 'publish' | 'open-linked-workflow'
//   linkedWorkflowId?: string
//   instructions?: string
// }

export type NotificationEventConfig = {
  notificationTemplateId?: string
  channel: 'email' | 'in-app' | 'whatsapp' | 'sms' | 'all'
  recipientRoleIds: string[]
  recipientUserIds: string[]
  recipientAreaIds: string[]
  notifyInitiator: boolean
  notifyPreviousAssignees: boolean
  customSubject?: string
  customBody?: string
  contextVariables: string[]
}

export type SystemTaskActionType =
  | 'increment-revision'
  | 'set-metadata'
  | 'copy-metadata'
  | 'http-request'
  | 'custom-script'
  | 'create-subprocess'

export type SystemTaskSubprocessConfig = {
  childProcessId?: string
  childProcessName?: string
  waitForCompletion?: boolean
  copyParentMetadata?: boolean
  copyParentAttachments?: boolean
  sourceTableFieldIds?: string[]
}

export type SystemTaskConfig = {
  actionType: SystemTaskActionType
  auditNote?: string
  notificationTemplateIds?: string[]
  subprocess?: SystemTaskSubprocessConfig
  customScript?: string          // ← ADICIONAR
}

export type SubprocessAdvanceMode = 'create-and-continue' | 'create-and-wait'

// ─── NOVOS: configs dos eventos intermediários ─────────────────────────────────

export type MessageEventConfig = {
  notificationTemplateIds: string[]
  recipientUserIds: string[]
  recipientGroupIds: string[]
  recipientRoleIds: string[]
  triggerMode: 'on-enter' | 'on-exit' | 'manual'
  auditNote?: string
}

export type TimerEventConfig = {
  timerType: 'fixed-delay' | 'fixed-date' | 'metadata-date'
  delayUnit?: 'minutes' | 'hours' | 'days'
  delayValue?: number
  fixedDate?: string
  metadataDefinitionId?: string
  metadataOffsetDays?: number
  auditNote?: string
}

export type SignalEventConfig = {
  targetProcessId: string
  targetProcessName?: string
  relationDirection: 'parent-to-child' | 'child-to-parent'
  targetAction: string
  targetActionLabel?: string
  auditNote?: string
}

export type ConditionalEventConfig = {
  actionType: 'increment-revision'
  createNewInstance: boolean
  auditNote?: string
}

// ─── WorkflowElementKind ──────────────────────────────────────────────────────

export type WorkflowElementKind =
  | 'start'
  | 'activity'
  | 'subprocess'
  | 'gateway'
  | 'flow'
  | 'end'
  | 'notification'
  | 'system-task'
  | 'message'
  | 'timer'
  | 'signal'
  | 'conditional'



export type WorkflowElementConfig = WorkflowScopedBase & {
  id: string
  workflowId: string
  elementId: string
  elementType: string
  elementName?: string
  kind: WorkflowElementKind
  config:
  | StartEventConfig
  | ActivityConfig
  | GatewayConfig
  | FlowConfig
  | EndEventConfig
  | NotificationEventConfig
  | SystemTaskConfig
  | MessageEventConfig
  | TimerEventConfig
  | SignalEventConfig
  | ConditionalEventConfig
  createdAt: string
  updatedAt: string
}

export type WorkflowActivityConfig = WorkflowScopedBase & {
  id: string
  workflowId: string
  elementId: string
  elementType: string
  elementName?: string
  assignmentMode: 'user' | 'role' | 'area' | 'function' | 'group' | 'positions' | 'mixed'
  responsibleUserIds: string[]
  responsibleRoleIds: string[]
  responsibleAreaIds: string[]
  responsibleFunctionIds: string[]
  responsibleGroupIds: string[]
  deadlineMode: 'hours' | 'days' | 'fixed-date' | 'metadata'
  deadlineValue?: number | string
  deadlineMetadataFieldId?: string
  metadataSetIds: string[]
  metadataDefinitionIds: string[]
  metadataFields?: ActivityMetadataFieldRule[]
  notificationTemplateIds: string[]
  allowApprove: boolean
  allowReject: boolean
  allowRequestChanges: boolean
  allowForward: boolean
  instructions?: string
  helpText?: string
  actions?: ActivityAction[]
  linkedWorkflowId?: string
  sendTask?: SendTaskConfig
  createdAt: string
  updatedAt: string
}

export type WorkflowVersionSnapshot = WorkflowScopedBase & {
  id: string
  workflowId: string
  versionLabel: string
  note?: string
  workflow: WorkflowDefinition
  elementConfigs: WorkflowElementConfig[]
  createdAt: string
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const WORKFLOWS_KEY = 'gestao-docs:workflows'
const ELEMENT_CONFIGS_KEY = 'gestao-docs:workflow-element-configs'
const SNAPSHOTS_KEY = 'gestao-docs:workflow-snapshots'
const LEGACY_ELEMENT_CONFIGS_KEY = 'workflow-element-configs'
const LEGACY_ACTIVITY_CONFIGS_KEY = 'gestao-docs:workflow-activity-configs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStorage(key: string) {
  if (!canUseLocalStorage()) return null
  return window.localStorage.getItem(key)
}

function writeStorage(key: string, value: string) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(key, value)
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) as T } catch { return fallback }
}

function readArrayFromStorage(key: string): any[] {
  return safeParseJson<any[]>(readStorage(key), [])
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toOptionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' && value.trim() ? value : undefined
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeScopeLevel(
  value: unknown,
  environmentId?: string | null,
  processId?: string | null,
): ScopeLevel {
  if (value === 'account' || value === 'environment' || value === 'process') return value
  if (processId) return 'process'
  if (environmentId) return 'environment'
  return 'account'
}

function normalizeScopedBase(
  value: any,
  fallback?: Partial<WorkflowScopedBase>,
): WorkflowScopedBase {
  const accountId =
    toOptionalString(value?.accountId) ??
    toOptionalString(value?.tenantId) ??
    toOptionalString(fallback?.accountId) ??
    toOptionalString(fallback?.tenantId) ?? ''

  const environmentId =
    toOptionalNullableString(value?.environmentId) ??
    toOptionalNullableString(value?.unitId) ??
    toOptionalNullableString(fallback?.environmentId) ?? null

  const processId =
    toOptionalNullableString(value?.processId) ??
    toOptionalNullableString(fallback?.processId) ?? null

  const scopeLevel = normalizeScopeLevel(
    value?.scopeLevel ?? fallback?.scopeLevel,
    environmentId,
    processId,
  )

  return {
    accountId,
    accountName:
      toOptionalString(value?.accountName) ??
      toOptionalString(fallback?.accountName),
    environmentId,
    environmentName:
      toOptionalNullableString(value?.environmentName) ??
      toOptionalNullableString(value?.unitName) ??
      toOptionalNullableString(fallback?.environmentName) ?? null,
    processId,
    processName:
      toOptionalNullableString(value?.processName) ??
      toOptionalNullableString(fallback?.processName) ?? null,
    scopeLevel,
    tenantId:
      toOptionalString(value?.tenantId) ??
      toOptionalString(fallback?.tenantId) ??
      (accountId || undefined),
  }
}

function getScopeWeight(scopeLevel: ScopeLevel): number {
  if (scopeLevel === 'process') return 3
  if (scopeLevel === 'environment') return 2
  return 1
}

function matchesScope(record: WorkflowScopedBase, context: ScopeContext): boolean {
  if (record.accountId !== context.accountId) return false
  if (record.scopeLevel === 'account') return true
  if (record.scopeLevel === 'environment') return record.environmentId === (context.environmentId ?? null)
  return record.processId === (context.processId ?? null)
}

function getWorkflowScopeFallback(workflowId: string): Partial<WorkflowScopedBase> | undefined {
  const workflow = loadWorkflows().find((item) => item.id === workflowId)
  if (!workflow) return undefined
  return {
    accountId: workflow.accountId, accountName: workflow.accountName,
    environmentId: workflow.environmentId, environmentName: workflow.environmentName,
    processId: workflow.processId, processName: workflow.processName,
    scopeLevel: workflow.scopeLevel, tenantId: workflow.tenantId,
  }
}

function normalizePermissionEntry(value: unknown): WorkflowPermissionEntry {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const environmentIds = uniqueStrings([
    ...toStringArray(raw.environmentIds),
    ...toStringArray(raw.unitIds),
  ])
  return {
    userIds: uniqueStrings(toStringArray(raw.userIds)),
    groupIds: uniqueStrings(toStringArray(raw.groupIds)),
    environmentIds,
    processIds: uniqueStrings(toStringArray(raw.processIds)),
    areaIds: uniqueStrings(toStringArray(raw.areaIds)),
    disciplineIds: uniqueStrings(toStringArray(raw.disciplineIds)),
    roleIds: uniqueStrings(toStringArray(raw.roleIds)),
    unitIds: environmentIds,
  }
}

function normalizePermissions(value: unknown): WorkflowPermissions | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  return {
    visualization: normalizePermissionEntry(raw.visualization),
    creation: normalizePermissionEntry(raw.creation),
  }
}

function normalizeWorkflow(item: any): WorkflowDefinition {
  const scoped = normalizeScopedBase(item)
  return {
    ...scoped,
    id: String(item?.id ?? crypto.randomUUID()),
    name: String(item?.name ?? 'Workflow sem nome'),
    description: typeof item?.description === 'string' ? item.description : undefined,
    version: typeof item?.version === 'string' && item.version.trim() ? item.version : '1.0',
    status:
      item?.status === 'draft' || item?.status === 'active' ||
        item?.status === 'inactive' || item?.status === 'archived'
        ? item.status : 'draft',
    documentTypeId: typeof item?.documentTypeId === 'string' ? item.documentTypeId : undefined,
    documentTypeName: typeof item?.documentTypeName === 'string' ? item.documentTypeName : undefined,
    bpmnXml: typeof item?.bpmnXml === 'string' ? item.bpmnXml : '',
    stepsCount:
      typeof item?.stepsCount === 'number' ? item.stepsCount :
        Array.isArray(item?.steps) ? item.steps.length : 0,
    permissions: normalizePermissions(item?.permissions),
    createdAt: typeof item?.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    publishedAt: typeof item?.publishedAt === 'string' ? item.publishedAt : undefined,
  }
}

function normalizeActivityAction(item: any): ActivityAction {
  return {
    id: String(item?.id ?? crypto.randomUUID()),
    label: typeof item?.label === 'string' ? item.label : 'Ação',
    color:
      item?.color === 'green' || item?.color === 'red' || item?.color === 'orange' ||
        item?.color === 'blue' || item?.color === 'purple' || item?.color === 'gold' ||
        item?.color === 'default' ? item.color : 'default',
    outcome:
      item?.outcome === 'approve' || item?.outcome === 'reject' ||
        item?.outcome === 'request-changes' || item?.outcome === 'forward' ||
        item?.outcome === 'custom' ? item.outcome : 'custom',
    confirmText: typeof item?.confirmText === 'string' ? item.confirmText : undefined,
    requiresComment: Boolean(item?.requiresComment),
  }
}

function normalizeSendTaskConfig(item: any): SendTaskConfig | undefined {
  if (!item || typeof item !== 'object') return undefined
  return {
    notificationTemplateId: typeof item.notificationTemplateId === 'string' ? item.notificationTemplateId : undefined,
    channel:
      item.channel === 'email' || item.channel === 'in-app' || item.channel === 'whatsapp' ||
        item.channel === 'sms' || item.channel === 'all' ? item.channel : 'email',
    recipientRoleIds: toStringArray(item.recipientRoleIds),
    recipientUserIds: toStringArray(item.recipientUserIds),
    recipientAreaIds: toStringArray(item.recipientAreaIds),
    notifyInitiator: Boolean(item.notifyInitiator),
    notifyPreviousAssignees: Boolean(item.notifyPreviousAssignees),
    customSubject: typeof item.customSubject === 'string' ? item.customSubject : undefined,
    customBody: typeof item.customBody === 'string' ? item.customBody : undefined,
    contextVariables: toStringArray(item.contextVariables),
  }
}

function normalizeActivityConfigValue(item: any): ActivityConfig {
  const metadataDefinitionIds: string[] = Array.isArray(item?.metadataDefinitionIds)
    ? item.metadataDefinitionIds.filter((v: unknown): v is string => typeof v === 'string')
    : []

  const metadataFields: ActivityMetadataFieldRule[] = Array.isArray(item?.metadataFields)
    ? item.metadataFields
      .filter((v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
      .map((field: Record<string, unknown>): ActivityMetadataFieldRule => ({
        metadataDefinitionId: String(field.metadataDefinitionId ?? ''),
        isRequired: Boolean(field.isRequired),
        isReadOnly: Boolean(field.isReadOnly),
      }))
      .filter((field: ActivityMetadataFieldRule) => Boolean(field.metadataDefinitionId))
    : metadataDefinitionIds.map((id: string): ActivityMetadataFieldRule => ({
      metadataDefinitionId: id,
      isRequired: false,
      isReadOnly: false,
    }))

  const resolvedMetadataDefinitionIds: string[] =
    metadataFields.length > 0
      ? metadataFields.map((f: ActivityMetadataFieldRule) => f.metadataDefinitionId)
      : metadataDefinitionIds

  return {
    assignmentMode:
      item?.assignmentMode === 'user' || item?.assignmentMode === 'role' ||
        item?.assignmentMode === 'area' || item?.assignmentMode === 'function' ||
        item?.assignmentMode === 'group' || item?.assignmentMode === 'positions' ||
        item?.assignmentMode === 'mixed'
        ? item.assignmentMode
        : 'user',
    responsibleUserIds: toStringArray(item?.responsibleUserIds),
    responsibleRoleIds: toStringArray(item?.responsibleRoleIds),
    responsibleAreaIds: toStringArray(item?.responsibleAreaIds),
    responsibleFunctionIds: toStringArray(item?.responsibleFunctionIds),
    responsibleGroupIds: toStringArray(item?.responsibleGroupIds),
    deadlineMode:
      item?.deadlineMode === 'hours' || item?.deadlineMode === 'days' ||
        item?.deadlineMode === 'fixed-date' || item?.deadlineMode === 'metadata'
        ? item.deadlineMode
        : 'days',
    deadlineValue:
      typeof item?.deadlineValue === 'number' || typeof item?.deadlineValue === 'string'
        ? item.deadlineValue
        : undefined,
    deadlineMetadataFieldId:
      typeof item?.deadlineMetadataFieldId === 'string'
        ? item.deadlineMetadataFieldId
        : undefined,
    metadataSetIds: toStringArray(item?.metadataSetIds),
    metadataDefinitionIds: resolvedMetadataDefinitionIds,
    metadataFields,
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    allowApprove: Boolean(item?.allowApprove ?? true),
    allowReject: Boolean(item?.allowReject ?? true),
    allowRequestChanges: Boolean(item?.allowRequestChanges ?? true),
    allowForward: Boolean(item?.allowForward ?? false),
    instructions: typeof item?.instructions === 'string' ? item.instructions : undefined,
    helpText: typeof item?.helpText === 'string' ? item.helpText : undefined,
    actions: Array.isArray(item?.actions) ? item.actions.map(normalizeActivityAction) : undefined,
    linkedWorkflowId: typeof item?.linkedWorkflowId === 'string' ? item.linkedWorkflowId : undefined,
    sendTask: normalizeSendTaskConfig(item?.sendTask),
  }
}

function buildActivityElementConfigPayload(
  item: Pick<WorkflowActivityConfig,
    | 'assignmentMode' | 'responsibleUserIds' | 'responsibleRoleIds'
    | 'responsibleAreaIds' | 'responsibleFunctionIds' | 'responsibleGroupIds'
    | 'deadlineMode' | 'deadlineValue' | 'deadlineMetadataFieldId'
    | 'metadataSetIds' | 'metadataDefinitionIds' | 'metadataFields'
    | 'notificationTemplateIds' | 'allowApprove' | 'allowReject'
    | 'allowRequestChanges' | 'allowForward' | 'instructions'
    | 'helpText' | 'actions' | 'linkedWorkflowId' | 'sendTask'
  >,
): ActivityConfig {
  return {
    assignmentMode: item.assignmentMode,
    responsibleUserIds: item.responsibleUserIds,
    responsibleRoleIds: item.responsibleRoleIds,
    responsibleAreaIds: item.responsibleAreaIds,
    responsibleFunctionIds: item.responsibleFunctionIds,
    responsibleGroupIds: item.responsibleGroupIds,
    deadlineMode: item.deadlineMode,
    deadlineValue: item.deadlineValue,
    deadlineMetadataFieldId: item.deadlineMetadataFieldId,
    metadataSetIds: item.metadataSetIds,
    metadataDefinitionIds: item.metadataDefinitionIds,
    metadataFields: item.metadataFields,
    notificationTemplateIds: item.notificationTemplateIds,
    allowApprove: item.allowApprove,
    allowReject: item.allowReject,
    allowRequestChanges: item.allowRequestChanges,
    allowForward: item.allowForward,
    instructions: item.instructions,
    helpText: item.helpText,
    actions: item.actions,
    linkedWorkflowId: item.linkedWorkflowId,
    sendTask: item.sendTask,
  }
}

function normalizeStartEventConfig(item: any): StartEventConfig {
  return {
    initialMetadataDefinitionIds: toStringArray(item?.initialMetadataDefinitionIds),
    metadataSetIds: toStringArray(item?.metadataSetIds),
    metadataFields: Array.isArray(item?.metadataFields) ? item.metadataFields : undefined,
    requiredAttachmentTypes: toStringArray(item?.requiredAttachmentTypes),
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    allowedStarterRoleIds: toStringArray(item?.allowedStarterRoleIds),
    instructions: typeof item?.instructions === 'string' ? item.instructions : undefined,
    formTitle: typeof item?.formTitle === 'string' ? item.formTitle : undefined,
  }
}

function normalizeGatewayConfig(item: any): GatewayConfig {
  return {
    decisionMode:
      item?.decisionMode === 'manual' || item?.decisionMode === 'metadata-rule' ||
        item?.decisionMode === 'expression' ? item.decisionMode : 'manual',
    decisionDescription: typeof item?.decisionDescription === 'string' ? item.decisionDescription : undefined,
    decisionFieldId: typeof item?.decisionFieldId === 'string' ? item.decisionFieldId : undefined,
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    instructions: typeof item?.instructions === 'string' ? item.instructions : undefined,
    // ADICIONE:
    actionRoutes: Array.isArray(item?.actionRoutes)
      ? item.actionRoutes
        .filter((r: any) => r && typeof r === 'object')
        .map((r: any) => ({
          actionId: String(r.actionId ?? ''),
          actionLabel: String(r.actionLabel ?? ''),
          sequenceFlowId: typeof r.sequenceFlowId === 'string' ? r.sequenceFlowId : undefined,
        }))
      : undefined,
  }
}

function normalizeFlowConfig(item: any): FlowConfig {
  return {
    label: typeof item?.label === 'string' ? item.label : undefined,
    conditionType:
      item?.conditionType === 'always' || item?.conditionType === 'expression' ||
        item?.conditionType === 'metadata-value' ? item.conditionType : 'always',
    expression: typeof item?.expression === 'string' ? item.expression : undefined,
    metadataFieldId: typeof item?.metadataFieldId === 'string' ? item.metadataFieldId : undefined,
    expectedValue: typeof item?.expectedValue === 'string' ? item.expectedValue : undefined,
    isDefault: Boolean(item?.isDefault),
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    description: typeof item?.description === 'string' ? item.description : undefined,
    // NOVO
    sourceId: typeof item?.sourceId === 'string' ? item.sourceId : undefined,
    targetId: typeof item?.targetId === 'string' ? item.targetId : undefined,
  }
}

function normalizeEndEventConfig(item: any): EndEventConfig {
  return {
    finalMetadataDefinitionIds: toStringArray(item?.finalMetadataDefinitionIds),
    metadataSetIds: toStringArray(item?.metadataSetIds),
    metadataFields: Array.isArray(item?.metadataFields) ? item.metadataFields : undefined,
    summarySections: toStringArray(item?.summarySections),
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    finalAction:
      item?.finalAction === 'complete' || item?.finalAction === 'archive' ||
        item?.finalAction === 'publish' || item?.finalAction === 'open-linked-workflow'
        ? item.finalAction : 'complete',
    linkedWorkflowId: typeof item?.linkedWorkflowId === 'string' ? item.linkedWorkflowId : undefined,
    instructions: typeof item?.instructions === 'string' ? item.instructions : undefined,
  }
}

function normalizeNotificationEventConfig(item: any): NotificationEventConfig {
  return {
    notificationTemplateId: typeof item?.notificationTemplateId === 'string' ? item.notificationTemplateId : undefined,
    channel:
      item?.channel === 'email' || item?.channel === 'in-app' || item?.channel === 'whatsapp' ||
        item?.channel === 'sms' || item?.channel === 'all' ? item.channel : 'email',
    recipientRoleIds: toStringArray(item?.recipientRoleIds),
    recipientUserIds: toStringArray(item?.recipientUserIds),
    recipientAreaIds: toStringArray(item?.recipientAreaIds),
    notifyInitiator: Boolean(item?.notifyInitiator),
    notifyPreviousAssignees: Boolean(item?.notifyPreviousAssignees),
    customSubject: typeof item?.customSubject === 'string' ? item.customSubject : undefined,
    customBody: typeof item?.customBody === 'string' ? item.customBody : undefined,
    contextVariables: toStringArray(item?.contextVariables),
  }
}

function normalizeSystemTaskConfig(item: any): SystemTaskConfig {
  const actionType: SystemTaskActionType =
    item?.actionType === 'increment-revision' ||
      item?.actionType === 'set-metadata' ||
      item?.actionType === 'copy-metadata' ||
      item?.actionType === 'http-request' ||
      item?.actionType === 'custom-script' ||
      item?.actionType === 'create-subprocess'
      ? item.actionType
      : 'increment-revision'

  return {
    actionType,
    auditNote: typeof item?.auditNote === 'string' ? item.auditNote : undefined,
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    customScript: typeof item?.customScript === 'string' ? item.customScript : undefined,  // ← ADICIONAR
    subprocess:
      actionType === 'create-subprocess'
        ? {
          childProcessId:
            typeof item?.subprocess?.childProcessId === 'string'
              ? item.subprocess.childProcessId
              : undefined,
          childProcessName:
            typeof item?.subprocess?.childProcessName === 'string'
              ? item.subprocess.childProcessName
              : undefined,
          waitForCompletion:
            typeof item?.subprocess?.waitForCompletion === 'boolean'
              ? item.subprocess.waitForCompletion
              : true,
          copyParentMetadata:
            typeof item?.subprocess?.copyParentMetadata === 'boolean'
              ? item.subprocess.copyParentMetadata
              : true,
          copyParentAttachments:
            typeof item?.subprocess?.copyParentAttachments === 'boolean'
              ? item.subprocess.copyParentAttachments
              : false,
          sourceTableFieldIds: toStringArray(
            item?.subprocess?.sourceTableFieldIds,
          ),
        }
        : undefined,
  }
}

// ─── Normalize dos novos tipos ────────────────────────────────────────────────

function normalizeMessageEventConfig(item: any): MessageEventConfig {
  return {
    notificationTemplateIds: toStringArray(item?.notificationTemplateIds),
    recipientUserIds: toStringArray(item?.recipientUserIds),
    recipientGroupIds: toStringArray(item?.recipientGroupIds),
    recipientRoleIds: toStringArray(item?.recipientRoleIds),
    triggerMode:
      item?.triggerMode === 'on-enter' || item?.triggerMode === 'on-exit' ||
        item?.triggerMode === 'manual' ? item.triggerMode : 'on-enter',
    auditNote: typeof item?.auditNote === 'string' ? item.auditNote : undefined,
  }
}

function normalizeTimerEventConfig(item: any): TimerEventConfig {
  return {
    timerType:
      item?.timerType === 'fixed-delay' || item?.timerType === 'fixed-date' ||
        item?.timerType === 'metadata-date' ? item.timerType : 'fixed-delay',
    delayUnit:
      item?.delayUnit === 'minutes' || item?.delayUnit === 'hours' ||
        item?.delayUnit === 'days' ? item.delayUnit : 'days',
    delayValue: typeof item?.delayValue === 'number' ? item.delayValue : undefined,
    fixedDate: typeof item?.fixedDate === 'string' ? item.fixedDate : undefined,
    metadataDefinitionId: typeof item?.metadataDefinitionId === 'string' ? item.metadataDefinitionId : undefined,
    metadataOffsetDays: typeof item?.metadataOffsetDays === 'number' ? item.metadataOffsetDays : undefined,
    auditNote: typeof item?.auditNote === 'string' ? item.auditNote : undefined,
  }
}

function normalizeSignalEventConfig(item: any): SignalEventConfig {
  return {
    targetProcessId: typeof item?.targetProcessId === 'string' ? item.targetProcessId : '',
    targetProcessName: typeof item?.targetProcessName === 'string' ? item.targetProcessName : undefined,
    relationDirection:
      item?.relationDirection === 'parent-to-child' || item?.relationDirection === 'child-to-parent'
        ? item.relationDirection : 'parent-to-child',
    targetAction: typeof item?.targetAction === 'string' ? item.targetAction : '',
    targetActionLabel: typeof item?.targetActionLabel === 'string' ? item.targetActionLabel : undefined,
    auditNote: typeof item?.auditNote === 'string' ? item.auditNote : undefined,
  }
}

function normalizeConditionalEventConfig(item: any): ConditionalEventConfig {
  return {
    actionType: 'increment-revision',
    createNewInstance: typeof item?.createNewInstance === 'boolean' ? item.createNewInstance : true,
    auditNote: typeof item?.auditNote === 'string' ? item.auditNote : undefined,
  }
}

// ─── normalizeElementKind ─────────────────────────────────────────────────────

function normalizeElementKind(kind: unknown, elementType?: string): WorkflowElementKind {
  if (
    kind === 'start' || kind === 'activity' || kind === 'gateway' ||
    kind === 'flow' || kind === 'end' || kind === 'notification' ||
    kind === 'system-task' || kind === 'message' || kind === 'timer' ||
    kind === 'signal' || kind === 'conditional'
  ) {
    return kind as WorkflowElementKind
  }

  const derived = getStudioElementKind(elementType)
  if (derived !== 'unsupported') {
    return derived as WorkflowElementKind
  }

  return 'activity'
}

// ─── normalizeWorkflowElementConfig ──────────────────────────────────────────

function normalizeWorkflowElementConfig(
  item: any,
  fallbackScope?: Partial<WorkflowScopedBase>,
): WorkflowElementConfig {
  const scoped = normalizeScopedBase(item, fallbackScope)
  const kind = normalizeElementKind(item?.kind, item?.elementType)
  const rawConfig = item?.config ?? {}

  let config: WorkflowElementConfig['config']

  switch (kind) {
    case 'start':
      config = normalizeStartEventConfig(rawConfig)
      break
    case 'gateway':
      config = normalizeGatewayConfig(rawConfig)
      break
    case 'flow':
      config = normalizeFlowConfig(rawConfig)
      break
    case 'end':
      config = normalizeEndEventConfig(rawConfig)
      break
    case 'notification':
      config = normalizeNotificationEventConfig(rawConfig)
      break
    case 'system-task':
      config = normalizeSystemTaskConfig(rawConfig)
      break
    case 'message':
      config = normalizeMessageEventConfig(rawConfig)
      break
    case 'timer':
      config = normalizeTimerEventConfig(rawConfig)
      break
    case 'signal':
      config = normalizeSignalEventConfig(rawConfig)
      break
    case 'conditional':
      config = normalizeConditionalEventConfig(rawConfig)
      break
    case 'activity':
    default:
      config = normalizeActivityConfigValue(rawConfig)
      break
  }

  return {
    ...scoped,
    id: String(item?.id ?? crypto.randomUUID()),
    workflowId: String(item?.workflowId ?? ''),
    elementId: String(item?.elementId ?? ''),
    elementType: String(item?.elementType ?? ''),
    elementName: typeof item?.elementName === 'string' ? item.elementName : undefined,
    kind,
    config,
    createdAt: typeof item?.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
  }
}

function normalizeWorkflowActivityConfig(
  item: any,
  fallbackScope?: Partial<WorkflowScopedBase>,
): WorkflowActivityConfig {
  const scoped = normalizeScopedBase(item, fallbackScope)
  const normalizedConfig = normalizeActivityConfigValue(item)

  return {
    ...scoped,
    id: String(item?.id ?? crypto.randomUUID()),
    workflowId: String(item?.workflowId ?? ''),
    elementId: String(item?.elementId ?? ''),
    elementType: String(item?.elementType ?? ''),
    elementName: typeof item?.elementName === 'string' ? item.elementName : undefined,
    ...normalizedConfig,
    createdAt: typeof item?.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    updatedAt: typeof item?.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
  }
}

function elementConfigToActivityConfig(item: WorkflowElementConfig): WorkflowActivityConfig | null {
  if (item.kind !== 'activity') return null
  const config = normalizeActivityConfigValue(item.config)
  return {
    accountId: item.accountId, accountName: item.accountName,
    environmentId: item.environmentId, environmentName: item.environmentName,
    processId: item.processId, processName: item.processName,
    scopeLevel: item.scopeLevel, tenantId: item.tenantId,
    id: item.id, workflowId: item.workflowId, elementId: item.elementId,
    elementType: item.elementType, elementName: item.elementName,
    ...config,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  }
}

function activityConfigToElementConfig(item: WorkflowActivityConfig): WorkflowElementConfig {
  const normalizedActivity = normalizeWorkflowActivityConfig(item)
  return {
    accountId: normalizedActivity.accountId, accountName: normalizedActivity.accountName,
    environmentId: normalizedActivity.environmentId, environmentName: normalizedActivity.environmentName,
    processId: normalizedActivity.processId, processName: normalizedActivity.processName,
    scopeLevel: normalizedActivity.scopeLevel, tenantId: normalizedActivity.tenantId,
    id: normalizedActivity.id, workflowId: normalizedActivity.workflowId,
    elementId: normalizedActivity.elementId, elementType: normalizedActivity.elementType,
    elementName: normalizedActivity.elementName,
    kind: 'activity',
    config: buildActivityElementConfigPayload(normalizedActivity),
    createdAt: normalizedActivity.createdAt, updatedAt: normalizedActivity.updatedAt,
  }
}

function dedupeElementConfigs(items: WorkflowElementConfig[]): WorkflowElementConfig[] {
  const map = new Map<string, WorkflowElementConfig>()
  items.forEach((item) => {
    const fallbackScope = getWorkflowScopeFallback(item.workflowId)
    const normalized = normalizeWorkflowElementConfig(item, fallbackScope)
    const key = `${normalized.workflowId}::${normalized.elementId}`
    map.set(key, normalized)
  })
  return Array.from(map.values()).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}

function normalizeSnapshot(item: any): WorkflowVersionSnapshot {
  const workflow = normalizeWorkflow(item?.workflow ?? {})
  const scoped = normalizeScopedBase(item, workflow)
  const elementConfigs = Array.isArray(item?.elementConfigs)
    ? item.elementConfigs.map((config: any) => normalizeWorkflowElementConfig(config, workflow))
    : Array.isArray(item?.activityConfigs)
      ? item.activityConfigs
        .map((config: any) => normalizeWorkflowActivityConfig(config, workflow))
        .map(activityConfigToElementConfig)
      : []

  return {
    ...scoped,
    id: String(item?.id ?? crypto.randomUUID()),
    workflowId: String(item?.workflowId ?? workflow.id ?? ''),
    versionLabel:
      typeof item?.versionLabel === 'string' && item.versionLabel.trim()
        ? item.versionLabel : 'Snapshot',
    note: typeof item?.note === 'string' ? item.note : undefined,
    workflow,
    elementConfigs: dedupeElementConfigs(elementConfigs),
    createdAt: typeof item?.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function loadWorkflows(): WorkflowDefinition[] {
  const raw = readArrayFromStorage(WORKFLOWS_KEY)
  return Array.isArray(raw) ? raw.map(normalizeWorkflow) : []
}

export function saveWorkflows(items: WorkflowDefinition[]) {
  writeStorage(WORKFLOWS_KEY, JSON.stringify(items.map(normalizeWorkflow)))
}

export function getWorkflowById(id: string) {
  return loadWorkflows().find((item) => item.id === id) ?? null
}

export function listWorkflowsByScope(
  context: ScopeContext,
  options?: {
    includeInherited?: boolean
    status?: WorkflowStatus | WorkflowStatus[]
    documentTypeId?: string
  },
) {
  const includeInherited = options?.includeInherited ?? true
  const statuses = Array.isArray(options?.status)
    ? options.status
    : options?.status ? [options.status] : null

  return loadWorkflows()
    .filter((item) => item.accountId === context.accountId)
    .filter((item) => {
      if (statuses && !statuses.includes(item.status)) return false
      if (options?.documentTypeId && item.documentTypeId !== options.documentTypeId) return false
      if (includeInherited) return matchesScope(item, context)
      if (context.processId) return item.scopeLevel === 'process' && item.processId === context.processId
      if (context.environmentId) return item.scopeLevel === 'environment' && item.environmentId === context.environmentId
      return item.scopeLevel === 'account'
    })
    .sort((a, b) => {
      const scopeOrder = getScopeWeight(b.scopeLevel) - getScopeWeight(a.scopeLevel)
      if (scopeOrder !== 0) return scopeOrder
      return +new Date(b.updatedAt) - +new Date(a.updatedAt)
    })
}

export function getBestWorkflowMatch(
  context: ScopeContext,
  options?: { workflowId?: string; documentTypeId?: string; status?: WorkflowStatus | WorkflowStatus[] },
) {
  const items = listWorkflowsByScope(context, {
    includeInherited: true,
    status: options?.status,
    documentTypeId: options?.documentTypeId,
  })
  if (options?.workflowId) return items.find((item) => item.id === options.workflowId) ?? null
  return items[0] ?? null
}

export function upsertWorkflow(workflow: WorkflowDefinition) {
  const current = loadWorkflows()
  const index = current.findIndex((item) => item.id === workflow.id)
  const now = new Date().toISOString()
  const nextWorkflow = normalizeWorkflow({
    ...workflow, updatedAt: now, tenantId: workflow.tenantId ?? workflow.accountId,
  })
  if (index >= 0) { current[index] = nextWorkflow } else { current.unshift(nextWorkflow) }
  saveWorkflows(current)
}

export function createWorkflowDraft(input: {
  accountId: string; accountName?: string; scopeLevel?: ScopeLevel
  environmentId?: string | null; environmentName?: string | null
  processId?: string | null; processName?: string | null
  name: string; description?: string; version?: string; status?: WorkflowStatus
  documentTypeId?: string; documentTypeName?: string
}) {
  const now = new Date().toISOString()
  const scopeLevel = normalizeScopeLevel(input.scopeLevel, input.environmentId ?? null, input.processId ?? null)
  return normalizeWorkflow({
    id: crypto.randomUUID(), accountId: input.accountId, accountName: input.accountName,
    environmentId: input.environmentId ?? null, environmentName: input.environmentName ?? null,
    processId: input.processId ?? null, processName: input.processName ?? null,
    scopeLevel, tenantId: input.accountId, name: input.name, description: input.description,
    version: input.version || '1.0', status: input.status || 'draft',
    documentTypeId: input.documentTypeId, documentTypeName: input.documentTypeName,
    bpmnXml: '', stepsCount: 0, createdAt: now, updatedAt: now,
  })
}

export function loadWorkflowElementConfigs(): WorkflowElementConfig[] {
  const primary = readArrayFromStorage(ELEMENT_CONFIGS_KEY)
    .map((item) => normalizeWorkflowElementConfig(item, getWorkflowScopeFallback(String(item?.workflowId ?? ''))))

  const legacyElementConfigs = readArrayFromStorage(LEGACY_ELEMENT_CONFIGS_KEY)
    .map((item) => normalizeWorkflowElementConfig(item, getWorkflowScopeFallback(String(item?.workflowId ?? ''))))

  const legacyActivityConfigs = readArrayFromStorage(LEGACY_ACTIVITY_CONFIGS_KEY)
    .map((item) => normalizeWorkflowActivityConfig(item, getWorkflowScopeFallback(String(item?.workflowId ?? ''))))
    .map(activityConfigToElementConfig)

  const merged = dedupeElementConfigs([...legacyActivityConfigs, ...legacyElementConfigs, ...primary])

  if (JSON.stringify(primary) !== JSON.stringify(merged)) saveWorkflowElementConfigs(merged)

  return merged
}

export function saveWorkflowElementConfigs(items: WorkflowElementConfig[]) {
  writeStorage(ELEMENT_CONFIGS_KEY, JSON.stringify(dedupeElementConfigs(items)))
}

export function listWorkflowElementConfigsByScope(context: ScopeContext, options?: { workflowId?: string }) {
  return loadWorkflowElementConfigs()
    .filter((item) => matchesScope(item, context))
    .filter((item) => options?.workflowId ? item.workflowId === options.workflowId : true)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
}

export function getElementConfigsByWorkflow(workflowId: string) {
  return loadWorkflowElementConfigs().filter((item) => item.workflowId === workflowId)
}

export function getWorkflowElementConfig(workflowId: string, elementId: string) {
  return loadWorkflowElementConfigs().find(
    (item) => item.workflowId === workflowId && item.elementId === elementId,
  ) ?? null
}

export function getElementConfig(workflowId: string, elementId: string) {
  return getWorkflowElementConfig(workflowId, elementId)
}

export function upsertElementConfig(values: Omit<WorkflowElementConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const current = loadWorkflowElementConfigs()
  const index = current.findIndex((item) => item.workflowId === values.workflowId && item.elementId === values.elementId)
  const fallbackScope = getWorkflowScopeFallback(values.workflowId)
  const now = new Date().toISOString()

  const nextItem: WorkflowElementConfig = normalizeWorkflowElementConfig(
    index >= 0
      ? { ...current[index], ...values, updatedAt: now }
      : {
        ...fallbackScope, ...values,
        tenantId: values.tenantId ?? values.accountId ?? fallbackScope?.accountId,
        id: crypto.randomUUID(), createdAt: now, updatedAt: now,
      },
    fallbackScope,
  )

  const nextConfigs = [...current]
  if (index >= 0) { nextConfigs[index] = nextItem } else { nextConfigs.unshift(nextItem) }
  saveWorkflowElementConfigs(nextConfigs)
  return nextItem
}

export function removeMissingElementConfigs(workflowId: string, validElementIds: string[]) {
  const validIdsSet = new Set(validElementIds)
  const nextConfigs = loadWorkflowElementConfigs().filter(
    (item) => item.workflowId !== workflowId || validIdsSet.has(item.elementId),
  )
  saveWorkflowElementConfigs(nextConfigs)
}

export function loadWorkflowActivityConfigs(): WorkflowActivityConfig[] {
  return loadWorkflowElementConfigs()
    .map(elementConfigToActivityConfig)
    .filter((item): item is WorkflowActivityConfig => item !== null)
}

export function saveWorkflowActivityConfigs(items: WorkflowActivityConfig[]) {
  const currentNonActivities = loadWorkflowElementConfigs().filter((item) => item.kind !== 'activity')
  const nextActivities = items
    .map((item) => normalizeWorkflowActivityConfig(item, getWorkflowScopeFallback(item.workflowId)))
    .map(activityConfigToElementConfig)
  saveWorkflowElementConfigs([...currentNonActivities, ...nextActivities])
}

export function getActivityConfigsByWorkflow(workflowId: string) {
  return loadWorkflowActivityConfigs().filter((item) => item.workflowId === workflowId)
}

export function getActivityConfig(workflowId: string, elementId: string) {
  return loadWorkflowActivityConfigs().find(
    (item) => item.workflowId === workflowId && item.elementId === elementId,
  ) ?? null
}

export function upsertActivityConfig(input: Omit<WorkflowActivityConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  const fallbackScope = getWorkflowScopeFallback(input.workflowId)
  const normalized = normalizeWorkflowActivityConfig({
    ...fallbackScope, ...input,
    tenantId: input.tenantId ?? input.accountId ?? fallbackScope?.accountId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, fallbackScope)

  return upsertElementConfig({
    accountId: normalized.accountId, accountName: normalized.accountName,
    environmentId: normalized.environmentId, environmentName: normalized.environmentName,
    processId: normalized.processId, processName: normalized.processName,
    scopeLevel: normalized.scopeLevel, tenantId: normalized.tenantId,
    workflowId: normalized.workflowId, elementId: normalized.elementId,
    elementType: normalized.elementType, elementName: normalized.elementName,
    kind: 'activity',
    config: buildActivityElementConfigPayload(normalized),
  })
}

export function removeMissingActivityConfigs(workflowId: string, validElementIds: string[]) {
  const validIdsSet = new Set(validElementIds)
  const nextConfigs = loadWorkflowElementConfigs().filter(
    (item) => item.workflowId !== workflowId || item.kind !== 'activity' || validIdsSet.has(item.elementId),
  )
  saveWorkflowElementConfigs(nextConfigs)
}

export function loadWorkflowSnapshots(): WorkflowVersionSnapshot[] {
  const raw = readArrayFromStorage(SNAPSHOTS_KEY)
  return Array.isArray(raw) ? raw.map(normalizeSnapshot) : []
}

export function saveWorkflowSnapshots(items: WorkflowVersionSnapshot[]) {
  writeStorage(SNAPSHOTS_KEY, JSON.stringify(items.map(normalizeSnapshot)))
}

export function listWorkflowSnapshots(workflowId: string) {
  return loadWorkflowSnapshots()
    .filter((item) => item.workflowId === workflowId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

export function createWorkflowSnapshot(input: {
  workflow: WorkflowDefinition; versionLabel: string; note?: string
  elementConfigs?: WorkflowElementConfig[]; activityConfigs?: WorkflowActivityConfig[]
}) {
  const items = loadWorkflowSnapshots()
  const normalizedElementConfigs = input.elementConfigs
    ? input.elementConfigs.map((item) => normalizeWorkflowElementConfig(item, input.workflow))
    : (input.activityConfigs ?? [])
      .map((item) => normalizeWorkflowActivityConfig(item, input.workflow))
      .map(activityConfigToElementConfig)

  const snapshot = normalizeSnapshot({
    id: crypto.randomUUID(), accountId: input.workflow.accountId,
    accountName: input.workflow.accountName, environmentId: input.workflow.environmentId,
    environmentName: input.workflow.environmentName, processId: input.workflow.processId,
    processName: input.workflow.processName, scopeLevel: input.workflow.scopeLevel,
    tenantId: input.workflow.tenantId ?? input.workflow.accountId,
    workflowId: input.workflow.id, versionLabel: input.versionLabel,
    note: input.note, workflow: input.workflow,
    elementConfigs: normalizedElementConfigs,
    createdAt: new Date().toISOString(),
  })

  items.unshift(snapshot)
  saveWorkflowSnapshots(items)
  return snapshot
}

export function restoreWorkflowSnapshot(snapshotId: string) {
  const snapshot = loadWorkflowSnapshots().find((item) => item.id === snapshotId)
  if (!snapshot) return null

  upsertWorkflow({ ...snapshot.workflow, updatedAt: new Date().toISOString() })

  const allConfigs = loadWorkflowElementConfigs().filter((item) => item.workflowId !== snapshot.workflowId)
  const restoredConfigs = snapshot.elementConfigs.map((item) =>
    normalizeWorkflowElementConfig({ ...item, updatedAt: new Date().toISOString() }, snapshot.workflow),
  )

  saveWorkflowElementConfigs([...allConfigs, ...restoredConfigs])
  return snapshot
}