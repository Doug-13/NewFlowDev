import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Divider, Form, Input, InputNumber,
  Radio, Row, Select, Space, Spin, Switch, Tabs, Tag, Typography, message,
} from 'antd'
import {
  BellOutlined, MinusCircleOutlined, PlusOutlined, SaveOutlined,
  SettingOutlined, ApartmentOutlined, LockOutlined, TeamOutlined,
  UserOutlined, EyeOutlined, FileAddOutlined,
} from '@ant-design/icons'
import { getEnvironmentSettings, saveEnvironmentSettings } from '../../api/environmentSettings'
import { getMetadataDefinitions, type MetadataDefinitionListItem } from '../../api/metadataDefinitions'
import { useAuthStore } from '../../store/authStore'
import type { EnvironmentSettings, CodingRulePart } from '../../types/environmentSettings'
import { WorkflowsPage } from '../Workflows/WorkflowsPage'
import { NotificationTemplatesPage } from '../Notifications/NotificationTemplatesPage'
import { getVisualizacoes } from '../../api/visualizacoes'
import { getConfigByProcesso, saveConfigProcesso } from '../../api/processoVisualizacoes'
import type { Visualizacao } from '../Exibicao/ExibicaoPage'
import { getProcesses, createProcess, updateProcess, type Process } from '../../api/processos'
import { getUsers } from '../../api/users'
import { getOrgGroups, type OrgGroupDto } from '../../api/organization'

const { Title, Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

type PermissionSet = { userIds: string[]; groupIds: string[] }

type ProcessFormValues = {
  name: string
  code: string
  description?: string
  parentProcessId?: string | null
  isActive: boolean
  permissions: PermissionSet
  documentCreation: PermissionSet
  documentVisualization: PermissionSet
}

type ProcessoVisualizacaoConfig = {
  processId: string
  visualizacaoIdsAtivas: string[]
}

const DEFAULT_VALUES: EnvironmentSettings = {
  revision:     { pattern: 'numeric', initialValue: '00', autoIncrementOnApproval: true, allowManualEdition: false },
  creationMode: { mode: 'both', requireTemplateInBatch: true },
  codingRule: {
    parts: [
      { type: 'fixed', fixedValue: 'DOC', separatorAfter: '-' },
      { type: 'year', separatorAfter: '-' },
      { type: 'sequential', separatorAfter: '' },
    ],
  },
  sequential: { startAt: 1, digits: 4, resetPeriod: 'yearly' },
  deadlines:  { totalProcessDays: 15 },
}

function normalizeSettings(v?: Partial<EnvironmentSettings> | null): EnvironmentSettings {
  return {
    revision:     { ...DEFAULT_VALUES.revision,     ...(v?.revision     ?? {}) },
    creationMode: { ...DEFAULT_VALUES.creationMode, ...(v?.creationMode ?? {}) },
    codingRule: {
      parts: v?.codingRule?.parts?.length
        ? v.codingRule.parts.map((p) => ({ ...p, separatorAfter: p.separatorAfter ?? '' }))
        : DEFAULT_VALUES.codingRule.parts,
    },
    sequential: { ...DEFAULT_VALUES.sequential, ...(v?.sequential ?? {}) },
    deadlines:  { ...DEFAULT_VALUES.deadlines,  ...(v?.deadlines  ?? {}) },
  }
}

function buildPartPreview(part: CodingRulePart, defs: MetadataDefinitionListItem[], s: EnvironmentSettings): string {
  switch (part.type) {
    case 'fixed':      return part.fixedValue?.trim() || 'FIXO'
    case 'metadata': { const m = defs.find((i) => i.id === part.metadataDefinitionId); return `{${part.metadataLabel || m?.label || m?.name || 'METADADO'}}` }
    case 'year':       return '2026'
    case 'unit':       return 'UN'
    case 'area':       return 'AREA'
    case 'process':    return 'PROC'
    case 'sequential': return String(s.sequential.startAt).padStart(s.sequential.digits, '0')
    default:           return ''
  }
}

function buildCodePreview(v: EnvironmentSettings, defs: MetadataDefinitionListItem[]) {
  return v.codingRule.parts.map((p) => `${buildPartPreview(p, defs, v)}${p.separatorAfter ?? ''}`).join('')
}

function resolveAccountId(user: { accountId?: string; tenantId?: string } | null): string {
  return user?.accountId ?? user?.tenantId ?? ''
}

// ─── PermissionSelector ───────────────────────────────────────────────────────

function PermissionSelector({ label, icon, description, fieldPrefix, userOptions, groupOptions }: {
  label: string; icon: React.ReactNode; description: string; fieldPrefix: string
  userOptions: { value: string; label: React.ReactNode; search: string }[]
  groupOptions: { value: string; label: React.ReactNode; search: string }[]
}) {
  return (
    <div style={{ padding: '16px', background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
      <Space style={{ marginBottom: 12 }}>
        {icon}
        <div>
          <Text strong style={{ fontSize: 13 }}>{label}</Text><br />
          <Text type="secondary" style={{ fontSize: 12 }}>{description}</Text>
        </div>
      </Space>
      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item label={<Space size={4}><UserOutlined style={{ fontSize: 12 }} /><span style={{ fontSize: 12 }}>Usuários</span></Space>} name={[fieldPrefix, 'userIds']} style={{ marginBottom: 0 }}>
            <Select mode="multiple" allowClear showSearch placeholder="Todos os usuários" options={userOptions} filterOption={(input, opt) => String(opt?.search ?? '').includes(input.toLowerCase())} optionLabelProp="label" size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label={<Space size={4}><TeamOutlined style={{ fontSize: 12 }} /><span style={{ fontSize: 12 }}>Grupos</span></Space>} name={[fieldPrefix, 'groupIds']} style={{ marginBottom: 0 }}>
            <Select mode="multiple" allowClear showSearch placeholder="Todos os grupos" options={groupOptions} filterOption={(input, opt) => String(opt?.search ?? '').includes(input.toLowerCase())} optionLabelProp="label" size="small" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  )
}

// ─── ProcessTab ───────────────────────────────────────────────────────────────

function ProcessTab({ accountId, processId }: { accountId: string; processId?: string }) {
  const [form]    = Form.useForm<ProcessFormValues>()
  const [saving,  setSaving]  = useState(false)
  // ─── CORREÇÃO: isEditing só é true se processId é uma string não-vazia ───
  const isEditing = !!processId && processId !== 'undefined'
  const queryClient = useQueryClient()

  const emptyPermission: PermissionSet = { userIds: [], groupIds: [] }

  const { data: existingProcess, isLoading: loadingProcess } = useQuery<Process | null>({
    queryKey: ['process', processId],
    queryFn:  async () => {
      const all = await getProcesses(accountId)
      return all.find((p) => p.id === processId) ?? null
    },
    // ─── CORREÇÃO: só busca se isEditing for verdadeiro ───────────────────
    enabled: isEditing,
  })

  useEffect(() => {
    if (existingProcess) {
      form.setFieldsValue({
        name:                  existingProcess.name,
        code:                  existingProcess.code,
        description:           existingProcess.description,
        isActive:              existingProcess.isActive,
        parentProcessId:       null,
        permissions:           (existingProcess as any).permissions           ?? emptyPermission,
        documentCreation:      (existingProcess as any).documentCreation      ?? emptyPermission,
        documentVisualization: (existingProcess as any).documentVisualization ?? emptyPermission,
      })
    }
  }, [existingProcess, form])

  const { data: allUsers = [] } = useQuery({ queryKey: ['users'],      queryFn: getUsers })
  const { data: groups = []   } = useQuery<OrgGroupDto[]>({ queryKey: ['org-groups'], queryFn: getOrgGroups })
  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ['processes', accountId],
    queryFn:  () => getProcesses(accountId),
    enabled:  !!accountId,
  })

  const userOptions = useMemo(() =>
    (allUsers as any[]).filter((u: any) => u.isActive).map((u: any) => ({
      value:  u.id,
      label:  <Space size={6}><UserOutlined style={{ color: '#94a3b8' }} /><span>{u.name}</span><Text type="secondary" style={{ fontSize: 11 }}>{u.jobTitle}</Text></Space>,
      search: `${u.name} ${u.email} ${u.jobTitle}`.toLowerCase(),
    })), [allUsers])

  const groupOptions = useMemo(() =>
    (groups as OrgGroupDto[]).filter((g) => g.isActive).map((g) => ({
      value:  g.id,
      label:  <Space size={6}><TeamOutlined style={{ color: '#94a3b8' }} /><span>{g.name}</span>{g.code && <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{g.code}</Tag>}</Space>,
      search: `${g.name} ${g.code ?? ''}`.toLowerCase(),
    })), [groups])

  const processOptions = useMemo(() =>
    processes.filter((p) => p.isActive && p.id !== processId)
      .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })), [processes, processId])

  // ─── CORREÇÃO: bloco principal — valida processId antes de chamar updateProcess
  const handleSubmit = async (values: ProcessFormValues) => {
    setSaving(true)
    try {
      if (isEditing) {
        // Dupla verificação: isEditing já garante, mas explicitamos para segurança
        if (!processId || processId === 'undefined') {
          message.error('ID do processo inválido. Recarregue a página e tente novamente.')
          return
        }
        await updateProcess(processId, { ...values, accountId })
        message.success('Processo atualizado com sucesso.')
      } else {
        await createProcess({ ...values, accountId })
        message.success('Processo criado com sucesso.')
        form.resetFields()
      }
      await queryClient.invalidateQueries({ queryKey: ['sidebar-processes', accountId] })
      await queryClient.invalidateQueries({ queryKey: ['processes', accountId] })
    } catch (err: any) {
      message.error(`Não foi possível ${isEditing ? 'atualizar' : 'criar'} o processo: ${err?.message ?? ''}`)
    } finally {
      setSaving(false)
    }
  }

  if (loadingProcess) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin /></div>

  return (
    <Form<ProcessFormValues>
      form={form} layout="vertical" onFinish={handleSubmit}
      initialValues={{ isActive: true, permissions: emptyPermission, documentCreation: emptyPermission, documentVisualization: emptyPermission }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title={<Space><ApartmentOutlined /><span>Identificação do processo</span></Space>}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Nome" name="name" rules={[{ required: true, message: 'Informe o nome' }]}>
                  <Input placeholder="Ex.: Contratos Corporativos" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Código" name="code" rules={[{ required: true, message: 'Informe o código' }]} extra="Identificador curto, sem espaços.">
                  <Input placeholder="Ex.: CTR-CORP" style={{ textTransform: 'uppercase' }} onChange={(e) => form.setFieldValue('code', e.target.value.toUpperCase())} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Status" name="isActive" valuePropName="checked" extra="Desativar impede criação de documentos.">
                  <Switch checkedChildren="Ativo" unCheckedChildren="Inativo" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="Descrição" name="description">
                  <Input.TextArea rows={3} placeholder="Descreva o propósito e escopo deste processo..." style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Processo pai" name="parentProcessId" extra="Opcional. Define hierarquia entre processos.">
                  <Select allowClear showSearch placeholder="Selecione um processo pai (opcional)" options={processOptions} optionFilterProp="label" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<Space><LockOutlined /><span>Permissões de acesso</span></Space>} extra={<Text type="secondary" style={{ fontSize: 12 }}>Deixe vazio para liberar acesso a todos</Text>}>
            <Alert type="info" showIcon message="Quando os campos são deixados vazios, todos os usuários da conta têm acesso." style={{ marginBottom: 20, borderRadius: 8 }} />
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <PermissionSelector label="Acesso ao processo"        icon={<LockOutlined    style={{ color: '#1677ff', fontSize: 16 }} />} description="Quem pode visualizar e operar neste processo"       fieldPrefix="permissions"           userOptions={userOptions} groupOptions={groupOptions} />
              <PermissionSelector label="Criação de documentos"     icon={<FileAddOutlined style={{ color: '#52c41a', fontSize: 16 }} />} description="Quem pode criar novos documentos neste processo"    fieldPrefix="documentCreation"      userOptions={userOptions} groupOptions={groupOptions} />
              <PermissionSelector label="Visualização de documentos" icon={<EyeOutlined    style={{ color: '#faad14', fontSize: 16 }} />} description="Quem pode visualizar os documentos deste processo" fieldPrefix="documentVisualization" userOptions={userOptions} groupOptions={groupOptions} />
            </Space>
          </Card>
        </Col>
      </Row>

      <Divider />
      <Space>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} style={{ background: '#0f172a', borderColor: '#0f172a' }}>
          {isEditing ? 'Salvar alterações' : 'Criar processo'}
        </Button>
        {!isEditing && <Button onClick={() => form.resetFields()}>Limpar</Button>}
      </Space>
    </Form>
  )
}

// ─── ExibicaoTab ──────────────────────────────────────────────────────────────

function ExibicaoTab({ processId }: { processId?: string }) {
  const qc = useQueryClient()
  const [selecionadas, setSelecionadas] = useState<string[]>([])

  const { data: visualizacoes = [], isLoading: loadingViz } = useQuery<Visualizacao[]>({
    queryKey: ['visualizacoes'],
    queryFn:  getVisualizacoes,
  })

  const { data: config, isLoading: loadingConfig } = useQuery<ProcessoVisualizacaoConfig | null>({
    queryKey: ['processo-visualizacoes', processId],
    queryFn:  () => getConfigByProcesso(processId!),
    enabled:  !!processId && processId !== 'undefined',
  })

  useEffect(() => { setSelecionadas(config?.visualizacaoIdsAtivas ?? []) }, [config])

  const saveMutation = useMutation({
    mutationFn: () => saveConfigProcesso(processId!, selecionadas),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['processo-visualizacoes', processId] }); message.success('Configuração de exibição salva.') },
  })

  const vinculadas  = visualizacoes.filter((v) => processId && processId !== 'undefined' && (v.processosVinculados ?? []).includes(processId))
  const isLoading   = loadingViz || loadingConfig

  if (isLoading) return <Spin />

  if (vinculadas.length === 0) {
    return (
      <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <EyeOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
        <Typography.Text type="secondary">Nenhuma visualização vinculada a este processo.</Typography.Text>
      </div>
    )
  }

  const toggle = (id: string, checked: boolean) =>
    setSelecionadas((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Typography.Text type="secondary">Selecione as visualizações que deseja ativar para este processo.</Typography.Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {vinculadas.map((v) => (
          <Card key={v.id} size="small" style={{ borderRadius: 8, cursor: 'pointer' }} onClick={() => toggle(v.id, !selecionadas.includes(v.id))}>
            <Space>
              <input type="checkbox" checked={selecionadas.includes(v.id)} onChange={(e) => toggle(v.id, e.target.checked)} onClick={(e) => e.stopPropagation()} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <Typography.Text strong>{v.nome}</Typography.Text>
            </Space>
          </Card>
        ))}
      </div>
      <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Salvar</Button>
    </div>
  )
}

// ─── EnvironmentSettingsPage ──────────────────────────────────────────────────

type EnvironmentSettingsPageProps = { processId?: string }

export function EnvironmentSettingsPage({ processId }: EnvironmentSettingsPageProps) {
  const [form]       = Form.useForm<EnvironmentSettings>()
  const [activeTab,  setActiveTab] = useState('process')
  const user         = useAuthStore((s) => s.user)
  const accountId    = resolveAccountId(user)
  // ─── CORREÇÃO: normaliza processId — descarta a string "undefined" ────────
  const safeProcessId = processId && processId !== 'undefined' ? processId : undefined
  const isEditing     = !!safeProcessId

  const { data, isLoading } = useQuery<EnvironmentSettings>({
    queryKey: ['environment-settings', accountId],
    queryFn:  () => getEnvironmentSettings(accountId),
    enabled:  !!accountId,
  })

  const { data: metadataDefinitions = [] } = useQuery<MetadataDefinitionListItem[]>({
    queryKey: ['metadata-definitions'],
    queryFn:  () => getMetadataDefinitions(),
  })

  const saveMutation = useMutation({
    mutationFn: (v: EnvironmentSettings) => saveEnvironmentSettings(accountId, v),
    onSuccess:  (saved) => { form.setFieldsValue(normalizeSettings(saved)); message.success('Configurações salvas com sucesso.') },
    onError:    () => message.error('Não foi possível salvar as configurações.'),
  })

  useEffect(() => { form.setFieldsValue(normalizeSettings(data)) }, [data, form])

  const watchedValues   = Form.useWatch([], form)
  const safeValues      = useMemo(() => normalizeSettings(watchedValues as Partial<EnvironmentSettings> | undefined), [watchedValues])
  const previewCode     = useMemo(() => buildCodePreview(safeValues, metadataDefinitions), [safeValues, metadataDefinitions])
  const hasSequential   = useMemo(() => safeValues.codingRule.parts.some((p) => p.type === 'sequential'), [safeValues])
  const metadataOptions = useMemo(() => metadataDefinitions.map((i) => ({ label: i.label || i.name, value: i.id })), [metadataDefinitions])

  const handleRevisionPatternChange = (value: 'numeric' | 'alphabetic' | 'alphanumeric') => {
    const cur = form.getFieldValue(['revision', 'initialValue'])
    if (!cur || ['00', 'AA', 'A1'].includes(cur)) {
      form.setFieldValue(['revision', 'initialValue'], value === 'alphabetic' ? 'AA' : value === 'alphanumeric' ? 'A1' : '00')
    }
  }

  const handleSubmit = async (values: EnvironmentSettings) => {
    if (!accountId) { message.error('Conta não identificada.'); return }
    const normalized = normalizeSettings(values)
    normalized.codingRule.parts = normalized.codingRule.parts.map((p) => {
      if (p.type !== 'metadata') return p
      const meta = metadataDefinitions.find((i) => i.id === p.metadataDefinitionId)
      return { ...p, metadataLabel: meta?.label || meta?.name || 'METADADO' }
    })
    await saveMutation.mutateAsync(normalized)
  }

  if (!accountId) return <Alert type="error" showIcon message="Não foi possível identificar a conta do usuário logado." />
  if (isLoading)  return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}><SettingOutlined /> {isEditing ? 'Configurações do processo' : 'Novo processo'}</Title>
        <Text type="secondary">{isEditing ? 'Edite as informações, permissões e o workflow vinculado a este processo.' : 'Configure as informações e permissões do novo processo.'}</Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'process',
          label: <Space size={6}><ApartmentOutlined /><span>{isEditing ? 'Dados do processo' : 'Novo processo'}</span></Space>,
          // ─── CORREÇÃO: passa safeProcessId em vez de processId raw ────────
          children: <ProcessTab accountId={accountId} processId={safeProcessId} />,
        },
        ...(isEditing ? [{ key: 'workflow', label: 'Workflow', children: <WorkflowsPage embedded processId={safeProcessId} /> }] : []),
        {
          key: 'environment', label: 'Configurações',
          children: (
            <>
              <Alert type="info" showIcon message="Estas configurações impactam a forma como documentos e processos serão criados." style={{ marginBottom: 16 }} />
              <Form<EnvironmentSettings> form={form} layout="vertical" onFinish={handleSubmit} initialValues={DEFAULT_VALUES}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={12}>
                    <Card title="Revisão">
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item label="Padrão de revisão" name={['revision', 'pattern']} rules={[{ required: true }]}>
                            <Radio.Group onChange={(e) => handleRevisionPatternChange(e.target.value)}>
                              <Radio value="numeric">Numérica</Radio>
                              <Radio value="alphabetic">Alfabética</Radio>
                              <Radio value="alphanumeric">Alfanumérica</Radio>
                            </Radio.Group>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item noStyle shouldUpdate>
                            {({ getFieldValue }) => (
                              <Form.Item label="Valor inicial" name={['revision', 'initialValue']} rules={[{ required: true }]}>
                                <Input placeholder={getFieldValue(['revision', 'pattern']) === 'alphabetic' ? 'Ex: AA' : getFieldValue(['revision', 'pattern']) === 'alphanumeric' ? 'Ex: A1' : 'Ex: 00'} />
                              </Form.Item>
                            )}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}><Form.Item label="Incrementar ao aprovar" name={['revision', 'autoIncrementOnApproval']} valuePropName="checked"><Switch /></Form.Item></Col>
                        <Col span={24}><Form.Item label="Permitir edição manual da revisão" name={['revision', 'allowManualEdition']} valuePropName="checked"><Switch /></Form.Item></Col>
                      </Row>
                    </Card>
                  </Col>

                  <Col xs={24} xl={12}>
                    <Card title="Modo de criação">
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item label="Forma de criação" name={['creationMode', 'mode']} rules={[{ required: true }]}>
                            <Radio.Group>
                              <Radio value="manual">Somente manual</Radio>
                              <Radio value="batch">Somente em lote</Radio>
                              <Radio value="both">Manual e em lote</Radio>
                            </Radio.Group>
                          </Form.Item>
                        </Col>
                        <Col span={24}><Form.Item label="Exigir template na criação em lote" name={['creationMode', 'requireTemplateInBatch']} valuePropName="checked"><Switch /></Form.Item></Col>
                      </Row>
                    </Card>
                  </Col>

                  <Col xs={24}>
                    <Card title="Regra de codificação">
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <div style={{ padding: 12, borderRadius: 12, background: '#fafafa', border: '1px solid #f0f0f0' }}>
                          <Text type="secondary">Exemplo do código gerado:</Text>
                          <div style={{ marginTop: 4 }}><Text strong style={{ fontSize: 16 }}>{previewCode || '—'}</Text></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(220px, 1fr) 180px 90px', gap: 12, padding: '0 4px', fontSize: 12, fontWeight: 600, color: '#8c8c8c' }}>
                          <div>Tipo</div><div>Valor</div><div>Separador após</div><div>Ações</div>
                        </div>
                        <Form.List name={['codingRule', 'parts']}>
                          {(fields, { add, remove }) => (
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              {fields.map((field) => (
                                <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '180px minmax(220px, 1fr) 180px 90px', gap: 12, alignItems: 'start', padding: 12, border: '1px solid #f0f0f0', borderRadius: 12, background: '#fff' }}>
                                  <Form.Item name={[field.name, 'type']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                    <Select placeholder="Tipo" options={[
                                      { label: 'Valor fixo', value: 'fixed' }, { label: 'Metadado', value: 'metadata' },
                                      { label: 'Ano', value: 'year' }, { label: 'Unidade', value: 'unit' },
                                      { label: 'Área', value: 'area' }, { label: 'Processo', value: 'process' },
                                      { label: 'Sequencial', value: 'sequential' },
                                    ]} />
                                  </Form.Item>
                                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.codingRule?.parts?.[field.name]?.type !== curr?.codingRule?.parts?.[field.name]?.type}>
                                    {({ getFieldValue }) => {
                                      const type = getFieldValue(['codingRule', 'parts', field.name, 'type'])
                                      if (type === 'fixed')    return <Form.Item name={[field.name, 'fixedValue']} rules={[{ required: true }]} style={{ marginBottom: 0 }}><Input placeholder="Ex: DOC, ENG..." /></Form.Item>
                                      if (type === 'metadata') return <Form.Item name={[field.name, 'metadataDefinitionId']} rules={[{ required: true }]} style={{ marginBottom: 0 }}><Select placeholder="Selecione um metadado" options={metadataOptions} /></Form.Item>
                                      return <Input disabled value="Preenchimento automático" style={{ width: '100%' }} />
                                    }}
                                  </Form.Item>
                                  <Form.Item name={[field.name, 'separatorAfter']} style={{ marginBottom: 0 }}>
                                    <Select placeholder="Separador" options={[{ label: 'Sem separador', value: '' }, { label: '-', value: '-' }, { label: '/', value: '/' }, { label: '.', value: '.' }]} />
                                  </Form.Item>
                                  <Button danger type="text" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)}>Remover</Button>
                                </div>
                              ))}
                              <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ type: 'fixed', fixedValue: '', separatorAfter: '' })} block>Adicionar parte</Button>
                            </Space>
                          )}
                        </Form.List>
                      </Space>
                    </Card>
                  </Col>

                  {hasSequential && (
                    <Col xs={24} xl={12}>
                      <Card title="Sequencial">
                        <Row gutter={16}>
                          <Col xs={24} md={8}><Form.Item label="Iniciar em"  name={['sequential', 'startAt']}     rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col xs={24} md={8}><Form.Item label="Dígitos"     name={['sequential', 'digits']}      rules={[{ required: true }]}><InputNumber min={1} max={10} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col xs={24} md={8}><Form.Item label="Reinício"    name={['sequential', 'resetPeriod']} rules={[{ required: true }]}><Select options={[{ label: 'Nunca', value: 'never' }, { label: 'Anual', value: 'yearly' }, { label: 'Mensal', value: 'monthly' }]} /></Form.Item></Col>
                        </Row>
                      </Card>
                    </Col>
                  )}

                  <Col span={24}>
                    <Card title="Prazo do processo">
                      <Row gutter={16}>
                        <Col xs={24} md={12} xl={8}>
                          <Form.Item label="Prazo total para conclusão" name={['deadlines', 'totalProcessDays']} rules={[{ required: true }]} extra="Tempo esperado para o documento chegar ao fim.">
                            <InputNumber min={0} style={{ width: '100%' }} addonAfter="dias" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                <Divider />
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saveMutation.isPending}>Salvar configurações</Button>
                  <Button onClick={() => form.setFieldsValue(DEFAULT_VALUES)}>Restaurar padrão</Button>
                </Space>
              </Form>
            </>
          ),
        },
        { key: 'notifications', label: <Space size={6}><BellOutlined /><span>Notificações</span></Space>, children: <NotificationTemplatesPage /> },
        { key: 'exibicao',      label: <Space size={6}><EyeOutlined  /><span>Exibição</span></Space>,    children: <ExibicaoTab processId={safeProcessId} /> },
      ]} />
    </Space>
  )
}