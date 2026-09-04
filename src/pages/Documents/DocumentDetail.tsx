import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Descriptions,
  Button,
  Upload,
  Space,
  Typography,
  Tabs,
  Table,
  Form,
  Input,
  Tag,
  Popconfirm,
  message,
  Steps,
  Divider,
  Alert,
  Modal,
  Spin,
  Popover,
} from 'antd'
import {
  UploadOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
  UserOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  BranchesOutlined,
} from '@ant-design/icons'
import {
  getDocument,
  uploadFile,
  cancelDocument,
  downloadFile,
  executeDocumentAction,
  getDocumentReferences,
  type DocumentReferenceItem,
} from '../../api/documents'
import { StatusBadge } from '../../components/StatusBadge'
import { Timeline } from '../../components/Timeline'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAuthStore } from '../../store/authStore'
import {
  getMetadataValues,
  saveMetadataValues,
  getMetadataDefinitions,
} from '../../api/metadata'
import {
  getWorkflowById,
  type WorkflowDefinition,
} from '../../api/workflows'
import { MetadataForm } from '../../components/MetadataForm'
import { BpmnViewer } from '../../components/BpmnViewer'
import { useWorkflowNodeStatuses } from '../../hooks/useWorkflowNodeStatuses'

const { Title, Text } = Typography

const ACTION_LABELS: Record<string, string> = {
  submit: 'Submeter',
  approve: 'Aprovar',
  reject: 'Reprovar',
  'request-changes': 'Solicitar ajustes',
  request_changes: 'Solicitar ajustes',
  cancel: 'Cancelar',
  publish: 'Publicar',
  review: 'Revisar',
  forward: 'Encaminhar',
  custom: 'Ação',
}

const ACTION_COLORS: Record<string, string> = {
  approve: '#52c41a',
  publish: '#52c41a',
  submit: '#1677ff',
  forward: '#1677ff',
  reject: '#ff4d4f',
  'request-changes': '#fa8c16',
  request_changes: '#fa8c16',
  cancel: '#8c8c8c',
  review: '#722ed1',
  custom: '#1677ff',
}

function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

function normalizeRevisionLabel(value?: string | null) {
  const revision = String(value ?? '').trim()
  if (!revision) return 'Rev -'
  return `Rev ${revision}`
}

function formatResponsibleLabel(
  responsible: { type?: string; kind?: string; id?: string; name?: string },
): string {
  const roleType = responsible.type ?? responsible.kind ?? ''
  const name = responsible.name ?? responsible.id ?? '—'

  if (roleType === 'dynamic') return 'Solicitante'
  if (roleType === 'user') return name
  if (roleType === 'role') return `Papel: ${name}`
  if (roleType === 'group') return `Grupo: ${name}`
  if (roleType === 'area') return `Área: ${name}`
  if (roleType === 'function') return `Função: ${name}`

  return name
}

function formatSla(
  deadlineMode: string | null,
  deadlineValue: number | string | null,
): string | null {
  if (
    !deadlineMode ||
    deadlineValue === null ||
    deadlineValue === undefined ||
    deadlineValue === ''
  ) {
    return null
  }

  const value = Number(deadlineValue)
  if (isNaN(value) || value <= 0) return null

  if (deadlineMode === 'hours') return `${value}h de prazo`
  if (deadlineMode === 'days') {
    return `${value} dia${value !== 1 ? 's' : ''} de prazo`
  }

  return null
}

function safeFormatDateTime(value?: string | null) {
  if (!value) return '-'

  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm', {
      locale: ptBR,
    })
  } catch {
    return value
  }
}

type ConfiguredAction = {
  id: string
  label: string
  color: string
  outcome: string
  requiresComment: boolean
  nextElementId?: string | null
}

type WorkflowStepTransition = {
  triggerAction: string
  toStepOrderIndex: number | null
  toStepId: string | null
  toStepName: string | null
}

type WorkflowStepEnriched = {
  id: string
  elementId?: string
  elementType?: string
  elementKind?: string
  name: string
  orderIndex: number | null
  isInitial: boolean
  isFinal: boolean
  allowedActions: string[]
  actions: ConfiguredAction[]
  deadlineMode: string | null
  deadlineValue: number | string | null
  responsibles: Array<{
    type?: string
    kind?: string
    id?: string
    name?: string
  }>
  transitions: WorkflowStepTransition[]
  instructions?: string | null
  helpText?: string | null
  metadataFields?: Array<{
    metadataDefinitionId: string
    isRequired?: boolean
    isReadOnly?: boolean
  }>
}

type RevisionHistoryItem = {
  id: string
  code: string
  revision: string
  status: string
  title?: string
  createdAt?: string | null
  updatedAt?: string | null
  createdByName?: string | null
  responsibleName?: string | null
  currentStepName?: string | null
  currentAssignedUserName?: string | null
  isCurrentRevision?: boolean
}

type ActionConfirmModalProps = {
  open: boolean
  action: ConfiguredAction | null
  nextStep: WorkflowStepEnriched | null
  commentValue: string
  commentError: boolean
  loading: boolean
  onCommentChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function normalizeDocument(raw: any) {
  if (!raw || typeof raw !== 'object') return null

  return {
    ...raw,

    id: raw.id ?? raw._id?.toString?.() ?? null,

    currentElementId:
      raw.currentElementId ??
      raw.current_element_id ??
      null,

    currentStepId:
      raw.currentStepId ??
      raw.current_step_id ??
      raw.currentElementId ??
      raw.current_element_id ??
      null,

    currentStepName:
      raw.currentStepName ??
      raw.current_step_name ??
      null,

    currentStepOrderIndex:
      raw.currentStepOrderIndex ??
      raw.current_step_order_index ??
      null,

    currentAssignedUserId:
      raw.currentAssignedUserId ??
      raw.current_assigned_user_id ??
      null,

    currentAssignedUserName:
      raw.currentAssignedUserName ??
      raw.current_assigned_user_name ??
      null,

    responsibleId:
      raw.responsibleId ??
      raw.responsible_id ??
      raw.responsibleUserId ??
      raw.responsible_user_id ??
      null,

    responsibleName:
      raw.responsibleName ??
      raw.responsible_name ??
      raw.responsibleUserName ??
      raw.responsible_user_name ??
      null,

    createdById:
      raw.createdById ??
      raw.created_by_id ??
      null,

    createdByName:
      raw.createdByName ??
      raw.created_by_name ??
      raw.createdByUserName ??
      raw.created_by_user_name ??
      null,

    workflowId:
      raw.workflowId ??
      raw.workflow_id ??
      null,

    workflowName:
      raw.workflowName ??
      raw.workflow_name ??
      null,

    processName:
      raw.processName ??
      raw.process_name ??
      null,

    createdAt:
      raw.createdAt ??
      raw.created_at ??
      null,

    updatedAt:
      raw.updatedAt ??
      raw.updated_at ??
      null,

    dueDate:
      raw.dueDate ??
      raw.due_date ??
      null,

    currentInstanceId:
      raw.currentInstanceId ??
      raw.current_instance_id ??
      null,

    isCurrentRevision:
      raw.isCurrentRevision ??
      raw.is_current_revision ??
      false,

    files: Array.isArray(raw.files) ? raw.files : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    auditLogs: Array.isArray(raw.auditLogs) ? raw.auditLogs : [],
    workflowSteps: Array.isArray(raw.workflowSteps) ? raw.workflowSteps : [],
    availableActions: Array.isArray(raw.availableActions) ? raw.availableActions : [],

    taskActions: Array.isArray(raw.taskActions)
      ? raw.taskActions
      : Array.isArray(raw.task_actions)
        ? raw.task_actions
        : [],

    stepMetadataFields: Array.isArray(raw.stepMetadataFields)
      ? raw.stepMetadataFields
      : Array.isArray(raw.step_metadata_fields)
        ? raw.step_metadata_fields
        : [],

    responsibleUserIds: Array.isArray(raw.responsibleUserIds)
      ? raw.responsibleUserIds
      : Array.isArray(raw.responsible_user_ids)
        ? raw.responsible_user_ids
        : [],

    responsibleNames: Array.isArray(raw.responsibleNames)
      ? raw.responsibleNames
      : Array.isArray(raw.responsible_names)
        ? raw.responsible_names
        : [],

    responsibles: Array.isArray(raw.responsibles) ? raw.responsibles : [],

    revisionHistory: Array.isArray(raw.revisionHistory)
      ? raw.revisionHistory
      : Array.isArray(raw.revision_history)
        ? raw.revision_history
        : [],
  }
}

function isRevisionCurrent(
  item: RevisionHistoryItem,
  currentInstanceId?: string | null,
) {
  const itemId = String(item.id ?? '').trim()
  const currentId = String(currentInstanceId ?? '').trim()

  if (currentId && itemId) {
    return itemId === currentId
  }

  return item.isCurrentRevision === true
}

function getNormalizedWorkflowElementKind(item: any): string {
  return String(
    item?.elementKind ??
    item?.element_kind ??
    item?.kind ??
    item?.configType ??
    item?.config_type ??
    '',
  ).trim()
}

function isVisibleWorkflowStepKind(kind: string): boolean {
  return [
    'activity',
    'subprocess',
    'system-task',
    'notification',
    'message',
    'timer',
    'signal',
    'conditional',
    'end',  // ← adicionar
  ].includes(kind)
}

function getElementDisplayName(element: any, config?: any): string {
  return String(
    config?.elementName ??
    config?.element_name ??
    element?.name ??
    element?.elementName ??
    element?.element_name ??
    element?.elementId ??
    element?.element_id ??
    element?.id ??
    'Etapa',
  )
}

function getElementIdFromRecord(item: any): string {
  return String(
    item?.elementId ??
    item?.element_id ??
    item?.id ??
    '',
  ).trim()
}

function normalizeWorkflowTransitionItem(item: any) {
  return {
    sequenceFlowId: String(
      item?.sequenceFlowId ??
      item?.sequence_flow_id ??
      item?.id ??
      '',
    ),
    sourceElementId: String(
      item?.sourceElementId ??
      item?.source_element_id ??
      '',
    ),
    targetElementId: String(
      item?.targetElementId ??
      item?.target_element_id ??
      '',
    ),
    outcome:
      item?.outcome ??
      item?.config?.outcome ??
      null,
    label:
      item?.label ??
      item?.name ??
      item?.config?.label ??
      null,
    isDefault: Boolean(item?.isDefault ?? item?.is_default),
    orderIndex:
      item?.orderIndex !== undefined && item?.orderIndex !== null
        ? Number(item.orderIndex)
        : item?.order_index !== undefined && item?.order_index !== null
          ? Number(item.order_index)
          : 0,
    config: item?.config ?? {},
  }
}

function getWorkflowElements(workflow: WorkflowDefinition | null | undefined): any[] {
  if (!workflow) return []

  if (Array.isArray((workflow as any).elements)) {
    return (workflow as any).elements
  }

  return []
}

function getWorkflowTransitions(workflow: WorkflowDefinition | null | undefined): any[] {
  if (!workflow) return []

  if (Array.isArray((workflow as any).transitions)) {
    return (workflow as any).transitions
  }

  return []
}

function orderWorkflowElementsByTransitions(
  workflow: WorkflowDefinition | null | undefined,
): any[] {
  if (!workflow) return []

  const rawElements = getWorkflowElements(workflow)
  const rawTransitions = getWorkflowTransitions(workflow)

  if (rawElements.length === 0) return []

  const elementsById = new Map<string, any>()

  rawElements.forEach((element: any) => {
    const elementId = getElementIdFromRecord(element)
    if (elementId) {
      elementsById.set(elementId, element)
    }
  })

  const transitions = rawTransitions
    .map(normalizeWorkflowTransitionItem)
    .filter((transition) => transition.sourceElementId && transition.targetElementId)
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const outgoingBySource = new Map<
    string,
    ReturnType<typeof normalizeWorkflowTransitionItem>[]
  >()

  const incomingCount = new Map<string, number>()

  transitions.forEach((transition) => {
    const list = outgoingBySource.get(transition.sourceElementId) ?? []
    list.push(transition)
    outgoingBySource.set(transition.sourceElementId, list)

    incomingCount.set(
      transition.targetElementId,
      (incomingCount.get(transition.targetElementId) ?? 0) + 1,
    )
  })

  const startElement =
    rawElements.find((element: any) => getNormalizedWorkflowElementKind(element) === 'start') ??
    rawElements.find((element: any) => {
      const elementId = getElementIdFromRecord(element)
      return elementId && !incomingCount.has(elementId)
    }) ??
    rawElements[0]

  const startElementId = getElementIdFromRecord(startElement)

  const ordered: any[] = []
  const visited = new Set<string>()
  const queue: string[] = startElementId ? [startElementId] : []

  while (queue.length > 0) {
    const elementId = queue.shift()
    if (!elementId || visited.has(elementId)) continue

    visited.add(elementId)

    const element = elementsById.get(elementId)
    if (!element) continue

    const kind = getNormalizedWorkflowElementKind(element)

    if (isVisibleWorkflowStepKind(kind)) {
      ordered.push(element)
    }

    const outgoing = outgoingBySource.get(elementId) ?? []

    outgoing
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? 1 : -1
        return a.orderIndex - b.orderIndex
      })
      .forEach((transition) => {
        if (!visited.has(transition.targetElementId)) {
          queue.push(transition.targetElementId)
        }
      })
  }

  rawElements.forEach((element: any) => {
    const elementId = getElementIdFromRecord(element)
    const kind = getNormalizedWorkflowElementKind(element)

    if (
      elementId &&
      !visited.has(elementId) &&
      isVisibleWorkflowStepKind(kind)
    ) {
      ordered.push(element)
    }
  })

  return ordered
}

function normalizeActionFromRaw(
  action: any,
  elementId: string,
  actionIndex: number,
  outgoingTransitions: ReturnType<typeof normalizeWorkflowTransitionItem>[],
): ConfiguredAction {
  const label =
    action?.actionLabel ??
    action?.action_label ??
    action?.label ??
    action?.name ??
    getActionLabel(String(action?.outcome ?? `action-${actionIndex + 1}`))

  const outcome = String(
    action?.outcome ??
    action?.actionKey ??
    action?.action_key ??
    action?.key ??
    `action-${actionIndex + 1}`,
  )

  const matchedTransition =
    outgoingTransitions.find((transition) => {
      const transitionOutcome = String(transition.outcome ?? '').trim()
      const transitionLabel = String(transition.label ?? '').trim()

      return (
        transitionOutcome === outcome ||
        transitionLabel === label ||
        transitionLabel === outcome
      )
    }) ??
    outgoingTransitions[actionIndex] ??
    null

  return {
    id: String(
      action?.id ??
      action?.actionKey ??
      action?.action_key ??
      `${elementId}-${outcome}-${actionIndex}`,
    ),
    label: String(label),
    color: String(
      action?.buttonColor ??
      action?.button_color ??
      action?.color ??
      ACTION_COLORS[outcome] ??
      '#1677ff',
    ),
    outcome,
    requiresComment: Boolean(
      action?.requiresComment ??
      action?.requires_comment ??
      false,
    ),
    nextElementId:
      action?.nextElementId != null
        ? String(action.nextElementId)
        : action?.next_element_id != null
          ? String(action.next_element_id)
          : action?.targetElementId != null
            ? String(action.targetElementId)
            : matchedTransition?.targetElementId ?? null,
  }
}

function buildWorkflowStepsFromWorkflow(
  workflow: WorkflowDefinition | null | undefined,
): WorkflowStepEnriched[] {
  if (!workflow) return []

  const elementConfigs = Array.isArray(workflow.elementConfigs)
    ? workflow.elementConfigs
    : []

  const configMap = new Map<string, any>()

  elementConfigs.forEach((config: any) => {
    const elementId = getElementIdFromRecord(config)
    if (elementId) {
      configMap.set(elementId, config)
    }
  })

  const orderedElements = orderWorkflowElementsByTransitions(workflow)
  const workflowTransitions = getWorkflowTransitions(workflow).map(
    normalizeWorkflowTransitionItem,
  )

  if (orderedElements.length > 0) {
    return orderedElements.map((element: any, index: number) => {
      const elementId = getElementIdFromRecord(element)
      const configItem = configMap.get(elementId)

      const config =
        configItem?.config && typeof configItem.config === 'object'
          ? (configItem.config as Record<string, any>)
          : element?.config && typeof element.config === 'object'
            ? (element.config as Record<string, any>)
            : {}

      const kind = getNormalizedWorkflowElementKind(configItem ?? element)

      const outgoingTransitions = workflowTransitions.filter(
        (transition) => transition.sourceElementId === elementId,
      )

      const rawActions = Array.isArray(config.actions)
        ? config.actions
        : []

      const actions: ConfiguredAction[] =
        rawActions.length > 0
          ? rawActions.map((action: any, actionIndex: number) =>
            normalizeActionFromRaw(action, elementId, actionIndex, outgoingTransitions),
          )
          : outgoingTransitions.map((transition, transitionIndex) => ({
            id: String(
              transition.outcome ??
              transition.label ??
              transition.sequenceFlowId ??
              `${elementId}-transition-${transitionIndex}`,
            ),
            label: String(
              transition.label ??
              getActionLabel(String(transition.outcome ?? 'Avançar')),
            ),
            color: ACTION_COLORS[String(transition.outcome ?? '')] ?? '#1677ff',
            outcome: String(
              transition.outcome ??
              transition.label ??
              transition.sequenceFlowId ??
              `transition-${transitionIndex}`,
            ),
            requiresComment: false,
            nextElementId: transition.targetElementId,
          }))

      const responsibles: Array<{
        type?: string
        kind?: string
        id?: string
        name?: string
      }> = [
          ...((Array.isArray(config.responsibleUserIds)
            ? config.responsibleUserIds
            : []) as string[]).map((id) => ({
              type: 'user',
              kind: 'user',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleRoleIds)
            ? config.responsibleRoleIds
            : []) as string[]).map((id) => ({
              type: 'role',
              kind: 'role',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleGroupIds)
            ? config.responsibleGroupIds
            : []) as string[]).map((id) => ({
              type: 'group',
              kind: 'group',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleAreaIds)
            ? config.responsibleAreaIds
            : []) as string[]).map((id) => ({
              type: 'area',
              kind: 'area',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleFunctionIds)
            ? config.responsibleFunctionIds
            : []) as string[]).map((id) => ({
              type: 'function',
              kind: 'function',
              id: String(id),
              name: String(id),
            })),
        ]

      const metadataFields = Array.isArray(config.metadataFields)
        ? config.metadataFields.map((field: any) => ({
          metadataDefinitionId: String(field?.metadataDefinitionId ?? ''),
          isRequired: Boolean(field?.isRequired),
          isReadOnly: Boolean(field?.isReadOnly),
        }))
        : Array.isArray(config.metadataDefinitionIds)
          ? config.metadataDefinitionIds.map((metadataDefinitionId: string) => ({
            metadataDefinitionId: String(metadataDefinitionId),
            isRequired: false,
            isReadOnly: false,
          }))
          : []

      const stepTransitions: WorkflowStepTransition[] =
        actions.length > 0
          ? actions.map((action) => ({
            triggerAction: action.outcome,
            toStepOrderIndex: null,
            toStepId: action.nextElementId ?? null,
            toStepName: null,
          }))
          : outgoingTransitions.map((transition) => ({
            triggerAction: String(
              transition.outcome ??
              transition.label ??
              transition.sequenceFlowId,
            ),
            toStepOrderIndex: null,
            toStepId: transition.targetElementId,
            toStepName: null,
          }))

      return {
        id: elementId,
        elementId,
        elementType:
          element?.elementType ??
          element?.element_type ??
          configItem?.elementType ??
          '',
        elementKind: kind,
        name: getElementDisplayName(element, configItem),
        orderIndex: index,
        isInitial: index === 0,
        isFinal: false,
        allowedActions: actions.map((action) => action.outcome),
        actions,
        deadlineMode:
          typeof config.deadlineMode === 'string' ? config.deadlineMode : null,
        deadlineValue:
          config.deadlineValue !== undefined ? config.deadlineValue : null,
        responsibles,
        transitions: stepTransitions,
        instructions:
          typeof config.instructions === 'string' ? config.instructions : null,
        helpText:
          typeof config.helpText === 'string' ? config.helpText : null,
        metadataFields,
      }
    })
  }

  return elementConfigs
    .filter((item) => item.kind === 'activity')
    .map((item, index) => {
      const elementId = String(item.elementId ?? item.id ?? '')

      const config =
        item.config && typeof item.config === 'object'
          ? (item.config as Record<string, any>)
          : {}

      const rawActions = Array.isArray(config.actions) ? config.actions : []

      const actions: ConfiguredAction[] = rawActions.map(
        (action: any, actionIndex: number) =>
          normalizeActionFromRaw(action, elementId, actionIndex, []),
      )

      const responsibles: Array<{
        type?: string
        kind?: string
        id?: string
        name?: string
      }> = [
          ...((Array.isArray(config.responsibleUserIds)
            ? config.responsibleUserIds
            : []) as string[]).map((id) => ({
              type: 'user',
              kind: 'user',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleRoleIds)
            ? config.responsibleRoleIds
            : []) as string[]).map((id) => ({
              type: 'role',
              kind: 'role',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleGroupIds)
            ? config.responsibleGroupIds
            : []) as string[]).map((id) => ({
              type: 'group',
              kind: 'group',
              id: String(id),
              name: String(id),
            })),
          ...((Array.isArray(config.responsibleAreaIds)
            ? config.responsibleAreaIds
            : []) as string[]).map((id) => ({
              type: 'area',
              kind: 'area',
              id: String(id),
              name: String(id),
            })),
        ]

      const metadataFields = Array.isArray(config.metadataFields)
        ? config.metadataFields.map((field: any) => ({
          metadataDefinitionId: String(field?.metadataDefinitionId ?? ''),
          isRequired: Boolean(field?.isRequired),
          isReadOnly: Boolean(field?.isReadOnly),
        }))
        : Array.isArray(config.metadataDefinitionIds)
          ? config.metadataDefinitionIds.map((metadataDefinitionId: string) => ({
            metadataDefinitionId: String(metadataDefinitionId),
            isRequired: false,
            isReadOnly: false,
          }))
          : []

      const transitions: WorkflowStepTransition[] = actions.map((action) => ({
        triggerAction: action.outcome,
        toStepOrderIndex: null,
        toStepId: action.nextElementId ?? null,
        toStepName: null,
      }))

      return {
        id: elementId,
        elementId,
        elementType: item.elementType,
        elementKind: item.kind,
        name: item.elementName ?? item.elementId,
        orderIndex:
          typeof config.orderIndex === 'number' ? config.orderIndex : index,
        isInitial: Boolean(config.isInitial ?? index === 0),
        isFinal: Boolean(config.isFinal ?? false),
        allowedActions: actions.map((action) => action.outcome),
        actions,
        deadlineMode:
          typeof config.deadlineMode === 'string' ? config.deadlineMode : null,
        deadlineValue:
          config.deadlineValue !== undefined ? config.deadlineValue : null,
        responsibles,
        transitions,
        instructions:
          typeof config.instructions === 'string' ? config.instructions : null,
        helpText:
          typeof config.helpText === 'string' ? config.helpText : null,
        metadataFields,
      }
    })
}

function RevisionHistoryPopover({
  currentDocumentId,
  documents,
  onOpenDocument,
}: {
  currentDocumentId?: string | null
  documents: RevisionHistoryItem[]
  onOpenDocument?: (documentId: string) => void
}) {
  const orderedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const revA = Number(a.revision ?? -1)
      const revB = Number(b.revision ?? -1)

      if (!Number.isNaN(revA) && !Number.isNaN(revB)) {
        return revB - revA
      }

      const dateA = new Date(a.updatedAt ?? a.createdAt ?? '').getTime()
      const dateB = new Date(b.updatedAt ?? b.createdAt ?? '').getTime()

      return dateB - dateA
    })
  }, [documents])

  return (
    <div
      style={{
        width: 340,
        maxHeight: 520,
        overflowY: 'auto',
        paddingRight: 2,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <Space>
          <HistoryOutlined style={{ color: '#334155' }} />
          <Text strong style={{ color: '#1f2937' }}>
            Histórico de revisões
          </Text>
        </Space>
      </div>

      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {orderedDocuments.map((item) => {
          const isCurrent = isRevisionCurrent(item, currentDocumentId)

          const statusLabel = isCurrent ? 'Atual' : 'Obsoleta'
          const displayDate = item.updatedAt ?? item.createdAt ?? null

          const revisionLabel = String(item.revision ?? '00').padStart(2, '0')

          const cardBorderColor = isCurrent ? '#bfdbfe' : '#fde68a'
          const cardBackgroundColor = isCurrent ? '#eff6ff' : '#fffbeb'
          const badgeBackgroundColor = isCurrent ? '#3b82f6' : '#f59e0b'
          const badgeTextColor = '#ffffff'
          const statusTextColor = isCurrent ? '#2563eb' : '#d97706'
          const obsoleteIconColor = isCurrent ? '#94a3b8' : '#d97706'

          return (
            <div
              key={item.id}
              onClick={() => {
                if (onOpenDocument && item.id) {
                  onOpenDocument(item.id)
                }
              }}
              style={{
                border: `1px solid ${cardBorderColor}`,
                background: cardBackgroundColor,
                borderRadius: 12,
                padding: 12,
                cursor: onOpenDocument ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                boxShadow: isCurrent
                  ? '0 4px 12px rgba(59, 130, 246, 0.12)'
                  : '0 2px 8px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Space
                align="start"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                }}
              >
                <Space align="start" size={10}>
                  <div
                    style={{
                      minWidth: 36,
                      height: 36,
                      borderRadius: 9,
                      background: badgeBackgroundColor,
                      color: badgeTextColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                  >
                    {revisionLabel}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <Space wrap size={6}>
                      <Text
                        strong
                        style={{
                          color: '#0f172a',
                          fontSize: 13,
                        }}
                      >
                        {item.code}
                      </Text>

                      <Text
                        strong={isCurrent}
                        style={{
                          color: statusTextColor,
                          fontSize: 11,
                        }}
                      >
                        {statusLabel}
                      </Text>
                    </Space>

                    {displayDate && (
                      <div style={{ marginTop: 4 }}>
                        <Text
                          type="secondary"
                          style={{
                            fontSize: 12,
                            color: '#64748b',
                          }}
                        >
                          {safeFormatDateTime(displayDate)}
                          {item.createdByName ? ` · ${item.createdByName}` : ''}
                        </Text>
                      </div>
                    )}
                  </div>
                </Space>

                {!isCurrent && (
                  <BranchesOutlined
                    style={{
                      color: obsoleteIconColor,
                      marginTop: 6,
                      fontSize: 14,
                    }}
                  />
                )}
              </Space>
            </div>
          )
        })}
      </Space>
    </div>
  )
}

function ActionConfirmModal({
  open,
  action,
  nextStep,
  commentValue,
  commentError,
  loading,
  onCommentChange,
  onConfirm,
  onCancel,
}: ActionConfirmModalProps) {
  if (!action) return null

  const actionColor = ACTION_COLORS[action.outcome] ?? action.color
  const slaLabel = nextStep ? formatSla(nextStep.deadlineMode, nextStep.deadlineValue) : null

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={
        <Space>
          <ThunderboltOutlined style={{ color: actionColor }} />
          <span>Confirmar ação</span>
          <Tag color={actionColor}>{action.label}</Tag>
        </Space>
      }
      width={560}
      destroyOnClose
    >
      {nextStep && (
        <>
          <div
            style={{
              background: '#f6f8fc',
              border: '1px solid #e6eaf2',
              borderRadius: 10,
              padding: '16px 20px',
              marginBottom: 20,
            }}
          >
            <Space align="center" style={{ marginBottom: 12 }}>
              <InfoCircleOutlined style={{ color: '#1677ff' }} />
              <Text strong style={{ fontSize: 13, color: '#1677ff' }}>
                Próxima etapa
              </Text>
            </Space>

            <Text
              strong
              style={{
                display: 'block',
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              {nextStep.name}
            </Text>

            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {Array.isArray(nextStep.responsibles) &&
                nextStep.responsibles.length > 0 && (
                  <Space wrap size={6}>
                    <TeamOutlined style={{ color: '#8c8c8c' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Responsável{nextStep.responsibles.length > 1 ? 'eis' : ''}:
                    </Text>

                    {nextStep.responsibles.map((resp, idx) => (
                      <Tag
                        key={`${resp.id ?? 'resp'}-${idx}`}
                        icon={<UserOutlined />}
                        color="blue"
                      >
                        {formatResponsibleLabel(resp)}
                      </Tag>
                    ))}
                  </Space>
                )}

              {slaLabel && (
                <Space size={6}>
                  <FieldTimeOutlined style={{ color: '#fa8c16' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Prazo estimado:
                  </Text>
                  <Tag color="orange">{slaLabel}</Tag>
                </Space>
              )}
            </Space>
          </div>

          <Divider style={{ margin: '0 0 16px' }} />
        </>
      )}

      <Form.Item
        label={action.requiresComment ? 'Comentário (obrigatório)' : 'Comentário (opcional)'}
        validateStatus={commentError ? 'error' : ''}
        help={commentError ? 'Comentário obrigatório para esta ação.' : ''}
        style={{ marginBottom: 20 }}
      >
        <Input.TextArea
          rows={3}
          value={commentValue}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={
            action.requiresComment
              ? 'Descreva o motivo.'
              : 'Adicione um comentário (opcional).'
          }
          autoFocus
        />
      </Form.Item>

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          type="primary"
          loading={loading}
          onClick={onConfirm}
          style={{
            background: actionColor,
            borderColor: actionColor,
          }}
        >
          Confirmar {action.label}
        </Button>
      </Space>
    </Modal>
  )
}

export function DocumentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((state) => state.user)

  const [modalAction, setModalAction] = useState<ConfiguredAction | null>(null)
  const [commentValue, setCommentValue] = useState('')
  const [commentError, setCommentError] = useState(false)
  const [metaForm] = Form.useForm()

  useEffect(() => {
    if (!id) {
      message.error('Documento inválido.')
      navigate('/documents')
    }
  }, [id, navigate])

  const {
    data: rawDoc,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const response = await getDocument(id!)
      console.log('GET document detail =>', response)
      return normalizeDocument(response)
    },
    enabled: !!id,
  })

  const doc = useMemo(() => normalizeDocument(rawDoc), [rawDoc])

  const { data: workflowRaw } = useQuery({
    queryKey: ['workflow', doc?.workflowId],
    queryFn: async () => {
      const workflowId = String(doc?.workflowId ?? '')
      if (!workflowId) return null
      return getWorkflowById(workflowId)
    },
    enabled: !!doc?.workflowId,
  })

  const workflow = useMemo<WorkflowDefinition | null>(() => {
    return workflowRaw ?? null
  }, [workflowRaw])

  const { data: metadataValuesRaw = [] } = useQuery({
    queryKey: ['metadata-values', id],
    queryFn: () => getMetadataValues(id!),
    enabled: !!id,
  })

  const { data: metadataDefinitionsRaw = [] } = useQuery({
    queryKey: ['metadata-definitions'],
    queryFn: () => getMetadataDefinitions(),
    enabled: !!id,
  })

  const metadataValues = useMemo(
    () => (Array.isArray(metadataValuesRaw) ? metadataValuesRaw : []),
    [metadataValuesRaw],
  )

  const metadataDefinitions = useMemo(
    () => (Array.isArray(metadataDefinitionsRaw) ? metadataDefinitionsRaw : []),
    [metadataDefinitionsRaw],
  )

  const { data: referencesRaw = [], isLoading: isLoadingReferences } = useQuery({
    queryKey: ['document-references', id],
    queryFn: () => getDocumentReferences(id!),
    enabled: !!id,
  })

  const references = useMemo<DocumentReferenceItem[]>(() => {
    return Array.isArray(referencesRaw) ? referencesRaw : []
  }, [referencesRaw])

  const tasks = useMemo(
    () => (Array.isArray(doc?.tasks) ? doc.tasks : []),
    [doc],
  )

  const files = useMemo(
    () => (Array.isArray(doc?.files) ? doc.files : []),
    [doc],
  )

  const auditLogs = useMemo(
    () => (Array.isArray(doc?.auditLogs) ? doc.auditLogs : []),
    [doc],
  )

  const isViewingObsoleteRevision = useMemo(() => {
    if (!doc) return false

    const currentInstanceId = String(
      doc.currentInstanceId ??
      doc.current_instance_id ??
      '',
    ).trim()

    const currentDocumentId = String(doc.id ?? '').trim()

    if (currentInstanceId && currentDocumentId) {
      return currentInstanceId !== currentDocumentId
    }

    return doc.isCurrentRevision === false
  }, [doc])

  const workflowSteps: WorkflowStepEnriched[] = useMemo(() => {
    const wf = workflow as any
    console.log('[DEBUG workflow.elements]', wf?.elements?.map((e: any) => ({
      elementId: e.elementId,
      kind: e.elementKind,
      name: e.name,
      isStart: e.isStart,
      orderIndex: e.orderIndex,
    })))
    console.log('[DEBUG workflow.transitions]', wf?.transitions?.map((t: any) => ({
      source: t.sourceElementId,
      target: t.targetElementId,
    })))
    console.log('[DEBUG workflow.elementConfigs kinds]', wf?.elementConfigs?.map((e: any) => ({
      elementId: e.elementId,
      kind: e.kind,
      name: e.elementName,
    })))
    const stepsFromWorkflow = buildWorkflowStepsFromWorkflow(workflow)

    if (stepsFromWorkflow.length > 0) {
      return stepsFromWorkflow
    }

    if (Array.isArray(doc?.workflowSteps) && doc.workflowSteps.length > 0) {
      return doc.workflowSteps.map((step: any, index: number) => ({
        ...step,
        id: String(step.elementId ?? step.element_id ?? step.id ?? ''),
        elementId: String(step.elementId ?? step.element_id ?? step.id ?? ''),
        orderIndex:
          typeof step.orderIndex === 'number'
            ? step.orderIndex
            : typeof step.stepOrderIndex === 'number'
              ? step.stepOrderIndex
              : typeof step.step_order_index === 'number'
                ? step.step_order_index
                : index,
      }))
    }

    return []
  }, [doc?.workflowSteps, workflow])





  const currentWorkflowStepIndex = useMemo(() => {
    const currentElementId = String(doc?.currentElementId ?? '').trim()
    const currentStepId = String(doc?.currentStepId ?? '').trim()
    const currentStepName = String(doc?.currentStepName ?? '').trim()

    const byElementId = workflowSteps.findIndex(
      (step) =>
        String((step as any).elementId ?? step.id ?? '').trim() === currentElementId,
    )

    if (byElementId >= 0) return byElementId

    const byStepId = workflowSteps.findIndex(
      (step) => String(step.id ?? '').trim() === currentStepId,
    )

    if (byStepId >= 0) return byStepId

    const byName = workflowSteps.findIndex(
      (step) => String(step.name ?? '').trim() === currentStepName,
    )

    if (byName >= 0) return byName

    return null
  }, [
    workflowSteps,
    doc?.currentElementId,
    doc?.currentStepId,
    doc?.currentStepName,
  ])

  const currentStep = useMemo<WorkflowStepEnriched | null>(() => {
    if (currentWorkflowStepIndex !== null && workflowSteps[currentWorkflowStepIndex]) {
      return workflowSteps[currentWorkflowStepIndex]
    }

    return workflowSteps.length > 0 ? workflowSteps[0] : null
  }, [workflowSteps, currentWorkflowStepIndex])



  const revisionHistoryDocuments = useMemo<RevisionHistoryItem[]>(() => {
    const resolvedStepName =
      doc?.currentStepName ??
      currentStep?.name ??
      null

    const resolvedAssignedUser =
      doc?.currentAssignedUserName ??
      doc?.responsibleName ??
      null

    const currentItem: RevisionHistoryItem = {
      id: String(doc?.id ?? ''),
      code: doc?.code ?? '-',
      revision: doc?.revision ?? '00',
      status: doc?.status ?? '',
      title: doc?.title ?? '',
      createdAt: doc?.createdAt ?? null,
      updatedAt: doc?.updatedAt ?? null,
      createdByName: doc?.createdByName ?? null,
      responsibleName: doc?.responsibleName ?? null,
      currentStepName: resolvedStepName,
      currentAssignedUserName: resolvedAssignedUser,

      /**
       * IMPORTANTE:
       * Não pode ser sempre true.
       * Quando você abre uma revisão obsoleta, a API retorna:
       * isCurrentRevision: false
       */
      isCurrentRevision: Boolean(doc?.isCurrentRevision),
    }

    const historyItems: RevisionHistoryItem[] = Array.isArray(doc?.revisionHistory)
      ? doc.revisionHistory.map((item: any) => {
        const itemId = String(
          item.id ??
          item.documentInstanceId ??
          item.document_instance_id ??
          item.documentId ??
          item.document_id ??
          item._id ??
          '',
        )

        const itemCurrentStepName =
          item.currentStepName ??
          item.current_step_name ??
          item.stepName ??
          item.step_name ??
          null

        const itemCurrentAssignedUserName =
          item.currentAssignedUserName ??
          item.current_assigned_user_name ??
          item.responsibleName ??
          item.responsible_name ??
          item.assignedUserName ??
          item.assigned_user_name ??
          null

        return {
          id: itemId,
          code: item.code ?? doc?.code ?? '-',
          revision: item.revision ?? '00',
          status: item.status ?? '',
          title: item.title ?? '',
          createdAt: item.createdAt ?? item.created_at ?? null,
          updatedAt: item.updatedAt ?? item.updated_at ?? null,
          createdByName:
            item.createdByName ??
            item.created_by_name ??
            item.createdByUserName ??
            item.created_by_user_name ??
            null,
          responsibleName:
            item.responsibleName ??
            item.responsible_name ??
            null,
          currentStepName: itemCurrentStepName,
          currentAssignedUserName: itemCurrentAssignedUserName,
          isCurrentRevision: Boolean(
            item.isCurrentRevision ??
            item.is_current_revision ??
            false,
          ),
        }
      })
      : []

    const mergedItems = [currentItem, ...historyItems].filter(
      (item, index, array) =>
        item.id &&
        array.findIndex(
          (candidate) => String(candidate.id) === String(item.id),
        ) === index,
    )

    const currentInstanceId = String(
      doc?.currentInstanceId ??
      doc?.current_instance_id ??
      '',
    ).trim()

    /**
     * Garante que somente uma revisão fique como Atual.
     * Prioridade:
     * 1. id igual ao currentInstanceId
     * 2. se não houver currentInstanceId, usa isCurrentRevision vindo da API
     */
    return mergedItems.map((item) => {
      const itemId = String(item.id ?? '').trim()

      if (currentInstanceId) {
        return {
          ...item,
          isCurrentRevision: itemId === currentInstanceId,
        }
      }

      return {
        ...item,
        isCurrentRevision: item.isCurrentRevision === true,
      }
    })
  }, [doc, currentStep])

  const revisionCount = revisionHistoryDocuments.length

  const stepPendingTask = useMemo(() => {
    const pending = tasks.filter(
      (task: any) =>
        String(task?.status ?? '').toLowerCase() === 'pending' ||
        String(task?.status ?? '').toLowerCase() === 'pendente',
    )

    if (pending.length === 0) return null

    const currentElementId = String(doc?.currentElementId ?? '').trim()
    const currentStepName = String(doc?.currentStepName ?? '').trim()

    return (
      pending.find(
        (task: any) =>
          String(task?.elementId ?? task?.element_id ?? '').trim() === currentElementId,
      ) ??
      pending.find(
        (task: any) =>
          String(task?.stepName ?? task?.step_name ?? '').trim() === currentStepName,
      ) ??
      pending[0]
    )
  }, [tasks, doc?.currentElementId, doc?.currentStepName])

  const myPendingTask = useMemo(() => {
    if (!stepPendingTask || !user?.id) return null

    const assignedTo = String(
      stepPendingTask.assignedToUserId ??
      stepPendingTask.assigned_user_id ??
      '',
    ).trim()

    if (assignedTo === String(user.id)) return stepPendingTask

    const responsibleIds = Array.isArray(stepPendingTask.responsibleUserIds)
      ? stepPendingTask.responsibleUserIds.map((item: any) => String(item))
      : []

    return responsibleIds.includes(String(user.id)) ? stepPendingTask : null
  }, [stepPendingTask, user?.id])

  const configuredActionsFromTask = useMemo<ConfiguredAction[]>(
    () =>
      myPendingTask && Array.isArray(myPendingTask.taskActions)
        ? myPendingTask.taskActions
        : stepPendingTask && Array.isArray(stepPendingTask.taskActions)
          ? stepPendingTask.taskActions
          : [],
    [myPendingTask, stepPendingTask],
  )

  const configuredActionsFromDocument = useMemo<ConfiguredAction[]>(
    () => (Array.isArray(doc?.taskActions) ? doc.taskActions : []),
    [doc?.taskActions],
  )

  const configuredActionsFromStepResolved = useMemo<ConfiguredAction[]>(
    () =>
      currentStep && Array.isArray((currentStep as any).actions)
        ? (currentStep as any).actions
        : [],
    [currentStep],
  )

  const resolvedAvailableActions = useMemo<ConfiguredAction[]>(
    () =>
      configuredActionsFromTask.length > 0
        ? configuredActionsFromTask
        : configuredActionsFromDocument.length > 0
          ? configuredActionsFromDocument
          : configuredActionsFromStepResolved.length > 0
            ? configuredActionsFromStepResolved
            : [],
    [
      configuredActionsFromTask,
      configuredActionsFromDocument,
      configuredActionsFromStepResolved,
    ],
  )

  type MergedMetadataField = {
    metadataDefinitionId: string
    name: string
    label: string
    fieldType: string
    maskType: string | null
    isRequired: boolean
    isReadOnly: boolean
    value: any
    options: any[]
    tableColumns: any[]
  }

  const mergedMetadataFields = useMemo(() => {
    const stepFields =
      Array.isArray(doc?.stepMetadataFields) && doc.stepMetadataFields.length > 0
        ? doc.stepMetadataFields
        : Array.isArray(currentStep?.metadataFields)
          ? currentStep.metadataFields
          : []

    if (stepFields.length === 0) {
      return metadataValues
    }

    const currentValuesMap = new Map(
      metadataValues.map((item: any) => [String(item.metadataDefinitionId), item]),
    )

    return stepFields
      .map((field: any) => {
        const metadataDefinitionId = String(field.metadataDefinitionId ?? '')
        const definition = metadataDefinitions.find(
          (def: any) => String(def.id) === metadataDefinitionId,
        )

        const currentValue = currentValuesMap.get(metadataDefinitionId)

        if (!definition) return null

        return {
          metadataDefinitionId,
          name: definition.name ?? definition.label ?? metadataDefinitionId,
          label: definition.label ?? definition.name ?? metadataDefinitionId,
          fieldType: definition.fieldType ?? 'text',
          maskType: definition.maskType ?? null,
          isRequired: field.isRequired ?? definition.isRequired ?? false,
          isReadOnly: field.isReadOnly ?? false,
          value: currentValue?.value ?? null,
          options: Array.isArray(definition.options) ? definition.options : [],
          tableColumns: Array.isArray(definition.tableColumns)
            ? definition.tableColumns
            : [],
        } as MergedMetadataField
      })
      .filter(
        (item: MergedMetadataField | null): item is MergedMetadataField =>
          item !== null,
      )
  }, [
    doc?.stepMetadataFields,
    currentStep?.metadataFields,
    metadataDefinitions,
    metadataValues,
  ])

  const currentStepName = useMemo(
    () => currentStep?.name ?? doc?.currentStepName ?? '-',
    [currentStep, doc?.currentStepName],
  )

  const currentResponsibleNames = useMemo(() => {
    if (Array.isArray(doc?.responsibleNames) && doc.responsibleNames.length > 0) {
      return doc.responsibleNames
    }

    if (doc?.responsibleName) {
      return [doc.responsibleName]
    }

    if (Array.isArray(currentStep?.responsibles) && currentStep.responsibles.length > 0) {
      return currentStep.responsibles.map(formatResponsibleLabel)
    }

    return []
  }, [
    doc?.responsibleNames,
    doc?.responsibleName,
    currentStep?.responsibles,
  ])

  const isFinished = useMemo(
    () =>
      [
        'published',
        'rejected',
        'cancelled',
        'approved',
        'completed',
        'archived',
        'Aprovado',
        'Reprovado',
        'Cancelado',
      ].includes(doc?.status ?? ''),
    [doc?.status],
  )

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(id!, file),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['document', id] })
      message.success('Arquivo enviado!')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelDocument(id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['document', id] })
      message.success('Documento cancelado.')
    },
  })

  const saveMetaMutation = useMutation({
    mutationFn: (values: Record<string, any>) => {
      const payload = Object.entries(values).map(([metadataDefinitionId, value]) => ({
        metadataDefinitionId,
        value: value?.toISOString ? value.toISOString() : value,
      }))

      return saveMetadataValues(id!, payload)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['metadata-values', id] })
      await qc.invalidateQueries({ queryKey: ['document', id] })
      message.success('Metadados salvos!')
    },
  })

  const taskMutation = useMutation({
    mutationFn: async ({
      documentId,
      actionId,
      outcome,
      comment,
    }: {
      documentId: string
      actionId: string
      outcome?: string
      comment?: string
    }) => {
      return executeDocumentAction(documentId, actionId, comment, outcome)
    },

    onSuccess: async (data: any) => {
      await qc.invalidateQueries({ queryKey: ['document', id] })
      await qc.invalidateQueries({ queryKey: ['documents'] })
      await qc.invalidateQueries({ queryKey: ['tasks'] })
      await qc.invalidateQueries({ queryKey: ['tasks', 'all'] })
      await qc.invalidateQueries({ queryKey: ['dashboard'] })
      await qc.invalidateQueries({ queryKey: ['document-references', id] })

      setModalAction(null)
      setCommentValue('')
      setCommentError(false)

      if (data?.revisionCreated && data?.revisionDocument?.id) {
        message.success('Nova revisão criada com sucesso!')
        navigate(`/documents/${data.revisionDocument.id}`)
        return
      }

      message.success(data?.message ?? 'Ação executada com sucesso!')
    },

    onError: (err: any) => {
      message.error(
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Erro ao executar ação.',
      )
    },
  })

  const lastActiveStepIndex = useMemo(() => {
    // Documento ainda em andamento — usa o índice atual normalmente
    if (!isFinished) return currentWorkflowStepIndex

    // Tenta encontrar a última etapa pelo stepName nos auditLogs
    // (os logs são ordenados por createdAt DESC, então o primeiro com stepName
    //  é o mais recente — ou seja, a etapa que originou o encerramento)
    const lastActionLog = auditLogs.find(
      (log: any) =>
        log?.stepName &&
        String(log.stepName).trim() !== '' &&
        String(log.stepName).trim() !== 'null',
    )

    if (lastActionLog?.stepName) {
      const byName = workflowSteps.findIndex(
        (step) =>
          String(step.name ?? '').trim() ===
          String(lastActionLog.stepName).trim(),
      )
      if (byName >= 0) return byName
    }

    // Fallback: se não achou pelo log, considera que o último passo visível
    // foi o primeiro (índice 0) — melhor do que marcar tudo como concluído
    return 0
  }, [isFinished, currentWorkflowStepIndex, auditLogs, workflowSteps])

  const stepsItems = useMemo(
    () =>
      workflowSteps.map((step, index) => {
        // Etapa atual: só existe quando o documento ainda está em andamento
        const isCurrent =
          !isFinished &&
          currentWorkflowStepIndex !== null &&
          index === currentWorkflowStepIndex

        // Etapa passada:
        // - Em andamento: índices anteriores ao atual
        // - Encerrado: apenas até lastActiveStepIndex (não marca etapas além do que foi executado)
        const isPast = isFinished
          ? index <= (lastActiveStepIndex ?? 0)
          : currentWorkflowStepIndex !== null && index < currentWorkflowStepIndex

        return {
          title: step.name,
          status: isCurrent
            ? ('process' as const)
            : isPast
              ? ('finish' as const)
              : ('wait' as const),
          icon: isCurrent ? (
            <ClockCircleOutlined />
          ) : isPast ? (
            <CheckCircleOutlined />
          ) : (
            <MinusCircleOutlined style={{ color: '#d9d9d9' }} />
          ),
        }
      }),
    [workflowSteps, currentWorkflowStepIndex, lastActiveStepIndex, isFinished],
  )

  const allElementIds = useMemo(() => {
    if (!workflow) return []
    const wf = workflow as any

    if (Array.isArray(wf.elements) && wf.elements.length > 0) {
      return wf.elements
        .map((e: any) => String(e.elementId ?? e.element_id ?? e.id ?? ''))
        .filter(Boolean)
    }

    return (workflow.elementConfigs ?? [])
      .map((c: any) => String(c.elementId ?? ''))
      .filter(Boolean)
  }, [workflow])

  // 2. workflowElements — passa os elementos completos para o hook poder
  //    identificar quais são End Events pelo campo elementKind/element_kind
  const workflowElements = useMemo(() => {
    if (!workflow) return []
    const wf = workflow as any
    return Array.isArray(wf.elements) ? wf.elements : []
  }, [workflow])

  // 3. nodeOverrides — passa workflowElements
  const nodeOverrides = useWorkflowNodeStatuses({
    allElementIds,
    currentElementId: doc?.currentElementId,
    documentStatus: doc?.status,
    auditLogs,
    workflowElements,   // ← novo
  })



  function findNextStep(action: ConfiguredAction): WorkflowStepEnriched | null {
    if (!Array.isArray(workflowSteps) || workflowSteps.length === 0 || !currentStep) {
      return null
    }

    const matchedTransition =
      currentStep.transitions?.find((tr) => tr.triggerAction === action.outcome) ??
      currentStep.transitions?.find((tr) => tr.toStepId === action.nextElementId) ??
      null

    if (
      matchedTransition?.toStepOrderIndex !== null &&
      matchedTransition?.toStepOrderIndex !== undefined
    ) {
      return (
        workflowSteps.find(
          (s) => Number(s.orderIndex) === Number(matchedTransition.toStepOrderIndex),
        ) ?? null
      )
    }

    if (matchedTransition?.toStepId) {
      return (
        workflowSteps.find(
          (s) =>
            String((s as any).elementId ?? s.id ?? '') ===
            String(matchedTransition.toStepId),
        ) ?? null
      )
    }

    if (action.nextElementId) {
      return (
        workflowSteps.find(
          (s) =>
            String((s as any).elementId ?? s.id ?? '') ===
            String(action.nextElementId),
        ) ?? null
      )
    }

    const currentIndex =
      currentWorkflowStepIndex !== null
        ? currentWorkflowStepIndex
        : workflowSteps.findIndex((s) => s.id === currentStep.id)

    return currentIndex >= 0 ? workflowSteps[currentIndex + 1] ?? null : null
  }

  function handleActionClick(action: ConfiguredAction) {
    setCommentValue('')
    setCommentError(false)
    setModalAction(action)
  }

  function handleModalConfirm() {
    if (!doc?.id || !modalAction) return

    if (modalAction.requiresComment && !commentValue.trim()) {
      setCommentError(true)
      return
    }

    taskMutation.mutate({
      documentId: String(doc.id),
      actionId: modalAction.id,
      outcome: modalAction.outcome,
      comment: commentValue.trim() || undefined,
    })
  }

  const referenceColumns = [
    // {
    //   title: 'Tipo',
    //   dataIndex: 'direction',
    //   key: 'direction',
    //   width: 130,
    //   render: (_: any, record: DocumentReferenceItem) => {
    //     const isChild = record.direction === 'child'

    //     return (
    //       <Tag color={isChild ? 'blue' : 'purple'}>
    //         {isChild ? 'Filho' : 'Pai'}
    //       </Tag>
    //     )
    //   },
    // },
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (value: string | null | undefined, record: DocumentReferenceItem) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          disabled={!record.documentInstanceId}
          onClick={() => {
            if (record.documentInstanceId) {
              navigate(`/documents/${record.documentInstanceId}`)
            }
          }}
        >
          {value ?? '-'}
        </Button>
      ),
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (value: string | null | undefined, record: DocumentReferenceItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value ?? '-'}</Text>

          {record.currentStepName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Etapa atual: {record.currentStepName}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Processo',
      key: 'process',
      width: 180,
      render: (_: any, record: DocumentReferenceItem) => {
        const processName =
          record.direction === 'child'
            ? record.childProcessName
            : record.parentProcessName

        return processName ? <Tag>{processName}</Tag> : '-'
      },
    },
    {
      title: 'Revisão',
      dataIndex: 'revision',
      key: 'revision',
      width: 110,
      render: (value: string | null | undefined) => (
        <Tag color="blue">{normalizeRevisionLabel(value)}</Tag>
      ),
    },
    // {
    //   title: 'Status',
    //   dataIndex: 'status',
    //   key: 'status',
    //   width: 150,
    //   render: (value: string | null | undefined) =>
    //     value ? <StatusBadge status={value} /> : '-',
    // },
    // {
    //   title: 'Origem',
    //   key: 'source',
    //   width: 220,
    //   render: (_: any, record: DocumentReferenceItem) => (
    //     <Space direction="vertical" size={0}>
    //       <Text>
    //         {record.sourceTableName
    //           ? `Tabela: ${record.sourceTableName}`
    //           : 'Referência manual/subprocesso'}
    //       </Text>

    //       {record.sourceRowIndex !== null &&
    //         record.sourceRowIndex !== undefined && (
    //           <Text type="secondary" style={{ fontSize: 12 }}>
    //             Linha: {Number(record.sourceRowIndex) + 1}
    //           </Text>
    //         )}
    //     </Space>
    //   ),
    // },
    {
      title: 'Espera',
      key: 'wait',
      width: 150,
      render: (_: any, record: DocumentReferenceItem) => {
        if (!record.waitForCompletion) {
          return <Tag>Não aguarda</Tag>
        }

        return (
          <Tag color="orange">
            {record.waitPolicy === 'any_child'
              ? 'Aguarda 1 filho'
              : 'Aguarda todos'}
          </Tag>
        )
      },
    },
    {
      title: 'Criado em',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value: string | null | undefined) => safeFormatDateTime(value),
    },
  ]

  const fileColumns = [
    {
      title: 'Nome',
      dataIndex: 'filename',
      key: 'filename',
      render: (_: any, record: any) =>
        record.filename ?? record.originalName ?? record.name ?? '-',
    },
    {
      title: 'Enviado em',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => safeFormatDateTime(value),
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => {
        const fileId = String(
          record.id ??
          record.fileId ??
          record.file_id ??
          '',
        )

        return (
          <Button
            icon={<DownloadOutlined />}
            disabled={!doc?.id || !fileId}
            onClick={() => downloadFile(String(doc.id), fileId)}
          >
            Baixar
          </Button>
        )
      },
    },
  ]

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Spin />
        </Card>
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          title="Documento não encontrado"
          description="Não foi possível carregar os dados do documento."
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#f5f7fb', minHeight: '100vh' }}>
      <Space
        style={{
          marginBottom: 20,
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/documents')}>
            Voltar
          </Button>

          <div>
            <Title level={3} style={{ margin: 0 }}>
              {doc.code ?? doc.title ?? 'Documento'}
            </Title>

            <Space
              wrap
              size={[8, 8]}
              style={{
                marginTop: 6,
                display: 'flex',
              }}
            >
              <Text type="secondary">{doc.title}</Text>
              <StatusBadge status={doc.status} />
              <Tag color="blue">{normalizeRevisionLabel(doc.revision)}</Tag>

              {revisionCount > 0 && (
                <Popover
                  trigger="click"
                  destroyTooltipOnHide
                  content={
                    <RevisionHistoryPopover
                      currentDocumentId={doc.currentInstanceId ?? doc.id}
                      documents={revisionHistoryDocuments}
                      onOpenDocument={(documentId) => navigate(`/documents/${documentId}`)}
                    />
                  }
                >
                  <Button
                    size="small"
                    icon={<HistoryOutlined />}
                    style={{
                      borderRadius: 8,
                      background: '#eff6ff',
                      borderColor: '#bfdbfe',
                      color: '#2563eb',
                      fontWeight: 600,
                    }}
                  >
                    {normalizeRevisionLabel(doc.revision)}
                  </Button>
                </Popover>
              )}
            </Space>

            <Space
              direction="vertical"
              size={6}
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              <Tag
                icon={<ClockCircleOutlined />}
                color="processing"
                style={{
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 12,
                  marginInlineEnd: 0,
                }}
              >
                Atividade atual: {currentStepName}
              </Tag>

              <Tag
                icon={<UserOutlined />}
                color="blue"
                style={{
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 12,
                  marginInlineEnd: 0,
                }}
              >
                Responsável atual:{' '}
                {currentResponsibleNames.length > 0
                  ? currentResponsibleNames.join(', ')
                  : '-'}
              </Tag>
            </Space>
          </div>
        </Space>
      </Space>

      {isViewingObsoleteRevision && (
        <Alert
          type="warning"
          showIcon
          style={{
            marginBottom: 16,
            borderRadius: 12,
            borderColor: '#fde68a',
            background: '#fffbeb',
          }}
          title="Você está visualizando uma revisão obsoleta"
          description={
            <Space direction="vertical" size={4}>
              <Text>
                Esta não é a revisão atual do documento. As ações, tarefas e metadados podem estar disponíveis apenas na revisão vigente.
              </Text>

              {doc.currentInstanceId && String(doc.currentInstanceId) !== String(doc.id) && (
                <Button
                  size="small"
                  type="link"
                  style={{
                    padding: 0,
                    color: '#d97706',
                    fontWeight: 600,
                  }}
                  onClick={() => navigate(`/documents/${doc.currentInstanceId}`)}
                >
                  Abrir revisão atual
                </Button>
              )}
            </Space>
          }
        />
      )}

      {workflowSteps.length > 0 && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderRadius: 12,
          }}
          title="Progresso do Fluxo"
        >
          <Steps
            size="small"
            current={currentWorkflowStepIndex ?? 0}
            items={stepsItems}
          />
        </Card>
      )}

      <Tabs
        items={[
          {
            key: 'metadata',
            label: 'Metadados',
            children: (
              <Card>
                <Form
                  form={metaForm}
                  layout="vertical"
                  onFinish={(values) => saveMetaMutation.mutate(values)}
                >
                  {mergedMetadataFields.length > 0 ? (
                    <MetadataForm fields={mergedMetadataFields} form={metaForm} />
                  ) : (
                    <Text type="secondary">
                      Nenhum metadado configurado para esta etapa.
                    </Text>
                  )}

                  {!isFinished && (
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={saveMetaMutation.isPending}
                      style={{ marginTop: 16 }}
                    >
                      Salvar
                    </Button>
                  )}

                  {resolvedAvailableActions.length > 0 && !isFinished && (
                    <>
                      <Divider style={{ margin: '20px 0 16px' }} />

                      <Text strong style={{ display: 'block', marginBottom: 12 }}>
                        Ações disponíveis
                      </Text>

                      <Space wrap>
                        {resolvedAvailableActions.map((action) => (
                          <Button
                            key={action.id ?? action.outcome}
                            type="primary"
                            onClick={() => handleActionClick(action)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </Space>
                    </>
                  )}

                  {resolvedAvailableActions.length === 0 && !isFinished && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 16 }}
                      title="Nenhuma ação disponível"
                      description="A etapa atual não retornou ações configuradas para o documento/tarefa."
                    />
                  )}
                </Form>
              </Card>
            ),
          },
          {
            key: 'workflow',
            label: 'Workflow',
            children: (
              <Card>
                {isFinished && (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined />}
                    message="Fluxo encerrado"
                    description={`Este documento foi encerrado com status: ${doc?.status ?? ''}`}
                    style={{ marginBottom: 16, borderRadius: 10 }}
                  />
                )}

                {workflow?.bpmnXml?.trim() ? (
                  <BpmnViewer
                    bpmnXml={workflow.bpmnXml}
                    overrides={nodeOverrides}
                    height={420}
                  />
                ) : (
                  // Fallback: lista de cards quando não há XML BPMN
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {workflowSteps.map((step, idx) => {
                      const isCurrent =
                        !isFinished &&
                        currentWorkflowStepIndex !== null &&
                        idx === currentWorkflowStepIndex

                      const wasActive =
                        isFinished &&
                        idx === (lastActiveStepIndex ?? 0)

                      const slaLabel = formatSla(step.deadlineMode, step.deadlineValue)

                      return (
                        <div
                          key={step.id ?? idx}
                          style={{
                            border: isCurrent
                              ? '1.5px solid #1677ff'
                              : wasActive
                                ? '1.5px solid #52c41a'
                                : '1px solid #f0f0f0',
                            borderRadius: 10,
                            padding: '12px 16px',
                            background: isCurrent ? '#f0f7ff' : wasActive ? '#f6ffed' : '#fff',
                          }}
                        >
                          <Space align="center" wrap>
                            <Text strong>{step.name}</Text>
                            {isCurrent && <Tag color="blue">Atual</Tag>}
                            {wasActive && <Tag color="success">Concluída</Tag>}
                            {step.isInitial && <Tag color="green">Inicial</Tag>}
                            {step.elementKind && <Tag color="purple">{step.elementKind}</Tag>}
                          </Space>

                          {Array.isArray(step.responsibles) && step.responsibles.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                Responsáveis: {step.responsibles.map(formatResponsibleLabel).join(', ')}
                              </Text>
                            </div>
                          )}

                          {slaLabel && (
                            <div style={{ marginTop: 8 }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>Prazo: {slaLabel}</Text>
                            </div>
                          )}

                          {step.actions.length > 0 && !isFinished && (
                            <Space wrap style={{ marginTop: 10 }}>
                              {step.actions.map((action) => (
                                <Tag
                                  key={action.id}
                                  style={{
                                    background: ACTION_COLORS[action.outcome] ?? '#e6f4ff',
                                    color: ACTION_COLORS[action.outcome] ? '#fff' : undefined,
                                    borderColor: ACTION_COLORS[action.outcome] ?? undefined,
                                  }}
                                >
                                  {action.label}
                                </Tag>
                              ))}
                            </Space>
                          )}
                        </div>
                      )
                    })}
                  </Space>
                )}
              </Card>
            ),
          },

          {
            key: 'references',
            label: `Referências (${references.length})`,
            children: (
              <Card>
                <Table
                  rowKey={(record: DocumentReferenceItem) => String(record.id)}
                  columns={referenceColumns}
                  dataSource={references}
                  loading={isLoadingReferences}
                  pagination={false}
                  locale={{
                    emptyText: 'Nenhum documento referenciado encontrado.',
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'info',
            label: 'Informações',
            children: (
              <Card>
                <Descriptions column={2}>
                  <Descriptions.Item label="Código">
                    {doc.code ?? '-'}
                  </Descriptions.Item>

                  <Descriptions.Item label="Status">
                    <StatusBadge status={doc.status} />
                  </Descriptions.Item>

                  <Descriptions.Item label="Revisão">
                    {normalizeRevisionLabel(doc.revision)}
                  </Descriptions.Item>

                  <Descriptions.Item label="Etapa atual">
                    {currentStepName}
                  </Descriptions.Item>

                  <Descriptions.Item label="Responsável">
                    {currentResponsibleNames.length > 0
                      ? currentResponsibleNames.join(', ')
                      : '-'}
                  </Descriptions.Item>

                  <Descriptions.Item label="Criado por">
                    {doc.createdByName ?? '-'}
                  </Descriptions.Item>

                  <Descriptions.Item label="Criado em">
                    {safeFormatDateTime(doc.createdAt)}
                  </Descriptions.Item>

                  <Descriptions.Item label="Atualizado em">
                    {safeFormatDateTime(doc.updatedAt)}
                  </Descriptions.Item>

                  <Descriptions.Item label="Processo">
                    {doc.processName ?? '-'}
                  </Descriptions.Item>

                  <Descriptions.Item label="Título">
                    {doc.title ?? '-'}
                  </Descriptions.Item>
                </Descriptions>

                {!isFinished && (
                  <div style={{ marginTop: 16 }}>
                    <Popconfirm
                      title="Cancelar documento"
                      description="Deseja realmente cancelar este documento?"
                      okText="Sim"
                      cancelText="Não"
                      onConfirm={() => cancelMutation.mutate()}
                    >
                      <Button danger loading={cancelMutation.isPending}>
                        Cancelar documento
                      </Button>
                    </Popconfirm>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'files',
            label: `Arquivos (${files.length})`,
            children: (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  {!isFinished && (
                    <Upload
                      showUploadList={false}
                      beforeUpload={(file) => {
                        uploadMutation.mutate(file as File)
                        return false
                      }}
                    >
                      <Button
                        icon={<UploadOutlined />}
                        loading={uploadMutation.isPending}
                      >
                        Enviar arquivo
                      </Button>
                    </Upload>
                  )}

                  <Table
                    rowKey={(record: any) => String(record.id)}
                    columns={fileColumns}
                    dataSource={files}
                    pagination={false}
                    locale={{ emptyText: 'Nenhum arquivo enviado.' }}
                  />
                </Space>
              </Card>
            ),
          },
          {
            key: 'timeline',
            label: 'Timeline',
            children: (
              <Card>
                <Timeline logs={auditLogs} />
              </Card>
            ),
          },
        ]}
      />

      <ActionConfirmModal
        open={!!modalAction}
        action={modalAction}
        nextStep={modalAction ? findNextStep(modalAction) : null}
        commentValue={commentValue}
        commentError={commentError}
        loading={taskMutation.isPending}
        onCommentChange={(value) => {
          setCommentValue(value)
          if (commentError && value.trim()) {
            setCommentError(false)
          }
        }}
        onConfirm={handleModalConfirm}
        onCancel={() => {
          if (taskMutation.isPending) return
          setModalAction(null)
          setCommentValue('')
          setCommentError(false)
        }}
      />
    </div>
  )
}
