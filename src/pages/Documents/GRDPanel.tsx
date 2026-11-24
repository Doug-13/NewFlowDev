import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Divider, Form, Input, Select, Space, Table, Tag, Typography, message, Popconfirm } from 'antd'
import { api } from '../../api/client'

interface GrdDocument { id: string; document_id: string; title: string; code: string; revision: string; status: string; process_id: string }
interface GrdState { rules: { allowExistingDocuments: boolean; allowNewDocuments: boolean; requireDocuments: boolean; minimumDocuments: number }; count: number; ready: boolean; editable: boolean; documents: { id: string; document: GrdDocument }[] }
interface WorkflowOption { id: string; name: string; processId: string }
interface ProcessOption { id: string; name: string; code?: string }

export function GRDPanel({ documentInstanceId }: { documentInstanceId: string }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedExisting, setSelectedExisting] = useState<string>()
  const [selectedProcess, setSelectedProcess] = useState<string>()
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>()
  const [title, setTitle] = useState('')
  const key = ['grd', documentInstanceId]
  const query = useQuery<GrdState | null>({ queryKey: key, queryFn: async () => {
    try { const { data } = await api.get(`/document-instances/${documentInstanceId}/grd`); return data as GrdState }
    catch (e: any) { if (e?.response?.status === 400 && String(e.response?.data?.message ?? '').includes('processo GRD')) return null; throw e }
  }, retry: false })
  const state = query.data
  const candidates = useQuery<GrdDocument[]>({ queryKey: ['grd-candidates', documentInstanceId, search],
    queryFn: async () => (await api.get(`/document-instances/${documentInstanceId}/grd/candidates`, { params: { search } })).data,
    enabled: Boolean(state?.rules.allowExistingDocuments && state?.editable), staleTime: 2000 })
  const processes = useQuery<ProcessOption[]>({ queryKey: ['grd-processes'], queryFn: async () => (await api.get('/processes/available')).data,
    enabled: Boolean(state?.rules.allowNewDocuments && state?.editable) })
  const workflows = useQuery<WorkflowOption[]>({ queryKey: ['grd-workflows'], queryFn: async () => (await api.get('/workflows')).data,
    enabled: Boolean(state?.rules.allowNewDocuments && state?.editable) })
  const mutation = useMutation({ mutationFn: async (payload: { method: 'add' | 'new' | 'remove'; id?: string; body?: any }) => {
    if (payload.method === 'remove') return api.delete(`/document-instances/${documentInstanceId}/grd/${payload.id}`)
    return api.post(`/document-instances/${documentInstanceId}/grd/${payload.method === 'new' ? 'new' : 'existing'}`, payload.body)
  }, onSuccess: async () => { message.success('GRD atualizada.'); setSelectedExisting(undefined); setTitle('');
    await qc.invalidateQueries({ queryKey: key }); await qc.invalidateQueries({ queryKey: ['grd-candidates', documentInstanceId] });
    await qc.invalidateQueries({ queryKey: ['documents'] }) },
    onError: (e: any) => message.error(String(e?.response?.data?.message ?? e?.message ?? 'Falha ao atualizar GRD.')) })
  if (query.isLoading || (!query.isError && !state)) return null
  if (query.isError) return <Alert type="error" showIcon title="Não foi possível carregar a GRD" description="Verifique as permissões e a conexão." style={{ marginTop: 16 }} />
  if (!state) return null
  const availableWorkflows = (workflows.data ?? []).filter(w => w.processId === selectedProcess)
  return <Card title="Documentos da GRD" style={{ marginTop: 16 }}>
    <Space style={{ marginBottom: 16 }} wrap>
      <Tag color={state.ready ? 'green' : 'orange'}>{state.ready ? 'Quantidade mínima atendida' : 'Quantidade mínima pendente'}</Tag>
      <Typography.Text type="secondary">{state.count} documento(s) vinculado(s){state.rules.requireDocuments ? ` — mínimo ${state.rules.minimumDocuments}` : ''}</Typography.Text>
    </Space>
    <Table rowKey="id" size="small" pagination={{ pageSize: 10 }} dataSource={state.documents}
      columns={[{ title: 'Código', render: (_, r) => r.document?.code ?? '—' },
        { title: 'Documento', render: (_, r) => r.document?.title ?? '—' },
        { title: 'Revisão', render: (_, r) => r.document?.revision ?? '—' },
        { title: 'Ações', render: (_, r) => state.editable ? <Popconfirm title="Desvincular documento?" onConfirm={() => mutation.mutate({ method: 'remove', id: r.id })}>
          <Button danger size="small" disabled={mutation.isPending}>Desvincular</Button></Popconfirm> : null }]}/>
    {!state.editable && <Alert showIcon type="info" title="GRD encerrada" description="Os documentos vinculados estão disponíveis apenas para consulta." />}
    {state.editable && state.rules.allowExistingDocuments && <>
      <Divider>Adicionar documento existente</Divider>
      <Input.Search placeholder="Pesquisar por código ou título" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 470, marginBottom: 12 }} allowClear />
      <Space wrap>
        <Select showSearch optionFilterProp="label" style={{ width: 430, maxWidth: '100%' }} placeholder="Selecione um documento" value={selectedExisting} onChange={setSelectedExisting}
          options={(candidates.data ?? []).map(d => ({ value: d.id, label: `${d.code} — ${d.title} (Rev. ${d.revision})` }))} />
        <Button type="primary" disabled={!selectedExisting} loading={mutation.isPending}
          onClick={() => mutation.mutate({ method: 'add', body: { documentInstanceId: selectedExisting } })}>Vincular documento</Button>
      </Space>
    </>}
    {state.editable && state.rules.allowNewDocuments && <>
      <Divider>Criar documento e vincular à GRD</Divider>
      <Form layout="vertical" onFinish={() => mutation.mutate({ method: 'new', body: { processId: selectedProcess, workflowId: selectedWorkflow, title } })}>
        <Form.Item label="Processo do novo documento" required><Select style={{ width: '100%' }} value={selectedProcess} onChange={v => { setSelectedProcess(v); setSelectedWorkflow(undefined) }}
          options={(processes.data ?? []).map(p => ({ value: p.id, label: `${p.code ?? ''} — ${p.name}` }))} placeholder="Selecione o processo" /></Form.Item>
        <Form.Item label="Workflow" required><Select style={{ width: '100%' }} value={selectedWorkflow} onChange={setSelectedWorkflow}
          options={availableWorkflows.map(w => ({ value: w.id, label: w.name }))} placeholder="Selecione o fluxo" /></Form.Item>
        <Form.Item label="Título do novo documento" required><Input value={title} onChange={e => setTitle(e.target.value)} maxLength={255} /></Form.Item>
        <Button htmlType="submit" type="primary" loading={mutation.isPending} disabled={!selectedProcess || !selectedWorkflow || !title.trim()}>Criar e vincular</Button>
      </Form>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>O documento será criado no processo selecionado como rascunho. Seus metadados e arquivos poderão ser preenchidos depois na página do documento.</Typography.Text>
    </>}
  </Card>
}
