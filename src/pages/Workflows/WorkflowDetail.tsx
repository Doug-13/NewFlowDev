import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Tag,
  Tabs,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  BranchesOutlined,
  EditOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import {
  getWorkflowById,
  type WorkflowDefinition,
  type WorkflowStatus,
} from '../../api/workflows'

const { Title, Text } = Typography

type WorkflowDetailPageProps = {
  workflowId?: string
  embedded?: boolean
  onBack?: () => void
}

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

function formatDateTime(value?: string) {
  if (!value) return '-'

  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR,
    })
  } catch {
    return value
  }
}

export function WorkflowDetailPage({
  workflowId,
  embedded = false,
  onBack,
}: WorkflowDetailPageProps) {
  const params = useParams()
  const navigate = useNavigate()
  const resolvedWorkflowId = workflowId ?? params.id

  const workflowQuery = useQuery({
    queryKey: ['workflow', resolvedWorkflowId],
    queryFn: async () => {
      if (!resolvedWorkflowId) throw new Error('Workflow não informado')
      return getWorkflowById(resolvedWorkflowId)
    },
    enabled: !!resolvedWorkflowId,
  })

  const workflow: WorkflowDefinition | null = useMemo(() => {
    return workflowQuery.data ?? null
  }, [workflowQuery.data])

  if (workflowQuery.isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card loading />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Workflow não encontrado" />
      </div>
    )
  }

  return (
    <div
      style={{
        padding: embedded ? 0 : 24,
        background: embedded ? 'transparent' : '#f5f7fb',
        minHeight: embedded ? 'auto' : '100vh',
      }}
    >
      <Space
        style={{
          marginBottom: 20,
          width: '100%',
          justifyContent: 'space-between',
          display: 'flex',
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (embedded) {
                onBack?.()
                return
              }

              navigate('/workflows')
            }}
          >
            Voltar
          </Button>

          <div>
            <Title level={3} style={{ margin: 0 }}>
              {workflow.name}
            </Title>

            <Text type="secondary">
              Resumo do workflow e acesso ao Workflow Studio.
            </Text>
          </div>
        </Space>

        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => navigate(`/workflows/${workflow.id}/studio`)}
          >
            Abrir Studio
          </Button>
        </Space>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card bordered={false} style={{ borderRadius: 18 }}>
            <Text type="secondary">Status</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color={getStatusColor(workflow.status)}>
                {getStatusLabel(workflow.status)}
              </Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card bordered={false} style={{ borderRadius: 18 }}>
            <Text type="secondary">Versão</Text>
            <div style={{ marginTop: 8 }}>
              <Text strong>{workflow.version}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card bordered={false} style={{ borderRadius: 18 }}>
            <Text type="secondary">Tipo documental</Text>
            <div style={{ marginTop: 8 }}>
              <Text strong>{workflow.documentTypeName || '-'}</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card bordered={false} style={{ borderRadius: 18 }}>
            <Text type="secondary">Diagrama BPMN</Text>
            <div style={{ marginTop: 8 }}>
              <Space>
                <BranchesOutlined style={{ color: '#1677ff' }} />
                <Text strong>
                  {workflow.bpmnXml?.trim() ? 'Disponível' : 'Ainda não modelado'}
                </Text>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} style={{ borderRadius: 20 }}>
        <Tabs
          items={[
            {
              key: 'summary',
              label: 'Resumo',
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 16 }}
                    message="Tela de consulta"
                    description="A edição estrutural e operacional do processo fica concentrada no Workflow Studio."
                  />

                  <Descriptions column={2}>
                    <Descriptions.Item label="Nome">
                      {workflow.name}
                    </Descriptions.Item>

                    <Descriptions.Item label="Versão">
                      {workflow.version}
                    </Descriptions.Item>

                    <Descriptions.Item label="Status">
                      <Tag color={getStatusColor(workflow.status)}>
                        {getStatusLabel(workflow.status)}
                      </Tag>
                    </Descriptions.Item>

                    <Descriptions.Item label="Tipo documental">
                      {workflow.documentTypeName || '-'}
                    </Descriptions.Item>

                    <Descriptions.Item label="Criado em">
                      {formatDateTime(workflow.createdAt)}
                    </Descriptions.Item>

                    <Descriptions.Item label="Atualizado em">
                      {formatDateTime(workflow.updatedAt)}
                    </Descriptions.Item>

                    <Descriptions.Item label="Descrição" span={2}>
                      {workflow.description || '-'}
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ),
            },
            {
              key: 'xml',
              label: 'XML BPMN',
              children: (
                <div style={{ paddingTop: 8 }}>
                  {workflow.bpmnXml?.trim() ? (
                    <Card
                      size="small"
                      style={{
                        borderRadius: 16,
                        background: '#0f172a',
                        color: '#e5e7eb',
                      }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: 620,
                          overflow: 'auto',
                          color: '#e5e7eb',
                          fontSize: 12,
                        }}
                      >
                        {workflow.bpmnXml}
                      </pre>
                    </Card>
                  ) : (
                    <Empty description="Nenhum XML BPMN salvo para este workflow" />
                  )}
                </div>
              ),
            },
            {
              key: 'actions',
              label: 'Ações',
              children: (
                <div style={{ paddingTop: 8 }}>
                  <Space direction="vertical" size={12}>
                    <Card bordered={false} style={{ borderRadius: 16 }}>
                      <Space>
                        <EditOutlined style={{ color: '#1677ff' }} />
                        <div>
                          <Text strong>Abrir Workflow Studio</Text>
                          <div>
                            <Text type="secondary">
                              Faça toda a edição estrutural e operacional em uma única tela.
                            </Text>
                          </div>
                        </div>
                      </Space>

                      <div style={{ marginTop: 16 }}>
                        <Button
                          type="primary"
                          onClick={() => navigate(`/workflows/${workflow.id}/studio`)}
                        >
                          Abrir Studio
                        </Button>
                      </div>
                    </Card>

                    <Card bordered={false} style={{ borderRadius: 16 }}>
                      <Space>
                        <FileTextOutlined style={{ color: '#1677ff' }} />
                        <div>
                          <Text strong>Resumo operacional</Text>
                          <div>
                            <Text type="secondary">
                              Use esta tela para inspeção. Use o Studio para mudanças estruturais e funcionais.
                            </Text>
                          </div>
                        </div>
                      </Space>
                    </Card>
                  </Space>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}