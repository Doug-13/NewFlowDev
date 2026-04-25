import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  BranchesOutlined,
  FileAddOutlined,
  SafetyOutlined,
  EyeOutlined,
  FormOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildDefaultBpmnXml,
  createWorkflow,
  EMPTY_WORKFLOW_PERMISSIONS,
  type WorkflowPermissions,
  type WorkflowStatus,
} from '../../api/workflows'
import { getUsers } from '../../api/users'
import { getAreas, getDisciplines, getOrgRoles, getOrgGroups } from '../../api/organization'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

export function PermissionSection({
  value,
  onChange,
}: {
  value: WorkflowPermissions
  onChange: (v: WorkflowPermissions) => void
}) {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: groups = [] } = useQuery({ queryKey: ['org-groups'], queryFn: getOrgGroups })
  const { data: areas = [] } = useQuery({ queryKey: ['org-areas'], queryFn: getAreas })
  const { data: disciplines = [] } = useQuery({
    queryKey: ['org-disciplines'],
    queryFn: getDisciplines,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['org-roles'],
    queryFn: getOrgRoles,
  })

  const update = (
    section: 'visualization' | 'creation',
    field: keyof WorkflowPermissions['visualization'],
    val: string[],
  ) => {
    onChange({
      ...value,
      [section]: {
        ...value[section],
        [field]: val,
      },
    })
  }

  const renderSection = (
    key: 'visualization' | 'creation',
    icon: ReactNode,
    label: string,
    color: string,
  ) => (
    <Card
      size="small"
      title={
        <Space>
          {icon}
          <span style={{ color }}>{label}</span>
        </Space>
      }
      style={{ marginBottom: 16, borderRadius: 12 }}
    >
      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Usuários</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Todos os usuários"
            value={value[key].userIds}
            onChange={(v) => update(key, 'userIds', v ?? [])}
            options={users.map((u: any) => ({ label: u.name, value: u.id }))}
            optionFilterProp="label"
            showSearch
            allowClear
          />
        </Col>

        <Col xs={24} md={12}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Grupos</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Todos os grupos"
            value={value[key].groupIds}
            onChange={(v) => update(key, 'groupIds', v ?? [])}
            options={groups.map((g: any) => ({ label: g.name, value: g.id }))}
            optionFilterProp="label"
            showSearch
            allowClear
          />
        </Col>

        <Col xs={24} md={8}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Áreas</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Todas as áreas"
            value={value[key].areaIds}
            onChange={(v) => update(key, 'areaIds', v ?? [])}
            options={areas.map((a: any) => ({ label: a.name, value: a.id }))}
            optionFilterProp="label"
            showSearch
            allowClear
          />
        </Col>

        <Col xs={24} md={8}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            Disciplinas
          </div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Todas as disciplinas"
            value={value[key].disciplineIds}
            onChange={(v) => update(key, 'disciplineIds', v ?? [])}
            options={disciplines.map((d: any) => ({ label: d.name, value: d.id }))}
            optionFilterProp="label"
            showSearch
            allowClear
          />
        </Col>

        <Col xs={24} md={8}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Funções</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Todas as funções"
            value={value[key].roleIds}
            onChange={(v) => update(key, 'roleIds', v ?? [])}
            options={roles.map((r: any) => ({ label: r.name, value: r.id }))}
            optionFilterProp="label"
            showSearch
            allowClear
          />
        </Col>
      </Row>
    </Card>
  )

  return (
    <div>
      {renderSection('visualization', <EyeOutlined />, 'Visualização', '#1677ff')}
      {renderSection('creation', <FormOutlined />, 'Criação', '#52c41a')}
    </div>
  )
}

type WorkflowNewPageProps = {
  embedded?: boolean
  onCancel?: () => void
  onSaved?: () => void
}

type WorkflowNewFormValues = {
  name: string
  description?: string
  version?: string
  status: WorkflowStatus
  documentTypeName?: string
}

const STATUS_OPTIONS: Array<{ label: string; value: WorkflowStatus }> = [
  { label: 'Rascunho', value: 'draft' },
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
  { label: 'Arquivado', value: 'archived' },
]

export function WorkflowNewPage({
  embedded = false,
  onCancel,
  onSaved,
}: WorkflowNewPageProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm<WorkflowNewFormValues>()
  const [permissions, setPermissions] = useState<WorkflowPermissions>(
    EMPTY_WORKFLOW_PERMISSIONS,
  )

  const processId = searchParams.get('processId') ?? undefined
  const backPath = processId ? `/processes/${processId}` : '/workflows'

  const user = useAuthStore((s) => s.user)
  const accountId = (user as any)?.accountId ?? (user as any)?.tenantId ?? ''
  const accountName = (user as any)?.accountName ?? (user as any)?.tenantName ?? undefined

  const createMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: async (workflow) => {
      await queryClient.invalidateQueries({ queryKey: ['workflows'] })
      message.success('Workflow criado. Agora você pode modelar e configurar tudo no Studio.')

      if (embedded) {
        onSaved?.()
        return
      }

      const studioPath = processId
        ? `/workflows/${workflow.id}/studio?processId=${processId}`
        : `/workflows/${workflow.id}/studio`

      navigate(studioPath)
    },
    onError: (error: any) => {
      const apiMessage =
        error?.response?.data?.message ??
        error?.message ??
        'Não foi possível criar o workflow.'
      message.error(Array.isArray(apiMessage) ? apiMessage.join(', ') : apiMessage)
    },
  })

  const handleSubmit = async (values: WorkflowNewFormValues) => {
    if (!accountId) {
      message.error('Não foi possível identificar o accountId do usuário logado.')
      return
    }

    await createMutation.mutateAsync({
      name: values.name,
      description: values.description,
      version: values.version ?? '1.0',
      status: values.status ?? 'draft',
      documentTypeName: values.documentTypeName,
      processId: processId ?? null,
      processName: null,
      environmentId: null,
      environmentName: null,
      scopeLevel: processId ? 'process' : 'account',
      tenantId: accountId,
      accountName,
      bpmnXml: buildDefaultBpmnXml(values.name),
      stepsCount: 0,
      permissions,
      elementConfigs: [],
      snapshots: [],
      publishedAt: undefined,
    })
  }

  return (
    <div
      style={{
        padding: embedded ? 0 : 24,
        background: embedded ? 'transparent' : '#f5f7fb',
        minHeight: embedded ? 'auto' : '100vh',
      }}
    >
      <Space style={{ marginBottom: 20 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            if (embedded) {
              onCancel?.()
              return
            }
            navigate(backPath)
          }}
        >
          Voltar
        </Button>

        <div>
          <Title level={3} style={{ margin: 0 }}>Novo Workflow</Title>
          <Text type="secondary">
            Crie o rascunho do fluxo e siga para o Workflow Studio.
          </Text>
        </div>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 16 }}
        message="Novo fluxo em modo BPMN-first"
        description="Nesta etapa você cria apenas os dados principais. O desenho das etapas, conexões, gateways, eventos e configurações operacionais será feito no Workflow Studio."
      />

      <Tabs
        items={[
          {
            key: 'general',
            label: (
              <Space>
                <BranchesOutlined />
                Dados do fluxo
              </Space>
            ),
            children: (
              <Form
                form={form}
                layout="vertical"
                initialValues={{ version: '1.0', status: 'draft' }}
                onFinish={handleSubmit}
              >
                <Card
                  bordered={false}
                  style={{ borderRadius: 20 }}
                  title="Dados gerais do workflow"
                >
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Nome do workflow"
                        name="name"
                        rules={[{ required: true, message: 'Informe o nome do workflow' }]}
                      >
                        <Input placeholder="Ex.: Fluxo de Aprovação de Contratos" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Versão" name="version">
                        <Input placeholder="Ex.: 1.0" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Status" name="status">
                        <Select options={STATUS_OPTIONS} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Tipo documental" name="documentTypeName">
                        <Input placeholder="Ex.: Contratos" />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item label="Descrição" name="description">
                        <Input.TextArea
                          rows={3}
                          placeholder="Descreva o objetivo deste workflow"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Space style={{ marginTop: 8 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<FileAddOutlined />}
                      loading={createMutation.isPending}
                    >
                      Criar e abrir no Studio
                    </Button>

                    <Button
                      onClick={() => {
                        if (embedded) {
                          onCancel?.()
                          return
                        }
                        navigate(backPath)
                      }}
                    >
                      Cancelar
                    </Button>
                  </Space>
                </Card>

                <Card bordered={false} style={{ borderRadius: 20, marginTop: 16 }}>
                  <Space align="start">
                    <BranchesOutlined
                      style={{ color: '#1677ff', fontSize: 18, marginTop: 2 }}
                    />
                    <div>
                      <Text strong>Fluxo recomendado</Text>
                      <div>
                        <Text type="secondary">
                          Criar rascunho → modelar no Studio → validar → publicar.
                        </Text>
                      </div>
                    </div>
                  </Space>
                </Card>
              </Form>
            ),
          },
          {
            key: 'permissions',
            label: (
              <Space>
                <SafetyOutlined />
                Permissões
              </Space>
            ),
            children: (
              <Card bordered={false} style={{ borderRadius: 20 }}>
                <PermissionSection value={permissions} onChange={setPermissions} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}