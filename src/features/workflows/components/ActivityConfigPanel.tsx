import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Avatar,
  Button,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  PlusOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'

import {
  getMetadataDefinitions,
  type MetadataDefinitionListItem,
} from '../../../api/metadataDefinitions'
import { getMetadataSets, type MetadataSetDto } from '../../../api/metadataSets'
import { getNotificationTemplates } from '../../../api/notificationTemplates'
import { getUsers } from '../../../api/users'
import { getOrgRoles, getOrgGroups, getDisciplines } from '../../../api/organization'
import type {
  ActivityAction,
  ActivityActionOutcome,
  ActivityConfig,
  ActivityMetadataFieldRule,
  ScopeContext,
  ScopeLevel,
  WorkflowActivityConfig,
} from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

// ── Types ──────────────────────────────────────────────────────────────────────

type AssigneeEntry = {
  kind: 'user' | 'group' | 'role' | 'function' | 'area'
  id: string
  label: string
  sub?: string // jobTitle para usuários
}

type ActivityConfigPanelProps = {
  workflowId: string
  scopeContext: ScopeContext & {
    scopeLevel: ScopeLevel
    accountName?: string
    environmentName?: string | null
    processName?: string | null
  }
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowActivityConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

type FormValues = {
  assignmentMode: 'user' | 'group' | 'positions' | 'mixed'
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
  metadataFields: ActivityMetadataFieldRule[]
  notificationTemplateIds: string[]
  allowApprove: boolean
  allowReject: boolean
  allowRequestChanges: boolean
  allowForward: boolean
  actions: ActivityAction[]
  instructions?: string
  helpText?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const OUTCOME_OPTIONS: Array<{ label: string; value: ActivityActionOutcome }> = [
  { label: 'Avançar (aprovar)', value: 'approve' },
  { label: 'Reprovar', value: 'reject' },
  { label: 'Solicitar revisão', value: 'request-changes' },
  { label: 'Encaminhar', value: 'forward' },
  { label: 'Personalizado (gateway)', value: 'custom' },
]

const COLOR_OPTIONS: Array<{ label: string; value: ActivityAction['color'] }> = [
  { label: 'Verde', value: 'green' },
  { label: 'Vermelho', value: 'red' },
  { label: 'Laranja', value: 'orange' },
  { label: 'Azul', value: 'blue' },
  { label: 'Roxo', value: 'purple' },
  { label: 'Dourado', value: 'gold' },
  { label: 'Padrão', value: 'default' },
]

const ASSIGNMENT_MODE_OPTIONS = [
  { label: 'Por usuário',  value: 'user'      },
  { label: 'Por grupo',    value: 'group'     },
  { label: 'Por posições', value: 'positions' }, // unidade, área, disciplina, função
  { label: 'Combinado',    value: 'mixed'     },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function migrateActionsFromBooleans(cfg: WorkflowActivityConfig | null): ActivityAction[] {
  if (cfg?.actions && cfg.actions.length > 0) return cfg.actions
  const migrated: ActivityAction[] = []
  if (cfg?.allowApprove ?? true)        migrated.push({ id: crypto.randomUUID(), label: 'Aprovar',           color: 'green',  outcome: 'approve',         requiresComment: false })
  if (cfg?.allowReject ?? true)         migrated.push({ id: crypto.randomUUID(), label: 'Reprovar',          color: 'red',    outcome: 'reject',          requiresComment: true  })
  if (cfg?.allowRequestChanges ?? true) migrated.push({ id: crypto.randomUUID(), label: 'Solicitar revisão', color: 'orange', outcome: 'request-changes', requiresComment: true  })
  if (cfg?.allowForward ?? false)       migrated.push({ id: crypto.randomUUID(), label: 'Encaminhar',        color: 'blue',   outcome: 'forward',         requiresComment: false })
  return migrated.length > 0
    ? migrated
    : [
        { id: crypto.randomUUID(), label: 'Aprovar',           color: 'green',  outcome: 'approve',         requiresComment: false },
        { id: crypto.randomUUID(), label: 'Reprovar',          color: 'red',    outcome: 'reject',          requiresComment: true  },
        { id: crypto.randomUUID(), label: 'Solicitar revisão', color: 'orange', outcome: 'request-changes', requiresComment: true  },
      ]
}

function deriveBooleansFromActions(actions: ActivityAction[]) {
  return {
    allowApprove:        actions.some((a) => a.outcome === 'approve'),
    allowReject:         actions.some((a) => a.outcome === 'reject'),
    allowRequestChanges: actions.some((a) => a.outcome === 'request-changes'),
    allowForward:        actions.some((a) => a.outcome === 'forward'),
  }
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function createMetadataFieldRule(
  definition?: MetadataDefinitionListItem,
  fallbackId?: string,
  existing?: ActivityMetadataFieldRule,
): ActivityMetadataFieldRule {
  return {
    metadataDefinitionId: definition?.id ?? fallbackId ?? '',
    name: definition?.name ?? existing?.name,
    label: definition?.label ?? existing?.label,
    fieldType: definition?.fieldType ?? existing?.fieldType,
    metadataSetId: definition?.metadataSetId ?? existing?.metadataSetId,
    metadataSetName: definition?.metadataSetName ?? existing?.metadataSetName,
    isRequired: existing?.isRequired ?? Boolean(definition?.isRequired),
    isReadOnly: existing?.isReadOnly ?? false,
  }
}

function sortMetadataFields(fields: ActivityMetadataFieldRule[]) {
  return [...fields].sort((a, b) => {
    const setCompare = (a.metadataSetName ?? '').localeCompare(b.metadataSetName ?? '')
    if (setCompare !== 0) return setCompare
    return (a.label ?? a.name ?? '').localeCompare(b.label ?? b.name ?? '')
  })
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const tabPaneStyle: CSSProperties = { padding: '20px 24px 4px', minHeight: 280 }

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#94a3b8',
  marginBottom: 12,
  display: 'block',
}

// ── Assignee kind metadata ─────────────────────────────────────────────────────

const ASSIGNEE_KIND_META: Record<
  AssigneeEntry['kind'],
  { label: string; bg: string; icon: React.ReactNode }
> = {
  user:     { label: 'Usuário',  bg: '#eff6ff', icon: <UserOutlined style={{ color: '#1677ff' }} /> },
  group:    { label: 'Grupo',    bg: '#f5f3ff', icon: <TeamOutlined style={{ color: '#7c3aed' }} /> },
  role:     { label: 'Cargo',    bg: '#f0f9ff', icon: <span style={{ color: '#0369a1', fontWeight: 700, fontSize: 11 }}>C</span> },
  function: { label: 'Função',   bg: '#f0fdf4', icon: <span style={{ color: '#059669', fontWeight: 700, fontSize: 11 }}>F</span> },
  area:     { label: 'Área',     bg: '#fffbeb', icon: <span style={{ color: '#d97706', fontWeight: 700, fontSize: 11 }}>Á</span> },
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ActivityConfigPanel({
  workflowId,
  scopeContext,
  selectedElement,
  initialConfig,
  onSave,
}: ActivityConfigPanelProps) {
  const [form] = Form.useForm<FormValues>()
  const deadlineMode = Form.useWatch('deadlineMode', form)
  const assignmentMode = Form.useWatch('assignmentMode', form) as string | undefined

  // ── Metadados: state ───────────────────────────────────────────────────────
  const [selectedMetadataSetIds, setSelectedMetadataSetIds] = useState<string[]>([])
  const [manualMetadataDefinitionIds, setManualMetadataDefinitionIds] = useState<string[]>([])
  const [metadataFieldRules, setMetadataFieldRules] = useState<ActivityMetadataFieldRule[]>([])
  const initializationKeyRef = useRef('')

  // ── Responsáveis: seleção pendente ─────────────────────────────────────────
  const [pendingUserIds,     setPendingUserIds]     = useState<string[]>([])
  const [pendingGroupIds,    setPendingGroupIds]    = useState<string[]>([])
  const [pendingRoleIds,     setPendingRoleIds]     = useState<string[]>([])
  const [pendingFunctionIds, setPendingFunctionIds] = useState<string[]>([])
  const [pendingAreaIds,     setPendingAreaIds]     = useState<string[]>([])

  // ── Responsáveis: lista confirmada ─────────────────────────────────────────
  const [assignees, setAssignees] = useState<AssigneeEntry[]>([])

  // ── API: responsáveis ──────────────────────────────────────────────────────
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    staleTime: 1000 * 60 * 5,
  })

  const { data: orgRoles = [] } = useQuery({
    queryKey: ['org-roles'],
    queryFn: getOrgRoles,
    staleTime: 1000 * 60 * 5,
  })

  const { data: disciplines = [] } = useQuery({
    queryKey: ['org-disciplines'],
    queryFn: getDisciplines,
    staleTime: 1000 * 60 * 5,
  })

  const { data: orgGroups = [] } = useQuery({
    queryKey: ['org-groups'],
    queryFn: getOrgGroups,
    staleTime: 1000 * 60 * 5,
  })

  // ── API: metadados ─────────────────────────────────────────────────────────
  const { data: metadataDefinitions = [], isLoading: metadataDefinitionsLoading, isError: metadataDefinitionsError } = useQuery({
    queryKey: ['workflow-activity-metadata-definitions'],
    queryFn: () => getMetadataDefinitions(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: metadataSets = [], isLoading: metadataSetsLoading, isError: metadataSetsError } = useQuery({
    queryKey: ['workflow-activity-metadata-sets'],
    queryFn: () => getMetadataSets(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: notificationTemplates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: getNotificationTemplates,
    staleTime: 1000 * 60 * 5,
  })

  // ── Options para selects de responsáveis ──────────────────────────────────
  const userOptions = useMemo(() =>
    (users as any[]).filter((u: any) => u.isActive !== false).map((u: any) => ({
      value: u.id,
      label: u.name,
      email: u.email,
      jobTitle: u.jobTitle,
    })), [users])

  const roleOptions = useMemo(() =>
    (orgRoles as any[]).filter((r: any) => r.isActive !== false).map((r: any) => ({
      value: r.id,
      label: r.code ? `${r.name} (${r.code})` : r.name,
    })), [orgRoles])

  const functionOptions = useMemo(() =>
    (disciplines as any[]).filter((d: any) => d.isActive !== false).map((d: any) => ({
      value: d.id,
      label: d.code ? `${d.name} (${d.code})` : d.name,
    })), [disciplines])

  const groupOptions = useMemo(() =>
    (orgGroups as any[]).filter((g: any) => g.isActive !== false).map((g: any) => ({
      value: g.id,
      label: g.code ? `${g.name} (${g.code})` : g.name,
    })), [orgGroups])

  // ── Inicializa assignees a partir do initialConfig ─────────────────────────
  // Usa uma ref para garantir que a inicialização rode sempre que o initialConfig
  // mudar, e também quando os dados da API chegarem (para resolver os labels).
  const assigneesInitKeyRef = useRef('')

  // Reseta quando o elemento selecionado muda (troca de atividade no fluxo)
  useEffect(() => {
    assigneesInitKeyRef.current = ''
    setAssignees([])
    setPendingUserIds([])
    setPendingGroupIds([])
    setPendingRoleIds([])
    setPendingFunctionIds([])
    setPendingAreaIds([])
  }, [selectedElement?.id])

  useEffect(() => {
    // Coleta todos os IDs que precisam ser resolvidos
    const allUserIds     = initialConfig?.responsibleUserIds      ?? []
    const allGroupIds    = (initialConfig as any)?.responsibleGroupIds as string[] ?? []
    const allRoleIds     = initialConfig?.responsibleRoleIds      ?? []
    const allFunctionIds = initialConfig?.responsibleFunctionIds  ?? []
    const allAreaIds     = initialConfig?.responsibleAreaIds      ?? []

    const totalIds = allUserIds.length + allGroupIds.length + allRoleIds.length + allFunctionIds.length + allAreaIds.length

    // Não há nada para inicializar
    if (totalIds === 0) return

    // Verifica quais dados da API ainda estão pendentes para os IDs necessários
    const needsUsers     = allUserIds.length > 0     && !(users     as any[]).length
    const needsGroups    = allGroupIds.length > 0    && !(orgGroups as any[]).length
    const needsRoles     = allRoleIds.length > 0     && !(orgRoles  as any[]).length
    const needsFunctions = allFunctionIds.length > 0 && !(disciplines as any[]).length

    // Se algum dado necessário ainda não chegou, aguarda
    if (needsUsers || needsGroups || needsRoles || needsFunctions) return

    // Chave que muda quando o config ou os dados relevantes mudam
    const key = [
      initialConfig?.updatedAt ?? 'new',
      allGroupIds.join(','),
      (orgGroups as any[]).length,
      (users     as any[]).length,
      (orgRoles  as any[]).length,
      (disciplines as any[]).length,
    ].join('::')

    if (assigneesInitKeyRef.current === key) return
    assigneesInitKeyRef.current = key

    const entries: AssigneeEntry[] = []

    allUserIds.forEach((id) => {
      const u = (users as any[]).find((u: any) => u.id === id)
      entries.push({ kind: 'user', id, label: u?.name ?? id, sub: u?.jobTitle })
    })
    allGroupIds.forEach((id) => {
      const g = (orgGroups as any[]).find((g: any) => g.id === id)
      entries.push({ kind: 'group', id, label: g?.name ?? id })
    })
    allRoleIds.forEach((id) => {
      const r = (orgRoles as any[]).find((r: any) => r.id === id)
      entries.push({ kind: 'role', id, label: r?.name ?? id })
    })
    allFunctionIds.forEach((id) => {
      const f = (disciplines as any[]).find((d: any) => d.id === id)
      entries.push({ kind: 'function', id, label: f?.name ?? id })
    })
    allAreaIds.forEach((id) => {
      entries.push({ kind: 'area', id, label: id })
    })

    setAssignees(entries)
  }, [initialConfig, users, orgGroups, orgRoles, disciplines])

  // ── Metadados: computed ────────────────────────────────────────────────────
  const metadataDefinitionMap = useMemo(() => {
    const map = new Map<string, MetadataDefinitionListItem>()
    metadataDefinitions.forEach((item) => map.set(item.id, item))
    return map
  }, [metadataDefinitions])

  const metadataSetsOptions = useMemo(
    () =>
      metadataSets
        .filter((item) => item.isActive !== false)
        .sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
        .map((item: MetadataSetDto) => ({ value: item.id, label: `${item.name} (${item.code})` })),
    [metadataSets],
  )

  const groupedMetadataOptions = useMemo(() => {
    const groups = new Map<string, { label: string; options: Array<{ value: string; label: string }> }>()
    metadataDefinitions.forEach((item) => {
      const groupKey   = item.metadataSetId ?? '__sem_conjunto__'
      const groupLabel = item.metadataSetName || 'Sem conjunto'
      if (!groups.has(groupKey)) groups.set(groupKey, { label: groupLabel, options: [] })
      groups.get(groupKey)!.options.push({
        value: item.id,
        label: `${item.label} (${item.name}) • ${item.fieldType}${item.isRequired ? ' • obrigatório padrão' : ''}`,
      })
    })
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [metadataDefinitions])

  const metadataDefinitionIdsFromSets = useMemo(() =>
    dedupeStrings(
      metadataDefinitions
        .filter((d) => !!d.metadataSetId && selectedMetadataSetIds.includes(d.metadataSetId))
        .map((d) => d.id),
    ),
    [metadataDefinitions, selectedMetadataSetIds],
  )

  const selectedMetadataDefinitionIds = useMemo(() =>
    dedupeStrings([...metadataDefinitionIdsFromSets, ...manualMetadataDefinitionIds]),
    [metadataDefinitionIdsFromSets, manualMetadataDefinitionIds],
  )

  const resolvedMetadataFields = useMemo(() => {
    const currentMap = new Map<string, ActivityMetadataFieldRule>()
    metadataFieldRules.forEach((f) => currentMap.set(f.metadataDefinitionId, f))
    return sortMetadataFields(
      selectedMetadataDefinitionIds.map((id) =>
        createMetadataFieldRule(metadataDefinitionMap.get(id), id, currentMap.get(id)),
      ),
    )
  }, [metadataFieldRules, selectedMetadataDefinitionIds, metadataDefinitionMap])

  // ── Metadados: sync ────────────────────────────────────────────────────────
  const syncMetadataState = (nextSetIds: string[], nextManualIds: string[], nextFields?: ActivityMetadataFieldRule[]) => {
    const normalizedManualIds = dedupeStrings(nextManualIds)
    const idsFromSets = dedupeStrings(
      metadataDefinitions
        .filter((d) => !!d.metadataSetId && nextSetIds.includes(d.metadataSetId))
        .map((d) => d.id),
    )
    const effectiveIds = dedupeStrings([...idsFromSets, ...normalizedManualIds])
    const baseMap = new Map<string, ActivityMetadataFieldRule>()
    metadataFieldRules.forEach((f) => baseMap.set(f.metadataDefinitionId, f))
    resolvedMetadataFields.forEach((f) => baseMap.set(f.metadataDefinitionId, f))
    ;(nextFields ?? []).forEach((f) => baseMap.set(f.metadataDefinitionId, f))
    const normalizedFields = sortMetadataFields(
      effectiveIds.map((id) => createMetadataFieldRule(metadataDefinitionMap.get(id), id, baseMap.get(id))),
    )
    setSelectedMetadataSetIds(nextSetIds)
    setManualMetadataDefinitionIds(normalizedManualIds)
    setMetadataFieldRules(normalizedFields)
    form.setFieldsValue({ metadataSetIds: nextSetIds, metadataDefinitionIds: effectiveIds, metadataFields: normalizedFields })
  }

  // ── Inicialização do form ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedElement || selectedElement.kind !== 'activity') return
    if (metadataDefinitionsLoading) return

    const currentKey = [workflowId, selectedElement.id, initialConfig?.updatedAt ?? 'new', metadataDefinitions.length].join('::')
    if (initializationKeyRef.current === currentKey) return

    const initialMetadataFields =
      initialConfig?.metadataFields && initialConfig.metadataFields.length > 0
        ? initialConfig.metadataFields
        : (initialConfig?.metadataDefinitionIds ?? []).map((id) =>
            createMetadataFieldRule(metadataDefinitionMap.get(id), id),
          )

    const initialMetadataDefinitionIds = initialMetadataFields.length > 0
      ? initialMetadataFields.map((f) => f.metadataDefinitionId)
      : []
    const initialSetIds = initialConfig?.metadataSetIds ?? []
    const idsComingFromSets = new Set(
      metadataDefinitions
        .filter((d) => !!d.metadataSetId && initialSetIds.includes(d.metadataSetId))
        .map((d) => d.id),
    )
    const initialManualIds = initialMetadataDefinitionIds.filter((id) => !idsComingFromSets.has(id))

    // Determina o assignmentMode salvo — compatibilidade com valores legados
    const savedMode = (initialConfig as any)?.assignmentMode
    const normalizedMode = ['user', 'group', 'positions', 'mixed'].includes(savedMode)
      ? savedMode
      : savedMode === 'role' || savedMode === 'function' || savedMode === 'area'
        ? 'positions'
        : 'user'

    form.setFieldsValue({
      assignmentMode:          normalizedMode,
      responsibleUserIds:      initialConfig?.responsibleUserIds      ?? [],
      responsibleRoleIds:      initialConfig?.responsibleRoleIds      ?? [],
      responsibleAreaIds:      initialConfig?.responsibleAreaIds      ?? [],
      responsibleFunctionIds:  initialConfig?.responsibleFunctionIds  ?? [],
      responsibleGroupIds:     (initialConfig as any)?.responsibleGroupIds ?? [],
      deadlineMode:            initialConfig?.deadlineMode            ?? 'days',
      deadlineValue:           initialConfig?.deadlineValue,
      deadlineMetadataFieldId: initialConfig?.deadlineMetadataFieldId,
      metadataSetIds:          initialSetIds,
      metadataDefinitionIds:   initialMetadataDefinitionIds,
      metadataFields:          initialMetadataFields,
      notificationTemplateIds: initialConfig?.notificationTemplateIds ?? [],
      allowApprove:            initialConfig?.allowApprove            ?? true,
      allowReject:             initialConfig?.allowReject             ?? true,
      allowRequestChanges:     initialConfig?.allowRequestChanges     ?? true,
      allowForward:            initialConfig?.allowForward            ?? false,
      actions:                 migrateActionsFromBooleans(initialConfig),
      instructions:            initialConfig?.instructions,
      helpText:                initialConfig?.helpText,
    })

    setSelectedMetadataSetIds(initialSetIds)
    setManualMetadataDefinitionIds(initialManualIds)
    setMetadataFieldRules(sortMetadataFields(initialMetadataFields))
    initializationKeyRef.current = currentKey
  }, [form, workflowId, selectedElement, initialConfig, metadataDefinitions, metadataDefinitionsLoading, metadataDefinitionMap])

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!selectedElement || selectedElement.kind !== 'activity') {
    return <Empty description="Selecione uma atividade no fluxo" style={{ padding: 32 }} />
  }

  // ── Handlers: metadados ────────────────────────────────────────────────────
  const handleMetadataSetsChange = (nextSetIds: string[]) =>
    syncMetadataState(nextSetIds, manualMetadataDefinitionIds)

  const handleMetadataDefinitionsChange = (nextIds: string[]) => {
    const remainingSetIds = selectedMetadataSetIds.filter((setId) => {
      const idsFromSet = metadataDefinitions.filter((d) => d.metadataSetId === setId).map((d) => d.id)
      if (idsFromSet.length === 0) return false
      return idsFromSet.every((id) => nextIds.includes(id))
    })
    const idsFromRemainingSets = dedupeStrings(
      metadataDefinitions.filter((d) => !!d.metadataSetId && remainingSetIds.includes(d.metadataSetId)).map((d) => d.id),
    )
    syncMetadataState(remainingSetIds, nextIds.filter((id) => !idsFromRemainingSets.includes(id)))
  }

  const updateMetadataField = (metadataDefinitionId: string, patch: Partial<ActivityMetadataFieldRule>) => {
    const nextFields = resolvedMetadataFields.map((f) =>
      f.metadataDefinitionId === metadataDefinitionId ? { ...f, ...patch } : f,
    )
    setMetadataFieldRules(sortMetadataFields(nextFields))
    form.setFieldsValue({
      metadataSetIds: selectedMetadataSetIds,
      metadataDefinitionIds: selectedMetadataDefinitionIds,
      metadataFields: sortMetadataFields(nextFields),
    })
  }

  const removeMetadataField = (metadataDefinitionId: string) =>
    handleMetadataDefinitionsChange(selectedMetadataDefinitionIds.filter((id) => id !== metadataDefinitionId))

  // ── Handlers: responsáveis ─────────────────────────────────────────────────
  const hasPending =
    pendingUserIds.length > 0 ||
    pendingGroupIds.length > 0 ||
    pendingRoleIds.length > 0 ||
    pendingFunctionIds.length > 0 ||
    pendingAreaIds.length > 0

  const handleAddAssignees = () => {
    const toAdd: AssigneeEntry[] = []

    pendingUserIds.forEach((id) => {
      if (assignees.some((a) => a.id === id && a.kind === 'user')) return
      const u = (users as any[]).find((u: any) => u.id === id)
      toAdd.push({ kind: 'user', id, label: u?.name ?? id, sub: u?.jobTitle })
    })
    pendingGroupIds.forEach((id) => {
      if (assignees.some((a) => a.id === id && a.kind === 'group')) return
      const g = (orgGroups as any[]).find((g: any) => g.id === id)
      toAdd.push({ kind: 'group', id, label: g?.name ?? id })
    })
    pendingRoleIds.forEach((id) => {
      if (assignees.some((a) => a.id === id && a.kind === 'role')) return
      const r = (orgRoles as any[]).find((r: any) => r.id === id)
      toAdd.push({ kind: 'role', id, label: r?.name ?? id })
    })
    pendingFunctionIds.forEach((id) => {
      if (assignees.some((a) => a.id === id && a.kind === 'function')) return
      const f = (disciplines as any[]).find((d: any) => d.id === id)
      toAdd.push({ kind: 'function', id, label: f?.name ?? id })
    })
    pendingAreaIds.forEach((id) => {
      if (assignees.some((a) => a.id === id && a.kind === 'area')) return
      toAdd.push({ kind: 'area', id, label: id })
    })

    setAssignees((prev) => [...prev, ...toAdd])
    setPendingUserIds([])
    setPendingGroupIds([])
    setPendingRoleIds([])
    setPendingFunctionIds([])
    setPendingAreaIds([])
  }

  const removeAssignee = (id: string, kind: string) =>
    setAssignees((prev) => prev.filter((a) => !(a.id === id && a.kind === kind)))

  // ── Visibilidade dos seletores ─────────────────────────────────────────────
  const showUsers     = assignmentMode === 'user'      || assignmentMode === 'mixed' || !assignmentMode
  const showGroups    = assignmentMode === 'group'     || assignmentMode === 'mixed'
  const showPositions = assignmentMode === 'positions' || assignmentMode === 'mixed'

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (values: FormValues) => {
    // Sobrescreve com a lista confirmada de assignees
    const byKind = (kind: string) => assignees.filter((a) => a.kind === kind).map((a) => a.id)
    values.responsibleUserIds     = byKind('user')
    values.responsibleGroupIds    = byKind('group')
    values.responsibleRoleIds     = byKind('role')
    values.responsibleFunctionIds = byKind('function')
    values.responsibleAreaIds     = byKind('area')

    const actions = (values.actions ?? []).map((a) => ({
      ...a,
      id: a.id || crypto.randomUUID(),
      requiresComment: a.requiresComment ?? false,
    }))

    const normalizedMetadataFields = sortMetadataFields(
      resolvedMetadataFields.filter((f) => f.metadataDefinitionId),
    )

    const activityConfig: ActivityConfig & { responsibleGroupIds?: string[] } = {
      assignmentMode:          values.assignmentMode as any,
      responsibleUserIds:      values.responsibleUserIds     ?? [],
      responsibleRoleIds:      values.responsibleRoleIds     ?? [],
      responsibleAreaIds:      values.responsibleAreaIds     ?? [],
      responsibleFunctionIds:  values.responsibleFunctionIds ?? [],
      responsibleGroupIds:     values.responsibleGroupIds    ?? [],
      deadlineMode:            values.deadlineMode,
      deadlineValue:           values.deadlineMode === 'metadata' ? undefined : values.deadlineValue,
      deadlineMetadataFieldId: values.deadlineMode === 'metadata' ? values.deadlineMetadataFieldId : undefined,
      metadataSetIds:          selectedMetadataSetIds,
      metadataDefinitionIds:   normalizedMetadataFields.map((f) => f.metadataDefinitionId),
      metadataFields:          normalizedMetadataFields,
      notificationTemplateIds: values.notificationTemplateIds ?? [],
      ...deriveBooleansFromActions(actions),
      actions,
      instructions: values.instructions,
      helpText:     values.helpText,
    }

    onSave({
      workflowId,
      elementId:   selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'activity',
      config: activityConfig,
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
      <Tabs
        size="small"
        tabBarStyle={{
          margin: 0,
          paddingLeft: 24,
          paddingRight: 24,
          borderBottom: '1px solid #f1f5f9',
          background: '#fafbfc',
        }}
        items={[

          // ── ABA: RESPONSÁVEIS ──────────────────────────────────────────────
          {
            key: 'responsible',
            label: <Space size={6}><TeamOutlined /><span>Responsáveis</span></Space>,
            children: (
              <div style={tabPaneStyle}>

                {/* Modo de atribuição */}
                <Text style={sectionLabelStyle}>Modo de atribuição</Text>
                <Form.Item name="assignmentMode" style={{ marginBottom: 20 }}>
                  <Select options={ASSIGNMENT_MODE_OPTIONS} />
                </Form.Item>

                {/* Seletores contextuais */}
                <Text style={sectionLabelStyle}>Adicionar responsável</Text>

                {/* ── Usuários ────────────────────────────────────────────── */}
                {showUsers && (
                  <Form.Item
                    label={
                      <Space size={4}>
                        <UserOutlined style={{ color: '#1677ff' }} />
                        <span>Usuários</span>
                      </Space>
                    }
                    style={{ marginBottom: 10 }}
                  >
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      placeholder="Selecione usuários..."
                      optionFilterProp="label"
                      value={pendingUserIds}
                      onChange={setPendingUserIds}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                        String((opt as any)?.email ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={userOptions}
                      optionRender={(option) => (
                        <Space size={8}>
                          <Avatar
                            size="small"
                            icon={<UserOutlined />}
                            style={{ background: '#69b1ff', flexShrink: 0 }}
                          />
                          <div style={{ lineHeight: 1.3 }}>
                            <div style={{ fontSize: 13 }}>{option.label}</div>
                            {(option.data as any)?.jobTitle && (
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                {(option.data as any).jobTitle}
                              </div>
                            )}
                          </div>
                        </Space>
                      )}
                    />
                  </Form.Item>
                )}

                {/* ── Grupos ──────────────────────────────────────────────── */}
                {showGroups && (
                  <Form.Item
                    label={
                      <Space size={4}>
                        <TeamOutlined style={{ color: '#7c3aed' }} />
                        <span>Grupos</span>
                      </Space>
                    }
                    style={{ marginBottom: 10 }}
                  >
                    <Select
                      mode="multiple"
                      allowClear
                      showSearch
                      placeholder="Selecione grupos..."
                      optionFilterProp="label"
                      value={pendingGroupIds}
                      onChange={setPendingGroupIds}
                      options={groupOptions}
                      notFoundContent={
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Nenhum grupo cadastrado"
                        />
                      }
                    />
                  </Form.Item>
                )}

                {/* ── Posições: Cargo, Função, Área ────────────────────────── */}
                {showPositions && (
                  <>
                    <Form.Item
                      label={
                        <Space size={4}>
                          <span style={{ color: '#0369a1', fontWeight: 700, fontSize: 12 }}>C</span>
                          <span>Cargos</span>
                        </Space>
                      }
                      style={{ marginBottom: 10 }}
                    >
                      <Select
                        mode="multiple"
                        allowClear
                        showSearch
                        placeholder="Selecione cargos..."
                        optionFilterProp="label"
                        value={pendingRoleIds}
                        onChange={setPendingRoleIds}
                        options={roleOptions}
                        notFoundContent={
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Nenhum cargo cadastrado"
                          />
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      label={
                        <Space size={4}>
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: 12 }}>F</span>
                          <span>Funções / Disciplinas</span>
                        </Space>
                      }
                      style={{ marginBottom: 10 }}
                    >
                      <Select
                        mode="multiple"
                        allowClear
                        showSearch
                        placeholder="Selecione funções..."
                        optionFilterProp="label"
                        value={pendingFunctionIds}
                        onChange={setPendingFunctionIds}
                        options={functionOptions}
                        notFoundContent={
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="Nenhuma função cadastrada"
                          />
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      label="Áreas"
                      style={{ marginBottom: 10 }}
                    >
                      <Select
                        mode="tags"
                        allowClear
                        placeholder="Ex.: qualidade, engenharia"
                        value={pendingAreaIds}
                        onChange={setPendingAreaIds}
                      />
                    </Form.Item>
                  </>
                )}

                {/* Botão Adicionar */}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!hasPending}
                  onClick={handleAddAssignees}
                  style={{
                    marginBottom: 24,
                    background: '#0f172a',
                    borderColor: '#0f172a',
                    borderRadius: 8,
                    opacity: hasPending ? 1 : 0.5,
                  }}
                >
                  Adicionar
                </Button>

                {/* ── Lista de responsáveis atribuídos ──────────────────── */}
                {assignees.length > 0 ? (
                  <>
                    <Text style={sectionLabelStyle}>
                      Responsáveis atribuídos ({assignees.length})
                    </Text>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      {assignees.map((a) => {
                        const meta = ASSIGNEE_KIND_META[a.kind]
                        return (
                          <div
                            key={`${a.kind}::${a.id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              background: meta.bg,
                              border: '1px solid #e2e8f0',
                              borderRadius: 10,
                              padding: '8px 12px',
                            }}
                          >
                            <Avatar
                              size="small"
                              style={{
                                background: 'transparent',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {meta.icon}
                            </Avatar>

                            <div style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {a.label}
                              </div>
                              {a.sub && (
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.sub}</div>
                              )}
                            </div>

                            <Tag
                              style={{
                                margin: 0,
                                flexShrink: 0,
                                fontSize: 10,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              {meta.label}
                            </Tag>

                            <Tooltip title="Remover">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => removeAssignee(a.id, a.kind)}
                                style={{ flexShrink: 0 }}
                              />
                            </Tooltip>
                          </div>
                        )
                      })}
                    </Space>
                  </>
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ borderRadius: 8, fontSize: 12 }}
                    message="Nenhum responsável atribuído ainda"
                    description="Selecione itens acima e clique em Adicionar para definir os responsáveis desta atividade."
                  />
                )}
              </div>
            ),
          },

          // ── ABA: PRAZO ─────────────────────────────────────────────────────
          {
            key: 'deadline',
            label: <Space size={6}><ClockCircleOutlined /><span>Prazo</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Prazo da atividade</Text>
                <Row gutter={12} style={{ marginBottom: deadlineMode === 'metadata' ? 12 : 24 }}>
                  <Col span={deadlineMode === 'metadata' ? 24 : 12}>
                    <Form.Item label="Modo" name="deadlineMode" style={{ marginBottom: 0 }}>
                      <Select
                        options={[
                          { label: 'Horas', value: 'hours' },
                          { label: 'Dias', value: 'days' },
                          { label: 'Data fixa', value: 'fixed-date' },
                          { label: 'Metadado', value: 'metadata' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  {deadlineMode !== 'metadata' && (
                    <Col span={12}>
                      <Form.Item label="Valor" name="deadlineValue" style={{ marginBottom: 0 }}>
                        {deadlineMode === 'fixed-date'
                          ? <Input placeholder="AAAA-MM-DD" />
                          : <InputNumber style={{ width: '100%' }} min={1} placeholder="Ex.: 2" />
                        }
                      </Form.Item>
                    </Col>
                  )}
                </Row>
                {deadlineMode === 'metadata' && (
                  <Form.Item
                    label="Campo de metadado"
                    name="deadlineMetadataFieldId"
                    style={{ marginBottom: 24 }}
                  >
                    <Select
                      allowClear
                      showSearch
                      placeholder="Selecione o metadado de prazo"
                      options={metadataDefinitions.map((d) => ({
                        value: d.id,
                        label: d.label ?? d.name,
                      }))}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </Form.Item>
                )}
                <Text style={sectionLabelStyle}>Notificações</Text>
                <Form.Item
                  label="Templates de notificação"
                  name="notificationTemplateIds"
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    placeholder="Selecione os templates de notificação"
                    options={notificationTemplates
                      .filter((t) =>
                        !scopeContext.processId ||
                        !(t as any).processId ||
                        (t as any).processId === scopeContext.processId,
                      )
                      .map((t) => ({
                        value: t.id,
                        label: t.name,
                      }))}
                    filterOption={(input, opt) =>
                      String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </div>
            ),
          },

          // ── ABA: METADADOS ─────────────────────────────────────────────────
          {
            key: 'metadata',
            label: <Space size={6}><DatabaseOutlined /><span>Metadados</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Conjuntos de metadados</Text>
                {metadataSetsError && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Não foi possível carregar os conjuntos de metadados"
                  />
                )}
                <Form.Item label="Conjuntos" style={{ marginBottom: 16 }}>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    value={selectedMetadataSetIds}
                    onChange={handleMetadataSetsChange}
                    loading={metadataSetsLoading}
                    placeholder={metadataSetsLoading ? 'Carregando conjuntos...' : 'Selecione um ou mais conjuntos'}
                    options={metadataSetsOptions}
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 12 }}>
                  Ao selecionar um conjunto, todos os metadados pertencentes a ele são adicionados automaticamente.
                </Text>

                <Text style={sectionLabelStyle}>Metadados da atividade</Text>
                {metadataDefinitionsError && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Não foi possível carregar os metadados do sistema"
                  />
                )}
                <Form.Item label="Metadados selecionados" style={{ marginBottom: 16 }}>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    value={selectedMetadataDefinitionIds}
                    onChange={handleMetadataDefinitionsChange}
                    loading={metadataDefinitionsLoading}
                    placeholder={metadataDefinitionsLoading ? 'Carregando metadados...' : 'Selecione os metadados da atividade'}
                    options={groupedMetadataOptions}
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>

                {resolvedMetadataFields.length === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="Nenhum metadado selecionado"
                    description="Selecione conjuntos ou metadados específicos para configurar esta atividade."
                    style={{ borderRadius: 10 }}
                  />
                ) : (
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {resolvedMetadataFields.map((field) => (
                      <div
                        key={field.metadataDefinitionId}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 12,
                          padding: 14,
                          background: '#f8fafc',
                        }}
                      >
                        <Row gutter={[12, 12]} align="middle">
                          <Col xs={24} md={10}>
                            <Space direction="vertical" size={2}>
                              <Text strong>{field.label || field.name || field.metadataDefinitionId}</Text>
                              <Space wrap size={6}>
                                {field.name        && <Tag>{field.name}</Tag>}
                                {field.fieldType   && <Tag color="blue">{field.fieldType}</Tag>}
                                {field.metadataSetName && (
                                  <Tag color="purple" icon={<FolderOpenOutlined />}>
                                    {field.metadataSetName}
                                  </Tag>
                                )}
                              </Space>
                            </Space>
                          </Col>
                          <Col xs={12} md={5}>
                            <Space direction="vertical" size={4}>
                              <Text style={{ fontSize: 12 }}>Obrigatório</Text>
                              <Switch
                                checked={field.isRequired}
                                onChange={(checked) =>
                                  updateMetadataField(field.metadataDefinitionId, { isRequired: checked })
                                }
                              />
                            </Space>
                          </Col>
                          <Col xs={12} md={5}>
                            <Space direction="vertical" size={4}>
                              <Text style={{ fontSize: 12 }}>Somente leitura</Text>
                              <Switch
                                checked={field.isReadOnly}
                                onChange={(checked) =>
                                  updateMetadataField(field.metadataDefinitionId, { isReadOnly: checked })
                                }
                              />
                            </Space>
                          </Col>
                          <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                            <Tooltip title="Remover metadado">
                              <Button
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => removeMetadataField(field.metadataDefinitionId)}
                              >
                                Remover
                              </Button>
                            </Tooltip>
                          </Col>
                        </Row>
                      </div>
                    ))}
                  </Space>
                )}

                <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
                  "Somente leitura" deixa o campo visível na etapa, mas sem permitir edição pelo executor.
                </Text>
              </div>
            ),
          },

          // ── ABA: AÇÕES ─────────────────────────────────────────────────────
          {
            key: 'actions',
            label: <Space size={6}><ThunderboltOutlined /><span>Ações</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Ações disponíveis para o executor</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                  Cada ação pode ser roteada para um caminho diferente no gateway seguinte.
                </Text>
                <Form.List name="actions">
                  {(fields, { add, remove }) => (
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      {fields.length === 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message="Nenhuma ação configurada"
                          description="Adicione pelo menos uma ação para que o executor possa interagir."
                          style={{ borderRadius: 10 }}
                        />
                      )}
                      {fields.map(({ key, name }) => (
                        <ActionRow key={key} name={name} form={form} onRemove={() => remove(name)} />
                      ))}
                      <Button
                        type="dashed"
                        block
                        icon={<PlusOutlined />}
                        style={{ borderRadius: 8, height: 36 }}
                        onClick={() =>
                          add({
                            id: crypto.randomUUID(),
                            label: 'Nova ação',
                            color: 'default',
                            outcome: 'custom',
                            requiresComment: false,
                          })
                        }
                      >
                        Adicionar ação
                      </Button>
                    </Space>
                  )}
                </Form.List>
              </div>
            ),
          },

          // ── ABA: INSTRUÇÕES ────────────────────────────────────────────────
          {
            key: 'instructions',
            label: <Space size={6}><FileTextOutlined /><span>Instruções</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Orientações para o executor</Text>
                <Form.Item
                  label="Instruções da atividade"
                  name="instructions"
                  style={{ marginBottom: 16 }}
                >
                  <Input.TextArea
                    rows={5}
                    placeholder="Explique o que deve ser feito nesta etapa, critérios de aprovação, documentos necessários..."
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
                <Form.Item
                  label="Texto de apoio"
                  name="helpText"
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Dicas adicionais, links úteis, exemplos..."
                    style={{ borderRadius: 8 }}
                  />
                </Form.Item>
              </div>
            ),
          },
        ]}
      />

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 24px',
          borderTop: '1px solid #f1f5f9',
          background: '#fafbfc',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          type="primary"
          htmlType="submit"
          style={{
            borderRadius: 8,
            background: '#0f172a',
            borderColor: '#0f172a',
            fontWeight: 600,
            paddingLeft: 28,
            paddingRight: 28,
          }}
        >
          Salvar configuração
        </Button>
      </div>
    </Form>
  )
}

// ── ActionRow ──────────────────────────────────────────────────────────────────

function ActionRow({
  name,
  form,
  onRemove,
}: {
  name: number
  form: ReturnType<typeof Form.useForm<FormValues>>[0]
  onRemove: () => void
}) {
  const color: ActivityAction['color'] = Form.useWatch(['actions', name, 'color'], form) ?? 'default'
  const label: string = Form.useWatch(['actions', name, 'label'], form) ?? ''

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <HolderOutlined style={{ color: '#cbd5e1', cursor: 'grab', flexShrink: 0 }} />
        <Form.Item
          name={[name, 'label']}
          noStyle
          rules={[{ required: true, message: 'Informe o nome' }]}
        >
          <Input
            placeholder="Nome da ação"
            variant="borderless"
            style={{ fontWeight: 600, padding: '0 4px', flex: 1 }}
          />
        </Form.Item>
        <Tag color={color} style={{ margin: 0, flexShrink: 0 }}>
          {label || 'Ação'}
        </Tag>
        <Tooltip title="Remover">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={onRemove}
            style={{ flexShrink: 0 }}
          />
        </Tooltip>
      </div>
      <Row gutter={[10, 0]} align="middle">
        <Col xs={8}>
          <Form.Item label="Cor" name={[name, 'color']} style={{ marginBottom: 0 }}>
            <Select size="small" options={COLOR_OPTIONS} />
          </Form.Item>
        </Col>
        <Col xs={10}>
          <Form.Item label="Comportamento" name={[name, 'outcome']} style={{ marginBottom: 0 }}>
            <Select size="small" options={OUTCOME_OPTIONS} />
          </Form.Item>
        </Col>
        <Col xs={6} style={{ paddingTop: 22 }}>
          <Form.Item name={[name, 'requiresComment']} valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch size="small" checkedChildren="Comentário" unCheckedChildren="Opcional" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  )
}