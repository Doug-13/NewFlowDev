import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BellOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  getNotificationTemplates,
  updateNotificationTemplate,
} from '../../api/notificationTemplates'
import type {
  NotificationChannel,
  NotificationTemplateListItem,
  NotificationTemplatePayload,
} from '../../types/notificationTemplates'

const { Title, Text } = Typography

const CHANNEL_OPTIONS: Array<{ label: string; value: NotificationChannel }> = [
  { label: 'E-mail', value: 'email' },
  { label: 'Sistema', value: 'system' },
  { label: 'WhatsApp', value: 'whatsapp' },
]

const DEFAULT_VALUES: NotificationTemplatePayload = {
  name: '',
  code: '',
  description: '',
  channel: 'email',
  subject: '',
  body: '',
  isActive: true,
}

function getChannelTagColor(channel: NotificationChannel) {
  switch (channel) {
    case 'email':
      return 'blue'
    case 'system':
      return 'purple'
    case 'whatsapp':
      return 'green'
    default:
      return 'default'
  }
}

function normalizeCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

export function NotificationTemplatesPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm<NotificationTemplatePayload>()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<NotificationTemplateListItem | null>(null)

  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'all'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const { data = [], isLoading } = useQuery<NotificationTemplateListItem[]>({
    queryKey: ['notification-templates'],
    queryFn: getNotificationTemplates,
  })

  const createMutation = useMutation({
    mutationFn: createNotificationTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      message.success('Notificação criada com sucesso.')
      handleCloseModal()
    },
    onError: () => {
      message.error('Não foi possível criar a notificação.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: NotificationTemplatePayload }) =>
      updateNotificationTemplate(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      message.success('Notificação atualizada com sucesso.')
      handleCloseModal()
    },
    onError: () => {
      message.error('Não foi possível atualizar a notificação.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotificationTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] })
      message.success('Notificação removida com sucesso.')
    },
    onError: () => {
      message.error('Não foi possível remover a notificação.')
    },
  })

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch =
        !search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase())

      const matchesChannel = channelFilter === 'all' || item.channel === channelFilter

      const matchesActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && item.isActive) ||
        (activeFilter === 'inactive' && !item.isActive)

      return matchesSearch && matchesChannel && matchesActive
    })
  }, [data, search, channelFilter, activeFilter])

  const handleOpenCreate = () => {
    setEditingItem(null)
    form.setFieldsValue(DEFAULT_VALUES)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: NotificationTemplateListItem) => {
    setEditingItem(item)
    form.setFieldsValue({
      name: item.name,
      code: item.code,
      description: item.description || '',
      channel: item.channel,
      subject: item.subject || '',
      body: item.body,
      isActive: item.isActive,
    })
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingItem(null)
    form.resetFields()
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()

    const payload: NotificationTemplatePayload = {
      ...values,
      code: normalizeCode(values.code),
      description: values.description?.trim() || '',
      subject: values.channel === 'email' ? values.subject?.trim() || '' : '',
      body: values.body.trim(),
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload })
      return
    }

    createMutation.mutate(payload)
  }

  const handleToggleActive = (item: NotificationTemplateListItem, checked: boolean) => {
    updateMutation.mutate({
      id: item.id,
      payload: {
        name: item.name,
        code: item.code,
        description: item.description || '',
        channel: item.channel,
        subject: item.subject || '',
        body: item.body,
        isActive: checked,
      },
    })
  }

  const columns: ColumnsType<NotificationTemplateListItem> = [
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.description || 'Sem descrição'}</Text>
        </Space>
      ),
    },
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      width: 180,
      render: value => <Tag>{value}</Tag>,
    },
    {
      title: 'Canal',
      dataIndex: 'channel',
      key: 'channel',
      width: 120,
      render: value => <Tag color={getChannelTagColor(value)}>{value}</Tag>,
    },
    {
      title: 'Ativa',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (_, record) => (
        <Switch checked={record.isActive} onChange={checked => handleToggleActive(record, checked)} />
      ),
    },
    {
      title: 'Atualização',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: value =>
        value ? format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—',
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            Editar
          </Button>

          <Popconfirm
            title="Remover notificação"
            description="Deseja realmente remover esta notificação?"
            okText="Remover"
            cancelText="Cancelar"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const watchedChannel = Form.useWatch('channel', form)

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          <BellOutlined /> Notificações
        </Title>
        <Text type="secondary">
          Cadastre os modelos de notificação que poderão ser usados nas etapas dos workflows.
        </Text>
      </div>

      <Card
        style={{ borderRadius: 16 }}
        title={
          <Space>
            <FilterOutlined />
            <span>Filtros</span>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Buscar por nome, código ou descrição"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </Col>

          <Col xs={24} md={7}>
            <Select
              value={channelFilter}
              onChange={value => setChannelFilter(value)}
              style={{ width: '100%' }}
              options={[
                { label: 'Todos os canais', value: 'all' },
                ...CHANNEL_OPTIONS,
              ]}
            />
          </Col>

          <Col xs={24} md={7}>
            <Select
              value={activeFilter}
              onChange={value => setActiveFilter(value)}
              style={{ width: '100%' }}
              options={[
                { label: 'Todas', value: 'all' },
                { label: 'Ativas', value: 'active' },
                { label: 'Inativas', value: 'inactive' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card
        style={{ borderRadius: 16 }}
        title="Modelos de notificação"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Nova notificação
          </Button>
        }
      >
        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={filteredData}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        title={editingItem ? 'Editar notificação' : 'Nova notificação'}
        open={modalOpen}
        onCancel={handleCloseModal}
        onOk={handleSubmit}
        okText={editingItem ? 'Salvar alterações' : 'Criar notificação'}
        cancelText="Cancelar"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={760}
        destroyOnHidden
      >
        <Form<NotificationTemplatePayload>
          form={form}
          layout="vertical"
          initialValues={DEFAULT_VALUES}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Nome"
                name="name"
                rules={[{ required: true, message: 'Informe o nome da notificação' }]}
              >
                <Input placeholder="Ex.: Notificar aprovador" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Código"
                name="code"
                rules={[{ required: true, message: 'Informe o código da notificação' }]}
                extra="Será normalizado para MAIÚSCULO_COM_UNDERSCORE."
              >
                <Input
                  placeholder="Ex.: notificar_aprovador"
                  onChange={e => {
                    form.setFieldValue('code', normalizeCode(e.target.value))
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Canal"
                name="channel"
                rules={[{ required: true, message: 'Selecione o canal' }]}
              >
                <Select options={CHANNEL_OPTIONS} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Ativa"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Descrição" name="description">
                <Input.TextArea rows={2} placeholder="Descreva quando esta notificação deve ser usada" />
              </Form.Item>
            </Col>

            {watchedChannel === 'email' && (
              <Col xs={24}>
                <Form.Item
                  label="Assunto"
                  name="subject"
                  rules={[{ required: true, message: 'Informe o assunto do e-mail' }]}
                >
                  <Input placeholder="Ex.: Documento aguardando sua aprovação" />
                </Form.Item>
              </Col>
            )}

            <Col xs={24}>
              <Form.Item
                label="Mensagem"
                name="body"
                rules={[{ required: true, message: 'Informe a mensagem da notificação' }]}
                extra="Você pode usar placeholders como {{documento}}, {{etapa}}, {{usuario}}, {{workflow}}."
              >
                <Input.TextArea
                  rows={8}
                  placeholder="Olá {{usuario}}, o documento {{documento}} avançou para a etapa {{etapa}}."
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  )
}