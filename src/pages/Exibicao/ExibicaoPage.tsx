import {
  Button, Modal, Form, Input, Checkbox, Typography, Space, Table, Tag, Popconfirm, message,
  Tabs, Transfer, Collapse, Tooltip,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  HolderOutlined, MinusCircleOutlined,
} from '@ant-design/icons'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getVisualizacoes,
  createVisualizacao,
  updateVisualizacao,
  deleteVisualizacao,
} from '../../api/visualizacoes'
import { getMetadataDefinitions, type MetadataDefinitionListItem } from '../../api/metadataDefinitions'
import { getMetadataSets, type MetadataSetDto } from '../../api/metadataSets'
import { getProcesses, type Process } from '../../api/processos'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

export interface ColunaVisualizacao {
  metadataId: string
  label: string
  metadataSetName: string
}

export interface Visualizacao {
  id: string
  nome: string
  apenasResponsavel: boolean
  exibirPendenciasAmbientes: boolean
  exibirRevisoesAnteriores: boolean
  mostrarPendenciasTreinamento: boolean
  mostrarPendenciasDistribuicao: boolean
  mostrarDocumentosCompartilhados: boolean
  mostrarItensSeguidos: boolean
  exibirAgrupamentosVazios: boolean
  exibirProgressoDatabook: boolean
  permiteRolagemHorizontal: boolean
  processosVinculados: string[]
  colunas: ColunaVisualizacao[]
}

const DEFAULT_VALUES: Omit<Visualizacao, 'id'> = {
  nome: '',
  apenasResponsavel: false,
  exibirPendenciasAmbientes: false,
  exibirRevisoesAnteriores: false,
  mostrarPendenciasTreinamento: false,
  mostrarPendenciasDistribuicao: false,
  mostrarDocumentosCompartilhados: false,
  mostrarItensSeguidos: false,
  exibirAgrupamentosVazios: false,
  exibirProgressoDatabook: false,
  permiteRolagemHorizontal: false,
  processosVinculados: [],
  colunas: [],
}

// ─── ColunasTab ───────────────────────────────────────────────────────────────

function ColunasTab({
  colunas,
  onChange,
}: {
  colunas: ColunaVisualizacao[]
  onChange: (cols: ColunaVisualizacao[]) => void
}) {
  const [showSelector, setShowSelector] = useState(false)
  const dragIndex = useRef<number | null>(null)

  const { data: metadataList = [] } = useQuery<MetadataDefinitionListItem[]>({
    queryKey: ['metadata-definitions-all'],
    queryFn: () => getMetadataDefinitions(),
  })

  const { data: metadataSets = [] } = useQuery<MetadataSetDto[]>({
    queryKey: ['metadata-sets-all'],
    queryFn: () => getMetadataSets(),
  })

  const setsById     = Object.fromEntries(metadataSets.map((s) => [s.id, s.name]))
  const enrichedList = metadataList.map((m) => ({
    ...m,
    metadataSetName: m.metadataSetName || (m.metadataSetId ? setsById[m.metadataSetId] : undefined) || 'Sem conjunto',
  }))

  const grupos = enrichedList.reduce<Record<string, MetadataDefinitionListItem[]>>((acc, m) => {
    const key = m.metadataSetName ?? 'Sem conjunto'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const selectedIds = new Set(colunas.map((c) => c.metadataId))

  const toggleMetadata = (item: MetadataDefinitionListItem & { metadataSetName?: string }) => {
    if (selectedIds.has(item.id)) {
      onChange(colunas.filter((c) => c.metadataId !== item.id))
    } else {
      onChange([...colunas, { metadataId: item.id, label: item.label, metadataSetName: item.metadataSetName ?? '' }])
    }
  }

  const handleDragStart = (index: number) => { dragIndex.current = index }
  const handleDrop = (dropIndex: number) => {
    if (dragIndex.current === null || dragIndex.current === dropIndex) return
    const next = [...colunas]
    const [moved] = next.splice(dragIndex.current, 1)
    next.splice(dropIndex, 0, moved)
    dragIndex.current = null
    onChange(next)
  }

  const collapseItems = Object.entries(grupos).map(([setName, items]: [string, (MetadataDefinitionListItem & { metadataSetName?: string })[]]) => ({
    key:   setName,
    label: <Text strong>{setName}</Text>,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item) => (
          <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '2px 0' }}>
            <Checkbox checked={selectedIds.has(item.id)} onChange={() => toggleMetadata(item)} />
            <span>{item.label}</span>
            <Tag style={{ marginLeft: 'auto', fontSize: 11 }}>{item.fieldType}</Tag>
          </label>
        ))}
      </div>
    ),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {colunas.length > 0 && (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>Arraste para reordenar as colunas:</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {colunas.map((col, index) => (
              <div
                key={col.metadataId} draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fafafa', cursor: 'grab', userSelect: 'none' }}
              >
                <HolderOutlined style={{ color: '#bfbfbf', fontSize: 14 }} />
                <Text style={{ flex: 1 }}>{col.label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{col.metadataSetName}</Text>
                <Tooltip title="Remover coluna">
                  <MinusCircleOutlined
                    style={{ color: '#ff4d4f', cursor: 'pointer' }}
                    onClick={() => onChange(colunas.filter((c) => c.metadataId !== col.metadataId))}
                  />
                </Tooltip>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="dashed" icon={<PlusOutlined />} onClick={() => setShowSelector((v) => !v)} style={{ alignSelf: 'flex-start' }}>
        {showSelector ? 'Fechar seletor' : 'Adicionar Coluna'}
      </Button>

      {showSelector && (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          {metadataList.length === 0
            ? <div style={{ padding: 16, textAlign: 'center' }}><Text type="secondary">Nenhum metadado encontrado.</Text></div>
            : <Collapse size="small" items={collapseItems} style={{ background: '#fff' }} />
          }
        </div>
      )}
    </div>
  )
}

// ─── ExibicaoPage ─────────────────────────────────────────────────────────────

export function ExibicaoPage() {
  const qc        = useQueryClient()
  const user      = useAuthStore((s) => s.user)
  const accountId = user?.accountId ?? user?.tenantId ?? ''

  const [modalOpen,          setModalOpen]          = useState(false)
  const [activeTab,          setActiveTab]          = useState('geral')
  const [editingItem,        setEditingItem]        = useState<Visualizacao | null>(null)
  const [processosVinculados, setProcessosVinculados] = useState<string[]>([])
  const [colunas,            setColunas]            = useState<ColunaVisualizacao[]>([])
  const [form] = Form.useForm<Omit<Visualizacao, 'id' | 'processosVinculados' | 'colunas'>>()
  const apenasResponsavel = Form.useWatch('apenasResponsavel', form)

  const { data: visualizacoes = [], isLoading } = useQuery<Visualizacao[]>({
    queryKey: ['visualizacoes'],
    queryFn:  getVisualizacoes,
  })

  const { data: processos = [] } = useQuery<Process[]>({
    queryKey: ['processes', accountId],
    queryFn:  () => getProcesses(accountId),
    enabled:  !!accountId,
  })

  const activeProcesses = processos.filter((p) => p.isActive)

  const createMutation = useMutation({
    mutationFn: createVisualizacao,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['visualizacoes'] }); message.success('Visualização criada com sucesso.'); handleClose() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Visualizacao, 'id'> }) => updateVisualizacao(id, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['visualizacoes'] }); message.success('Visualização atualizada com sucesso.'); handleClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVisualizacao,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['visualizacoes'] }); message.success('Visualização removida.') },
  })

  const handleOpenCreate = () => {
    setEditingItem(null); setProcessosVinculados([]); setColunas([])
    form.setFieldsValue(DEFAULT_VALUES); setActiveTab('geral'); setModalOpen(true)
  }

  const handleOpenEdit = (item: Visualizacao) => {
    setEditingItem(item); setProcessosVinculados(item.processosVinculados ?? []); setColunas(item.colunas ?? [])
    form.setFieldsValue(item); setActiveTab('geral'); setModalOpen(true)
  }

  const handleClose = () => {
    setModalOpen(false); setEditingItem(null); setProcessosVinculados([]); setColunas([])
    form.resetFields(); setActiveTab('geral')
  }

  const handleSubmit = (values: Omit<Visualizacao, 'id' | 'processosVinculados' | 'colunas'>) => {
    const data: Omit<Visualizacao, 'id'> = {
      ...values,
      exibirPendenciasAmbientes: values.apenasResponsavel ? values.exibirPendenciasAmbientes : false,
      processosVinculados,
      colunas,
    }
    if (editingItem) { updateMutation.mutate({ id: editingItem.id, data }) }
    else             { createMutation.mutate(data) }
  }

  const transferDataSource = activeProcesses.map((p) => ({ key: p.id, title: p.name, description: p.code ?? '' }))

  const columns = [
    { title: 'Nome', dataIndex: 'nome', key: 'nome', render: (nome: string) => <Text strong>{nome}</Text> },
    {
      title: 'Colunas', key: 'colunas',
      render: (_: unknown, record: Visualizacao) => {
        const cols = record.colunas ?? []
        return cols.length === 0 ? <Text type="secondary">—</Text> : <Space size={4} wrap>{cols.map((c) => <Tag key={c.metadataId}>{c.label}</Tag>)}</Space>
      },
    },
    {
      title: 'Processos', key: 'processos',
      render: (_: unknown, record: Visualizacao) => {
        const vinculados = record.processosVinculados ?? []
        return vinculados.length === 0 ? <Text type="secondary">—</Text> : (
          <Space size={4} wrap>
            {vinculados.map((pid) => { const proc = processos.find((p) => p.id === pid); return proc ? <Tag key={pid}>{proc.name}</Tag> : null })}
          </Space>
        )
      },
    },
    {
      title: 'Configurações', key: 'configs',
      render: (_: unknown, record: Visualizacao) => (
        <Space size={4} wrap>
          {record.apenasResponsavel             && <Tag color="blue">Apenas responsável</Tag>}
          {record.exibirPendenciasAmbientes     && <Tag color="cyan">Todos ambientes</Tag>}
          {record.exibirRevisoesAnteriores      && <Tag color="purple">Revisões anteriores</Tag>}
          {record.mostrarPendenciasTreinamento  && <Tag color="orange">Pend. Treinamento</Tag>}
          {record.mostrarPendenciasDistribuicao && <Tag color="gold">Pend. Distribuição</Tag>}
          {record.mostrarDocumentosCompartilhados && <Tag color="green">Docs Compartilhados</Tag>}
          {record.mostrarItensSeguidos          && <Tag color="geekblue">Itens Seguidos</Tag>}
          {record.exibirAgrupamentosVazios      && <Tag>Agrupamentos vazios</Tag>}
          {record.exibirProgressoDatabook       && <Tag color="volcano">Databook</Tag>}
          {record.permiteRolagemHorizontal      && <Tag color="magenta">Rolagem horizontal</Tag>}
        </Space>
      ),
    },
    {
      title: 'Ações', key: 'acoes', width: 100,
      render: (_: unknown, record: Visualizacao) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
          <Popconfirm title="Remover visualização?" description="Esta ação não pode ser desfeita." onConfirm={() => deleteMutation.mutate(record.id)} okText="Remover" cancelText="Cancelar" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'geral', label: 'Geral',
      children: (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Nome" name="nome" rules={[{ required: true, message: 'Informe o nome da visualização.' }]}>
            <Input placeholder="Ex: Minhas Pendências" />
          </Form.Item>
          <Form.Item name="apenasResponsavel"           valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Apenas itens sob responsabilidade do usuário logado</Checkbox></Form.Item>
          {apenasResponsavel && <Form.Item name="exibirPendenciasAmbientes"   valuePropName="checked" style={{ marginBottom: 4, marginLeft: 24 }}><Checkbox>Exibir pendências de todos os ambientes</Checkbox></Form.Item>}
          <Form.Item name="exibirRevisoesAnteriores"    valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Exibir revisões anteriores</Checkbox></Form.Item>
          <Form.Item name="mostrarPendenciasTreinamento" valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Mostrar somente "Pendências de Treinamentos"</Checkbox></Form.Item>
          <Form.Item name="mostrarPendenciasDistribuicao" valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Mostrar somente "Pendências de Distribuição"</Checkbox></Form.Item>
          <Form.Item name="mostrarDocumentosCompartilhados" valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Mostrar somente "Documentos Compartilhados"</Checkbox></Form.Item>
          <Form.Item name="mostrarItensSeguidos"        valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Mostrar somente "Itens Seguidos"</Checkbox></Form.Item>
          <Form.Item name="exibirAgrupamentosVazios"    valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Exibir agrupamentos vazios</Checkbox></Form.Item>
          <Form.Item name="exibirProgressoDatabook"     valuePropName="checked" style={{ marginBottom: 4 }}><Checkbox>Exibir progresso Databook</Checkbox></Form.Item>
          <Form.Item name="permiteRolagemHorizontal"    valuePropName="checked" style={{ marginBottom: 0 }}><Checkbox>Permite rolagem horizontal</Checkbox></Form.Item>
        </Form>
      ),
    },
    { key: 'colunas',   label: 'Colunas',   children: <ColunasTab colunas={colunas} onChange={setColunas} /> },
    {
      key: 'processos', label: 'Processos',
      children: (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Selecione os processos que deseja vincular a esta visualização.</Text>
          <Transfer
            dataSource={transferDataSource}
            targetKeys={processosVinculados}
            onChange={(nextKeys) => setProcessosVinculados(nextKeys as string[])}
            render={(item) => item.title}
            titles={['Disponíveis', 'Vinculados']}
            listStyle={{ width: '100%', height: 260 }}
            locale={{ itemUnit: 'processo', itemsUnit: 'processos', notFoundContent: 'Nenhum processo encontrado' }}
            showSearch
            filterOption={(inputValue, item) =>
              item.title.toLowerCase().includes(inputValue.toLowerCase()) ||
              item.description.toLowerCase().includes(inputValue.toLowerCase())
            }
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Exibição</Title>
          <Text type="secondary">Gerencie as visualizações personalizadas para listas de itens.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>Criar nova visualização</Button>
      </div>

      <Table<Visualizacao>
        dataSource={visualizacoes} columns={columns} rowKey="id" loading={isLoading}
        locale={{ emptyText: (
          <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <EyeOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
            <Text type="secondary">Nenhuma visualização criada ainda.</Text>
          </div>
        )}}
        pagination={visualizacoes.length > 10 ? { pageSize: 10 } : false}
      />

      <Modal
        title={editingItem ? 'Editar Visualização' : 'Criar nova visualização'}
        open={modalOpen} onCancel={handleClose} onOk={() => form.submit()}
        okText={editingItem ? 'Salvar' : 'Criar'} cancelText="Cancelar"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={620} destroyOnHidden
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} style={{ marginTop: 8 }} />
      </Modal>
    </div>
  )
}