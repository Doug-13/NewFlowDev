import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { createDocumentRevision, getDocumentGovernance, publishControlledRevision } from '../../api/documentGovernance'
import { useAuthStore } from '../../store/authStore'

export function DocumentGovernancePanel({ documentInstanceId }: { documentInstanceId: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [revision, setRevision] = useState('')
  const [reason, setReason] = useState('')
  const [reviewIntervalMonths, setReviewIntervalMonths] = useState(12)
  const { data, isLoading, error } = useQuery({
    queryKey: ['document-governance', documentInstanceId],
    queryFn: () => getDocumentGovernance(documentInstanceId),
  })
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['document-governance'] }); void qc.invalidateQueries({ queryKey: ['document'] }) }
  const revisionMutation = useMutation({
    mutationFn: () => createDocumentRevision(documentInstanceId, revision, reason),
    onSuccess: ({ id }) => { refresh(); setRevisionOpen(false); navigate(`/documents/${id}`) },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Não foi possível criar a revisão.'),
  })
  const publishMutation = useMutation({
    mutationFn: () => publishControlledRevision(documentInstanceId, 'Publicação controlada', reviewIntervalMonths),
    onSuccess: () => { refresh(); message.success('Revisão publicada.') },
    onError: (e: any) => message.error(e?.response?.data?.message ?? 'Publicação não permitida.'),
  })
  const isAdmin = ['admin', 'administrator', 'administrador'].includes(String(user?.role ?? '').toLowerCase())
  const current = data?.revisions.find((r) => r.id === documentInstanceId)
  return <Card title="Controle documental e revisões" loading={isLoading}>
    {error && <Alert type="error" message="Não foi possível consultar o controle documental." showIcon />}
    {data && <>
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag color="blue">{data.revisionCount} revisões</Tag>
        <Tag color="green">{data.publishedCount} publicadas</Tag>
        <Tag>Atual: {data.activeRevision ?? '—'}</Tag>
      </Space>
      <Table rowKey="id" pagination={false} size="small" dataSource={data.revisions} columns={[
        { title: 'Revisão', dataIndex: 'revision', render: (value: string, row) => <Button type="link" onClick={() => navigate(`/documents/${row.id}`)}>{value}</Button> },
        { title: 'Situação', dataIndex: 'status', render: (status: string, row) => <Space><Tag color={status === 'published' ? 'green' : 'default'}>{status}</Tag>{row.isCurrent && <Tag color="blue">Atual</Tag>}</Space> },
        { title: 'Próxima revisão', dataIndex: 'dueDate', render: (value: string | null, row) => <Space>{value ? new Date(value).toLocaleDateString('pt-BR') : '—'}{row.reviewOverdue && <Tag color="red">Vencida</Tag>}</Space> },
      ]} />
      <Space wrap style={{ marginTop: 16 }}>
        {current?.isCurrent && ['published', 'completed', 'archived'].includes(current.status) && <Button type="primary" onClick={() => setRevisionOpen(true)}>Criar nova revisão</Button>}
        {isAdmin && current?.isCurrent && current.status === 'completed' && <>
          <Typography.Text>Periodicidade (meses):</Typography.Text>
          <InputNumber min={1} max={120} value={reviewIntervalMonths} onChange={v => setReviewIntervalMonths(v ?? 12)} />
          <Button loading={publishMutation.isPending} onClick={() => Modal.confirm({ title: 'Publicar revisão?', content: 'Confirme que as aprovações do fluxo foram concluídas.', onOk: async () => { await publishMutation.mutateAsync() } })}>Publicar revisão</Button>
        </>}
      </Space>
      <Typography.Title level={5} style={{ marginTop: 24 }}>Histórico de auditoria</Typography.Title>
      <Table rowKey="id" size="small" pagination={{ pageSize: 5 }} dataSource={data.audit} columns={[
        { title: 'Quando', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('pt-BR') },
        { title: 'Evento', dataIndex: 'action' },
        { title: 'Usuário', dataIndex: 'userName' },
        { title: 'Observação', dataIndex: 'comment' },
      ]} />
    </>}
    <Modal title="Criar nova revisão" open={revisionOpen} okText="Criar revisão" okButtonProps={{ loading: revisionMutation.isPending, disabled: !revision.trim() || !reason.trim() }} onOk={() => revisionMutation.mutate()} onCancel={() => setRevisionOpen(false)}>
      <Form layout="vertical">
        <Form.Item label="Número da nova revisão" required><Input placeholder="Rev.01" value={revision} onChange={e => setRevision(e.target.value)} /></Form.Item>
        <Form.Item label="Motivo da revisão" required><Input.TextArea rows={3} value={reason} onChange={e => setReason(e.target.value)} /></Form.Item>
      </Form>
    </Modal>
  </Card>
}
