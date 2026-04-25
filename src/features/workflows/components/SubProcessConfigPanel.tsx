import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd'
import {
  ApartmentOutlined,
  BranchesOutlined,
  TableOutlined,
} from '@ant-design/icons'

import { api } from '../../../api/client'

import type {
  SystemTaskConfig,
  WorkflowElementConfig,
} from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

type SubProcessConfigPanelProps = {
  workflowId: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  workflowElementConfigs?: WorkflowElementConfig[]
  currentProcessId?: string | null
  currentProcessName?: string | null
  onSave: (values: ElementConfigSavePayload) => void
}

type ProcessOption = {
  id: string
  name: string
  code?: string
  description?: string
}

type WorkflowRuntimeInfo = {
  id: string
  publicId?: string
  processId?: string | null
  processName?: string | null
  name?: string
}

type MetadataDefinitionOption = {
  id: string
  name?: string
  label?: string
  fieldType?: string
  type?: string
  dataType?: string
  kind?: string
  inputType?: string
  metadataSetId?: string
  metadataSetName?: string
  tableColumns?: any[]
  columns?: any[]
  processId?: string
}

type SourceTableOption = {
  id: string
  label: string
  name?: string
  activityId: string
  activityName: string
  metadataSetId?: string
  metadataSetName?: string
  processId?: string
}

// Política de espera dos filhos
type WaitPolicy = 'all' | 'any' | 'none'

type FormValues = {
  childProcessId?: string
  childProcessName?: string
  waitForCompletion: boolean
  waitPolicy: WaitPolicy
  copyParentMetadata: boolean
  copyParentAttachments: boolean
  sourceTableFieldIds: string[]
  auditNote?: string
  notificationTemplateIds: string[]
}

const DEFAULT_VALUES: FormValues = {
  childProcessId: undefined,
  childProcessName: undefined,
  waitForCompletion: true,
  waitPolicy: 'all',
  copyParentMetadata: true,
  copyParentAttachments: false,
  sourceTableFieldIds: [],
  auditNote: undefined,
  notificationTemplateIds: [],
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#94a3b8',
  marginBottom: 12,
  display: 'block',
}

function normalizeApiList<T = any>(payload: any): T[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  if (Array.isArray(payload?.data?.data)) return payload.data.data
  if (Array.isArray(payload?.values)) return payload.values

  return []
}

function normalizeApiObject(payload: any): any {
  if (!payload) return null

  if (payload?.data && !Array.isArray(payload.data)) return payload.data
  if (payload?.item && !Array.isArray(payload.item)) return payload.item
  if (payload?.workflow && !Array.isArray(payload.workflow)) {
    return payload.workflow
  }

  return payload
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function isSameValue(a?: string | null, b?: string | null) {
  const normalizedA = normalizeText(a)
  const normalizedB = normalizeText(b)

  return normalizedA !== '' && normalizedB !== '' && normalizedA === normalizedB
}

function normalizeProcessOption(item: any): ProcessOption | null {
  const id = String(
    item?.id ??
      item?.publicId ??
      item?.public_id ??
      item?.processId ??
      item?.process_id ??
      item?.value ??
      '',
  ).trim()

  if (!id) return null

  const name = String(
    item?.name ??
      item?.processName ??
      item?.process_name ??
      item?.title ??
      item?.label ??
      'Processo sem nome',
  ).trim()

  return {
    id,
    name,
    code:
      typeof item?.code === 'string'
        ? item.code
        : typeof item?.processCode === 'string'
          ? item.processCode
          : undefined,
    description:
      typeof item?.description === 'string' ? item.description : undefined,
  }
}

function normalizeWorkflowRuntimeInfo(item: any): WorkflowRuntimeInfo | null {
  const id = String(
    item?.id ??
      item?.workflowId ??
      item?.workflow_id ??
      item?.publicId ??
      item?.public_id ??
      '',
  ).trim()

  if (!id) return null

  return {
    id,
    publicId:
      typeof item?.publicId === 'string'
        ? item.publicId
        : typeof item?.public_id === 'string'
          ? item.public_id
          : undefined,
    processId:
      item?.processId ??
      item?.process_id ??
      item?.process?.id ??
      item?.process?.publicId ??
      item?.process?.public_id ??
      null,
    processName:
      item?.processName ??
      item?.process_name ??
      item?.process?.name ??
      null,
    name: item?.name,
  }
}

function normalizeMetadataDefinitionOption(
  item: any,
): MetadataDefinitionOption | null {
  const id = String(
    item?.id ??
      item?.metadataDefinitionId ??
      item?.metadata_definition_id ??
      item?.definitionId ??
      item?.definition_id ??
      item?.value ??
      '',
  ).trim()

  if (!id) return null

  return {
    id,
    name:
      typeof item?.name === 'string'
        ? item.name
        : typeof item?.internalName === 'string'
          ? item.internalName
          : typeof item?.internal_name === 'string'
            ? item.internal_name
            : undefined,
    label:
      typeof item?.label === 'string'
        ? item.label
        : typeof item?.title === 'string'
          ? item.title
          : undefined,
    fieldType:
      typeof item?.fieldType === 'string'
        ? item.fieldType
        : typeof item?.field_type === 'string'
          ? item.field_type
          : undefined,
    type: typeof item?.type === 'string' ? item.type : undefined,
    dataType:
      typeof item?.dataType === 'string'
        ? item.dataType
        : typeof item?.data_type === 'string'
          ? item.data_type
          : undefined,
    kind: typeof item?.kind === 'string' ? item.kind : undefined,
    inputType:
      typeof item?.inputType === 'string'
        ? item.inputType
        : typeof item?.input_type === 'string'
          ? item.input_type
          : undefined,
    metadataSetId:
      typeof item?.metadataSetId === 'string'
        ? item.metadataSetId
        : typeof item?.metadata_set_id === 'string'
          ? item.metadata_set_id
          : undefined,
    metadataSetName:
      typeof item?.metadataSetName === 'string'
        ? item.metadataSetName
        : typeof item?.metadata_set_name === 'string'
          ? item.metadata_set_name
          : undefined,
    tableColumns: Array.isArray(item?.tableColumns)
      ? item.tableColumns
      : Array.isArray(item?.table_columns)
        ? item.table_columns
        : undefined,
    columns: Array.isArray(item?.columns) ? item.columns : undefined,
    processId:
      typeof item?.processId === 'string'
        ? item.processId
        : typeof item?.process_id === 'string'
          ? item.process_id
          : undefined,
  }
}

function metadataDefinitionToSourceTableOption(
  definition: MetadataDefinitionOption,
): SourceTableOption {
  return {
    id: String(definition.id),
    label: String(
      definition.label ?? definition.name ?? `Tabela ${definition.id}`,
    ),
    name: definition.name,
    activityId: 'process-metadata-values',
    activityName: 'Tabela vinculada ao processo',
    metadataSetId: definition.metadataSetId,
    metadataSetName: definition.metadataSetName,
    processId: definition.processId,
  }
}

function getProcessIdFromInitialConfig(
  initialConfig: WorkflowElementConfig | null,
) {
  return String(
    (initialConfig as any)?.processId ??
      (initialConfig as any)?.process_id ??
      (initialConfig as any)?.config?.processId ??
      (initialConfig as any)?.config?.process_id ??
      '',
  ).trim()
}

function getProcessNameFromInitialConfig(
  initialConfig: WorkflowElementConfig | null,
) {
  return String(
    (initialConfig as any)?.processName ??
      (initialConfig as any)?.process_name ??
      (initialConfig as any)?.config?.processName ??
      (initialConfig as any)?.config?.process_name ??
      '',
  ).trim()
}

function getProcessIdFromElementConfigs(
  workflowElementConfigs?: WorkflowElementConfig[],
) {
  const found = workflowElementConfigs
    ?.map((item: any) => item?.processId ?? item?.process_id)
    .find(Boolean)

  return found ? String(found).trim() : ''
}

function getProcessNameFromElementConfigs(
  workflowElementConfigs?: WorkflowElementConfig[],
) {
  const found = workflowElementConfigs
    ?.map((item: any) => item?.processName ?? item?.process_name)
    .find(Boolean)

  return found ? String(found).trim() : ''
}

function extractSavedConfig(initialConfig: WorkflowElementConfig | null) {
  const rawConfig = (initialConfig as any)?.config

  if (!rawConfig) {
    return null
  }

  if (rawConfig?.actionType === 'create-subprocess') {
    return rawConfig as SystemTaskConfig
  }

  if (rawConfig?.subprocess) {
    return {
      actionType: 'create-subprocess',
      auditNote: rawConfig.auditNote,
      notificationTemplateIds: rawConfig.notificationTemplateIds ?? [],
      subprocess: rawConfig.subprocess,
    } as SystemTaskConfig
  }

  return null
}

/**
 * Deriva waitForCompletion a partir de waitPolicy.
 * 'none' → false (não aguarda)
 * 'all' | 'any' → true (aguarda)
 */
function waitPolicyToWaitForCompletion(policy: WaitPolicy): boolean {
  return policy !== 'none'
}

export function SubProcessConfigPanel({
  workflowId,
  selectedElement,
  initialConfig,
  workflowElementConfigs = [],
  currentProcessId,
  currentProcessName,
  onSave,
}: SubProcessConfigPanelProps) {
  const [form] = Form.useForm<FormValues>()

  const [processes, setProcesses] = useState<ProcessOption[]>([])
  const [loadingProcesses, setLoadingProcesses] = useState(false)

  const [workflowInfo, setWorkflowInfo] = useState<WorkflowRuntimeInfo | null>(
    null,
  )
  const [loadingWorkflowInfo, setLoadingWorkflowInfo] = useState(false)

  const [metadataDefinitions, setMetadataDefinitions] = useState<
    MetadataDefinitionOption[]
  >([])
  const [loadingMetadataDefinitions, setLoadingMetadataDefinitions] =
    useState(false)

  const sourceTableFieldIds = Form.useWatch('sourceTableFieldIds', form) ?? []
  const childProcessId = Form.useWatch('childProcessId', form)
  const childProcessName = Form.useWatch('childProcessName', form)
  const waitPolicy = Form.useWatch('waitPolicy', form) ?? 'all'

  const resolvedCurrentProcessId = useMemo(() => {
    const fromProp = String(currentProcessId ?? '').trim()
    if (fromProp) return fromProp

    const fromWorkflow = String(workflowInfo?.processId ?? '').trim()
    if (fromWorkflow) return fromWorkflow

    const fromInitial = getProcessIdFromInitialConfig(initialConfig)
    if (fromInitial) return fromInitial

    const fromConfigs = getProcessIdFromElementConfigs(workflowElementConfigs)
    if (fromConfigs) return fromConfigs

    return ''
  }, [currentProcessId, workflowInfo, initialConfig, workflowElementConfigs])

  const resolvedCurrentProcessName = useMemo(() => {
    const fromProp = String(currentProcessName ?? '').trim()
    if (fromProp) return fromProp

    const fromWorkflow = String(workflowInfo?.processName ?? '').trim()
    if (fromWorkflow) return fromWorkflow

    const fromInitial = getProcessNameFromInitialConfig(initialConfig)
    if (fromInitial) return fromInitial

    const fromConfigs = getProcessNameFromElementConfigs(workflowElementConfigs)
    if (fromConfigs) return fromConfigs

    return ''
  }, [currentProcessName, workflowInfo, initialConfig, workflowElementConfigs])

  const processSelectOptions = useMemo(() => {
    return processes
      .filter((process) => {
        const sameById = isSameValue(process.id, resolvedCurrentProcessId)
        const sameByName = isSameValue(process.name, resolvedCurrentProcessName)

        return !sameById && !sameByName
      })
      .map((process) => ({
        label: process.name,
        value: process.id,
        description: process.description,
      }))
  }, [processes, resolvedCurrentProcessId, resolvedCurrentProcessName])

  const sourceTableOptions = useMemo(() => {
    return metadataDefinitions.map(metadataDefinitionToSourceTableOption)
  }, [metadataDefinitions])

  useEffect(() => {
    if (!selectedElement) return

    const saved = extractSavedConfig(initialConfig)

    // Deriva waitPolicy a partir do config salvo
    const savedWaitPolicy: WaitPolicy =
      (saved?.subprocess as any)?.waitPolicy ??
      (saved?.subprocess?.waitForCompletion === false ? 'none' : 'all')

    form.setFieldsValue({
      childProcessId:
        saved?.subprocess?.childProcessId ?? DEFAULT_VALUES.childProcessId,
      childProcessName:
        saved?.subprocess?.childProcessName ?? DEFAULT_VALUES.childProcessName,
      waitForCompletion:
        saved?.subprocess?.waitForCompletion ??
        DEFAULT_VALUES.waitForCompletion,
      waitPolicy: savedWaitPolicy,
      copyParentMetadata:
        saved?.subprocess?.copyParentMetadata ??
        DEFAULT_VALUES.copyParentMetadata,
      copyParentAttachments:
        saved?.subprocess?.copyParentAttachments ??
        DEFAULT_VALUES.copyParentAttachments,
      sourceTableFieldIds:
        saved?.subprocess?.sourceTableFieldIds ??
        DEFAULT_VALUES.sourceTableFieldIds,
      auditNote: saved?.auditNote ?? DEFAULT_VALUES.auditNote,
      notificationTemplateIds:
        saved?.notificationTemplateIds ?? DEFAULT_VALUES.notificationTemplateIds,
    })
  }, [form, initialConfig, selectedElement])

  useEffect(() => {
    if (!selectedElement) return
    if (!workflowId) return

    let isMounted = true

    async function loadWorkflowInfo() {
      try {
        setLoadingWorkflowInfo(true)

        let resolved: WorkflowRuntimeInfo | null = null

        try {
          const detailResponse = await api.get(`/workflows/${workflowId}`)
          const detailPayload = normalizeApiObject(detailResponse.data)
          resolved = normalizeWorkflowRuntimeInfo(detailPayload)
        } catch (detailError) {
          console.warn(
            '[SubProcessConfigPanel] Falha ao buscar workflow por ID, tentando lista:',
            detailError,
          )
        }

        if (!resolved) {
          const listResponse = await api.get('/workflows')
          const list = normalizeApiList(listResponse.data)

          const workflow = list.find((item: any) => {
            return (
              String(item?.id ?? '') === String(workflowId) ||
              String(item?.publicId ?? '') === String(workflowId) ||
              String(item?.public_id ?? '') === String(workflowId)
            )
          })

          resolved = normalizeWorkflowRuntimeInfo(workflow)
        }

        if (!isMounted) return

        setWorkflowInfo(resolved)
      } catch (error) {
        console.error(
          '[SubProcessConfigPanel] Erro ao buscar workflow atual:',
          error,
        )

        if (!isMounted) return

        setWorkflowInfo(null)
      } finally {
        if (isMounted) {
          setLoadingWorkflowInfo(false)
        }
      }
    }

    loadWorkflowInfo()

    return () => {
      isMounted = false
    }
  }, [selectedElement, workflowId])

  useEffect(() => {
    if (!selectedElement) return

    let isMounted = true

    async function loadProcesses() {
      try {
        setLoadingProcesses(true)

        const response = await api.get('/processes')

        const list = normalizeApiList(response.data)
          .map(normalizeProcessOption)
          .filter(Boolean) as ProcessOption[]

        if (!isMounted) return

        setProcesses(list)
      } catch (error) {
        console.error('[SubProcessConfigPanel] Erro ao buscar processos:', error)

        if (!isMounted) return

        setProcesses([])
      } finally {
        if (isMounted) {
          setLoadingProcesses(false)
        }
      }
    }

    loadProcesses()

    return () => {
      isMounted = false
    }
  }, [selectedElement])

  useEffect(() => {
    if (!selectedElement) return

    if (!resolvedCurrentProcessId) {
      setMetadataDefinitions([])
      return
    }

    let isMounted = true

    async function loadTableDefinitionsByProcess() {
      try {
        setLoadingMetadataDefinitions(true)

        const response = await api.get('/metadata/table-definitions', {
          params: {
            processId: resolvedCurrentProcessId,
          },
        })

        const list = normalizeApiList(response.data)
          .map(normalizeMetadataDefinitionOption)
          .filter(Boolean) as MetadataDefinitionOption[]

        if (!isMounted) return

        setMetadataDefinitions(list)
      } catch (error) {
        console.error(
          '[SubProcessConfigPanel] Erro ao buscar metadados tabela do processo:',
          error,
        )

        if (!isMounted) return

        setMetadataDefinitions([])
      } finally {
        if (isMounted) {
          setLoadingMetadataDefinitions(false)
        }
      }
    }

    loadTableDefinitionsByProcess()

    return () => {
      isMounted = false
    }
  }, [selectedElement, resolvedCurrentProcessId])

  useEffect(() => {
    if (!selectedElement) return

    console.log('[SubProcessConfigPanel] Debug subprocesso =>', {
      workflowId,
      selectedElementId: selectedElement?.id,
      currentProcessId,
      currentProcessName,
      workflowInfo,
      loadingWorkflowInfo,
      resolvedCurrentProcessId,
      resolvedCurrentProcessName,
      processes,
      processSelectOptions,
      metadataDefinitions,
      sourceTableOptions,
      sourceTableFieldIds,
    })
  }, [
    selectedElement,
    workflowId,
    currentProcessId,
    currentProcessName,
    workflowInfo,
    loadingWorkflowInfo,
    resolvedCurrentProcessId,
    resolvedCurrentProcessName,
    processes,
    processSelectOptions,
    metadataDefinitions,
    sourceTableOptions,
    sourceTableFieldIds,
  ])

  if (!selectedElement) {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty description="Selecione um subprocesso no fluxo" />
      </Card>
    )
  }

  const handleChildProcessChange = (processId?: string) => {
    const selectedProcess = processes.find((process) => process.id === processId)

    form.setFieldsValue({
      childProcessId: selectedProcess?.id,
      childProcessName: selectedProcess?.name,
    })
  }

  const handleToggleSourceTable = (fieldId: string, checked: boolean) => {
    const currentValues = form.getFieldValue('sourceTableFieldIds') ?? []

    const nextValues = checked
      ? Array.from(new Set([...currentValues, fieldId]))
      : currentValues.filter((id: string) => id !== fieldId)

    form.setFieldsValue({
      sourceTableFieldIds: nextValues,
    })

    form.validateFields(['sourceTableFieldIds']).catch(() => {
      // Apenas força validação visual do campo hidden.
    })
  }

  const handleSubmit = (values: FormValues) => {
    // waitForCompletion é derivado de waitPolicy para manter compatibilidade
    const resolvedWaitForCompletion = waitPolicyToWaitForCompletion(
      values.waitPolicy ?? 'all',
    )

    const normalizedConfig: SystemTaskConfig = {
      actionType: 'create-subprocess',
      auditNote: values.auditNote,
      notificationTemplateIds: values.notificationTemplateIds ?? [],
      subprocess: {
        childProcessId: values.childProcessId,
        childProcessName: values.childProcessName,
        waitForCompletion: resolvedWaitForCompletion,
        // waitPolicy é usado pelo motor para preencher a tabela document_subprocess_relations:
        // 'all'  → wait_policy = 'all'  (pai retoma quando TODOS os filhos concluírem)
        // 'any'  → wait_policy = 'any'  (pai retoma quando QUALQUER filho concluir)
        // 'none' → wait_policy = 'none' (pai continua imediatamente, não aguarda)
        waitPolicy: values.waitPolicy ?? 'all',
        copyParentMetadata: values.copyParentMetadata ?? true,
        copyParentAttachments: values.copyParentAttachments ?? false,
        sourceTableFieldIds: values.sourceTableFieldIds ?? [],
        // Sinaliza ao motor que deve criar 1 documento filho por linha da tabela selecionada.
        // Para cada linha: o motor insere 1 registro em document_subprocess_relations com:
        //   - source_table_metadata_definition_id = sourceTableFieldIds[i]
        //   - source_row_index  = índice da linha (0-based)
        //   - source_row_key    = chave/id da linha (se disponível)
        //   - source_row_value  = jsonb com todos os dados da linha
        //   - relation_type     = 'subprocess-from-table-row'
        //   - parent_process_id / parent_process_name = processo pai (resolvido abaixo)
        //   - child_process_id  / child_process_name  = processo filho selecionado
        //   - wait_for_completion / wait_policy        = conforme configurado acima
        //   - status            = 'pending' (atualizado para 'completed' quando filho concluir)
        createOnePerRow: true,
        relationType: 'subprocess-from-table-row',
        // Dados do processo pai — necessários para preencher as colunas
        // parent_process_id e parent_process_name na tabela document_subprocess_relations
        parentProcessId: resolvedCurrentProcessId || undefined,
        parentProcessName: resolvedCurrentProcessName || undefined,
      } as any,
    }

    onSave({
      workflowId,
      elementId: selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'system-task',
      config: normalizedConfig,
    })
  }

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 18 }}
      title={
        <Space>
          <BranchesOutlined style={{ color: '#1677ff' }} />
          <span>Configuração do subprocesso</span>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={selectedElement.name || 'Subprocesso'}
        description="Ao chegar neste elemento, o motor criará um documento filho para cada linha da tabela selecionada e registrará o vínculo pai-filho na tabela document_subprocess_relations."
      />

      <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
        {/* ── Processo filho ──────────────────────────────────────────── */}
        <Text style={sectionLabelStyle}>Processo a ser criado</Text>

        <Form.Item
          label="Processo filho"
          name="childProcessId"
          rules={[
            {
              required: true,
              message: 'Selecione o processo que será criado.',
            },
          ]}
        >
          <Select
            showSearch
            allowClear
            loading={loadingProcesses}
            placeholder="Selecione o processo que será criado"
            optionFilterProp="label"
            options={processSelectOptions}
            notFoundContent={
              loadingProcesses ? <Spin size="small" /> : 'Nenhum processo disponível'
            }
            onChange={handleChildProcessChange}
          />
        </Form.Item>

        <Form.Item name="childProcessName" hidden>
          <Input />
        </Form.Item>

        {loadingWorkflowInfo && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16, borderRadius: 10 }}
            message="Identificando processo atual..."
            description="O sistema está buscando o workflow para descobrir o process_id vinculado."
          />
        )}

        {!loadingWorkflowInfo &&
          (resolvedCurrentProcessId || resolvedCurrentProcessName) && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
              message="O processo atual não é exibido na seleção."
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Processo atual identificado:{' '}
                  {resolvedCurrentProcessName || resolvedCurrentProcessId}
                </Text>
              }
            />
          )}

        {!loadingWorkflowInfo && !resolvedCurrentProcessId && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16, borderRadius: 10 }}
            message="Processo atual não identificado"
            description="Não foi possível localizar process_id no workflow atual. Verifique se o endpoint /workflows/:id retorna process_id/processId."
          />
        )}

        {/* ── Controle do fluxo pai ────────────────────────────────────── */}
        <Text style={sectionLabelStyle}>Controle do fluxo pai</Text>

        {/*
          waitPolicy controla:
          - o comportamento do pai após disparar os subprocessos
          - a coluna wait_policy na tabela document_subprocess_relations
          - a coluna wait_for_completion (derivada: 'none' → false, demais → true)
        */}
        <Form.Item
          label="Política de espera dos filhos"
          name="waitPolicy"
          initialValue="all"
          tooltip="Define quando o processo pai deve retomar após criar os subprocessos. Afeta as colunas wait_policy e wait_for_completion na tabela document_subprocess_relations."
        >
          <Select
            options={[
              {
                value: 'all',
                label: 'Aguardar TODOS os filhos concluírem',
              },
              {
                value: 'any',
                label: 'Retomar quando QUALQUER filho concluir',
              },
              {
                value: 'none',
                label: 'Não aguardar (dispara e continua imediatamente)',
              },
            ]}
          />
        </Form.Item>

        {/* Campo oculto — mantido para compatibilidade com o motor */}
        <Form.Item name="waitForCompletion" hidden valuePropName="checked">
          <input type="checkbox" />
        </Form.Item>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 10 }}
          message={
            <Space direction="vertical" size={2}>
              {waitPolicy === 'all' && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  O documento pai ficará parado até que <strong>todos</strong> os filhos concluam.
                  <br />
                  <code>wait_for_completion = true</code> / <code>wait_policy = 'all'</code>
                </Text>
              )}
              {waitPolicy === 'any' && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  O documento pai retomará assim que <strong>qualquer</strong> filho concluir.
                  <br />
                  <code>wait_for_completion = true</code> / <code>wait_policy = 'any'</code>
                </Text>
              )}
              {waitPolicy === 'none' && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  O documento pai continua imediatamente após criar os filhos, sem aguardar.
                  <br />
                  <code>wait_for_completion = false</code> / <code>wait_policy = 'none'</code>
                </Text>
              )}
            </Space>
          }
        />

        <Space direction="vertical" size={10} style={{ width: '100%', marginBottom: 16 }}>
          <Form.Item
            name="copyParentMetadata"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Checkbox>Copiar metadados do pai para os filhos</Checkbox>
          </Form.Item>

          <Form.Item
            name="copyParentAttachments"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Checkbox>Copiar anexos do pai para os filhos</Checkbox>
          </Form.Item>
        </Space>

        {/* ── Tabelas que geram subprocessos ──────────────────────────── */}
        <Text style={sectionLabelStyle}>
          Tabelas do processo que geram subprocesso
        </Text>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12, borderRadius: 10 }}
          message="Uma linha = um documento filho"
          description={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Para cada linha das tabelas selecionadas, o motor criará{' '}
              <strong>um documento filho</strong> e registrará o vínculo em{' '}
              <code>document_subprocess_relations</code> com{' '}
              <code>source_row_index</code>, <code>source_row_key</code> e{' '}
              <code>source_row_value</code> (jsonb da linha).
            </Text>
          }
        />

        <Form.Item
          name="sourceTableFieldIds"
          rules={[
            {
              validator: async (_, value: string[] = []) => {
                if (value.length === 0) {
                  throw new Error('Selecione ao menos uma tabela do processo.')
                }
              },
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <Input type="hidden" />
        </Form.Item>

        {/* Bloco de seleção de tabelas — só exibido quando processo filho foi escolhido */}
        {!childProcessId ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16, borderRadius: 10 }}
            message="Selecione o processo filho primeiro"
            description="As tabelas ficam disponíveis após definir qual processo será criado."
          />
        ) : loadingMetadataDefinitions ? (
          <Alert
            type="info"
            showIcon
            message="Buscando tabelas do processo..."
            description="O sistema está consultando os metadados do tipo tabela vinculados ao process_id em metadata_values."
          />
        ) : !resolvedCurrentProcessId ? (
          <Alert
            type="warning"
            showIcon
            message="Não foi possível buscar as tabelas"
            description="O process_id atual não foi identificado no workflow."
          />
        ) : sourceTableOptions.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            message="Nenhuma tabela encontrada para este processo"
            description="Verifique se já existe valor salvo em metadata_values para este process_id e se a metadata_definition correspondente possui field_type = table."
          />
        ) : (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {sourceTableOptions.map((tableField) => {
              const checked = sourceTableFieldIds.includes(tableField.id)

              return (
                <Card
                  key={`${tableField.activityId}-${tableField.id}`}
                  size="small"
                  hoverable
                  onClick={() => handleToggleSourceTable(tableField.id, !checked)}
                  style={{
                    borderRadius: 12,
                    borderColor: checked ? '#13c2c2' : '#e5e7eb',
                    background: checked ? '#ecfeff' : '#ffffff',
                    cursor: 'pointer',
                  }}
                  styles={{
                    body: {
                      padding: '10px 12px',
                    },
                  }}
                >
                  <Space align="start">
                    <Checkbox checked={checked} />
                    <Space direction="vertical" size={2}>
                      <Space>
                        <TableOutlined style={{ color: '#0891b2' }} />
                        <Text strong>{tableField.label}</Text>
                      </Space>

                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Origem: {tableField.activityName}
                      </Text>

                      {tableField.metadataSetName && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Grupo de metadados: {tableField.metadataSetName}
                        </Text>
                      )}

                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ID do metadado:{' '}
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '1px 4px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {tableField.id}
                        </code>
                      </Text>

                      {checked && (
                        <Text
                          type="secondary"
                          style={{ fontSize: 11, color: '#0891b2' }}
                        >
                          ✓ Cada linha desta tabela gerará 1 documento filho em "
                          {childProcessName || childProcessId}"
                        </Text>
                      )}
                    </Space>
                  </Space>
                </Card>
              )
            })}
          </Space>
        )}

        {/* Resumo do que será criado */}
        {sourceTableFieldIds.length > 0 && childProcessId && (
          <Alert
            type="success"
            showIcon
            icon={<ApartmentOutlined />}
            style={{ marginTop: 14, borderRadius: 10 }}
            message="Resumo da criação"
            description={
              <Space direction="vertical" size={2}>
                <Text style={{ fontSize: 12 }}>
                  Para cada linha das{' '}
                  <strong>
                    {sourceTableFieldIds.length} tabela
                    {sourceTableFieldIds.length > 1 ? 's' : ''} selecionada
                    {sourceTableFieldIds.length > 1 ? 's' : ''}
                  </strong>
                  , o motor criará <strong>1 documento filho</strong> no processo{' '}
                  <strong>"{childProcessName || childProcessId}"</strong>.
                </Text>
                <Text style={{ fontSize: 12 }}>
                  Cada criação registra 1 linha em{' '}
                  <code>document_subprocess_relations</code> com{' '}
                  <code>relation_type = 'subprocess-from-table-row'</code>,{' '}
                  <code>source_row_index</code>, <code>source_row_key</code>,{' '}
                  <code>source_row_value</code> e{' '}
                  <code>wait_policy = '{waitPolicy}'</code>.
                </Text>
              </Space>
            }
          />
        )}

        <div style={{ height: 22 }} />

        {/* ── Auditoria e notificações ─────────────────────────────────── */}
        <Text style={sectionLabelStyle}>Auditoria e notificações</Text>

        <Form.Item
          label="Nota de auditoria"
          name="auditNote"
          tooltip="Texto em linguagem de negócio registrado no histórico da instância."
        >
          <Input.TextArea
            rows={3}
            placeholder="Ex.: Cria documentos filhos a partir da tabela selecionada."
          />
        </Form.Item>

        <Form.Item
          label="Notificações após criação dos subprocessos"
          name="notificationTemplateIds"
          tooltip="Templates disparados após o motor criar os documentos filhos."
        >
          <Select
            mode="tags"
            placeholder="Ex.: notif-subprocesso-criado"
          />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          icon={<ApartmentOutlined />}
          style={{
            borderRadius: 8,
            background: '#0f172a',
            borderColor: '#0f172a',
            fontWeight: 600,
          }}
        >
          Salvar configuração do subprocesso
        </Button>
      </Form>
    </Card>
  )
}