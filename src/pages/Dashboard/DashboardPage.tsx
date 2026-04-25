import { useQuery } from '@tanstack/react-query'
import { Card, Col, Row, Table, Typography, Spin, Empty, Button, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { getDashboard } from '../../api/documents'
import { StatusBadge } from '../../components/StatusBadge'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRightOutlined, CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import './DashboardPage.css'

const { Title, Text } = Typography

interface StatCardProps {
  icon: React.ReactNode
  value: number
  label: string
  color: string
  bgColor: string
}

function StatCard({ icon, value, label, color, bgColor }: StatCardProps) {
  return (
    <Card
      className="stat-card"
      style={{
        background: bgColor,
        border: 'none',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
      hoverable
    >
      <div className="stat-card-content">
        <div className="stat-card-icon" style={{ color }}>
          {icon}
        </div>
        <div className="stat-card-info">
          <div className="stat-card-value" style={{ color }}>
            {value}
          </div>
          <div className="stat-card-label">
            {label}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  const columns = [
    {
      title: 'Documento',
      dataIndex: 'documentName',
      key: 'documentName',
      render: (text: string) => <Text strong>{text}</Text>,
      width: '30%',
    },
    {
      title: 'Etapa',
      dataIndex: 'stepName',
      key: 'stepName',
      render: (text: string) => <Text type="secondary">{text}</Text>,
      width: '25%',
    },
    {
      title: 'Prazo',
      key: 'dueAt',
      render: (_: any, r: any) => {
        const dueDate = r.dueAt ? format(new Date(r.dueAt), 'dd/MM/yyyy', { locale: ptBR }) : '-'
        const isOverdue = r.dueAt && new Date(r.dueAt) < new Date()
        return (
          <Tooltip title={isOverdue ? 'Prazo expirado' : ''}>
            <Text type={isOverdue ? 'danger' : 'secondary'}>
              <CalendarOutlined style={{ marginRight: 6 }} />
              {dueDate}
            </Text>
          </Tooltip>
        )
      },
      width: '20%',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: any) => <StatusBadge status={r.status} />,
      width: '15%',
    },
    {
      title: '',
      key: 'action',
      render: () => (
        <Link to="/tasks">
          <Button
            type="primary"
            size="small"
            icon={<ArrowRightOutlined />}
            style={{ borderRadius: '6px' }}
          >
            Ver
          </Button>
        </Link>
      ),
      width: '10%',
      align: 'right' as const,
    },
  ]

  const hasUrgentTasks = data?.myUrgentTasks && data.myUrgentTasks.length > 0

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            Dashboard
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Bem-vindo! Aqui está um resumo das suas atividades
          </Text>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ExclamationCircleOutlined style={{ fontSize: 28 }} />}
            value={data?.pendingTasks ?? 0}
            label="Tarefas Pendentes"
            color="#fa8c16"
            bgColor="#fffbe6"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ClockCircleOutlined style={{ fontSize: 28 }} />}
            value={data?.inProgress ?? 0}
            label="Em Andamento"
            color="#1677ff"
            bgColor="#e6f7ff"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<CheckCircleOutlined style={{ fontSize: 28 }} />}
            value={data?.approvedToday ?? 0}
            label="Aprovados Hoje"
            color="#52c41a"
            bgColor="#f6ffed"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            icon={<ExclamationCircleOutlined style={{ fontSize: 28 }} />}
            value={data?.rejectedToday ?? 0}
            label="Reprovados Hoje"
            color="#ff4d4f"
            bgColor="#fff1f0"
          />
        </Col>
      </Row>

      {/* Urgent Tasks Table */}
      <Card
        className="urgent-tasks-card"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 4,
                height: 24,
                background: 'linear-gradient(180deg, #ff4d4f 0%, #fa8c16 100%)',
                borderRadius: '2px',
              }}
            />
            <Text strong style={{ fontSize: '16px' }}>
              Minhas Tarefas Urgentes
            </Text>
            {hasUrgentTasks && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  background: '#ff4d4f',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {data?.myUrgentTasks?.length ?? 0}
              </span>
            )}
          </div>
        }
        style={{
          borderRadius: '12px',
          border: '1px solid #f0f0f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        bodyStyle={{ padding: '0px' }}
      >
        {hasUrgentTasks ? (
          <Table
            dataSource={data?.myUrgentTasks}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="middle"
            style={{ borderRadius: '12px' }}
            rowClassName={(_, index) => index % 2 === 0 ? 'table-row-light' : ''}
          />
        ) : (
          <Empty
            description="Nenhuma tarefa urgente"
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>
    </div>
  )
}
