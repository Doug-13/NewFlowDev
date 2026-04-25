import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Switch, Space,
  Popconfirm, Typography, Badge, message, Breadcrumb
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { listTenantUsers, createTenantUser, updateTenantUser, deleteTenantUser } from '../../api/platform'

const { Title } = Typography

const ROLES = [
  { label: 'Admin', value: 'Admin' },
  { label: 'Gerente', value: 'Gerente' },
  { label: 'Operador', value: 'Operador' },
]

export function TenantUsersPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const tenantName = (location.state as any)?.tenantName ?? 'Empresa'

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['tenant-users', id],
    queryFn: () => listTenantUsers(id!)
  })

  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      editing
        ? updateTenantUser(id!, editing.id, {
            name: values.name,
            role: values.role,
            isActive: values.isActive ?? true,
            password: values.password || undefined
          })
        : createTenantUser(id!, {
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-users', id] })
      qc.invalidateQueries({ queryKey: ['platform-tenants'] })
      message.success(editing ? 'Usuário atualizado!' : 'Usuário criado!')
      setOpen(false); setEditing(null); form.resetFields()
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error ?? 'Erro ao salvar.')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteTenantUser(id!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-users', id] })
      qc.invalidateQueries({ queryKey: ['platform-tenants'] })
      message.success('Usuário removido!')
    }
  })

  const openEdit = (u: any) => {
    setEditing(u)
    form.setFieldsValue({ name: u.name, email: u.email, role: u.role, isActive: u.isActive })
    setOpen(true)
  }

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <a onClick={() => navigate('/platform')}>Inquilinos</a> },
          { title: tenantName },
          { title: 'Usuários' }
        ]}
      />

      <Space style={{ marginBottom: 16 }} align="center">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform')}>Voltar</Button>
        <Title level={4} style={{ margin: 0 }}>Usuários — {tenantName}</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>
          Novo Usuário
        </Button>
      </Space>

      <Table
        loading={isLoading}
        dataSource={users}
        rowKey="id"
        columns={[
          { title: 'Nome', dataIndex: 'name' },
          { title: 'E-mail', dataIndex: 'email' },
          { title: 'Perfil', dataIndex: 'role' },
          {
            title: 'Status', dataIndex: 'isActive',
            render: (v) => <Badge status={v ? 'success' : 'error'} text={v ? 'Ativo' : 'Inativo'} />
          },
          {
            title: '', key: 'actions',
            render: (_, u: any) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)} />
                <Popconfirm title="Remover usuário?" onConfirm={() => deleteMutation.mutate(u.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? 'Editar Usuário' : 'Novo Usuário'}
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); setEditing(null) }}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item label="E-mail" name="email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item
            label={editing ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
            name="password"
            rules={editing ? [] : [{ required: true, min: 6 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="Perfil" name="role" rules={[{ required: true }]} initialValue="Operador">
            <Select options={ROLES} />
          </Form.Item>
          {editing && (
            <Form.Item label="Ativo" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
