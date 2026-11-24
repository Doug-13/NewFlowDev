import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Table, Tabs, Tag, Typography, message } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../store/authStore'
import { getProcesses, createProcess } from '../../api/processos'
import { getConfigEnvironments, createConfigEnvironment, updateConfigEnvironment, getConfigResources, createConfigResource, updateConfigResource, attachEnvironmentProcess, getEnvironmentProcessIds, type ConfigEnvironment, type ConfigResource, type ConfigResourceKind, type ResourceInput } from '../../api/configuration'
import { MetadataPage } from './MetadataPage'
import { NotificationTemplatesPage } from '../Notifications/NotificationTemplatesPage'
import { ExibicaoPage } from '../Exibicao/ExibicaoPage'

const { Title, Text } = Typography
const sections = ['overview', 'metadata', 'notifications', 'visualization', 'integrations', 'audit'] as const
const cleanError = (err: any) => Array.isArray(err?.response?.data?.message) ? err.response.data.message.join(', ') : err?.response?.data?.message || 'Não foi possível salvar.'

function ResourceCatalog({ environmentId, kind }: { environmentId: string; kind: ConfigResourceKind }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ConfigResource | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const { data = [], isLoading } = useQuery({ queryKey: ['configuration-resources', environmentId, kind], queryFn: () => getConfigResources(environmentId, kind) })
  const save = useMutation({
    mutationFn: (values: any) => {
      const content = kind === 'scripts'
        ? { language: values.language, source: values.source ?? '', description: values.description ?? '' }
        : kind === 'visualization'
          ? { area: values.area ?? '', recordType: values.recordType ?? '', role: values.role ?? '', description: values.description ?? '' }
          : { revisionPattern: values.revisionPattern, initialValue: values.initialValue, digits: values.digits, resetPeriod: values.resetPeriod, prefix: values.prefix ?? '' }
      const payload: ResourceInput = { name: values.name, code: values.code, isActive: values.isActive ?? true, content }
      return editing ? updateConfigResource(environmentId, kind, editing.id, payload) : createConfigResource(environmentId, kind, payload)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['configuration-resources', environmentId, kind] }); setOpen(false); message.success('Configuração salva.') },
    onError: (err) => message.error(cleanError(err)),
  })
  function start(record?: ConfigResource) {
    setEditing(record ?? null)
    const content: Record<string, unknown> = record?.content ?? {}
    form.setFieldsValue({ ...content, name: record?.name ?? '', code: record?.code ?? '', isActive: record?.isActive ?? true, language: content.language ?? 'javascript', revisionPattern: content.revisionPattern ?? 'numeric', initialValue: content.initialValue ?? '00', digits: content.digits ?? 4, resetPeriod: content.resetPeriod ?? 'never' })
    setOpen(true)
  }
  const label = kind === 'scripts' ? 'script' : kind === 'visualization' ? 'regra de visualização' : 'política documental'
  return <>
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {kind === 'scripts' && <Alert showIcon type="info" message="Catálogo de scripts reutilizáveis. O código é armazenado, mas não executado nesta versão." />}
      {kind === 'visualization' && <Alert showIcon type="info" message="Regras de apresentação não concedem acesso a documentos. As permissões continuam obrigatórias." />}
      {kind === 'document-policy' && <Alert showIcon type="warning" message="As políticas são armazenadas por ambiente. A geração real de códigos e revisões continua usando o mecanismo atual até a etapa de integração do motor documental." />}
      <div style={{ textAlign: 'right' }}><Button icon={<PlusOutlined />} type="primary" onClick={() => start()}>Nova {label}</Button></div>
      <Table loading={isLoading} rowKey="id" dataSource={data} pagination={{ pageSize: 8 }} columns={[
        { title: 'Nome', dataIndex: 'name' },
        { title: 'Identificador', dataIndex: 'code', render: (value: string) => <Tag>{value}</Tag> },
        { title: 'Situação', dataIndex: 'isActive', render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? 'Ativo' : 'Inativo'}</Tag> },
        { title: '', render: (_: unknown, r: ConfigResource) => <Button onClick={() => start(r)} icon={<EditOutlined />}>Editar</Button> },
      ]} />
    </Space>
    <Modal title={editing ? `Editar ${label}` : `Nova ${label}`} open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Salvar" confirmLoading={save.isPending} destroyOnHidden>
      <Form layout="vertical" form={form} onFinish={(values) => save.mutate(values)}>
        <Form.Item label="Nome" name="name" rules={[{ required: true }]}><Input maxLength={180} /></Form.Item>
        <Form.Item label="Identificador" name="code" rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_-]{1,59}$/ }]}><Input maxLength={60} /></Form.Item>
        <Form.Item label="Ativo" name="isActive" valuePropName="checked"><Switch /></Form.Item>
        {kind === 'scripts' && <>
          <Form.Item label="Linguagem" name="language"><Select options={[{ label: 'JavaScript', value: 'javascript' }, { label: 'Python', value: 'python' }]} /></Form.Item>
          <Form.Item label="Descrição" name="description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Código-fonte" name="source"><Input.TextArea rows={10} style={{ fontFamily: 'monospace' }} /></Form.Item>
        </>}
        {kind === 'visualization' && <>
          <Form.Item label="Área" name="area"><Input placeholder="Ex.: Engenharia" /></Form.Item>
          <Form.Item label="Tipo de registro" name="recordType"><Input placeholder="Ex.: Desenho técnico" /></Form.Item>
          <Form.Item label="Perfil" name="role"><Input placeholder="Ex.: Gestor" /></Form.Item>
          <Form.Item label="Descrição" name="description"><Input.TextArea rows={2} /></Form.Item>
        </>}
        {kind === 'document-policy' && <>
          <Form.Item label="Formato da revisão" name="revisionPattern"><Select options={[{ label: 'Numérico', value: 'numeric' }, { label: 'Alfabético', value: 'alphabetic' }, { label: 'Alfanumérico', value: 'alphanumeric' }]} /></Form.Item>
          <Form.Item label="Valor inicial" name="initialValue"><Input /></Form.Item>
          <Form.Item label="Prefixo do documento" name="prefix"><Input /></Form.Item>
          <Form.Item label="Quantidade de dígitos" name="digits"><InputNumber min={1} max={12} /></Form.Item>
          <Form.Item label="Reinício do sequencial" name="resetPeriod"><Select options={[{ label: 'Nunca', value: 'never' }, { label: 'Anual', value: 'yearly' }, { label: 'Mensal', value: 'monthly' }]} /></Form.Item>
        </>}
      </Form>
    </Modal>
  </>
}

export function ConfigurationWorkspace() {
  const user = useAuthStore((s) => s.user)
  const accountId = user?.accountId ?? user?.tenantId ?? ''
  const [params, setParams] = useSearchParams()
  const envId = params.get('environment') ?? ''
  const section = params.get('section') ?? 'overview'
  const [form] = Form.useForm()
  const [environmentModal, setEnvironmentModal] = useState(false)
  const [editingEnvironment, setEditingEnvironment] = useState<ConfigEnvironment | null>(null)
  const [processModal, setProcessModal] = useState(false)
  const [processForm] = Form.useForm()
  const qc = useQueryClient()
  const { data: environments = [], isLoading, error } = useQuery({ queryKey: ['configuration-environments'], queryFn: getConfigEnvironments })
  const env = environments.find((x) => x.id === envId)
  const { data: allProcesses = [] } = useQuery({ queryKey: ['processes', accountId], queryFn: () => getProcesses(accountId), enabled: !!accountId })
  const { data: linkedIds = [] } = useQuery({ queryKey: ['configuration-process-ids', envId], queryFn: () => getEnvironmentProcessIds(envId), enabled: !!envId })
  const linkedProcesses = useMemo(() => allProcesses.filter((process) => linkedIds.includes(process.id)), [allProcesses, linkedIds])
  useEffect(() => { if (!envId && environments.length) setParams({ environment: environments[0].id, section: 'overview' }, { replace: true }) }, [envId, environments, setParams])
  const action = params.get('action')
  useEffect(() => { if (action === 'new-environment') { setEditingEnvironment(null); form.resetFields(); form.setFieldsValue({ isActive: true }); setEnvironmentModal(true) } else if (action === 'new-process') { processForm.resetFields(); setProcessModal(true) } }, [action, form, processForm])
  const saveEnv = useMutation({
    mutationFn: (values: any) => editingEnvironment ? updateConfigEnvironment(editingEnvironment.id, values) : createConfigEnvironment(values),
    onSuccess: (result) => { void qc.invalidateQueries({ queryKey: ['configuration-environments'] }); setEnvironmentModal(false); setParams({ environment: result.id, section: 'overview' }); message.success('Ambiente salvo.') },
    onError: (e) => message.error(cleanError(e)),
  })
  const saveProcess = useMutation({
    mutationFn: async (values: any) => {
      if (!env) throw new Error('Selecione um ambiente.')
      if (!values.processId && (!values.name?.trim() || !values.code?.trim())) throw new Error('Informe nome e código ou selecione um processo existente.')
      const id = values.processId || (await createProcess({ name: values.name, code: values.code, description: values.description, accountId, isActive: true })).id
      await attachEnvironmentProcess(env.id, id)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['configuration-process-ids', envId] }); void qc.invalidateQueries({ queryKey: ['configuration-sidebar-links'] }); void qc.invalidateQueries({ queryKey: ['processes', accountId] }); void qc.invalidateQueries({ queryKey: ['sidebar-processes', accountId] }); setProcessModal(false); setParams({ environment: envId, section: 'overview' }); message.success('Processo vinculado ao ambiente.') },
    onError: (e) => message.error(cleanError(e)),
  })
  function editEnvironment() { if (!env) return; setEditingEnvironment(env); form.setFieldsValue(env); setEnvironmentModal(true) }
  if (String(user?.role ?? '').toLowerCase() !== 'admin') return <Alert type="error" showIcon message="Acesso exclusivo do administrador." />
  if (error) return <Alert type="error" showIcon message="Falha ao consultar ambientes." />
  if (isLoading) return <Card loading />
  const isNew = params.get('action') === 'new-environment'
  return <div>
    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 18 }} align="start" wrap>
      <div><Text type="secondary" style={{ fontSize: 12 }}>CENTRAL DE CONFIGURAÇÕES</Text><Title level={3} style={{ margin: '4px 0' }}>{env ? `Ambiente: ${env.name}` : 'Ambientes'}</Title><Text type="secondary">Configurações compartilhadas e processos vinculados ao ambiente.</Text></div>
      <Button onClick={() => { setEditingEnvironment(null); form.resetFields(); form.setFieldsValue({ isActive: true }); setEnvironmentModal(true) }} icon={<PlusOutlined />}>Novo ambiente</Button>
    </Space>
    {!env && !isNew && <Empty description="Crie um ambiente para organizar seus processos e configurações." />}
    {env && <Card>
      <Tabs activeKey={sections.includes(section as any) ? section : 'overview'} onChange={(key) => setParams({ environment: env.id, section: key })} items={[
        { key: 'overview', label: 'Visão Geral', children: <><Tabs size="small" items={[
          { key: 'general', label: 'Dados do ambiente', children: <><Row gutter={12} style={{ marginBottom: 18 }}><Col span={8}><Card size="small"><Text type="secondary">Ambiente</Text><p><b>{env.name}</b></p></Card></Col><Col span={8}><Card size="small"><Text type="secondary">Código</Text><p><b>{env.code}</b></p></Card></Col><Col span={8}><Card size="small"><Text type="secondary">Processos</Text><p><b>{linkedProcesses.length}</b></p></Card></Col></Row><Button onClick={editEnvironment} icon={<EditOutlined />}>Editar ambiente</Button></> },
          { key: 'documents', label: 'Revisões e documentos', children: <ResourceCatalog environmentId={env.id} kind="document-policy" /> },
        ]} /></> },
        { key: 'metadata', label: 'Metadados', children: <MetadataPage /> },
        { key: 'notifications', label: 'Notificações', children: <><Alert type="info" showIcon message="Os modelos existentes ainda são compartilhados pela conta; a seleção por ambiente e o disparo por atividade serão integrados em uma etapa posterior." style={{ marginBottom: 16 }} /><NotificationTemplatesPage /></> },
        { key: 'visualization', label: 'Visualização', children: <><ResourceCatalog environmentId={env.id} kind="visualization" /><div style={{ marginTop: 28 }}><Title level={5}>Visualizações existentes</Title><ExibicaoPage /></div></> },
        { key: 'integrations', label: 'Integrações e API', children: <ResourceCatalog environmentId={env.id} kind="scripts" /> },
        { key: 'audit', label: 'Auditoria e histórico', children: <Alert showIcon type="info" message="A auditoria de alterações nas configurações e os logs de execução exigem eventos registrados no backend; ainda não estão habilitados nesta entrega." /> },
      ]} />
    </Card>}
    
    <Modal title={editingEnvironment ? 'Editar ambiente' : 'Novo ambiente'} open={environmentModal} onCancel={() => { setEnvironmentModal(false); if (isNew) setParams({}) }} onOk={() => form.submit()} okText="Salvar" confirmLoading={saveEnv.isPending} destroyOnHidden>
      <Form layout="vertical" form={form} onFinish={(values) => saveEnv.mutate(values)}><Form.Item label="Nome" name="name" rules={[{ required: true }]}><Input placeholder="Qualidade" /></Form.Item><Form.Item label="Código" name="code" rules={[{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_-]{1,59}$/ }]}><Input placeholder="QLD" /></Form.Item><Form.Item label="Descrição" name="description"><Input.TextArea /></Form.Item><Form.Item label="Ativo" name="isActive" valuePropName="checked"><Switch /></Form.Item></Form>
    </Modal>
    <Modal title="Novo ou vincular processo" open={processModal} onCancel={() => { setProcessModal(false); setParams({ environment: envId, section: 'overview' }) }} onOk={() => processForm.submit()} confirmLoading={saveProcess.isPending} destroyOnHidden>
      <Form form={processForm} layout="vertical" onFinish={(values) => saveProcess.mutate(values)}>
        <Form.Item label="Vincular processo existente" name="processId"><Select allowClear showSearch optionFilterProp="label" options={allProcesses.filter((p) => !linkedIds.includes(p.id)).map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))} /></Form.Item>
        <Alert type="info" message="Ou informe nome e código para criar um processo novo." style={{ marginBottom: 12 }} />
        <Form.Item label="Nome do novo processo" name="name"><Input placeholder="Ex.: Auditoria" /></Form.Item><Form.Item label="Código" name="code"><Input placeholder="AUD" /></Form.Item><Form.Item label="Descrição" name="description"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  </div>
}
