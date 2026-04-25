import { useEffect } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd'
import { MailOutlined } from '@ant-design/icons'

import type { NotificationEventConfig, WorkflowElementConfig } from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text, Title } = Typography

type NotificationEventConfigPanelProps = {
  workflowId: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

type FormValues = NotificationEventConfig

const CHANNEL_OPTIONS = [
  { label: 'E-mail', value: 'email' },
  { label: 'Notificação app', value: 'in-app' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'SMS', value: 'sms' },
  { label: 'Todos os canais', value: 'all' },
]

const DEFAULT_CONFIG: FormValues = {
  notificationTemplateId: undefined,
  channel: 'email',
  recipientRoleIds: [],
  recipientUserIds: [],
  recipientAreaIds: [],
  notifyInitiator: false,
  notifyPreviousAssignees: false,
  customSubject: undefined,
  customBody: undefined,
  contextVariables: [],
}

export function NotificationEventConfigPanel({
  workflowId,
  selectedElement,
  initialConfig,
  onSave,
}: NotificationEventConfigPanelProps) {
  const [form] = Form.useForm<FormValues>()

  useEffect(() => {
    if (!selectedElement) return

    const saved =
      initialConfig?.kind === 'notification'
        ? (initialConfig.config as NotificationEventConfig)
        : null

    form.setFieldsValue({
      notificationTemplateId:
        saved?.notificationTemplateId ?? DEFAULT_CONFIG.notificationTemplateId,
      channel: saved?.channel ?? DEFAULT_CONFIG.channel,
      recipientRoleIds: saved?.recipientRoleIds ?? [],
      recipientUserIds: saved?.recipientUserIds ?? [],
      recipientAreaIds: saved?.recipientAreaIds ?? [],
      notifyInitiator: saved?.notifyInitiator ?? false,
      notifyPreviousAssignees: saved?.notifyPreviousAssignees ?? false,
      customSubject: saved?.customSubject,
      customBody: saved?.customBody,
      contextVariables: saved?.contextVariables ?? [],
    })
  }, [form, initialConfig, selectedElement])

  if (!selectedElement) {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty description="Selecione um evento de notificação no fluxo" />
      </Card>
    )
  }

  if (selectedElement.kind !== 'notification') {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty description="Este elemento não é um evento de notificação" />
      </Card>
    )
  }

  const handleSubmit = (values: FormValues) => {
    onSave({
      workflowId,
      elementId: selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'notification',
      config: {
        notificationTemplateId: values.notificationTemplateId,
        channel: values.channel,
        recipientRoleIds: values.recipientRoleIds ?? [],
        recipientUserIds: values.recipientUserIds ?? [],
        recipientAreaIds: values.recipientAreaIds ?? [],
        notifyInitiator: values.notifyInitiator ?? false,
        notifyPreviousAssignees: values.notifyPreviousAssignees ?? false,
        customSubject: values.customSubject,
        customBody: values.customBody,
        contextVariables: values.contextVariables ?? [],
      } satisfies NotificationEventConfig,
    })
  }

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 18 }}
      title="Configuração de notificação"
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={selectedElement.name || 'Evento de notificação'}
        description={
          <>
            Este é um <strong>disparo automático do fluxo</strong> — não uma
            tarefa humana. Não possui executor, prazo nem ações de decisão.
            Configure apenas o template, o canal e os destinatários.
          </>
        }
      />

      <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
        <Space style={{ marginBottom: 8 }}>
          <MailOutlined style={{ color: '#1677ff', fontSize: 16 }} />
          <Title level={5} style={{ margin: 0 }}>
            Template de notificação
          </Title>
        </Space>

        <Form.Item
          label="Template"
          name="notificationTemplateId"
          rules={[
            {
              required: true,
              message: 'Informe o template de notificação',
            },
          ]}
        >
          <Select
            showSearch
            allowClear
            mode="tags"
            maxCount={1}
            placeholder="Ex.: notif-aprovacao, aviso-prazo, comunicado-publicacao"
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item label="Canal de envio" name="channel">
          <Select options={CHANNEL_OPTIONS} />
        </Form.Item>

        <Divider />

        <Title level={5} style={{ marginBottom: 12 }}>
          Destinatários
        </Title>

        <Row gutter={[12, 0]}>
          <Col xs={24}>
            <Form.Item label="Cargos / perfis" name="recipientRoleIds">
              <Select
                mode="tags"
                placeholder="Ex.: aprovador, gestor, qualidade"
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="Usuários específicos" name="recipientUserIds">
              <Select mode="tags" placeholder="Ex.: douglas, maria, joao" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="Áreas / departamentos" name="recipientAreaIds">
              <Select
                mode="tags"
                placeholder="Ex.: qualidade, engenharia, TI"
              />
            </Form.Item>
          </Col>
        </Row>

        <Space
          direction="vertical"
          style={{ width: '100%', marginBottom: 16 }}
          size={8}
        >
          <Form.Item
            name="notifyInitiator"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch
              checkedChildren="Notificar iniciador do processo"
              unCheckedChildren="Não notificar iniciador"
            />
          </Form.Item>

          <Form.Item
            name="notifyPreviousAssignees"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch
              checkedChildren="Notificar responsáveis da etapa anterior"
              unCheckedChildren="Não notificar etapa anterior"
            />
          </Form.Item>
        </Space>

        <Divider />

        <Title level={5} style={{ marginBottom: 4 }}>
          Conteúdo personalizado
          <Text
            type="secondary"
            style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}
          >
            (opcional — sobrescreve o template)
          </Text>
        </Title>

        <Form.Item label="Assunto personalizado" name="customSubject">
          <Input placeholder="Ex.: Documento {{titulo}} aguarda sua aprovação" />
        </Form.Item>

        <Form.Item label="Corpo personalizado" name="customBody">
          <Input.TextArea
            rows={4}
            placeholder="Olá, {{nome}}. O documento {{titulo}} foi encaminhado para você..."
          />
        </Form.Item>

        <Form.Item
          label="Variáveis de contexto disponíveis"
          name="contextVariables"
          tooltip="Informe as variáveis que serão substituídas no template"
        >
          <Select
            mode="tags"
            placeholder="Ex.: titulo, codigo, aprovador, prazo"
          />
        </Form.Item>

        <Button type="primary" htmlType="submit" block>
          Salvar configuração de notificação
        </Button>
      </Form>
    </Card>
  )
}