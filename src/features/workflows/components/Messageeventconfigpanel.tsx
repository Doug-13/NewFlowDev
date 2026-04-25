import { useEffect, useMemo } from 'react'
import {
  Alert, Avatar, Button, Card, Empty, Form, Select, Space, Tabs, Tag, Typography,
} from 'antd'
import {
  BellOutlined, MailOutlined, TeamOutlined, UserOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getNotificationTemplates } from '../../../api/notificationTemplates'
import { getUsers } from '../../../api/users'
import { getOrgGroups, getOrgRoles } from '../../../api/organization'
import type { WorkflowElementConfig } from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageEventConfig = {
  notificationTemplateIds: string[]
  recipientUserIds: string[]
  recipientGroupIds: string[]
  recipientRoleIds: string[]
  triggerMode: 'on-enter' | 'on-exit' | 'manual'
  auditNote?: string
}

type FormValues = MessageEventConfig

type Props = {
  workflowId: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

const DEFAULT: FormValues = {
  notificationTemplateIds: [],
  recipientUserIds:        [],
  recipientGroupIds:       [],
  recipientRoleIds:        [],
  triggerMode:             'on-enter',
}

const tabPaneStyle: React.CSSProperties = { padding: '20px 24px 4px', minHeight: 260 }
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 12, display: 'block',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MessageEventConfigPanel({ workflowId, selectedElement, initialConfig, onSave }: Props) {
  const [form] = Form.useForm<FormValues>()

  const { data: templates = [] }  = useQuery({ queryKey: ['notification-templates'], queryFn: getNotificationTemplates })
  const { data: users = [] }      = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: groups = [] }     = useQuery({ queryKey: ['org-groups'], queryFn: getOrgGroups })
  const { data: roles = [] }      = useQuery({ queryKey: ['org-roles'], queryFn: getOrgRoles })

  useEffect(() => {
    if (!selectedElement) return
    const saved = initialConfig?.kind === 'notification'
      ? (initialConfig.config as MessageEventConfig)
      : null
    form.setFieldsValue(saved ? { ...DEFAULT, ...saved } : DEFAULT)
  }, [form, initialConfig, selectedElement])

  if (!selectedElement) return <Card variant="borderless"><Empty description="Selecione um evento no fluxo" /></Card>

  const templateOptions = useMemo(() =>
    (templates as any[]).map((t: any) => ({
      value: t.id,
      label: (
        <Space size={8}>
          <Tag color={t.channel === 'email' ? 'blue' : t.channel === 'whatsapp' ? 'green' : 'default'} style={{ margin: 0 }}>
            {t.channel}
          </Tag>
          {t.name}
        </Space>
      ),
    })), [templates])

  const userOptions = useMemo(() =>
    (users as any[]).filter((u: any) => u.isActive !== false).map((u: any) => ({
      value: u.id,
      label: (
        <Space size={8}>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: '#69b1ff' }} />
          <span>{u.name}</span>
          {u.jobTitle && <Text type="secondary" style={{ fontSize: 11 }}>{u.jobTitle}</Text>}
        </Space>
      ),
    })), [users])

  const groupOptions = useMemo(() =>
    (groups as any[]).filter((g: any) => g.isActive !== false).map((g: any) => ({
      value: g.id,
      label: <Space size={8}><TeamOutlined style={{ color: '#7c3aed' }} /><span>{g.name}</span></Space>,
    })), [groups])

  const roleOptions = useMemo(() =>
    (roles as any[]).filter((r: any) => r.isActive !== false).map((r: any) => ({
      value: r.id,
      label: r.name,
    })), [roles])

  const handleSubmit = (values: FormValues) => {
    onSave({
      workflowId,
      elementId:   selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'notification',
      config: values satisfies MessageEventConfig,
    })
  }

  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit} initialValues={DEFAULT}>
      <Card
        variant="borderless"
        style={{ borderRadius: 18 }}
        title={<Space><MailOutlined style={{ color: '#1677ff' }} /><span>Evento de Mensagem</span></Space>}
        bodyStyle={{ padding: 0 }}
      >
        <Alert
          type="info" showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message={selectedElement.name || 'Evento de Mensagem'}
          description="Dispara notificações automaticamente quando o fluxo chega neste evento. Configure os templates e destinatários abaixo."
        />

        <Tabs
          size="small"
          tabBarStyle={{ margin: '16px 0 0 0', paddingLeft: 24, paddingRight: 24, borderBottom: '1px solid #f1f5f9', background: '#fafbfc' }}
          items={[
            {
              key: 'templates',
              label: <Space size={6}><BellOutlined /><span>Templates</span></Space>,
              children: (
                <div style={tabPaneStyle}>
                  <Text style={sectionLabel}>Quando disparar</Text>
                  <Form.Item name="triggerMode" label="Momento do disparo" style={{ marginBottom: 20 }}>
                    <Select options={[
                      { label: 'Ao entrar no evento (on-enter)', value: 'on-enter' },
                      { label: 'Ao sair do evento (on-exit)',    value: 'on-exit'  },
                    ]} />
                  </Form.Item>

                  <Text style={sectionLabel}>Templates de notificação</Text>
                  <Form.Item
                    name="notificationTemplateIds"
                    label="Selecione os templates"
                    rules={[{ required: true, message: 'Selecione pelo menos um template' }]}
                  >
                    <Select
                      mode="multiple" allowClear showSearch
                      placeholder="Selecione os templates de notificação..."
                      options={templateOptions}
                      filterOption={(input, opt) =>
                        String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum template cadastrado" />}
                    />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'recipients',
              label: <Space size={6}><UserOutlined /><span>Destinatários</span></Space>,
              children: (
                <div style={tabPaneStyle}>
                  <Alert
                    type="info" showIcon style={{ marginBottom: 20, borderRadius: 8 }}
                    message="Se nenhum destinatário for selecionado, a notificação é enviada ao responsável atual do documento."
                  />

                  <Form.Item name="recipientUserIds" label={<Space size={4}><UserOutlined style={{ color: '#1677ff' }} /><span>Usuários específicos</span></Space>} style={{ marginBottom: 16 }}>
                    <Select mode="multiple" allowClear showSearch placeholder="Selecione usuários..." options={userOptions}
                      filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                    />
                  </Form.Item>

                  <Form.Item name="recipientGroupIds" label={<Space size={4}><TeamOutlined style={{ color: '#7c3aed' }} /><span>Grupos</span></Space>} style={{ marginBottom: 16 }}>
                    <Select mode="multiple" allowClear showSearch placeholder="Selecione grupos..." options={groupOptions}
                      notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum grupo cadastrado" />}
                    />
                  </Form.Item>

                  <Form.Item name="recipientRoleIds" label="Cargos / Funções" style={{ marginBottom: 0 }}>
                    <Select mode="multiple" allowClear showSearch placeholder="Selecione cargos..." options={roleOptions}
                      notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum cargo cadastrado" />}
                    />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />

        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" htmlType="submit" style={{ borderRadius: 8, background: '#0f172a', borderColor: '#0f172a', fontWeight: 600, paddingLeft: 28, paddingRight: 28 }}>
            Salvar evento
          </Button>
        </div>
      </Card>
    </Form>
  )
}
