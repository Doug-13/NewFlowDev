import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
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
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'

import {
  getMetadataDefinitions,
  type MetadataDefinitionListItem,
} from '../../../api/metadataDefinitions'
import { getMetadataSets, type MetadataSetDto } from '../../../api/metadataSets'
import { getNotificationTemplates } from '../../../api/notificationTemplates'
import type {
  ActivityMetadataFieldRule,
  ScopeContext,
  ScopeLevel,
  StartEventConfig,
  WorkflowElementConfig,
} from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

// ── Types ──────────────────────────────────────────────────────────────────────

type StartEventConfigPanelProps = {
  workflowId: string
  scopeContext: ScopeContext & { scopeLevel: ScopeLevel; processId?: string | null }
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

type FormValues = StartEventConfig

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

export function StartEventConfigPanel({
  workflowId,
  scopeContext,
  selectedElement,
  initialConfig,
  onSave,
}: StartEventConfigPanelProps) {
  const [form] = Form.useForm<FormValues>()

  // ── Metadados: state ───────────────────────────────────────────────────────
  const [selectedMetadataSetIds, setSelectedMetadataSetIds] = useState<string[]>([])
  const [manualMetadataDefinitionIds, setManualMetadataDefinitionIds] = useState<string[]>([])
  const [metadataFieldRules, setMetadataFieldRules] = useState<ActivityMetadataFieldRule[]>([])
  const initializationKeyRef = useRef('')

  // ── API ────────────────────────────────────────────────────────────────────
  const { data: metadataDefinitions = [], isLoading: metadataDefinitionsLoading, isError: metadataDefinitionsError } = useQuery({
    queryKey: ['start-event-metadata-definitions'],
    queryFn: () => getMetadataDefinitions(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: metadataSets = [], isLoading: metadataSetsLoading, isError: metadataSetsError } = useQuery({
    queryKey: ['start-event-metadata-sets'],
    queryFn: () => getMetadataSets(),
    staleTime: 1000 * 60 * 5,
  })

  const { data: notificationTemplates = [] } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: getNotificationTemplates,
    staleTime: 1000 * 60 * 5,
  })

  // ── Computed ───────────────────────────────────────────────────────────────
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

  // ── Sync metadados ─────────────────────────────────────────────────────────
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
    form.setFieldsValue({
      metadataSetIds: nextSetIds,
      initialMetadataDefinitionIds: effectiveIds,
      metadataFields: normalizedFields,
    })
  }

  // ── Inicialização ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedElement || selectedElement.kind !== 'start') return
    if (metadataDefinitionsLoading) return

    const currentKey = [workflowId, selectedElement.id, initialConfig?.updatedAt ?? 'new', metadataDefinitions.length].join('::')
    if (initializationKeyRef.current === currentKey) return

    const cfg = initialConfig?.kind === 'start' ? (initialConfig.config as StartEventConfig) : null

    const initialMetadataFields =
      cfg?.metadataFields && cfg.metadataFields.length > 0
        ? cfg.metadataFields
        : (cfg?.initialMetadataDefinitionIds ?? []).map((id) =>
            createMetadataFieldRule(metadataDefinitionMap.get(id), id),
          )

    const initialDefinitionIds = initialMetadataFields.map((f) => f.metadataDefinitionId)
    const initialSetIds = cfg?.metadataSetIds ?? []
    const idsFromSets = new Set(
      metadataDefinitions
        .filter((d) => !!d.metadataSetId && initialSetIds.includes(d.metadataSetId))
        .map((d) => d.id),
    )
    const initialManualIds = initialDefinitionIds.filter((id) => !idsFromSets.has(id))

    form.setFieldsValue({
      formTitle:                    cfg?.formTitle,
      initialMetadataDefinitionIds: initialDefinitionIds,
      metadataSetIds:               initialSetIds,
      metadataFields:               initialMetadataFields,
      requiredAttachmentTypes:      cfg?.requiredAttachmentTypes ?? [],
      allowedStarterRoleIds:        cfg?.allowedStarterRoleIds   ?? [],
      notificationTemplateIds:      cfg?.notificationTemplateIds ?? [],
      instructions:                 cfg?.instructions,
    })

    setSelectedMetadataSetIds(initialSetIds)
    setManualMetadataDefinitionIds(initialManualIds)
    setMetadataFieldRules(sortMetadataFields(initialMetadataFields))
    initializationKeyRef.current = currentKey
  }, [form, workflowId, selectedElement, initialConfig, metadataDefinitions, metadataDefinitionsLoading, metadataDefinitionMap])

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!selectedElement || selectedElement.kind !== 'start') {
    return <Empty description="Selecione um evento inicial no fluxo" style={{ padding: 32 }} />
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    form.setFieldsValue({ metadataFields: sortMetadataFields(nextFields) })
  }

  const removeMetadataField = (metadataDefinitionId: string) =>
    handleMetadataDefinitionsChange(selectedMetadataDefinitionIds.filter((id) => id !== metadataDefinitionId))

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (values: FormValues) => {
    const normalizedFields = sortMetadataFields(
      resolvedMetadataFields.filter((f) => f.metadataDefinitionId),
    )
    onSave({
      workflowId,
      elementId:   selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'start',
      config: {
        initialMetadataDefinitionIds: normalizedFields.map((f) => f.metadataDefinitionId),
        metadataSetIds:               selectedMetadataSetIds,
        metadataFields:               normalizedFields,
        requiredAttachmentTypes:      values.requiredAttachmentTypes ?? [],
        notificationTemplateIds:      values.notificationTemplateIds ?? [],
        allowedStarterRoleIds:        values.allowedStarterRoleIds   ?? [],
        instructions:                 values.instructions,
        formTitle:                    values.formTitle,
      } satisfies StartEventConfig,
    })
  }

  // ── Notification options ───────────────────────────────────────────────────
  const notificationOptions = notificationTemplates
    .filter((t) =>
      !scopeContext.processId ||
      !(t as any).processId ||
      (t as any).processId === scopeContext.processId,
    )
    .map((t) => ({ value: t.id, label: t.name }))

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

          // ── ABA: CONFIGURAÇÃO ──────────────────────────────────────────────
          {
            key: 'config',
            label: <Space size={6}><PlayCircleOutlined /><span>Configuração</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Formulário de abertura</Text>
                <Form.Item label="Título do formulário" name="formTitle" style={{ marginBottom: 16 }}>
                  <Input placeholder="Ex.: Abertura de solicitação" />
                </Form.Item>

                <Text style={sectionLabelStyle}>Acesso</Text>
                <Form.Item label="Perfis que podem iniciar" name="allowedStarterRoleIds" style={{ marginBottom: 16 }}>
                  <Select
                    mode="tags"
                    placeholder="Ex.: solicitante, gestor, qualidade"
                  />
                </Form.Item>

                <Text style={sectionLabelStyle}>Anexos</Text>
                <Form.Item label="Tipos de anexo obrigatórios" name="requiredAttachmentTypes" style={{ marginBottom: 16 }}>
                  <Select
                    mode="tags"
                    placeholder="Ex.: pdf, imagem, contrato-base"
                  />
                </Form.Item>

                <Text style={sectionLabelStyle}>Instruções</Text>
                <Form.Item label="Instruções iniciais" name="instructions" style={{ marginBottom: 0 }}>
                  <Input.TextArea
                    rows={4}
                    placeholder="Explique o que o usuário deve informar ao iniciar o processo"
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
                  <Alert type="error" showIcon style={{ marginBottom: 16 }}
                    message="Não foi possível carregar os conjuntos de metadados" />
                )}
                <Form.Item label="Conjuntos" style={{ marginBottom: 8 }}>
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

                <Text style={sectionLabelStyle}>Metadados do evento inicial</Text>
                {metadataDefinitionsError && (
                  <Alert type="error" showIcon style={{ marginBottom: 16 }}
                    message="Não foi possível carregar os metadados do sistema" />
                )}
                <Form.Item label="Metadados selecionados" style={{ marginBottom: 16 }}>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    value={selectedMetadataDefinitionIds}
                    onChange={handleMetadataDefinitionsChange}
                    loading={metadataDefinitionsLoading}
                    placeholder={metadataDefinitionsLoading ? 'Carregando metadados...' : 'Selecione os metadados de abertura'}
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
                    description="Selecione conjuntos ou metadados específicos para configurar o formulário de abertura."
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
                                {field.name      && <Tag>{field.name}</Tag>}
                                {field.fieldType && <Tag color="blue">{field.fieldType}</Tag>}
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
                  "Somente leitura" deixa o campo visível no formulário de abertura, mas sem permitir edição.
                </Text>
              </div>
            ),
          },

          // ── ABA: NOTIFICAÇÕES ──────────────────────────────────────────────
          {
            key: 'notifications',
            label: <Space size={6}><FileTextOutlined /><span>Notificações</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Templates de notificação</Text>
                <Form.Item
                  label="Notificações disparadas ao iniciar"
                  name="notificationTemplateIds"
                  style={{ marginBottom: 0 }}
                >
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    placeholder="Selecione os templates de notificação"
                    options={notificationOptions}
                    filterOption={(input, opt) =>
                      String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </div>
            ),
          },

          // ── ABA: INSTRUÇÕES ────────────────────────────────────────────────
          {
            key: 'instructions',
            label: <Space size={6}><FileTextOutlined /><span>Instruções</span></Space>,
            children: (
              <div style={tabPaneStyle}>
                <Text style={sectionLabelStyle}>Instruções para o iniciador</Text>
                <Form.Item name="instructions" style={{ marginBottom: 0 }}>
                  <Input.TextArea
                    rows={8}
                    placeholder="Explique o que o usuário deve informar ao iniciar o processo"
                  />
                </Form.Item>
              </div>
            ),
          },

        ]}
      />

      {/* Hidden form fields to keep values in sync */}
      <Form.Item name="metadataSetIds" hidden><Input /></Form.Item>
      <Form.Item name="initialMetadataDefinitionIds" hidden><Input /></Form.Item>
      <Form.Item name="metadataFields" hidden><Input /></Form.Item>

      <div style={{ padding: '12px 24px' }}>
        <Button type="primary" htmlType="submit" block>
          Salvar configuração
        </Button>
      </div>
    </Form>
  )
}
