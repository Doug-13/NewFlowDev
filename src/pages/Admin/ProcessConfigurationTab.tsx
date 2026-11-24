import { LDImportPanel } from './LDImportPanel'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Form, Input, InputNumber, Radio, Row,
  Select, Space, Spin, Switch, Typography, message, Divider, Empty, Tabs, Modal,
} from 'antd'
import { MinusCircleOutlined, PlusOutlined, SaveOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { createProcess } from '../../api/processos'
import { attachEnvironmentProcess } from '../../api/configuration'
import { getMetadataDefinitions, type MetadataDefinitionListItem } from '../../api/metadataDefinitions'
import { api } from '../../api/client'
import { Link } from 'react-router-dom'
import {
  createConfigResource, getConfigResources, updateConfigResource,
  type ResourceInput,
} from '../../api/configuration'

const { Text } = Typography

type PartType = 'fixed' | 'metadata' | 'year' | 'unit' | 'area' | 'process' | 'sequential'
type CodePart = { type: PartType; fixedValue?: string; separatorAfter?: string; metadataDefinitionId?: string }
type ActivityField = { metadataDefinitionId: string; isRequired: boolean; isReadOnly: boolean }
type ActivityMapping = { elementId: string; fields: ActivityField[] }
type DocumentBehavior = {
  type: 'standard' | 'ld' | 'grd'
  ld: {
    hasHeader: boolean
    columns: { column: string; metadataDefinitionId: string; required: boolean }[]
  }
  grd: {
    allowExistingDocuments: boolean
    allowNewDocuments: boolean
    requireDocuments: boolean
    minimumDocuments: number
  }
}
type ProcessSettings = {
  documentBehavior: DocumentBehavior
  revision: { pattern: 'numeric' | 'alphabetic' | 'alphanumeric'; initialValue: string; autoIncrementOnApproval: boolean; allowManualEdition: boolean }
  creationMode: { mode: 'manual' | 'batch' | 'both'; requireTemplateInBatch: boolean }
  codingRule: { parts: CodePart[] }
  sequential: { startAt: number; digits: number; resetPeriod: 'never' | 'yearly' | 'monthly' }
  activityMappings: ActivityMapping[]
}

const defaultSettings: ProcessSettings = {
  documentBehavior: {
    type: 'standard',
    ld: { hasHeader: true, columns: [
      { column: 'A', metadataDefinitionId: '', required: true },
      { column: 'B', metadataDefinitionId: '', required: false },
      { column: 'C', metadataDefinitionId: '', required: false },
    ] },
    grd: { allowExistingDocuments: true, allowNewDocuments: true, requireDocuments: true, minimumDocuments: 1 },
  },
  revision: { pattern: 'numeric', initialValue: '00', autoIncrementOnApproval: true, allowManualEdition: false },
  creationMode: { mode: 'both', requireTemplateInBatch: true },
  codingRule: { parts: [
    { type: 'process', separatorAfter: '-' },
    { type: 'area', separatorAfter: '-' },
    { type: 'sequential', separatorAfter: '' },
  ] },
  sequential: { startAt: 1, digits: 3, resetPeriod: 'never' },
  activityMappings: [],
}

function normalize(value?: Partial<ProcessSettings> | null): ProcessSettings {
  const configuredBehavior = value?.documentBehavior
  return {
    documentBehavior: {
      type: configuredBehavior?.type === 'ld' || configuredBehavior?.type === 'grd' ? configuredBehavior.type : 'standard',
      ld: {
        hasHeader: configuredBehavior?.ld?.hasHeader ?? true,
        columns: Array.isArray(configuredBehavior?.ld?.columns)
          ? configuredBehavior.ld.columns.map((item) => ({
              column: String(item.column ?? '').trim().toUpperCase(),
              metadataDefinitionId: String(item.metadataDefinitionId ?? ''),
              required: item.required !== false,
            }))
          : defaultSettings.documentBehavior.ld.columns.map((item) => ({ ...item })),
      },
      grd: { ...defaultSettings.documentBehavior.grd, ...(configuredBehavior?.grd ?? {}) },
    },
    revision: { ...defaultSettings.revision, ...(value?.revision ?? {}) },
    creationMode: { ...defaultSettings.creationMode, ...(value?.creationMode ?? {}) },
    codingRule: { parts: Array.isArray(value?.codingRule?.parts) && value.codingRule.parts.length
      ? value.codingRule.parts.map((p) => ({ ...p, separatorAfter: p.separatorAfter ?? '' }))
      : defaultSettings.codingRule.parts.map((p) => ({ ...p })) },
    sequential: { ...defaultSettings.sequential, ...(value?.sequential ?? {}) },
    activityMappings: Array.isArray(value?.activityMappings) ? value.activityMappings.map((item) => ({ elementId: item.elementId, fields: Array.isArray(item.fields) ? item.fields : [] })) : [],
  }
}

function preview(settings: ProcessSettings, processCode: string, defs: MetadataDefinitionListItem[]): string {
  const parts = settings.codingRule.parts ?? []
  return parts.map((part) => {
    let value = ''
    switch (part.type) {
      case 'fixed': value = part.fixedValue || 'FIXO'; break
      case 'metadata': value = part.metadataDefinitionId ? `{${defs.find((d) => d.id === part.metadataDefinitionId)?.label ?? 'METADADO'}}` : '{METADADO}'; break
      case 'year': value = String(new Date().getFullYear()); break
      case 'unit': value = 'UN'; break
      case 'area': value = 'AREA'; break
      case 'process': value = processCode || 'PROC'; break
      case 'sequential': value = String(settings.sequential.startAt || 1).padStart(settings.sequential.digits || 4, '0'); break
    }
    return value + (part.separatorAfter ?? '')
  }).join('')
}

const kind = 'process-settings' as const

export function ProcessConfigurationTab({
  environmentId, processes,
}: {
  environmentId: string
  processes: { id: string; name: string; code?: string | null }[]
}) {
  const [form] = Form.useForm<ProcessSettings>()
  const qc = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const accountId = user?.accountId ?? user?.tenantId ?? ''
  const [createForm] = Form.useForm<{ name: string; code: string; documentType: DocumentBehavior['type'] }>()
  const [creating, setCreating] = useState(false)
  const [activityId, setActivityId] = useState<string>('')
  const [draftFields, setDraftFields] = useState<ActivityField[]>([])
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null)
  const [processTab, setProcessTab] = useState('details')
  const [search, setSearch] = useState('')
  const filteredProcesses = useMemo(() => processes.filter((item) =>
    `${item.name} ${item.code ?? ''}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
  ), [processes, search])
  const watched = Form.useWatch([], form) as Partial<ProcessSettings> | undefined
  const selectedType = Form.useWatch(['documentBehavior', 'type'], form) as DocumentBehavior['type'] | undefined
  const safeSettings = useMemo(() => normalize(watched), [watched])
  const { data: definitions = [] } = useQuery({ queryKey: ['metadata-definitions', 'config-processes'], queryFn: () => getMetadataDefinitions() })
  const codePreview = useMemo(() => preview(safeSettings, processes.find((p) => p.id === selectedProcessId)?.code ?? '', definitions), [safeSettings, processes, selectedProcessId, definitions])

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ['configuration-process-settings', environmentId],
    queryFn: () => getConfigResources(environmentId, kind),
    enabled: !!environmentId,
  })
  const process = processes.find((item) => item.id === selectedProcessId)
  const resourceCode = selectedProcessId ? `PROC_${selectedProcessId.replace(/-/g, '').toUpperCase()}` : ''
  const savedResource = records.find((r) => r.code === resourceCode)
  const { data: workflows = [] } = useQuery<{ id: string; name: string; elements?: { elementId: string; elementKind: string; name?: string | null }[] }[]>({
    queryKey: ['workflows', 'config-processes', selectedProcessId],
    queryFn: async () => (await api.get('/workflows', { params: { processId: selectedProcessId } })).data,
    enabled: !!selectedProcessId,
  })
  const workflow = workflows[0]
  const activities = (workflow?.elements ?? []).filter((item) => ['activity', 'subprocess'].includes(item.elementKind))

  useEffect(() => {
    if (selectedProcessId && !processes.some((item) => item.id === selectedProcessId)) {
      setSelectedProcessId(null)
      setProcessTab('details')
    }
  }, [processes, selectedProcessId])

  useEffect(() => {
    form.setFieldsValue(normalize(savedResource?.content as Partial<ProcessSettings> | undefined))
  }, [form, savedResource, selectedProcessId])

  useEffect(() => {
    if (!activities.some((item) => item.elementId === activityId)) setActivityId(activities[0]?.elementId ?? '')
  }, [activities.map((item) => item.elementId).join(','), activityId])

  useEffect(() => {
    const mappings = normalize(form.getFieldsValue(true) as ProcessSettings).activityMappings
    setDraftFields((mappings.find((item) => item.elementId === activityId)?.fields ?? []).map((item) => ({ ...item })))
  }, [activityId, savedResource])

  const create = useMutation({
    mutationFn: async (values: { name: string; code: string; documentType: DocumentBehavior['type'] }) => {
      if (!accountId) throw new Error('Conta não identificada.')
      const created = await createProcess({ name: values.name.trim(), code: values.code.trim().toUpperCase(), accountId, isActive: true })
      await attachEnvironmentProcess(environmentId, created.id)
      const initialSettings = normalize({
        documentBehavior: {
          ...defaultSettings.documentBehavior,
          type: values.documentType,
        },
      })
      await createConfigResource(environmentId, kind, {
        name: `Configuração: ${created.name}`,
        code: `PROC_${created.id.replace(/-/g, '').toUpperCase()}`,
        isActive: true,
        content: initialSettings as unknown as Record<string, unknown>,
      })
      return created
    },
    onSuccess: async (created) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['configuration-process-ids', environmentId] }),
        qc.invalidateQueries({ queryKey: ['configuration-process-settings', environmentId] }),
        qc.invalidateQueries({ queryKey: ['configuration-sidebar-links'] }),
        qc.invalidateQueries({ queryKey: ['processes', accountId] }),
        qc.invalidateQueries({ queryKey: ['sidebar-processes', accountId] }),
      ])
      setSelectedProcessId(created.id)
      setProcessTab('details')
      setCreating(false)
      createForm.resetFields()
      message.success('Processo criado e vinculado ao ambiente.')
    },
    onError: (error: Error) => message.error(error.message),
  })

  function updateActivityFields(fields: ActivityField[]) {
    const current = normalize(form.getFieldsValue(true) as ProcessSettings)
    const mappings = current.activityMappings.filter((item) => item.elementId !== activityId)
    if (activityId && fields.length) mappings.push({ elementId: activityId, fields })
    form.setFieldValue('activityMappings', mappings)
    setDraftFields(fields)
  }

  const save = useMutation({
    mutationFn: async (values: ProcessSettings) => {
      if (!process || !selectedProcessId) throw new Error('Selecione um processo.')
      const settings = normalize(values)
      if (settings.documentBehavior.type === 'ld') {
        const columns = settings.documentBehavior.ld.columns
        if (columns.length === 0) throw new Error('Configure pelo menos uma coluna da planilha LD.')
        const names = columns.map((item) => item.column.toUpperCase())
        if (new Set(names).size !== names.length) throw new Error('A LD possui colunas repetidas.')
        const metadados = columns.map((item) => item.metadataDefinitionId)
        if (metadados.some((id) => !id || !definitions.some((d) => d.id === id))) throw new Error('Selecione um metadado válido para cada coluna da LD.')
      }
      if (settings.documentBehavior.type === 'grd' && !settings.documentBehavior.grd.allowExistingDocuments && !settings.documentBehavior.grd.allowNewDocuments) {
        throw new Error('A GRD deve permitir pelo menos uma forma de adicionar documentos.')
      }
      const payload: ResourceInput = {
        name: `Configuração: ${process.name}`,
        code: resourceCode,
        isActive: true,
        content: settings as unknown as Record<string, unknown>,
      }
      if (savedResource) return updateConfigResource(environmentId, kind, savedResource.id, payload)
      return createConfigResource(environmentId, kind, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['configuration-process-settings', environmentId] })
      message.success('Configurações deste processo salvas.')
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } }; message?: string }
      const detail = err.response?.data?.message
      message.error(Array.isArray(detail) ? detail.join(', ') : detail || err.message || 'Erro ao salvar configurações.')
    },
  })

  return <Space direction="vertical" size={16} style={{ width: '100%' }}>
    {!selectedProcessId && <Alert type="info" showIcon title="Processos do ambiente"
      description="Selecione um processo para abrir suas configurações. Cada processo possui um tipo definido no cadastro, suas regras de codificação, revisão e metadados por atividade." />}
    {!selectedProcessId && <Card title="Processos cadastrados" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { createForm.resetFields(); createForm.setFieldValue('documentType', 'standard'); setCreating(true) }}>Novo processo</Button>}>
      {!creating && processes.length === 0 && <Empty description="Nenhum processo vinculado. Use Novo processo para começar." />}
      {processes.length > 0 && <>
        <Input.Search allowClear placeholder="Pesquisar por nome ou sigla" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 440, marginBottom: 16, marginTop: 0 }} />
        {filteredProcesses.length === 0 ? <Empty description="Nenhum processo encontrado para esta pesquisa." /> :
          <Row gutter={[12, 12]}>
            {filteredProcesses.map((item) => <Col key={item.id} xs={24} sm={12} lg={8}>
              <Card hoverable size="small" onClick={() => { setSelectedProcessId(item.id); setProcessTab('details'); setCreating(false) }} style={{ cursor: 'pointer', height: '100%', borderRadius: 10 }}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Text strong>{item.name}</Text>
                  <Text type="secondary">Sigla: {item.code || 'Não informada'}</Text>
                  <Text style={{ color: '#1677ff', fontSize: 12 }}>Abrir configurações →</Text>
                </Space>
              </Card>
            </Col>)}
          </Row>}
      </>}
    </Card>}
    <Modal
      title="Novo processo"
      open={creating}
      onCancel={() => { setCreating(false); createForm.resetFields() }}
      onOk={() => createForm.submit()}
      okText="Criar processo"
      confirmLoading={create.isPending}
      okButtonProps={{ disabled: create.isPending }}
      destroyOnHidden
    >
      <Form form={createForm} layout="vertical" onFinish={(values) => create.mutate(values)} initialValues={{ documentType: 'standard' }}>
        <Form.Item label="Nome do processo" name="name" rules={[{ required: true, whitespace: true, message: 'Informe o nome do processo.' }]}>
          <Input maxLength={150} placeholder="Ex.: Lista de Documentos" />
        </Form.Item>
        <Form.Item label="Sigla / código" name="code" rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_-]{1,19}$/, message: 'Informe uma sigla entre 2 e 20 caracteres, sem espaços.' }]}>
          <Input maxLength={20} placeholder="Ex.: LD" style={{ textTransform: 'uppercase' }} />
        </Form.Item>
        <Form.Item label="Tipo de documento" name="documentType" rules={[{ required: true, message: 'Selecione o tipo de documento.' }]}>
          <Select options={[
            { value: 'standard', label: 'Documento padrão' },
            { value: 'ld', label: 'LD — Lista de Documentos' },
            { value: 'grd', label: 'GRD — Guia de Remessa de Documentos' },
          ]} />
        </Form.Item>
        <Alert type="info" showIcon title="Tipo definido na criação" description="O tipo do documento é gravado para este processo. Os mapeamentos LD e as regras de GRD serão configurados após o cadastro em Dados do processo." />
      </Form>
    </Modal>
    {selectedProcessId && <>
      <Button onClick={() => { setSelectedProcessId(null); setProcessTab('details'); setCreating(false) }}>← Todos os processos</Button>
      <div style={{ marginTop: 4 }}>
        <Text strong style={{ fontSize: 18 }}>{process?.name ?? 'Processo'}</Text>
        <Text type="secondary" style={{ marginLeft: 12 }}>{process?.code ?? ''}</Text>
      </div>
      <Tabs activeKey={processTab} onChange={setProcessTab} items={[
        { key: 'details', label: 'Dados do processo' },
        { key: 'revision', label: 'Revisão e criação' },
        { key: 'coding', label: 'Codificação do documento' },
        { key: 'metadata', label: 'Metadados por atividade' },
        ...(selectedType === 'ld' ? [{ key: 'ld', label: 'Configuração LD' }] : []),
      ]} />
      {isLoading ? <Spin /> : error ? <Alert showIcon type="error" title="Não foi possível consultar as configurações dos processos." /> : process && <Form key={process.id} form={form} layout="vertical" initialValues={defaultSettings} onFinish={(v) => save.mutate(v)}>
        <Card size="small" title="Dados do processo" style={{ marginBottom: 16, display: processTab === 'details' ? undefined : 'none' }}>
          <Row gutter={12}>
            <Col xs={24} md={8}><Text type="secondary">Nome</Text><div><Text strong>{process.name}</Text></div></Col>
            <Col xs={24} md={8}><Text type="secondary">Sigla</Text><div><Text strong>{process.code || 'Não informada'}</Text></div></Col>
            <Col xs={24} md={8}><Text type="secondary">Tipo de documento</Text><div><Text strong>{selectedType === 'ld' ? 'LD — Lista de Documentos' : selectedType === 'grd' ? 'GRD — Guia de Remessa' : 'Documento padrão'}</Text></div></Col>
          </Row>
          <Form.Item name={['documentBehavior', 'type']} hidden><Input /></Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>Nome, sigla, tipo e permissões são definidos no cadastro. As regras específicas de LD ficam na aba Configuração LD. As regras de GRD aparecem abaixo.</Text>
          <div style={{ marginTop: 12 }}><Link to={`/processes/${process.id}`}>Editar nome, sigla e permissões do processo →</Link></div>
          {selectedType === 'grd' && <Divider>Configuração específica — GRD</Divider>}
          {selectedType === 'grd' && <>
            <Divider>Documentos vinculados à GRD</Divider>
            <Text type="secondary">Defina se o usuário poderá incluir novos arquivos e/ou associar documentos já cadastrados na criação da GRD.</Text>
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col xs={24} md={12}><Form.Item label="Permitir vincular documentos existentes" name={['documentBehavior', 'grd', 'allowExistingDocuments']} valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="Permitir adicionar novos documentos" name={['documentBehavior', 'grd', 'allowNewDocuments']} valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="Exigir pelo menos um documento" name={['documentBehavior', 'grd', 'requireDocuments']} valuePropName="checked"><Switch /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="Quantidade mínima de documentos" name={['documentBehavior', 'grd', 'minimumDocuments']} rules={[{ required: true }]}><InputNumber min={1} max={10000} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Alert type="warning" showIcon title="Vínculo documental" description="As permissões de acesso dos documentos vinculados deverão ser verificadas no backend. A configuração sozinha não concede acesso aos anexos." />
          </>}
        </Card>
        {selectedType === 'ld' && (
          <Card
            size="small"
            title="Configuração LD — Mapeamento da planilha"
            style={{ marginBottom: 16, display: processTab === 'ld' ? undefined : 'none' }}
          >
            <Divider>Mapeamento das colunas da LD</Divider>
            <Text type="secondary">Cada linha da planilha representará um documento. Associe cada coluna a um metadado já cadastrado. Os códigos serão gerados pelo motor documental após a implementação da importação.</Text>
            <Form.Item label="A primeira linha contém os títulos das colunas" name={['documentBehavior', 'ld', 'hasHeader']} valuePropName="checked" style={{ marginTop: 16 }}><Switch /></Form.Item>
            <Form.List name={['documentBehavior', 'ld', 'columns']}>
              {(fields, { add, remove }) => <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {fields.map((field) => <Row key={field.key} gutter={12} align="middle">
                  <Col xs={24} md={5}>
                    <Form.Item label="Coluna" name={[field.name, 'column']} rules={[{ required: true, pattern: /^[A-Za-z]{1,3}$/, message: 'Use letras como A, B, C ou AA.' }]}><Input placeholder="A" maxLength={3} style={{ textTransform: 'uppercase' }} /></Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="Metadado" name={[field.name, 'metadataDefinitionId']} rules={[{ required: true, message: 'Selecione o metadado da coluna.' }]}>
                      <Select showSearch optionFilterProp="label" placeholder="Selecione um metadado" options={definitions.map((d) => ({ value: d.id, label: d.label || d.name }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={16} md={5}>
                    <Form.Item label="Obrigatório" name={[field.name, 'required']} valuePropName="checked"><Switch /></Form.Item>
                  </Col>
                  <Col xs={8} md={2}><Button danger type="text" title="Remover coluna" icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} /></Col>
                </Row>)}
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ column: '', metadataDefinitionId: '', required: false })}>Adicionar coluna da planilha</Button>
              </Space>}
            </Form.List>
            <Alert type="warning" showIcon style={{ marginTop: 16 }} title="Regras da LD" description="Os nomes de colunas devem ser únicos. A geração de códigos usa a aba Codificação do documento e seu sequencial, não o número da linha da planilha." />
            {selectedProcessId && <LDImportPanel processId={selectedProcessId} />}
          
          </Card>
        )}
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12} style={{ display: processTab === 'revision' ? undefined : 'none' }}>
            <Card title="Revisão" style={{ height: '100%' }}>
              <Form.Item label="Padrão de revisão" name={['revision', 'pattern']} rules={[{ required: true }]}>
                <Radio.Group onChange={(e) => {
                  const val = e.target.value as ProcessSettings['revision']['pattern']
                  const current = form.getFieldValue(['revision', 'initialValue'])
                  if (['00', 'AA', 'A1', undefined, ''].includes(current)) {
                    form.setFieldValue(['revision', 'initialValue'], val === 'alphabetic' ? 'AA' : val === 'alphanumeric' ? 'A1' : '00')
                  }
                }}>
                  <Radio value="numeric">Numérica</Radio>
                  <Radio value="alphabetic">Alfabética</Radio>
                  <Radio value="alphanumeric">Alfanumérica</Radio>
                </Radio.Group>
              </Form.Item>
              <Row gutter={12}>
                <Col xs={24} md={12}><Form.Item label="Valor inicial" name={['revision', 'initialValue']} rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item label="Incrementar ao aprovar" name={['revision', 'autoIncrementOnApproval']} valuePropName="checked"><Switch /></Form.Item></Col>
              </Row>
              <Form.Item label="Permitir edição manual da revisão" name={['revision', 'allowManualEdition']} valuePropName="checked"><Switch /></Form.Item>
            </Card>
          </Col>
          <Col xs={24} xl={12} style={{ display: processTab === 'revision' ? undefined : 'none' }}>
            <Card title="Modo de criação" style={{ height: '100%' }}>
              <Form.Item label="Forma de criação" name={['creationMode', 'mode']} rules={[{ required: true }]}>
                <Radio.Group><Radio value="manual">Somente manual</Radio><Radio value="batch">Somente em lote</Radio><Radio value="both">Manual e em lote</Radio></Radio.Group>
              </Form.Item>
              <Form.Item label="Exigir template na criação em lote" name={['creationMode', 'requireTemplateInBatch']} valuePropName="checked"><Switch /></Form.Item>
            </Card>
          </Col>
          <Col xs={24} style={{ display: processTab === 'coding' ? undefined : 'none' }}>
            <Card title="Nome e código dos documentos">
              <Alert type="info" showIcon title="Ex.: QUA-AREA-001" description="Adicione as partes Processo, Área e Sequencial com separador hífen. A prévia usa a sigla do processo e valores demonstrativos para a área." style={{ marginBottom: 12 }} />
              <div style={{ background: '#fafafa', padding: 14, borderRadius: 10, marginBottom: 18 }}>
                <Text type="secondary">Exemplo do código gerado:</Text>
                <div><Text strong>{codePreview || '—'}</Text></div>
              </div>
              <Form.List name={['codingRule', 'parts']}>
                {(fields, { add, remove }) => <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {fields.map((field) => <Row key={field.key} gutter={8} align="top" wrap>
                    <Col xs={24} md={5}><Form.Item name={[field.name, 'type']} rules={[{ required: true }]}>
                      <Select placeholder="Tipo" options={[
                        { value: 'fixed', label: 'Valor fixo' },
                        { value: 'metadata', label: 'Metadado' },
                        { value: 'year', label: 'Ano' },
                        { value: 'unit', label: 'Unidade' },
                        { value: 'area', label: 'Área' },
                        { value: 'process', label: 'Processo' },
                        { value: 'sequential', label: 'Sequencial' },
                      ]} />
                    </Form.Item></Col>
                    <Col xs={24} md={12}>
                      <Form.Item noStyle shouldUpdate={(p, n) => p?.codingRule?.parts?.[field.name]?.type !== n?.codingRule?.parts?.[field.name]?.type}>
                        {({ getFieldValue }) => getFieldValue(['codingRule', 'parts', field.name, 'type']) === 'fixed'
                          ? <Form.Item name={[field.name, 'fixedValue']}><Input placeholder="Valor fixo" /></Form.Item>
                          : getFieldValue(['codingRule', 'parts', field.name, 'type']) === 'metadata'
                            ? <Form.Item name={[field.name, 'metadataDefinitionId']} rules={[{ required: true, message: 'Selecione o metadado.' }]}><Select placeholder="Metadado no código" showSearch optionFilterProp="label" options={definitions.map((d) => ({ value: d.id, label: d.label || d.name }))} /></Form.Item>
                            : <Input disabled placeholder="Preenchimento automático" />}
                      </Form.Item>
                    </Col>
                    <Col xs={20} md={5}><Form.Item name={[field.name, 'separatorAfter']}><Select options={[{ value: '', label: 'Sem separador' }, { value: '-', label: 'Hífen (-)' }, { value: '/', label: 'Barra (/)' }, { value: '.', label: 'Ponto (.)' }, { value: '_', label: 'Underline (_)' }]} /></Form.Item></Col>
                    <Col xs={4} md={2}><Button danger type="text" icon={<MinusCircleOutlined />} aria-label="Remover parte" onClick={() => remove(field.name)} /></Col>
                  </Row>)}
                  <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ type: 'fixed', fixedValue: '', separatorAfter: '' })}>Adicionar parte</Button>
                </Space>}
              </Form.List>
            </Card>
          </Col>
          <Col xs={24} style={{ display: processTab === 'coding' ? undefined : 'none' }}>
            <Card title="Sequencial">
              <Row gutter={12}>
                <Col xs={24} md={8}><Form.Item label="Iniciar em" name={['sequential', 'startAt']} rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} max={99999999} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Dígitos" name={['sequential', 'digits']} rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={1} max={12} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item label="Reinício" name={['sequential', 'resetPeriod']}><Select options={[{ label: 'Nunca', value: 'never' }, { label: 'Anual', value: 'yearly' }, { label: 'Mensal', value: 'monthly' }]} /></Form.Item></Col>
              </Row>
            </Card>
          </Col>
        </Row>
        <Card title="Metadados por atividade" style={{ marginTop: 16, display: processTab === 'metadata' ? undefined : 'none' }}>
          <Alert type="info" showIcon title="Campos e ordem por atividade BPMN" description="A configuração abaixo é salva neste processo. Para aplicá-la automaticamente na execução das atividades, o motor BPMN deverá ler esse mapeamento ou o cadastro do Workflow Studio." style={{ marginBottom: 12 }} />
          {!workflow ? <Empty description="Nenhum workflow encontrado. Crie o BPMN do processo primeiro." /> : activities.length === 0 ? <Empty description="O workflow não possui atividades configuráveis." /> : <>
            <Space style={{ marginBottom: 12 }} wrap>
              <Text>Workflow: <Text strong>{workflow.name}</Text></Text>
              <Link to={`/workflows/${workflow.id}/studio`}>Abrir editor BPMN</Link>
            </Space>
            <Form.Item label="Atividade" style={{ maxWidth: 520 }}>
              <Select value={activityId || undefined} onChange={setActivityId} options={activities.map((item) => ({ value: item.elementId, label: item.name || item.elementId }))} />
            </Form.Item>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {draftFields.map((field, index) => <Row key={`${activityId}-${index}`} gutter={8} align="middle">
                <Col xs={24} md={12}><Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={field.metadataDefinitionId} options={definitions.filter((d) => d.id === field.metadataDefinitionId || !draftFields.some((f) => f.metadataDefinitionId === d.id)).map((d) => ({ value: d.id, label: d.label || d.name }))} onChange={(value) => updateActivityFields(draftFields.map((f, i) => i === index ? { ...f, metadataDefinitionId: value } : f))} /></Col>
                <Col xs={12} md={4}><Switch size="small" checked={field.isRequired} onChange={(checked) => updateActivityFields(draftFields.map((f, i) => i === index ? { ...f, isRequired: checked } : f))} /> <Text style={{ fontSize: 12 }}>Obrigatório</Text></Col>
                <Col xs={12} md={4}><Switch size="small" checked={field.isReadOnly} onChange={(checked) => updateActivityFields(draftFields.map((f, i) => i === index ? { ...f, isReadOnly: checked } : f))} /> <Text style={{ fontSize: 12 }}>Somente leitura</Text></Col>
                <Col xs={24} md={4}><Space size={2}>
                  <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => { const next = [...draftFields]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateActivityFields(next) }} />
                  <Button size="small" icon={<ArrowDownOutlined />} disabled={index === draftFields.length - 1} onClick={() => { const next = [...draftFields]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateActivityFields(next) }} />
                  <Button size="small" danger icon={<MinusCircleOutlined />} onClick={() => updateActivityFields(draftFields.filter((_, i) => i !== index))} />
                </Space></Col>
              </Row>)}
              <Select<string> value={undefined} placeholder="Adicionar metadado à atividade" showSearch optionFilterProp="label" style={{ maxWidth: 520, width: '100%' }} options={definitions.filter((d) => !draftFields.some((f) => f.metadataDefinitionId === d.id)).map((d) => ({ value: d.id, label: d.label || d.name }))} onChange={(value: string) => { if (value) updateActivityFields([...draftFields, { metadataDefinitionId: value, isRequired: false, isReadOnly: false }]) }} />
            </Space>
            <Divider />
            <Text type="secondary">A ordem exibida acima será mantida no cadastro do processo. Use Salvar configurações do processo para persistir.</Text>
          </>}
          <Form.Item name="activityMappings" hidden><Input /></Form.Item>
        </Card>
        <Button htmlType="submit" type="primary" icon={<SaveOutlined />} loading={save.isPending} style={{ marginTop: 16 }}>Salvar configurações do processo</Button>
        {savedResource && <Text type="secondary" style={{ marginLeft: 12 }}>Configuração específica existente</Text>}
      </Form>}
    </>}
  </Space>
}
