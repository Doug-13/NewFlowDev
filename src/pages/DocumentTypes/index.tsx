// import { useState } from 'react'
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// import { Table, Button, Modal, Form, Input, Space, Popconfirm, Typography, Tag } from 'antd'
// import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
// import { getDocumentTypes, createDocumentType, updateDocumentType, deleteDocumentType } from '../../api/documentTypes'
// import type { DocumentType } from '../../types'
// import { format } from 'date-fns'
// import { ptBR } from 'date-fns/locale'

// const { Title } = Typography

// export function DocumentTypesPage() {
//   const [open, setOpen] = useState(false)
//   const [editing, setEditing] = useState<DocumentType | null>(null)
//   const [form] = Form.useForm()
//   const qc = useQueryClient()

//   const { data, isLoading } = useQuery({ queryKey: ['document-types'], queryFn: () => getDocumentTypes() })

//   const createMutation = useMutation({
//     mutationFn: createDocumentType,
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-types'] }); handleClose() }
//   })

//   const updateMutation = useMutation({
//     mutationFn: ({ id, data }: any) => updateDocumentType(id, data),
//     onSuccess: () => { qc.invalidateQueries({ queryKey: ['document-types'] }); handleClose() }
//   })

//   const deleteMutation = useMutation({
//     mutationFn: deleteDocumentType,
//     onSuccess: () => qc.invalidateQueries({ queryKey: ['document-types'] })
//   })

//   const handleOpen = (dt?: DocumentType) => {
//     setEditing(dt ?? null)
//     form.setFieldsValue(dt ?? { name: '', description: '' })
//     setOpen(true)
//   }

//   const handleClose = () => { setOpen(false); setEditing(null); form.resetFields() }

//   const handleSubmit = (values: any) => {
//     if (editing) updateMutation.mutate({ id: editing.id, data: values })
//     else createMutation.mutate(values)
//   }

//   const columns = [
//     { title: 'Nome', dataIndex: 'name', key: 'name' },
//     { title: 'Descrição', dataIndex: 'description', key: 'description' },
//     { title: 'Status', key: 'isActive', render: (_: any, r: DocumentType) => <Tag color={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Ativo' : 'Inativo'}</Tag> },
//     {
//       title: 'Criado em',
//       key: 'createdAt',
//       render: (_: any, r: DocumentType) => {
//         if (!r.createdAt) return '—'
//         const date = new Date(r.createdAt)
//         if (isNaN(date.getTime())) return '—'
//         return format(date, 'dd/MM/yyyy', { locale: ptBR })
//       }
//     },
//     {
//       title: 'Ações', key: 'actions', render: (_: any, r: DocumentType) => (
//         <Space>
//           <Button size="small" icon={<EditOutlined />} onClick={() => handleOpen(r)} />
//           <Popconfirm title="Desativar tipo?" onConfirm={() => deleteMutation.mutate(r.id)}>
//             <Button size="small" icon={<DeleteOutlined />} danger />
//           </Popconfirm>
//         </Space>
//       )
//     },
//   ]

//   return (
//     <div>
//       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
//         <Title level={4}>Tipos de Documento</Title>
//         <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Novo Tipo</Button>
//       </div>
//       <Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} />
//       <Modal title={editing ? 'Editar Tipo' : 'Novo Tipo'} open={open} onCancel={handleClose}
//         onOk={() => form.submit()} confirmLoading={createMutation.isPending || updateMutation.isPending}>
//         <Form form={form} layout="vertical" onFinish={handleSubmit}>
//           <Form.Item label="Nome" name="name" rules={[{ required: true }]}>
//             <Input />
//           </Form.Item>
//           <Form.Item label="Descrição" name="description">
//             <Input.TextArea rows={2} />
//           </Form.Item>
//         </Form>
//       </Modal>
//     </div>
//   )
// }
