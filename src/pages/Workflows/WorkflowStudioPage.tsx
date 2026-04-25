import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TabsProps } from 'antd'
import {
  ArrowLeftOutlined,
  BgColorsOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  MailOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SettingOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sanitizeElementConfigsForPersistence } from '../../features/workflows/workflowConfigPersistence'
import {
  BpmnEditor,
  COLOR_PALETTE,
  type ColorEntry,
} from '../../features/workflows/components/BpmnEditor'
import { WorkflowElementConfigPanel } from '../../features/workflows/components/WorkflowElementConfigPanel'
import { WorkflowValidationPanel } from '../../features/workflows/components/WorkflowValidationPanel'
import { WorkflowVersionsPanel } from '../../features/workflows/components/WorkflowVersionsPanel'
import {
  type WorkflowDefinition as BaseWorkflowDefinition,
  type WorkflowElementConfig,
  type WorkflowVersionSnapshot,
  type WorkflowElementKind,
  type StartEventConfig,
  type ActivityConfig,
  type GatewayConfig,
  type FlowConfig,
  type EndEventConfig,
  type NotificationEventConfig,
  type SystemTaskConfig,
  type MessageEventConfig,
  type TimerEventConfig,
  type SignalEventConfig,
  type ConditionalEventConfig,
} from '../../features/workflows/storage'
import {
  getWorkflowById,
  toWorkflowPayload,
  updateWorkflow,
  type WorkflowDefinition,
  type WorkflowSnapshot,
  type WorkflowStatus,
} from '../../api/workflows'
import {
  type BpmnElementSummary,
  validateWorkflowStudio,
} from '../../features/workflows/studioValidation'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

type WorkflowStudioFormValues = {
  name: string
  description?: string
  version: string
  status: WorkflowStatus
  documentTypeName?: string
}

const STATUS_OPTIONS: Array<{ label: string; value: WorkflowStatus }> = [
  { label: 'Rascunho', value: 'draft' },
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
  { label: 'Arquivado', value: 'archived' },
]

function getStatusColor(status: WorkflowStatus) {
  switch (status) {
    case 'active':
      return 'green'
    case 'draft':
      return 'gold'
    case 'inactive':
      return 'default'
    case 'archived':
      return 'red'
    default:
      return 'default'
  }
}

function buildSupportedElementSignature(elements: BpmnElementSummary[]) {
  return elements
    .filter((i) => i.kind !== 'unsupported')
    .map((i) => `${i.kind}:${i.id}`)
    .sort()
    .join('|')
}

function countWorkflowSteps(elements: BpmnElementSummary[]) {
  return elements.filter((i) =>
    i.kind === 'activity' ||
    i.kind === 'system-task' ||
    i.kind === 'notification' ||
    i.kind === 'message' ||
    i.kind === 'timer' ||
    i.kind === 'signal' ||
    i.kind === 'conditional',
  ).length
}

function getElementKindLabel(kind?: BpmnElementSummary['kind']) {
  if (kind === 'start') return 'Evento inicial'
  if (kind === 'end') return 'Evento final'
  if (kind === 'activity') return 'Atividade humana'
  if (kind === 'gateway') return 'Gateway de decisão'
  if (kind === 'notification') return 'Notificação'
  if (kind === 'system-task') return 'Tarefa de sistema'
  if (kind === 'flow') return 'Fluxo de sequência'
  if (kind === 'message') return 'Evento de Mensagem'
  if (kind === 'timer') return 'Evento Temporal'
  if (kind === 'signal') return 'Evento de Sinal'
  if (kind === 'conditional') return 'Evento Condicional'
  return 'Elemento'
}

function ElementKindIcon({ kind }: { kind?: BpmnElementSummary['kind'] }) {
  if (kind === 'start') return <PlayCircleOutlined />
  if (kind === 'end') return <StopOutlined />
  if (kind === 'activity') return <EditOutlined />
  if (kind === 'gateway') return <BranchesOutlined />
  if (kind === 'notification') return <ThunderboltOutlined />
  if (kind === 'system-task') return <SettingOutlined />
  if (kind === 'flow') return <NodeIndexOutlined />
  if (kind === 'message') return <MailOutlined />
  if (kind === 'timer') return <ClockCircleOutlined />
  if (kind === 'signal') return <ThunderboltOutlined />
  if (kind === 'conditional') return <BranchesOutlined />
  return <EditOutlined />
}

function ColorPaletteTab({
  selectedElement,
  onApplyColor,
}: {
  selectedElement: BpmnElementSummary | null
  onApplyColor: (entry: ColorEntry) => void
}) {
  if (!selectedElement) {
    return <Empty description="Selecione um elemento para alterar a cor" />
  }

  return (
    <div style={{ padding: 20 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={selectedElement.name || selectedElement.id}
        description="Escolha uma cor para aplicar ao elemento selecionado no diagrama."
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 12,
        }}
      >
        {COLOR_PALETTE.map((entry) => (
          <button
            key={entry.label}
            type="button"
            onClick={() => onApplyColor(entry)}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              background: '#fff',
              padding: 12,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '100%',
                height: 44,
                borderRadius: 8,
                background: entry.fill,
                border: `2px solid ${entry.stroke}`,
                marginBottom: 8,
              }}
            />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
              {entry.label}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              Fill: {entry.fill}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Stroke: {entry.stroke}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function upsertElementConfigInList(
  items: WorkflowElementConfig[],
  nextItem: WorkflowElementConfig,
) {
  const index = items.findIndex((item) => item.elementId === nextItem.elementId)

  if (index === -1) {
    return [...items, nextItem]
  }

  const clone = [...items]
  clone[index] = {
    ...clone[index],
    ...nextItem,
  }

  return clone
}

function buildSnapshotWorkflow(workflow: WorkflowDefinition): BaseWorkflowDefinition {
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

function createDefaultConfigByKind(
  kind: WorkflowElementKind,
): WorkflowElementConfig['config'] {
  switch (kind) {
    case 'start': {
      const config: StartEventConfig = {
        initialMetadataDefinitionIds: [],
        metadataSetIds: [],
        metadataFields: [],
        requiredAttachmentTypes: [],
        notificationTemplateIds: [],
        allowedStarterRoleIds: [],
        instructions: undefined,
        formTitle: undefined,
      }
      return config
    }

    case 'activity': {
      const config: ActivityConfig = {
        assignmentMode: 'user',
        responsibleUserIds: [],
        responsibleRoleIds: [],
        responsibleAreaIds: [],
        responsibleFunctionIds: [],
        responsibleGroupIds: [],
        deadlineMode: 'days',
        deadlineValue: undefined,
        deadlineMetadataFieldId: undefined,
        metadataSetIds: [],
        metadataDefinitionIds: [],
        metadataFields: [],
        notificationTemplateIds: [],
        allowApprove: true,
        allowReject: true,
        allowRequestChanges: true,
        allowForward: false,
        instructions: undefined,
        helpText: undefined,
        actions: [],
        linkedWorkflowId: undefined,
        sendTask: undefined,
      }
      return config
    }

    case 'gateway': {
      const config: GatewayConfig = {
        decisionMode: 'manual',
        decisionDescription: undefined,
        decisionFieldId: undefined,
        notificationTemplateIds: [],
        instructions: undefined,
        actionRoutes: [],
      }
      return config
    }

    case 'flow': {
      const config: FlowConfig = {
        label: undefined,
        conditionType: 'always',
        expression: undefined,
        metadataFieldId: undefined,
        expectedValue: undefined,
        isDefault: false,
        notificationTemplateIds: [],
        description: undefined,
        sourceId: undefined,
        targetId: undefined,
      }
      return config
    }

    case 'end': {
      const config: EndEventConfig = {
        finalMetadataDefinitionIds: [],
        metadataSetIds: [],
        metadataFields: [],
        summarySections: [],
        notificationTemplateIds: [],
        finalAction: 'complete',
        linkedWorkflowId: undefined,
        instructions: undefined,
      }
      return config
    }

    case 'notification': {
      const config: NotificationEventConfig = {
        notificationTemplateId: undefined,
        channel: 'email',
        recipientRoleIds: [],
        recipientUserIds: [],
        recipientAreaIds: [],
        notifyInitiator: false,
        notifyPreviousAssignees: false,
        customSubject: undefined,
        customBody: undefined,
        contextVariables: [],
      }
      return config
    }

    case 'system-task': {
      const config: SystemTaskConfig = {
        actionType: 'increment-revision',
        auditNote: undefined,
        notificationTemplateIds: [],
      }
      return config
    }

    case 'message': {
      const config: MessageEventConfig = {
        notificationTemplateIds: [],
        recipientUserIds: [],
        recipientGroupIds: [],
        recipientRoleIds: [],
        triggerMode: 'on-enter',
        auditNote: undefined,
      }
      return config
    }

    case 'timer': {
      const config: TimerEventConfig = {
        timerType: 'fixed-delay',
        delayUnit: 'days',
        delayValue: undefined,
        fixedDate: undefined,
        metadataDefinitionId: undefined,
        metadataOffsetDays: undefined,
        auditNote: undefined,
      }
      return config
    }

    case 'signal': {
      const config: SignalEventConfig = {
        targetProcessId: '',
        targetProcessName: undefined,
        relationDirection: 'parent-to-child',
        targetAction: '',
        targetActionLabel: undefined,
        auditNote: undefined,
      }
      return config
    }

    case 'conditional': {
      const config: ConditionalEventConfig = {
        actionType: 'increment-revision',
        createNewInstance: true,
        auditNote: undefined,
      }
      return config
    }

    default: {
      const config: ActivityConfig = {
        assignmentMode: 'user',
        responsibleUserIds: [],
        responsibleRoleIds: [],
        responsibleAreaIds: [],
        responsibleFunctionIds: [],
        responsibleGroupIds: [],
        deadlineMode: 'days',
        deadlineValue: undefined,
        deadlineMetadataFieldId: undefined,
        metadataSetIds: [],
        metadataDefinitionIds: [],
        metadataFields: [],
        notificationTemplateIds: [],
        allowApprove: true,
        allowReject: true,
        allowRequestChanges: true,
        allowForward: false,
        instructions: undefined,
        helpText: undefined,
        actions: [],
        linkedWorkflowId: undefined,
        sendTask: undefined,
      }
      return config
    }
  }
}

function resolveElementConfigValue(
  kind: WorkflowElementKind,
  typedValues: Partial<WorkflowElementConfig>,
  currentElementConfig: WorkflowElementConfig | null,
): WorkflowElementConfig['config'] {
  return typedValues.config ?? currentElementConfig?.config ?? createDefaultConfigByKind(kind)
}

export function WorkflowStudioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm<WorkflowStudioFormValues>()

  const processId = searchParams.get('processId') ?? undefined
  const backPath = processId ? `/processes/${processId}` : '/workflows'

  const user = useAuthStore((s) => s.user)
  const accountId = (user as any)?.accountId ?? (user as any)?.tenantId ?? ''

  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null)
  const [elements, setElements] = useState<BpmnElementSummary[]>([])
  const [selectedElement, setSelectedElement] = useState<BpmnElementSummary | null>(null)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [elementNameInput, setElementNameInput] = useState('')
  const [modalTabKey, setModalTabKey] = useState<'config' | 'colors'>('config')

  const bpmnRenameRef = useRef<((id: string, name: string) => void) | null>(null)
  const bpmnColorRef = useRef<((id: string, color: ColorEntry) => void) | null>(null)
  const lastElementSignatureRef = useRef('')

  const workflowQuery = useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      if (!id) throw new Error('Workflow não informado')
      return getWorkflowById(id)
    },
    enabled: !!id,
  })

  const saveMutation = useMutation({
    mutationFn: async (nextWorkflow: WorkflowDefinition) => {
      return updateWorkflow(nextWorkflow.id, toWorkflowPayload(nextWorkflow))
    },
    onSuccess: async (saved) => {
      setWorkflow(saved)
      queryClient.setQueryData(['workflow', saved.id], saved)
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  useEffect(() => {
    if (!workflowQuery.data) return

    setWorkflow(workflowQuery.data)
    form.setFieldsValue({
      name: workflowQuery.data.name,
      description: workflowQuery.data.description,
      version: workflowQuery.data.version,
      status: workflowQuery.data.status,
      documentTypeName: workflowQuery.data.documentTypeName,
    })
  }, [form, workflowQuery.data])

  const elementConfigs = useMemo(() => {
    return workflow?.elementConfigs ?? []
  }, [workflow])

  const currentElementConfig = useMemo(() => {
    if (!workflow || !selectedElement) return null
    return workflow.elementConfigs.find((cfg) => cfg.elementId === selectedElement.id) ?? null
  }, [workflow, selectedElement])

  const snapshots = useMemo<WorkflowVersionSnapshot[]>(() => {
    return workflow?.snapshots ?? []
  }, [workflow])

  const validation = useMemo(() => {
    if (!workflow) {
      return {
        issues: [],
        summary: {
          totalRelevantElements: 0,
          configuredRelevantElements: 0,
          errors: 0,
          warnings: 0,
          readinessPercent: 0,
        },
      }
    }

    return validateWorkflowStudio(workflow, elements, elementConfigs)
  }, [workflow, elements, elementConfigs])

  useEffect(() => {
    setWorkflow((prev) => {
      if (!prev) return prev
      const nextStepsCount = countWorkflowSteps(elements)
      if (prev.stepsCount === nextStepsCount) return prev
      return {
        ...prev,
        stepsCount: nextStepsCount,
        updatedAt: new Date().toISOString(),
      }
    })
  }, [elements])

  const scopeContext = useMemo(() => ({
    accountId: workflow?.accountId ?? accountId,
    accountName: workflow?.accountName ?? undefined,
    scopeLevel: workflow?.scopeLevel ?? ('process' as const),
    processId: workflow?.processId ?? processId ?? undefined,
    processName: workflow?.processName ?? undefined,
    tenantId: workflow?.tenantId ?? accountId,
  }), [workflow, accountId, processId])

  if (workflowQuery.isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card loading />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Workflow não encontrado" />
      </div>
    )
  }

  async function persistWorkflow(
    nextWorkflow: WorkflowDefinition,
    successText?: string,
  ) {
    const sanitizedWorkflow: WorkflowDefinition = {
      ...nextWorkflow,
      elementConfigs: sanitizeElementConfigsForPersistence(
        nextWorkflow.elementConfigs ?? [],
      ),
      updatedAt: new Date().toISOString(),
    }

    const saved = await saveMutation.mutateAsync(sanitizedWorkflow)

    if (successText) {
      message.success(successText)
    }

    return saved
  }

  const openElementModal = (
    element: BpmnElementSummary | null,
    initialTab: 'config' | 'colors' = 'config',
  ) => {
    if (!element?.isConfigurable) return
    setSelectedElement(element)
    setElementNameInput(element.name || '')
    setModalTabKey(initialTab)
    setConfigModalOpen(true)
  }

  const handleSaveNow = async () => {
    try {
      await persistWorkflow(
        {
          ...workflow,
          stepsCount: countWorkflowSteps(elements),
        },
        'Workflow salvo com sucesso.',
      )
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ??
        error?.message ??
        'Não foi possível salvar o workflow.'
      message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
    }
  }

  const handlePublish = async () => {
    if (validation.summary.errors > 0) {
      message.error('Resolva os erros de validação antes de publicar.')
      return
    }

    const now = new Date().toISOString()

    const publishSnapshot: WorkflowSnapshot = {
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      accountId: workflow.accountId,
      accountName: workflow.accountName ?? undefined,
      environmentId: workflow.environmentId ?? null,
      environmentName: workflow.environmentName ?? null,
      processId: workflow.processId ?? null,
      processName: workflow.processName ?? null,
      scopeLevel: workflow.scopeLevel,
      tenantId: workflow.tenantId ?? workflow.accountId,
      versionLabel: `Publicação ${workflow.version}`,
      note: 'Snapshot criado na publicação.',
      workflow: buildSnapshotWorkflow(workflow),
      elementConfigs: [...workflow.elementConfigs],
      createdAt: now,
    }

    try {
      await persistWorkflow(
        {
          ...workflow,
          status: 'active',
          publishedAt: now,
          stepsCount: countWorkflowSteps(elements),
          snapshots: [publishSnapshot, ...workflow.snapshots],
        },
        'Workflow publicado com sucesso.',
      )
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ??
        error?.message ??
        'Não foi possível publicar o workflow.'
      message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
    }
  }

  const handleCreateSnapshot = async () => {
    const now = new Date().toISOString()

    const snapshot: WorkflowSnapshot = {
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      accountId: workflow.accountId,
      accountName: workflow.accountName ?? undefined,
      environmentId: workflow.environmentId ?? null,
      environmentName: workflow.environmentName ?? null,
      processId: workflow.processId ?? null,
      processName: workflow.processName ?? null,
      scopeLevel: workflow.scopeLevel,
      tenantId: workflow.tenantId ?? workflow.accountId,
      versionLabel: `${workflow.version} - ${new Date().toLocaleString('pt-BR')}`,
      note: 'Snapshot manual do Workflow Studio.',
      workflow: buildSnapshotWorkflow(workflow),
      elementConfigs: [...workflow.elementConfigs],
      createdAt: now,
    }

    try {
      await persistWorkflow(
        {
          ...workflow,
          snapshots: [snapshot, ...workflow.snapshots],
        },
        'Snapshot criado com sucesso.',
      )
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ??
        error?.message ??
        'Não foi possível criar o snapshot.'
      message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
    }
  }

  const handleRestoreSnapshot = async (snapshotId: string) => {
    const snapshot = workflow.snapshots.find((item) => item.id === snapshotId)

    if (!snapshot) {
      message.error('Snapshot não encontrado.')
      return
    }

    try {
      const saved = await persistWorkflow(
        {
          ...workflow,
          ...snapshot.workflow,
          id: workflow.id,
          elementConfigs: [...snapshot.elementConfigs],
          snapshots: [...workflow.snapshots],
          updatedAt: new Date().toISOString(),
        },
        'Snapshot restaurado com sucesso.',
      )

      form.setFieldsValue({
        name: saved.name,
        description: saved.description,
        version: saved.version,
        status: saved.status,
        documentTypeName: saved.documentTypeName,
      })
    } catch (error: any) {
      const apiMessage =
        error?.response?.data?.message ??
        error?.message ??
        'Não foi possível restaurar o snapshot.'
      message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
    }
  }

  const applySelectedElementColor = (entry: ColorEntry) => {
    if (!selectedElement) return
    bpmnColorRef.current?.(selectedElement.id, entry)
    message.success(`Cor "${entry.label}" aplicada.`)
  }

  const modalItems: TabsProps['items'] = [
    {
      key: 'config',
      label: (
        <Space size={6}>
          <EditOutlined />
          <span>Configuração</span>
        </Space>
      ),
      children: (
        <div style={{ padding: '0 4px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          <WorkflowElementConfigPanel
            workflowId={workflow.id}
            bpmnXml={workflow.bpmnXml ?? ''}
            selectedElement={selectedElement}
            initialConfig={currentElementConfig}
            elementConfigs={elementConfigs}
            scopeContext={scopeContext}
            onSave={async (values) => {
              if (!selectedElement) return

              const now = new Date().toISOString()
              const typedValues = values as Partial<WorkflowElementConfig>

              const finalName =
                elementNameInput.trim() ||
                selectedElement.name ||
                typedValues?.elementName ||
                selectedElement.id

              if (finalName && finalName !== selectedElement.name) {
                bpmnRenameRef.current?.(selectedElement.id, finalName)
              }

              const nextConfig: WorkflowElementConfig = {
                ...(currentElementConfig ?? {}),
                ...(typedValues as WorkflowElementConfig),
                id: currentElementConfig?.id ?? crypto.randomUUID(),
                workflowId: workflow.id,
                accountId: workflow.accountId,
                accountName: workflow.accountName ?? undefined,
                environmentId: workflow.environmentId ?? null,
                environmentName: workflow.environmentName ?? null,
                processId: workflow.processId ?? null,
                processName: workflow.processName ?? null,
                scopeLevel: workflow.scopeLevel,
                tenantId: workflow.tenantId ?? workflow.accountId,
                elementId: selectedElement.id,
                elementType: String((selectedElement as any)?.type ?? selectedElement.kind),
                elementName: finalName,
                kind: selectedElement.kind as WorkflowElementKind,
                config: resolveElementConfigValue(
                  selectedElement.kind as WorkflowElementKind,
                  typedValues,
                  currentElementConfig,
                ),
                createdAt: currentElementConfig?.createdAt ?? now,
                updatedAt: now,
              }

              try {
                const saved = await persistWorkflow(
                  {
                    ...workflow,
                    elementConfigs: upsertElementConfigInList(
                      workflow.elementConfigs,
                      nextConfig,
                    ),
                  },
                  'Configuração salva.',
                )

                setSelectedElement((prev) =>
                  prev ? { ...prev, name: finalName } : prev,
                )
                setElementNameInput(finalName)
                setWorkflow(saved)
                setConfigModalOpen(false)
              } catch (error: any) {
                const apiMessage =
                  error?.response?.data?.message ??
                  error?.message ??
                  'Não foi possível salvar a configuração do elemento.'
                message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
              }
            }}
          />
        </div>
      ),
    },
    {
      key: 'colors',
      label: (
        <Space size={6}>
          <BgColorsOutlined />
          <span>Cores</span>
        </Space>
      ),
      children: (
        <ColorPaletteTab
          selectedElement={selectedElement}
          onApplyColor={applySelectedElementColor}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f7fb', minHeight: '100vh' }}>
      <Space
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>
            {processId ? 'Voltar ao processo' : 'Voltar'}
          </Button>
          <div>
            <Title level={3} style={{ margin: 0 }}>Workflow Studio</Title>
            <Text type="secondary">
              Modelagem BPMN, configuração operacional, validação e versionamento.
            </Text>
          </div>
        </Space>
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/workflows/${workflow.id}`)}>
            Ver detalhes
          </Button>
          <Button icon={<HistoryOutlined />} onClick={handleCreateSnapshot}>
            Snapshot
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSaveNow} loading={saveMutation.isPending}>
            Salvar
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handlePublish}
            loading={saveMutation.isPending}
          >
            Publicar
          </Button>
        </Space>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 16 }}
        message="Workflow Studio"
        description="Clique para selecionar um elemento e dê duplo clique para abrir o modal de configuração."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card variant="borderless" style={{ borderRadius: 18 }}>
            <Descriptions column={1} size="small" title="Status do workflow">
              <Descriptions.Item label="Situação">
                <Tag color={getStatusColor(workflow.status)}>{workflow.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Versão">
                <Tag color="blue">{workflow.version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Elementos relevantes">
                {validation.summary.totalRelevantElements}
              </Descriptions.Item>
              <Descriptions.Item label="Elementos configurados">
                {validation.summary.configuredRelevantElements}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card variant="borderless" style={{ borderRadius: 18 }} title="Dados gerais">
            <Form<WorkflowStudioFormValues>
              form={form}
              layout="vertical"
              onValuesChange={(_, values) => {
                setWorkflow((prev) =>
                  prev ? {
                    ...prev,
                    name: values.name ?? prev.name,
                    description: values.description,
                    version: values.version ?? prev.version,
                    status: values.status ?? prev.status,
                    documentTypeName: values.documentTypeName,
                    updatedAt: new Date().toISOString(),
                  } : prev,
                )
              }}
            >
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="Nome do workflow" name="name" rules={[{ required: true }]}>
                    <Input id="workflow-studio-name" autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item label="Versão" name="version">
                    <Input id="workflow-studio-version" autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item label="Status" name="status">
                    <Select id="workflow-studio-status" options={STATUS_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="Tipo documental" name="documentTypeName">
                    <Input id="workflow-studio-document-type" autoComplete="off" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Descrição" name="description">
                    <Input.TextArea id="workflow-studio-description" autoComplete="off" rows={2} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card
        variant="borderless"
        style={{ borderRadius: 20 }}
        title={<Space><EditOutlined /><span>Modelador BPMN</span></Space>}
        extra={
          <Space>
            <Button
              size="small"
              onClick={() => openElementModal(selectedElement, 'config')}
              disabled={!selectedElement?.isConfigurable}
            >
              {selectedElement?.isConfigurable
                ? `Configurar: ${selectedElement.name || selectedElement.id}`
                : 'Selecione um elemento'}
            </Button>
            <Button
              size="small"
              icon={<BgColorsOutlined />}
              onClick={() => openElementModal(selectedElement, 'colors')}
              disabled={!selectedElement?.isConfigurable}
            >
              Cores
            </Button>
          </Space>
        }
      >
        <BpmnEditor
          renameRef={bpmnRenameRef}
          colorRef={bpmnColorRef}
          initialXml={workflow.bpmnXml}
          onChange={(xml) => {
            setWorkflow((prev) => {
              if (!prev || prev.bpmnXml === xml) return prev
              return { ...prev, bpmnXml: xml, updatedAt: new Date().toISOString() }
            })
          }}
          onSelectionChange={(el) => {
            setSelectedElement(el)
            setElementNameInput(el?.name || '')
          }}
          onElementDoubleClick={(el) => openElementModal(el, 'config')}
          onElementsChange={(nextElements) => {
            setElements(nextElements)

            if (selectedElement && !nextElements.some((i) => i.id === selectedElement.id)) {
              setSelectedElement(null)
              setConfigModalOpen(false)
            }

            const nextSignature = buildSupportedElementSignature(nextElements)
            if (nextSignature === lastElementSignatureRef.current) return
            lastElementSignatureRef.current = nextSignature

            const validIds = new Set(
              nextElements
                .filter((i) => i.kind !== 'unsupported')
                .map((i) => i.id),
            )

            setWorkflow((prev) => {
              if (!prev) return prev

              const nextConfigs = prev.elementConfigs.filter((cfg) =>
                validIds.has(cfg.elementId),
              )

              if (nextConfigs.length === prev.elementConfigs.length) return prev

              return {
                ...prev,
                elementConfigs: nextConfigs,
                updatedAt: new Date().toISOString(),
              }
            })
          }}
        />
      </Card>

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'validation',
            label: 'Validação',
            children: <WorkflowValidationPanel validation={validation} />,
          },
          {
            key: 'versions',
            label: 'Versões',
            children: (
              <WorkflowVersionsPanel
                snapshots={snapshots}
                onCreateSnapshot={handleCreateSnapshot}
                onRestoreSnapshot={handleRestoreSnapshot}
              />
            ),
          },
        ]}
      />

      <Modal
        open={configModalOpen}
        onCancel={() => setConfigModalOpen(false)}
        footer={null}
        width={760}
        destroyOnClose={false}
        closeIcon={null}
        styles={{
          container: { padding: 0, borderRadius: 20, overflow: 'hidden' },
          body: { padding: 0 },
        }}
        title={null}
      >
        {selectedElement && (
          <>
            <div style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
              padding: '24px 28px 20px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

              <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                <Space align="center" size={14}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 20,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    <ElementKindIcon kind={selectedElement.kind} />
                  </div>

                  <div>
                    <Input
                      value={elementNameInput}
                      onChange={(e) => setElementNameInput(e.target.value)}
                      onBlur={(e) => {
                        const newName = e.target.value.trim()
                        if (newName && newName !== selectedElement.name) {
                          bpmnRenameRef.current?.(selectedElement.id, newName)
                          setSelectedElement((prev) => prev ? { ...prev, name: newName } : prev)
                        }
                      }}
                      onPressEnter={(e) => {
                        const newName = (e.target as HTMLInputElement).value.trim()
                        if (newName && newName !== selectedElement.name) {
                          bpmnRenameRef.current?.(selectedElement.id, newName)
                          setSelectedElement((prev) => prev ? { ...prev, name: newName } : prev)
                        }
                        ; (e.target as HTMLInputElement).blur()
                      }}
                      placeholder="Nome do elemento..."
                      variant="borderless"
                      style={{
                        color: '#fff',
                        fontSize: 17,
                        fontWeight: 700,
                        padding: '0 4px',
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.15)',
                        maxWidth: 420,
                        width: 420,
                        caretColor: '#fff',
                      }}
                    />

                    <Space size={6} style={{ marginTop: 6 }}>
                      <Tag style={{
                        margin: 0,
                        background: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.20)',
                        color: '#e2e8f0',
                        borderRadius: 6,
                        fontSize: 11,
                        padding: '0 8px',
                      }}>
                        {getElementKindLabel(selectedElement.kind)}
                      </Tag>
                      <Tag style={{
                        margin: 0,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#94a3b8',
                        borderRadius: 6,
                        fontSize: 11,
                        padding: '0 8px',
                      }}>
                        {selectedElement.id}
                      </Tag>
                      {currentElementConfig
                        ? <Badge status="success" text={<span style={{ color: '#86efac', fontSize: 11 }}>Configurado</span>} />
                        : <Badge status="warning" text={<span style={{ color: '#fbbf24', fontSize: 11 }}>Sem configuração</span>} />}
                    </Space>
                  </div>
                </Space>

                <Button
                  type="text"
                  size="small"
                  onClick={() => setConfigModalOpen(false)}
                  style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, lineHeight: 1, padding: '4px 8px', marginTop: -2 }}
                >
                  ✕
                </Button>
              </Space>
            </div>

            <Tabs
              activeKey={modalTabKey}
              onChange={(key) => setModalTabKey(key as 'config' | 'colors')}
              items={modalItems}
              tabBarStyle={{
                margin: 0,
                paddingLeft: 20,
                paddingRight: 20,
                borderBottom: '1px solid #f1f5f9',
                background: '#fafbfc',
              }}
            />
          </>
        )}
      </Modal>
    </div>
  )
}