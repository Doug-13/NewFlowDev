import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Tag, Modal, Form, Input, Checkbox, Space, Popconfirm, Typography, Badge
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { listTenants, createTenant, updateTenant, deleteTenant } from '../../api/platform'
import { ALL_MODULES } from '../../types'
import type { Tenant } from '../../types'
import { message } from 'antd'

const { Title } = Typography

export function TenantsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)

  const { data: tenants = [], isLoading } = useQuery({ queryKey: ['platform-tenants'], queryFn: listTenants })

  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      editing
        ? updateTenant(editing.id, { name: values.name, isActive: values.isActive ?? true, modules: values.modules ?? [] })
        : createTenant({ name: values.name, slug: values.slug, modules: values.modules ?? [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenants'] })
      message.success(editing ? 'Tenant atualizado!' : 'Tenant criado!')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['platform-tenants'] }); message.success('Tenant removido!') }
  })

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }

  const openEdit = (t: Tenant) => {
    setEditing(t)
    form.setFieldsValue({ name: t.name, slug: t.slug, isActive: t.isActive, modules: t.modules })
    setOpen(true)
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} align="center">
        <Title level={4} style={{ margin: 0 }}>Tenants (Empresas)</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Novo Tenant</Button>
      </Space>

      <Table
        loading={isLoading}
        dataSource={tenants}
        rowKey="id"
        columns={[
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          { title: 'Código', dataIndex: 'slug', key: 'slug', render: (v) => <code>{v}</code> },
          {
            title: 'Módulos', key: 'modules',
            render: (_, t: Tenant) => t.modules.map(m => {
              const mod = ALL_MODULES.find(x => x.key === m)
              return <Tag key={m}>{mod?.label ?? m}</Tag>
            })
          },
          { title: 'Usuários', dataIndex: 'userCount', key: 'userCount' },
          {
            title: 'Status', dataIndex: 'isActive', key: 'isActive',
            render: (v) => <Badge status={v ? 'success' : 'error'} text={v ? 'Ativo' : 'Inativo'} />
          },
          {
            title: '', key: 'actions',
            render: (_, t: Tenant) => (
              <Space>
                <Button
                  size="small"
                  icon={<TeamOutlined />}
                  onClick={() => navigate(`/platform/tenants/${t.id}/users`, { state: { tenantName: t.name } })}
                >
                  Usuários
                </Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} />
                <Popconfirm title="Remover tenant?" onConfirm={() => deleteMutation.mutate(t.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? 'Editar Tenant' : 'Novo Tenant'}
        open={open}
        onOk={() => form.submit()}
        onCancel={() => { setOpen(false); setEditing(null) }}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item label="Nome da Empresa" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Form.Item label="Código (identificador único)" name="slug" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: 'Apenas letras minúsculas, números e hífens' }]}>
              <Input placeholder="ex: empresa-xyz" />
            </Form.Item>
          )}
          {editing && (
            <Form.Item label="Ativo" name="isActive" valuePropName="checked">
              <Checkbox />
            </Form.Item>
          )}
          <Form.Item label="Módulos habilitados" name="modules">
            <Checkbox.Group
              options={ALL_MODULES.map(m => ({ label: m.label, value: m.key }))}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
