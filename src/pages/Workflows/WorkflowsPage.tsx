import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteWorkflow,
  listWorkflows,
  type WorkflowDefinition,
  type WorkflowStatus,
} from '../../api/workflows'

const { Title, Text } = Typography

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

function getStatusLabel(status: WorkflowStatus) {
  switch (status) {
    case 'active':
      return 'Ativo'
    case 'draft':
      return 'Rascunho'
    case 'inactive':
      return 'Inativo'
    case 'archived':
      return 'Arquivado'
    default:
      return status
  }
}

type WorkflowsPageProps = {
  embedded?: boolean
  processId?: string
}

export function WorkflowsPage({ embedded = false, processId }: WorkflowsPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const workflowsQuery = useQuery({
    queryKey: ['workflows', { processId: processId ?? null }],
    queryFn: () => listWorkflows(processId ? { processId } : undefined),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
      message.success('Workflow excluído com sucesso.')
    },
    onError: (error: any) => {
      const apiMessage =
        error?.response?.data?.message ??
        error?.message ??
        'Não foi possível excluir o workflow.'
      message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
    },
  })

  const items = workflowsQuery.data ?? []

  const processItems = useMemo(() => {
    if (!processId) return items
    return items.filter((item) => item.processId === processId)
  }, [items, processId])

  const processAlreadyHasWorkflow = processId ? processItems.length > 0 : false

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return processItems

    return processItems.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        (item.description ?? '').toLowerCase().includes(term) ||
        (item.processName ?? '').toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term) ||
        (item.version ?? '').toLowerCase().includes(term)
      )
    })
  }, [processItems, search])

  const handleDelete = (workflow: WorkflowDefinition) => {
    Modal.confirm({
      title: 'Excluir workflow',
      content: `Deseja realmente excluir o workflow "${workflow.name}"?`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        await deleteMutation.mutateAsync(workflow.id)
      },
    })
  }

  const handleCreate = () => {
    const path = processId ? `/workflows/new?processId=${processId}` : '/workflows/new'
    navigate(path)
  }

  const processColumn: ColumnsType<WorkflowDefinition> = !processId
    ? [
        {
          title: 'Processo',
          dataIndex: 'processName',
          key: 'processName',
          width: 200,
          render: (value?: string | null) =>
            value ? (
              <Tag color="purple">{value}</Tag>
            ) : (
              <Text type="secondary">Não vinculado</Text>
            ),
        },
      ]
    : []

  const columns: ColumnsType<WorkflowDefinition> = [
    {
      title: 'Workflow',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.name}</div>
          <Text type="secondary">
            {record.description || 'Sem descrição informada'}
          </Text>
        </div>
      ),
    },
    ...processColumn,
    {
      title: 'Versão',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (value?: string) => value ?? '-',
    },
    {
      title: 'Etapas',
      dataIndex: 'stepsCount',
      key: 'stepsCount',
      width: 100,
      render: (value?: number) => value ?? 0,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: WorkflowStatus) => (
        <Tag color={getStatusColor(value)}>{getStatusLabel(value)}</Tag>
      ),
    },
    {
      title: 'Atualizado em',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string) => {
        try {
          return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        } catch {
          return value
        }
      },
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/workflows/${record.id}`)}>
            Visualizar
          </Button>

          <Button
            icon={<EditOutlined />}
            onClick={() =>
              navigate(
                record.processId
                  ? `/workflows/${record.id}/studio?processId=${record.processId}`
                  : `/workflows/${record.id}/studio`,
              )
            }
          >
            Studio
          </Button>

          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            loading={deleteMutation.isPending}
          >
            Excluir
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {!embedded && (
        <Card bordered={false}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Workflows
              </Title>
              <Text type="secondary">
                Gerencie os fluxos e edite tudo em um único Workflow Studio.
              </Text>
            </div>

            {!processAlreadyHasWorkflow && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Novo workflow
              </Button>
            )}
          </div>
        </Card>
      )}

      {processId && processAlreadyHasWorkflow && (
        <Alert
          type="info"
          showIcon
          message="Este processo já possui um workflow vinculado."
          description="Cada processo pode ter apenas um fluxo. Para alterar o fluxo, edite ou exclua o workflow existente."
        />
      )}

      <Card bordered={false}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Input
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar workflow por nome, descrição ou status"
              prefix={<SearchOutlined />}
              style={{ maxWidth: 420 }}
            />

            {!processAlreadyHasWorkflow && (
              <Button icon={<PlusOutlined />} onClick={handleCreate}>
                {processId ? 'Criar workflow para este processo' : 'Criar no Studio'}
              </Button>
            )}
          </div>

          <Table<WorkflowDefinition>
            rowKey="id"
            loading={workflowsQuery.isLoading}
            columns={columns}
            dataSource={filteredItems}
            scroll={{ x: processId ? 900 : 1200 }}
            locale={{ emptyText: <Empty description="Nenhum workflow encontrado" /> }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
          />
        </Space>
      </Card>
    </Space>
  )
}