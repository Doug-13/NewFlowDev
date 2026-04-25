import { api } from './client'
import {
  EMPTY_WORKFLOW_PERMISSIONS,
  type ScopeLevel,
  type WorkflowDefinition as StorageWorkflowDefinition,
  type WorkflowElementConfig,
  type WorkflowElementKind,
  type WorkflowPermissionEntry,
  type WorkflowPermissions,
  type WorkflowStatus as StorageWorkflowStatus,
  type WorkflowVersionSnapshot,
} from '../features/workflows/storage'
import { sanitizeElementConfigsForPersistence } from '../features/workflows/workflowConfigPersistence'

export type WorkflowStatus = StorageWorkflowStatus
export type { WorkflowElementConfig, WorkflowPermissions, WorkflowVersionSnapshot }

export type WorkflowScopeLevel = ScopeLevel
export type WorkflowPermissionScope = WorkflowPermissionEntry
export type WorkflowSnapshot = WorkflowVersionSnapshot

export type WorkflowDefinition = StorageWorkflowDefinition & {
  elementConfigs: WorkflowElementConfig[]
  snapshots: WorkflowVersionSnapshot[]
}

export { EMPTY_WORKFLOW_PERMISSIONS }

export type WorkflowActivityConfigPayload = {
  workflowId?: string
  elementId: string
  elementName?: string
  activityType?: string
  assignmentMode?: string
  deadlineMode?: string
  deadlineValue?: number | null
  deadlineFixedAt?: string | null
  instructions?: string
  helpText?: string
  backgroundColor?: string
  borderColor?: string
  textColor?: string
  iconName?: string
  allowApprove?: boolean
  allowReject?: boolean
  allowRequestChanges?: boolean
  allowForward?: boolean
  allowComment?: boolean
  allowAttachment?: boolean
  notifyOnEnter?: boolean
  notifyOnExit?: boolean
  linkedWorkflowId?: string | null
  responsibleUserIds?: string[]
  responsibleRoleIds?: string[]
  responsibleGroupIds?: string[]
  responsibleAreaIds?: string[]
}

export type WorkflowActivityActionPayload = {
  workflowId?: string
  elementId: string
  actionKey: string
  actionName: string
  actionLabel: string
  description?: string
  outcome?: string
  buttonColor?: string
  textColor?: string
  iconName?: string
  nextElementId?: string | null
  orderIndex?: number
  isDefault?: boolean
  isActive?: boolean
  requiresComment?: boolean
  requiresAttachment?: boolean
  confirmationMessage?: string
}

export type WorkflowActivityMetadataPayload = {
  workflowId?: string
  elementId: string
  elementName?: string
  metadataDefinitionId: string
  isRequired?: boolean
  isReadOnly?: boolean
  orderIndex?: number
}

export type WorkflowElementPayload = {
  elementId: string
  elementType: string
  elementKind: WorkflowElementKind
  name?: string | null
  description?: string | null
  orderIndex?: number | null
  isStart?: boolean
  isEnd?: boolean
  isExecutable?: boolean
  config?: Record<string, any>
}

export type WorkflowTransitionPayload = {
  sequenceFlowId: string
  sourceElementId: string
  targetElementId: string
  name?: string | null
  label?: string | null
  outcome?: string | null
  conditionType: 'always' | 'expression' | 'metadata-value'
  metadataFieldId?: string | null
  expectedValue?: string | null
  expression?: string | null
  isDefault?: boolean
  orderIndex?: number | null
  config?: Record<string, any>
}

export type CreateWorkflowPayload = {
  name: string
  description?: string
  version?: string
  status?: WorkflowStatus
  documentTypeId?: string
  documentTypeName?: string
  processId?: string | null
  processName?: string | null
  environmentId?: string | null
  environmentName?: string | null
  scopeLevel?: WorkflowScopeLevel
  tenantId?: string
  accountName?: string
  bpmnXml?: string
  stepsCount?: number
  permissions?: WorkflowPermissions
  elementConfigs?: WorkflowElementConfig[]
  snapshots?: WorkflowVersionSnapshot[]
  publishedAt?: string

  elements?: WorkflowElementPayload[]
  transitions?: WorkflowTransitionPayload[]

  activityConfigs?: WorkflowActivityConfigPayload[]
  activityActions?: WorkflowActivityActionPayload[]
  activityMetadata?: WorkflowActivityMetadataPayload[]
}

export type UpdateWorkflowPayload = Partial<CreateWorkflowPayload>

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toOptionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return fallback
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function slugifyAction(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function isExecutableWorkflowElement(kind?: string) {
  return [
    'activity',
    'subprocess',
    'system-task',
    'notification',
    'message',
    'timer',
    'signal',
    'conditional',
  ].includes(String(kind ?? ''))
}

function isStartElement(kind?: string) {
  return kind === 'start'
}

function isEndElement(kind?: string) {
  return kind === 'end'
}

function buildWorkflowElementsPayload(
  elementConfigs: WorkflowElementConfig[],
): WorkflowElementPayload[] {
  return elementConfigs
    .filter((item) => item.kind !== 'flow')
    .map((item, index) => ({
      elementId: item.elementId,
      elementType: item.elementType,
      elementKind: item.kind,
      name: item.elementName ?? null,
      description: null,
      orderIndex: index,
      isStart: isStartElement(item.kind),
      isEnd: isEndElement(item.kind),
      isExecutable: isExecutableWorkflowElement(item.kind),
      config: (item.config ?? {}) as Record<string, any>,
    }))
}

function buildWorkflowTransitionsPayload(
  elementConfigs: WorkflowElementConfig[],
): WorkflowTransitionPayload[] {
  return elementConfigs
    .filter((item) => item.kind === 'flow')
    .map((item, index) => {
      const config = (item.config ?? {}) as Record<string, any>

      return {
        sequenceFlowId: item.elementId,
        sourceElementId: String(config.sourceId ?? ''),
        targetElementId: String(config.targetId ?? ''),
        name: item.elementName ?? config.label ?? null,
        label: config.label ?? item.elementName ?? null,
        outcome: config.outcome ?? null,
        conditionType:
          config.conditionType === 'expression' ||
            config.conditionType === 'metadata-value'
            ? config.conditionType
            : 'always',
        metadataFieldId: config.metadataFieldId ?? null,
        expectedValue: config.expectedValue ?? null,
        expression: config.expression ?? null,
        isDefault: Boolean(config.isDefault),
        orderIndex: index,
        config,
      }
    })
    .filter((item) => item.sourceElementId && item.targetElementId)
}

function normalizeScopeLevel(
  value: unknown,
  environmentId?: string | null,
  processId?: string | null,
): WorkflowScopeLevel {
  if (value === 'account' || value === 'environment' || value === 'process') {
    return value
  }
  if (processId) return 'process'
  if (environmentId) return 'environment'
  return 'account'
}

function normalizeElementKind(value: unknown): WorkflowElementKind {
  if (
    value === 'start' ||
    value === 'activity' ||
    value === 'subprocess' ||
    value === 'gateway' ||
    value === 'flow' ||
    value === 'end' ||
    value === 'notification' ||
    value === 'system-task' ||
    value === 'message' ||
    value === 'timer' ||
    value === 'signal' ||
    value === 'conditional'
  ) {
    return value
  }

  return 'activity'
}

function normalizePermissionEntry(value: unknown): WorkflowPermissionEntry {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {}

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

function normalizePermissions(value: unknown): WorkflowPermissions {
  if (!value || typeof value !== 'object') {
    return EMPTY_WORKFLOW_PERMISSIONS
  }

  const raw = value as Record<string, unknown>

  return {
    visualization: normalizePermissionEntry(raw.visualization),
    creation: normalizePermissionEntry(raw.creation),
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function buildDefaultBpmnXml(workflowName = 'Novo Workflow') {
  const now = Date.now()
  const processId = `Process_${now}`
  const startId = `StartEvent_${now}`
  const taskId = `Activity_${now}`
  const endId = `EndEvent_${now}`
  const flow1 = `Flow_${now}_1`
  const flow2 = `Flow_${now}_2`
  const safeName = escapeXml(workflowName)

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_${now}"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" isExecutable="false" name="${safeName}">
    <bpmn:startEvent id="${startId}" name="Início">
      <bpmn:outgoing>${flow1}</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="${taskId}" name="Atividade">
      <bpmn:incoming>${flow1}</bpmn:incoming>
      <bpmn:outgoing>${flow2}</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="${endId}" name="Fim">
      <bpmn:incoming>${flow2}</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="${flow1}" sourceRef="${startId}" targetRef="${taskId}" />
    <bpmn:sequenceFlow id="${flow2}" sourceRef="${taskId}" targetRef="${endId}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${now}">
    <bpmndi:BPMNPlane id="BPMNPlane_${now}" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="${startId}_di" bpmnElement="${startId}">
        <dc:Bounds x="180" y="150" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="${taskId}_di" bpmnElement="${taskId}">
        <dc:Bounds x="280" y="128" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="${endId}_di" bpmnElement="${endId}">
        <dc:Bounds x="470" y="150" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="${flow1}_di" bpmnElement="${flow1}">
        <di:waypoint x="216" y="168" />
        <di:waypoint x="280" y="168" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="${flow2}_di" bpmnElement="${flow2}">
        <di:waypoint x="400" y="168" />
        <di:waypoint x="470" y="168" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

function normalizeScopedFields(value: any) {
  const accountId =
    toOptionalString(value?.accountId) ??
    toOptionalString(value?.tenantId) ??
    ''

  const environmentId =
    toOptionalNullableString(value?.environmentId) ??
    toOptionalNullableString(value?.unitId) ??
    null

  const processId =
    toOptionalNullableString(value?.processId) ??
    null

  const scopeLevel = normalizeScopeLevel(
    value?.scopeLevel,
    environmentId,
    processId,
  )

  return {
    accountId,
    accountName: toOptionalString(value?.accountName),
    environmentId,
    environmentName:
      toOptionalNullableString(value?.environmentName) ??
      toOptionalNullableString(value?.unitName) ??
      null,
    processId,
    processName:
      toOptionalNullableString(value?.processName) ??
      null,
    scopeLevel,
    tenantId:
      toOptionalString(value?.tenantId) ??
      accountId,
  }
}

function toBaseWorkflowDefinition(
  workflow: WorkflowDefinition,
): StorageWorkflowDefinition {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    version: workflow.version,
    status: workflow.status,
    documentTypeId: workflow.documentTypeId,
    documentTypeName: workflow.documentTypeName,
    bpmnXml: workflow.bpmnXml,
    stepsCount: workflow.stepsCount,
    permissions: workflow.permissions,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    publishedAt: workflow.publishedAt,
    accountId: workflow.accountId,
    accountName: workflow.accountName,
    environmentId: workflow.environmentId,
    environmentName: workflow.environmentName,
    processId: workflow.processId,
    processName: workflow.processName,
    scopeLevel: workflow.scopeLevel,
    tenantId: workflow.tenantId,
  }
}

function normalizeElementConfig(
  item: any,
  workflowFallback?: Partial<StorageWorkflowDefinition>,
): WorkflowElementConfig {
  const fallback = workflowFallback ?? {}

  const scoped = normalizeScopedFields({
    accountId: item?.accountId ?? fallback.accountId,
    accountName: item?.accountName ?? fallback.accountName,
    environmentId: item?.environmentId ?? fallback.environmentId,
    environmentName: item?.environmentName ?? fallback.environmentName,
    processId: item?.processId ?? fallback.processId,
    processName: item?.processName ?? fallback.processName,
    scopeLevel: item?.scopeLevel ?? fallback.scopeLevel,
    tenantId: item?.tenantId ?? fallback.tenantId ?? fallback.accountId,
  })

  return {
    ...scoped,
    id: String(item?.id ?? crypto.randomUUID()),
    workflowId: String(item?.workflowId ?? workflowFallback?.id ?? ''),
    elementId: String(item?.elementId ?? ''),
    elementType: String(item?.elementType ?? ''),
    elementName: toOptionalString(item?.elementName),
    kind: normalizeElementKind(item?.kind),
    config: item?.config ?? {},
    createdAt:
      typeof item?.createdAt === 'string'
        ? item.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof item?.updatedAt === 'string'
        ? item.updatedAt
        : new Date().toISOString(),
  } as WorkflowElementConfig
}

function normalizeSnapshot(
  item: any,
  workflowFallback?: Partial<StorageWorkflowDefinition>,
): WorkflowVersionSnapshot {
  const normalizedWorkflow = normalizeWorkflow(item?.workflow ?? workflowFallback ?? {})
  const baseWorkflow = toBaseWorkflowDefinition(normalizedWorkflow)

  const scoped = normalizeScopedFields({
    accountId: item?.accountId ?? baseWorkflow.accountId,
    accountName: item?.accountName ?? baseWorkflow.accountName,
    environmentId: item?.environmentId ?? baseWorkflow.environmentId,
    environmentName: item?.environmentName ?? baseWorkflow.environmentName,
    processId: item?.processId ?? baseWorkflow.processId,
    processName: item?.processName ?? baseWorkflow.processName,
    scopeLevel: item?.scopeLevel ?? baseWorkflow.scopeLevel,
    tenantId: item?.tenantId ?? baseWorkflow.tenantId ?? baseWorkflow.accountId,
  })

  const elementConfigs = Array.isArray(item?.elementConfigs)
    ? item.elementConfigs.map((cfg: any) => normalizeElementConfig(cfg, baseWorkflow))
    : []

  return {
    ...scoped,
    id: String(item?.id ?? crypto.randomUUID()),
    workflowId: String(item?.workflowId ?? baseWorkflow.id ?? ''),
    versionLabel:
      typeof item?.versionLabel === 'string' && item.versionLabel.trim()
        ? item.versionLabel
        : 'Snapshot',
    note: toOptionalString(item?.note),
    workflow: baseWorkflow,
    elementConfigs,
    createdAt:
      typeof item?.createdAt === 'string'
        ? item.createdAt
        : new Date().toISOString(),
  }
}

function normalizeWorkflow(item: any): WorkflowDefinition {
  const scoped = normalizeScopedFields(item)

  const workflow: WorkflowDefinition = {
    ...scoped,
    id: String(item?.id ?? item?._id ?? crypto.randomUUID()),
    name: String(item?.name ?? 'Workflow sem nome'),
    description:
      typeof item?.description === 'string'
        ? item.description
        : undefined,
    version:
      typeof item?.version === 'string' && item.version.trim()
        ? item.version
        : '1.0',
    status:
      item?.status === 'draft' ||
        item?.status === 'active' ||
        item?.status === 'inactive' ||
        item?.status === 'archived'
        ? item.status
        : 'draft',
    documentTypeId:
      typeof item?.documentTypeId === 'string'
        ? item.documentTypeId
        : undefined,
    documentTypeName:
      typeof item?.documentTypeName === 'string'
        ? item.documentTypeName
        : undefined,
    bpmnXml:
      typeof item?.bpmnXml === 'string'
        ? item.bpmnXml
        : '',
    stepsCount:
      typeof item?.stepsCount === 'number'
        ? item.stepsCount
        : Array.isArray(item?.steps)
          ? item.steps.length
          : 0,
    permissions: normalizePermissions(item?.permissions),
    createdAt:
      typeof item?.createdAt === 'string'
        ? item.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof item?.updatedAt === 'string'
        ? item.updatedAt
        : new Date().toISOString(),
    publishedAt:
      typeof item?.publishedAt === 'string'
        ? item.publishedAt
        : undefined,
    elementConfigs: [],
    snapshots: [],
  }

  workflow.elementConfigs = Array.isArray(item?.elementConfigs)
    ? item.elementConfigs.map((cfg: any) => normalizeElementConfig(cfg, workflow))
    : []

  workflow.snapshots = Array.isArray(item?.snapshots)
    ? item.snapshots.map((snap: any) => normalizeSnapshot(snap, workflow))
    : []

    ; (workflow as any).elements = Array.isArray(item?.elements) ? item.elements : []
    ; (workflow as any).transitions = Array.isArray(item?.transitions) ? item.transitions : []

  return workflow
}

function extractActivityConfigs(
  workflow: WorkflowDefinition,
): WorkflowActivityConfigPayload[] {
  return (workflow.elementConfigs ?? [])
    .filter((item) => item.kind === 'activity')
    .map((item) => {
      const config = (item.config ?? {}) as Record<string, unknown>

      return {
        workflowId: workflow.id,
        elementId: item.elementId,
        elementName: item.elementName,
        activityType: toOptionalString(config.activityType) ?? 'activity',
        assignmentMode: toOptionalString(config.assignmentMode) ?? 'user',
        deadlineMode: toOptionalString(config.deadlineMode),
        deadlineValue:
          config.deadlineValue != null ? toNumber(config.deadlineValue, 0) : null,
        deadlineFixedAt: toOptionalNullableString(config.deadlineFixedAt) ?? null,
        instructions: toOptionalString(config.instructions),
        helpText: toOptionalString(config.helpText),
        backgroundColor: toOptionalString(config.backgroundColor),
        borderColor: toOptionalString(config.borderColor),
        textColor: toOptionalString(config.textColor),
        iconName: toOptionalString(config.iconName),
        allowApprove: toBoolean(config.allowApprove, false),
        allowReject: toBoolean(config.allowReject, false),
        allowRequestChanges: toBoolean(config.allowRequestChanges, false),
        allowForward: toBoolean(config.allowForward, false),
        allowComment: toBoolean(config.allowComment, true),
        allowAttachment: toBoolean(config.allowAttachment, true),
        notifyOnEnter: toBoolean(config.notifyOnEnter, false),
        notifyOnExit: toBoolean(config.notifyOnExit, false),
        linkedWorkflowId: toOptionalNullableString(config.linkedWorkflowId) ?? null,
        responsibleUserIds: uniqueStrings(
          toStringArray(config.responsibleUserIds),
        ),
        responsibleRoleIds: uniqueStrings(
          toStringArray(config.responsibleRoleIds),
        ),
        responsibleGroupIds: uniqueStrings(
          toStringArray(config.responsibleGroupIds),
        ),
        responsibleAreaIds: uniqueStrings(
          toStringArray(config.responsibleAreaIds),
        ),
      }
    })
}

function extractActivityActions(
  workflow: WorkflowDefinition,
): WorkflowActivityActionPayload[] {
  return (workflow.elementConfigs ?? [])
    .filter((item) => item.kind === 'activity')
    .flatMap((item) => {
      const config = (item.config ?? {}) as Record<string, unknown>
      const actions = Array.isArray(config.actions) ? config.actions : []

      return actions.map((action, index) => {
        const actionRecord =
          action && typeof action === 'object'
            ? (action as Record<string, unknown>)
            : {}

        const actionLabel =
          toOptionalString(actionRecord.actionLabel) ??
          toOptionalString(actionRecord.label) ??
          toOptionalString(actionRecord.name) ??
          `Ação ${index + 1}`

        const actionKey =
          toOptionalString(actionRecord.actionKey) ??
          toOptionalString(actionRecord.key) ??
          toOptionalString(actionRecord.outcome) ??
          slugifyAction(actionLabel)

        return {
          workflowId: workflow.id,
          elementId: item.elementId,
          actionKey,
          actionName:
            toOptionalString(actionRecord.actionName) ??
            toOptionalString(actionRecord.name) ??
            actionLabel,
          actionLabel,
          description: toOptionalString(actionRecord.description),
          outcome:
            toOptionalString(actionRecord.outcome) ??
            actionKey,
          buttonColor:
            toOptionalString(actionRecord.buttonColor) ??
            toOptionalString(actionRecord.color),
          textColor: toOptionalString(actionRecord.textColor),
          iconName: toOptionalString(actionRecord.iconName),
          nextElementId:
            toOptionalNullableString(actionRecord.nextElementId) ??
            toOptionalNullableString(actionRecord.targetElementId) ??
            null,
          orderIndex:
            actionRecord.orderIndex != null
              ? toNumber(actionRecord.orderIndex, index)
              : index,
          isDefault: toBoolean(actionRecord.isDefault, false),
          isActive: toBoolean(actionRecord.isActive, true),
          requiresComment: toBoolean(actionRecord.requiresComment, false),
          requiresAttachment: toBoolean(actionRecord.requiresAttachment, false),
          confirmationMessage: toOptionalString(actionRecord.confirmationMessage),
        }
      })
    })
}
function extractActivityMetadata(
  workflow: WorkflowDefinition,
): WorkflowActivityMetadataPayload[] {
  return (workflow.elementConfigs ?? [])
    .filter((item) => item.kind === 'activity')
    .flatMap((item) => {
      const config = (item.config ?? {}) as Record<string, unknown>

      const metadataFields = Array.isArray(config.metadataFields)
        ? config.metadataFields
        : []

      if (metadataFields.length > 0) {
        const result: WorkflowActivityMetadataPayload[] = []

        metadataFields.forEach((field, index) => {
          const fieldRecord =
            field && typeof field === 'object'
              ? (field as Record<string, unknown>)
              : {}

          const metadataDefinitionId =
            toOptionalString(fieldRecord.metadataDefinitionId) ??
            toOptionalString(fieldRecord.metadata_definition_id)

          if (!metadataDefinitionId) {
            return
          }

          result.push({
            workflowId: workflow.id,
            elementId: item.elementId,
            elementName: item.elementName,
            metadataDefinitionId,
            isRequired: toBoolean(fieldRecord.isRequired, false),
            isReadOnly: toBoolean(fieldRecord.isReadOnly, false),
            orderIndex:
              fieldRecord.orderIndex != null
                ? toNumber(fieldRecord.orderIndex, index)
                : index,
          })
        })

        return result
      }

      const metadataDefinitionIds = uniqueStrings(
        toStringArray(config.metadataDefinitionIds),
      )

      return metadataDefinitionIds.map((metadataDefinitionId, index) => ({
        workflowId: workflow.id,
        elementId: item.elementId,
        elementName: item.elementName,
        metadataDefinitionId,
        isRequired: false,
        isReadOnly: false,
        orderIndex: index,
      }))
    })
}

export function toWorkflowPayload(
  workflow: WorkflowDefinition,
): UpdateWorkflowPayload {
  const sanitizedElementConfigs = sanitizeElementConfigsForPersistence(
    workflow.elementConfigs ?? [],
  )

  const elements = buildWorkflowElementsPayload(sanitizedElementConfigs)
  const transitions = buildWorkflowTransitionsPayload(sanitizedElementConfigs)

  return {
    name: workflow.name,
    description: workflow.description,
    version: workflow.version,
    status: workflow.status,
    documentTypeId: workflow.documentTypeId,
    documentTypeName: workflow.documentTypeName,
    processId: workflow.processId,
    processName: workflow.processName,
    environmentId: workflow.environmentId,
    environmentName: workflow.environmentName,
    scopeLevel: workflow.scopeLevel,
    tenantId: workflow.tenantId,
    accountName: workflow.accountName,
    bpmnXml: workflow.bpmnXml,
    stepsCount: workflow.stepsCount,
    permissions: workflow.permissions,
    elementConfigs: sanitizedElementConfigs,
    snapshots: workflow.snapshots ?? [],

    elements,
    transitions,

    activityConfigs: extractActivityConfigs({
      ...workflow,
      elementConfigs: sanitizedElementConfigs,
    }),
    activityActions: extractActivityActions({
      ...workflow,
      elementConfigs: sanitizedElementConfigs,
    }),
    activityMetadata: extractActivityMetadata({
      ...workflow,
      elementConfigs: sanitizedElementConfigs,
    }),
  }
}

export async function listWorkflows(params?: { processId?: string }) {
  const { data } = await api.get('/workflows', {
    params: {
      ...(params?.processId ? { processId: params.processId } : {}),
    },
  })

  return Array.isArray(data) ? data.map(normalizeWorkflow) : []
}

export async function getWorkflowById(id: string) {
  const { data } = await api.get(`/workflows/${id}`)
  return normalizeWorkflow(data)
}

export async function createWorkflow(payload: CreateWorkflowPayload) {
  const workflowLike = normalizeWorkflow({
    ...payload,
    version: payload.version ?? '1.0',
    status: payload.status ?? 'draft',
    scopeLevel:
      payload.scopeLevel ??
      (payload.processId
        ? 'process'
        : payload.environmentId
          ? 'environment'
          : 'account'),
    bpmnXml: payload.bpmnXml ?? buildDefaultBpmnXml(payload.name),
    stepsCount: payload.stepsCount ?? 0,
    permissions: payload.permissions ?? EMPTY_WORKFLOW_PERMISSIONS,
    elementConfigs: payload.elementConfigs ?? [],
    snapshots: payload.snapshots ?? [],
    publishedAt: payload.publishedAt,
  })

  const { data } = await api.post('/workflows', toWorkflowPayload(workflowLike))
  return normalizeWorkflow(data)
}

export async function updateWorkflow(id: string, payload: UpdateWorkflowPayload) {
  const baseWorkflow = normalizeWorkflow({
    id,
    name: payload.name ?? 'Workflow sem nome',
    description: payload.description,
    version: payload.version ?? '1.0',
    status: payload.status ?? 'draft',
    documentTypeId: payload.documentTypeId,
    documentTypeName: payload.documentTypeName,
    processId: payload.processId,
    processName: payload.processName,
    environmentId: payload.environmentId,
    environmentName: payload.environmentName,
    scopeLevel: payload.scopeLevel,
    tenantId: payload.tenantId,
    accountName: payload.accountName,
    bpmnXml: payload.bpmnXml ?? '',
    stepsCount: payload.stepsCount ?? 0,
    permissions: payload.permissions ?? EMPTY_WORKFLOW_PERMISSIONS,
    elementConfigs: payload.elementConfigs ?? [],
    snapshots: payload.snapshots ?? [],
    publishedAt: payload.publishedAt,
  })

  const { data } = await api.patch(`/workflows/${id}`, toWorkflowPayload(baseWorkflow))
  return normalizeWorkflow(data)
}

export async function deleteWorkflow(id: string) {
  const { data } = await api.delete(`/workflows/${id}`)
  return data
}