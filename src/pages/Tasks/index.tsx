import { useQuery } from '@tanstack/react-query'
import { Table, Button, Typography, Tag } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getTasks } from '../../api/tasks'
import { StatusBadge } from '../../components/StatusBadge'
import type { ApprovalTask } from '../../types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

export function TasksPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => getTasks('pending'),
  })

  const columns: ColumnsType<ApprovalTask> = [
    {
      title: 'Documento',
      key: 'document',
      render: (_: unknown, r: ApprovalTask) =>
        r.documentTitle ?? r.documentInstanceId ?? '-',
    },
    {
      title: 'Etapa',
      dataIndex: 'stepName',
      key: 'stepName',
    },
    {
      title: 'Atribuído a',
      key: 'assignedTo',
      render: (_: unknown, r: ApprovalTask) => r.assignedToUserName ?? '-',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, r: ApprovalTask) => <StatusBadge status={r.status} />,
    },
    {
      title: 'Prazo',
      key: 'dueAt',
      render: (_: unknown, r: ApprovalTask) => {
        if (!r.dueAt) return '-'

        const due = new Date(r.dueAt)
        const isOverdue = due < new Date()

        return (
          <Tag color={isOverdue ? 'red' : 'blue'}>
            {format(due, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </Tag>
        )
      },
    },
    {
      title: 'Criada em',
      key: 'createdAt',
      render: (_: unknown, r: ApprovalTask) =>
        format(new Date(r.createdAt), 'dd/MM/yyyy', { locale: ptBR }),
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: ApprovalTask) => (
        <Link to={`/documents/${r.documentInstanceId}`}>
          <Button size="small" icon={<EyeOutlined />}>
            Ver Documento
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div>
      <Title level={4}>Minhas Tarefas Pendentes</Title>

      <Table
        dataSource={data ?? []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        locale={{ emptyText: 'Nenhuma tarefa pendente.' }}
      />
    </div>
  )
}