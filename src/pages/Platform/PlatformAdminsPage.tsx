import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Switch, Space, Popconfirm, Typography, Badge, message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  listPlatformAdmins, createPlatformAdmin, updatePlatformAdmin, deletePlatformAdmin
} from '../../api/platform'

const { Title } = Typography

export function PlatformAdminsPage() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['platform-admins'],
    queryFn: listPlatformAdmins
  })

  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      editing
        ? updatePlatformAdmin(editing.id, { name: values.name, isActive: values.isActive, password: values.password || undefined })
        : createPlatformAdmin({ name: values.name, email: values.email, password: values.password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-admins'] })
      message.success(editing ? 'Admin atualizado!' : 'Admin criado!')
      setOpen(false); setEditing(null); form.resetFields()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlatformAdmin,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-admins'] }); message.success('Admin removido!') }
  })

  const openEdit = (a: any) => {
    setEditing(a)
    form.setFieldsValue({ name: a.name, email: a.email, isActive: a.isActive })
    setOpen(true)
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center">
        <Title level={4} style={{ margin: 0 }}>Administradores da Plataforma</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>
          Novo Admin
        </Button>
      </Space>

      <Table
        loading={isLoading}
        dataSource={admins}
        rowKey="id"
        columns={[
          { title: 'Nome', dataIndex: 'name' },
          { title: 'E-mail', dataIndex: 'email' },
          {
            title: 'Status', dataIndex: 'isActive',
            render: (v) => <Badge status={v ? 'success' : 'error'} text={v ? 'Ativo' : 'Inativo'} />
          },
          {
            title: '', key: 'actions',
            render: (_, a: any) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(a)} />
                <Popconfirm title="Remover admin?" onConfirm={() => deleteMutation.mutate(a.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? 'Editar Admin' : 'Novo Admin'}
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
