import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Space,
  Popconfirm,
  Typography,
  Tag,
  message,
  Card,
  Empty,
  List,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  AppstoreAddOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  TableOutlined,
  DownOutlined,
  RightOutlined,
  FolderFilled,
  SearchOutlined,
} from '@ant-design/icons'
import {
  getMetadataDefinitions,
  createMetadataDefinition,
  updateMetadataDefinition,
  deleteMetadataDefinition,
  type MetadataDefinitionDto,
  type MetadataOptionDto,
  type MetadataTableColumnDto,
} from '../../api/metadata'
import {
  getMetadataSets,
  createMetadataSet,
  updateMetadataSet,
  deleteMetadataSet,
  type MetadataSetDto,
} from '../../api/metadataSets'

const { Title, Text } = Typography

const FIELD_TYPES = [
  { label: 'Texto curto', value: 'text' },
  { label: 'Texto longo', value: 'textarea' },
  { label: 'Número', value: 'number' },
  { label: 'Moeda (R$)', value: 'currency' },
  { label: 'Data', value: 'date' },
  { label: 'Data e hora', value: 'datetime' },
  { label: 'Lista (seleção única)', value: 'select' },
  { label: 'Lista (múltipla)', value: 'multiselect' },
  { label: 'Lista por sigla', value: 'sigla_select' },
  { label: 'Tabela', value: 'table' },
  { label: 'Sim / Não', value: 'boolean' },
  { label: 'Usuário', value: 'user' },
  { label: 'Unidades', value: 'org_units' },
  { label: 'Áreas/Departamentos', value: 'org_areas' },
  { label: 'Disciplinas', value: 'org_disciplines' },
  { label: 'Funções', value: 'org_roles' },
  { label: 'Grupos', value: 'org_groups' },
]

const ORG_FIELD_TYPES = ['org_units', 'org_areas', 'org_disciplines', 'org_roles', 'org_groups']

function isOrgField(fieldType?: string) {
  return !!fieldType && ORG_FIELD_TYPES.includes(fieldType)
}

const STRING_MASKS = [
  { label: 'Sem máscara', value: 'none' },
  { label: 'CPF', value: 'cpf' },
  { label: 'CNPJ', value: 'cnpj' },
  { label: 'CPF/CNPJ', value: 'cpf_cnpj' },
  { label: 'Telefone', value: 'phone' },
  { label: 'CEP', value: 'cep' },
]

const LIST_FIELD_TYPES = ['select', 'multiselect', 'sigla_select']

function isListField(fieldType?: string) {
  return !!fieldType && LIST_FIELD_TYPES.includes(fieldType)
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function buildCode(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function buildSiglaCode(value: string) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
}

function formatOptionsText(options: MetadataOptionDto[] = [], fieldType?: string) {
  if (!options.length) return ''

  if (fieldType === 'sigla_select') {
    return options.map((o) => `${o.sigla ?? o.value}=${o.label}`).join('\n')
  }

  return options.map((o) => `${o.value}=${o.label}`).join('\n')
}

function parseOptions(text: string, fieldType: string): MetadataOptionDto[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split('=')
      const rawLeft = left?.trim() ?? ''
      const rawRight = rest.join('=').trim()

      if (fieldType === 'sigla_select') {
        const label = rawRight || rawLeft
        const sigla = buildSiglaCode(rawLeft || label)

        return {
          value: sigla,
          label,
          sigla,
        }
      }

      const label = rawRight || rawLeft
      const value = buildCode(rawLeft || label)

      return {
        value,
        label,
      }
    })
}

type SortMode = 'display' | 'alphabetical'

export function MetadataPage() {
  const qc = useQueryClient()

  const [openMetadataModal, setOpenMetadataModal] = useState(false)
  const [editingMetadata, setEditingMetadata] = useState<MetadataDefinitionDto | null>(null)
  const [fieldType, setFieldType] = useState('text')
  const [multipleSelection, setMultipleSelection] = useState(false)
  const [optionsText, setOptionsText] = useState('')
  const [selectedSetId, setSelectedSetId] = useState<string | undefined>(undefined)

  const [openSetModal, setOpenSetModal] = useState(false)
  const [editingSet, setEditingSet] = useState<MetadataSetDto | null>(null)

  const [selectedTableMetadataId, setSelectedTableMetadataId] = useState<string | undefined>(undefined)
  const [tableColumns, setTableColumns] = useState<MetadataTableColumnDto[]>([])
  const [collapsedSets, setCollapsedSets] = useState<Record<string, boolean>>({})
  const [sortMode, setSortMode] = useState<SortMode>('display')
  const [searchTerm, setSearchTerm] = useState('')

  const [metadataForm] = Form.useForm<Partial<MetadataDefinitionDto>>()
  const [setForm] = Form.useForm<Partial<MetadataSetDto>>()

  const watchedLabel = Form.useWatch('label', metadataForm)
  const watchedSetName = Form.useWatch('name', setForm)
  const watchedMetadataSetId = Form.useWatch('metadataSetId', metadataForm)

  useEffect(() => {
    const generatedName = buildCode(watchedLabel ?? '')
    metadataForm.setFieldValue('name', generatedName)
  }, [watchedLabel, metadataForm])

  useEffect(() => {
    const generatedCode = buildCode(watchedSetName ?? '')
    setForm.setFieldValue('code', generatedCode)
  }, [watchedSetName, setForm])

  const { data: metadataSets = [], isLoading: isLoadingSets } = useQuery({
    queryKey: ['metadata-sets'],
    queryFn: () => getMetadataSets(),
  })

  const { data: allMetadataDefinitions = [], isLoading } = useQuery({
    queryKey: ['metadata-definitions', 'all'],
    queryFn: () => getMetadataDefinitions(),
  })

  useEffect(() => {
    if (!selectedSetId && metadataSets.length > 0) {
      setSelectedSetId(metadataSets[0].id)
    }
  }, [metadataSets, selectedSetId])

  useEffect(() => {
    setCollapsedSets((prev) => {
      const next = { ...prev }

      metadataSets.forEach((set) => {
        if (next[set.id] === undefined) {
          next[set.id] = false
        }
      })

      Object.keys(next).forEach((key) => {
        if (!metadataSets.some((set) => set.id === key)) {
          delete next[key]
        }
      })

      return next
    })
  }, [metadataSets])

  useEffect(() => {
    if (!watchedMetadataSetId) return

    setTableColumns((current) =>
      current.filter((column) =>
        allMetadataDefinitions.some(
          (item) =>
            item.id === column.metadataDefinitionId &&
            item.metadataSetId === watchedMetadataSetId &&
            item.fieldType !== 'table',
        ),
      ),
    )
  }, [watchedMetadataSetId, allMetadataDefinitions])

  const createMetadataMutation = useMutation({
    mutationFn: createMetadataDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metadata-definitions'] })
      handleCloseMetadataModal()
      message.success('Metadado criado com sucesso.')
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Não foi possível criar o metadado.')
    },
  })

  const updateMetadataMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MetadataDefinitionDto> }) =>
      updateMetadataDefinition(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metadata-definitions'] })
      handleCloseMetadataModal()
      message.success('Metadado atualizado com sucesso.')
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Não foi possível atualizar o metadado.')
    },
  })

  const deleteMetadataMutation = useMutation({
    mutationFn: deleteMetadataDefinition,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metadata-definitions'] })
      message.success('Metadado removido com sucesso.')
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Não foi possível remover o metadado.')
    },
  })

  const createSetMutation = useMutation({
    mutationFn: createMetadataSet,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['metadata-sets'] })
      setSelectedSetId(created.id)
      setCollapsedSets((prev) => ({ ...prev, [created.id]: false }))
      handleCloseSetModal()
      message.success('Conjunto criado com sucesso.')
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Não foi possível criar o conjunto.')
    },
  })

  const updateSetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MetadataSetDto> }) =>
      updateMetadataSet(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metadata-sets'] })
      handleCloseSetModal()
      message.success('Conjunto atualizado com sucesso.')
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Não foi possível atualizar o conjunto.')
    },
  })

  const deleteSetMutation = useMutation({
    mutationFn: deleteMetadataSet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metadata-sets'] })
      qc.invalidateQueries({ queryKey: ['metadata-definitions'] })
      setSelectedSetId(undefined)
      message.success('Conjunto removido com sucesso.')
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Não foi possível remover o conjunto.')
    },
  })

  const typeLabels: Record<string, string> = useMemo(
    () => Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label])),
    [],
  )

  const maskLabels: Record<string, string> = useMemo(
    () => Object.fromEntries(STRING_MASKS.map((t) => [t.value, t.label])),
    [],
  )

  const groupedSets = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm.trim())

    const sortSets = [...metadataSets].sort((a, b) => {
      if (sortMode === 'alphabetical') {
        return a.name.localeCompare(b.name)
      }

      return a.orderIndex - b.orderIndex || a.name.localeCompare(b.name)
    })

    const sortMetadata = (items: MetadataDefinitionDto[]) => {
      const next = [...items]

      if (sortMode === 'alphabetical') {
        return next.sort((a, b) => a.label.localeCompare(b.label))
      }

      return next.sort((a, b) => a.orderIndex - b.orderIndex || a.label.localeCompare(b.label))
    }

    return sortSets
      .map((set) => {
        let metadata = allMetadataDefinitions.filter((item) => item.metadataSetId === set.id)

        if (normalizedSearch) {
          metadata = metadata.filter((item) => {
            const label = normalizeText(item.label)
            const name = normalizeText(item.name)
            return label.includes(normalizedSearch) || name.includes(normalizedSearch)
          })
        }

        return {
          ...set,
          metadata: sortMetadata(metadata),
        }
      })
      .filter((set) => {
        if (!normalizedSearch) return true
        return set.metadata.length > 0
      })
  }, [metadataSets, allMetadataDefinitions, sortMode, searchTerm])

  const availableMetadataForTable = useMemo(() => {
    if (!watchedMetadataSetId) return []

    const usedIds = new Set(tableColumns.map((item) => item.metadataDefinitionId))

    return allMetadataDefinitions.filter((item) => {
      if (item.metadataSetId !== watchedMetadataSetId) return false
      if (item.fieldType === 'table') return false
      if (editingMetadata?.id === item.id) return false
      if (usedIds.has(item.id)) return false
      return true
    })
  }, [allMetadataDefinitions, watchedMetadataSetId, tableColumns, editingMetadata])

  const toggleSet = (setId: string) => {
    setCollapsedSets((prev) => ({
      ...prev,
      [setId]: !prev[setId],
    }))
  }

  const handleAddTableColumn = () => {
    if (!selectedTableMetadataId) {
      message.warning('Selecione um metadado para adicionar na tabela.')
      return
    }

    const field = availableMetadataForTable.find((item) => item.id === selectedTableMetadataId)
    if (!field) {
      message.warning('Metadado não encontrado para a composição da tabela.')
      return
    }

    setTableColumns((current) => [
      ...current,
      {
        id: `${field.id}_${Date.now()}`,
        metadataDefinitionId: field.id,
        internalName: field.name,
        externalName: field.label,
        fieldType: field.fieldType,
        orderIndex: current.length,
      },
    ])

    setSelectedTableMetadataId(undefined)
  }

  const handleMoveTableColumn = (index: number, direction: 'up' | 'down') => {
    setTableColumns((current) => {
      const next = [...current]
      const targetIndex = direction === 'up' ? index - 1 : index + 1

      if (targetIndex < 0 || targetIndex >= next.length) return current

      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp

      return next.map((item, idx) => ({
        ...item,
        orderIndex: idx,
      }))
    })
  }

  const handleRemoveTableColumn = (id: string) => {
    setTableColumns((current) =>
      current
        .filter((item) => item.id !== id)
        .map((item, index) => ({
          ...item,
          orderIndex: index,
        })),
    )
  }

  const getNextMetadataOrder = (metadataSetId?: string) => {
    if (!metadataSetId) return 1

    const itemsFromSet = allMetadataDefinitions.filter((item) => item.metadataSetId === metadataSetId)
    return itemsFromSet.length + 1
  }

  const handleOpenMetadataModal = (item?: MetadataDefinitionDto, forcedSetId?: string) => {
    if (!item && metadataSets.length === 0) {
      message.warning('Crie um conjunto antes de cadastrar um metadado.')
      return
    }

    const current = item ?? null
    const initialSetId = current?.metadataSetId ?? forcedSetId ?? selectedSetId ?? metadataSets[0]?.id
    const initialOrderIndex = current?.orderIndex ?? getNextMetadataOrder(initialSetId)

    setEditingMetadata(current)
    setFieldType(current?.fieldType ?? 'text')
    setMultipleSelection((current as any)?.multipleSelection ?? false)
    setOptionsText(formatOptionsText(current?.options ?? [], current?.fieldType))
    setTableColumns(
      (current?.tableColumns ?? []).map((column, index) => ({
        ...column,
        orderIndex: index,
      })),
    )
    setSelectedTableMetadataId(undefined)

    metadataForm.setFieldsValue(
      current ?? {
        label: '',
        name: '',
        fieldType: 'text',
        maskType: 'none',
        isRequired: false,
        isActive: true,
        orderIndex: initialOrderIndex,
        metadataSetId: initialSetId,
      },
    )

    setOpenMetadataModal(true)
  }

  const handleCloseMetadataModal = () => {
    setOpenMetadataModal(false)
    setEditingMetadata(null)
    setFieldType('text')
    setMultipleSelection(false)
    setOptionsText('')
    setSelectedTableMetadataId(undefined)
    setTableColumns([])
    metadataForm.resetFields()
  }

  const handleOpenSetModal = (item?: MetadataSetDto) => {
    const current = item ?? null
    setEditingSet(current)

    setForm.setFieldsValue(
      current ?? {
        name: '',
        code: '',
        description: '',
        isActive: true,
        orderIndex: 0,
      },
    )

    setOpenSetModal(true)
  }

  const handleCloseSetModal = () => {
    setOpenSetModal(false)
    setEditingSet(null)
    setForm.resetFields()
  }

  const handleSubmitMetadata = (values: Partial<MetadataDefinitionDto>) => {
    const generatedName = buildCode(values.label ?? '')

    if (!values.metadataSetId) {
      message.error('Selecione o conjunto de metadados.')
      return
    }

    const parsedOptions = isListField(values.fieldType)
      ? parseOptions(optionsText, values.fieldType!)
      : undefined

    if (isListField(values.fieldType) && (!parsedOptions || parsedOptions.length === 0)) {
      message.error('Informe ao menos uma opção para a lista.')
      return
    }

    if (values.fieldType === 'table' && tableColumns.length === 0) {
      message.error('Adicione ao menos um metadado para compor a tabela.')
      return
    }

    const payload: Partial<MetadataDefinitionDto> = {
      ...values,
      name: generatedName,
      maskType: values.fieldType === 'text' ? values.maskType ?? 'none' : null,
      options: isListField(values.fieldType) ? parsedOptions : [],
      tableColumns: values.fieldType === 'table' ? tableColumns : [],
      ...(isOrgField(values.fieldType) ? { multipleSelection } : { multipleSelection: false }),
    }

    if (editingMetadata) {
      updateMetadataMutation.mutate({
        id: editingMetadata.id,
        data: payload,
      })
      return
    }

    createMetadataMutation.mutate(payload)
  }

  const handleSubmitSet = (values: Partial<MetadataSetDto>) => {
    const payload: Partial<MetadataSetDto> = {
      ...values,
      code: buildCode(values.name ?? ''),
    }

    if (editingSet) {
      updateSetMutation.mutate({
        id: editingSet.id,
        data: payload,
      })
      return
    }

    createSetMutation.mutate(payload)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Metadados
          </Title>
          <Text type="secondary">
            Visualização agrupada por conjunto.
          </Text>
        </div>

        <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={() => handleOpenSetModal()}>
            Novo Conjunto
          </Button>

          <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => handleOpenMetadataModal()}>
            Novo Campo
          </Button>
        </Space>
      </div>

      <Card
        loading={isLoading || isLoadingSets}
        styles={{
          body: {
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          },
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Input
            allowClear
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar metadado por nome externo ou interno"
            prefix={<SearchOutlined />}
            style={{ width: 360, maxWidth: '100%' }}
          />

          <Select
            value={sortMode}
            onChange={(value) => setSortMode(value)}
            style={{ width: 240 }}
            options={[
              { label: 'Ordenar por ordem de demonstração', value: 'display' },
              { label: 'Ordenar por ordem alfabética', value: 'alphabetical' },
            ]}
          />
        </div>

        {groupedSets.length === 0 ? (
          <Empty
            description={
              searchTerm
                ? 'Nenhum metadado encontrado para a pesquisa informada.'
                : 'Nenhum conjunto cadastrado.'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={18}>
            {groupedSets.map((set) => {
              const isCollapsed = collapsedSets[set.id] ?? false

              return (
                <div
                  key={set.id}
                  style={{
                    border: '1px solid #d9e7ff',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: '#fafcff',
                    boxShadow: '0 1px 2px rgba(22, 119, 255, 0.05)',
                  }}
                >
                  <div
                    onClick={() => toggleSet(set.id)}
                    style={{
                      cursor: 'pointer',
                      background: 'linear-gradient(90deg, #e6f4ff 0%, #f7fbff 100%)',
                      borderLeft: '6px solid #1677ff',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <Space align="center" size={12}>
                      <Button
                        type="text"
                        size="small"
                        icon={isCollapsed ? <RightOutlined /> : <DownOutlined />}
                      />
                      <FolderFilled style={{ color: '#1677ff', fontSize: 18 }} />
                      <div>
                        <Space wrap size={8}>
                          <Text strong style={{ fontSize: 15 }}>
                            {set.name}
                          </Text>
                          <Tag color="blue">Conjunto</Tag>
                          <Tag>{set.code}</Tag>
                          <Tag color="gold">{set.metadata.length} metadado(s)</Tag>
                          {!set.isActive && <Tag>Inativo</Tag>}
                        </Space>

                        {!!set.description && (
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary">{set.description}</Text>
                          </div>
                        )}
                      </div>
                    </Space>

                    <Space
                      onClick={(e) => e.stopPropagation()}
                      wrap
                    >
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleOpenMetadataModal(undefined, set.id)}
                      >
                        Novo Metadado
                      </Button>

                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenSetModal(set)}
                      />

                      <Popconfirm
                        title="Remover conjunto?"
                        description="Só será possível remover se não houver metadados vinculados."
                        onConfirm={() => deleteSetMutation.mutate(set.id)}
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </Space>
                  </div>

                  {!isCollapsed && (
                    <div
                      style={{
                        background: '#fff',
                        padding: 12,
                      }}
                    >
                      {set.metadata.length === 0 ? (
                        <Empty
                          description={
                            searchTerm
                              ? 'Nenhum metadado deste conjunto corresponde à pesquisa.'
                              : 'Nenhum metadado neste conjunto.'
                          }
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ) : (
                        <List
                          dataSource={set.metadata}
                          split={false}
                          renderItem={(metadata) => (
                            <List.Item
                              style={{
                                padding: '10px 12px',
                                border: '1px solid #f0f0f0',
                                borderRadius: 12,
                                marginBottom: 10,
                                background: '#ffffff',
                              }}
                              actions={[
                                <Button
                                  key="edit"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleOpenMetadataModal(metadata)}
                                />,
                                <Popconfirm
                                  key="delete"
                                  title="Remover metadado?"
                                  description="Essa ação não poderá ser desfeita."
                                  onConfirm={() => deleteMetadataMutation.mutate(metadata.id)}
                                >
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                  />
                                </Popconfirm>,
                              ]}
                            >
                              <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <Space wrap size={[8, 8]}>
                                    <Text strong style={{ fontSize: 14 }}>
                                      {metadata.label}
                                    </Text>

                                    <Text type="secondary">
                                      ({metadata.name})
                                    </Text>

                                    <Tag color="blue">Ordem {metadata.orderIndex}</Tag>
                                    <Tag>{typeLabels[metadata.fieldType] ?? metadata.fieldType}</Tag>

                                    {metadata.fieldType === 'text' &&
                                      metadata.maskType &&
                                      metadata.maskType !== 'none' && (
                                        <Tag color="purple">
                                          {maskLabels[metadata.maskType] ?? metadata.maskType}
                                        </Tag>
                                      )}

                                    {metadata.isRequired && <Tag color="red">Obrigatório</Tag>}
                                    {!metadata.isActive && <Tag>Inativo</Tag>}

                                    {metadata.fieldType === 'table' && (
                                      <Tag color="gold" icon={<TableOutlined />}>
                                        {(metadata.tableColumns ?? []).length} colunas
                                      </Tag>
                                    )}
                                  </Space>

                                  {metadata.fieldType === 'table' && (metadata.tableColumns ?? []).length > 0 && (
                                    <div
                                      style={{
                                        background: '#fafafa',
                                        borderRadius: 10,
                                        padding: 10,
                                        border: '1px dashed #d9d9d9',
                                      }}
                                    >
                                      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                                        Colunas da tabela
                                      </Text>

                                      <Space wrap>
                                        {(metadata.tableColumns ?? []).map((column) => (
                                          <Tag key={column.id}>
                                            {column.externalName} ({column.internalName})
                                          </Tag>
                                        ))}
                                      </Space>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </List.Item>
                          )}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Space>
        )}
      </Card>

      <Modal
        title={editingSet ? 'Editar Conjunto de Metadados' : 'Novo Conjunto de Metadados'}
        open={openSetModal}
        onCancel={handleCloseSetModal}
        onOk={() => setForm.submit()}
        confirmLoading={createSetMutation.isPending || updateSetMutation.isPending}
        width={620}
        destroyOnClose
      >
        <Form
          form={setForm}
          layout="vertical"
          onFinish={handleSubmitSet}
          initialValues={{
            name: '',
            code: '',
            description: '',
            isActive: true,
            orderIndex: 0,
          }}
        >
          <Form.Item
            label="Nome"
            name="name"
            rules={[{ required: true, message: 'Informe o nome do conjunto.' }]}
          >
            <Input placeholder="Ex.: Contratos" />
          </Form.Item>

          <Form.Item
            label="Código"
            name="code"
            extra="Gerado automaticamente a partir do nome."
          >
            <Input disabled />
          </Form.Item>

          <Form.Item label="Descrição" name="description">
            <Input.TextArea rows={3} placeholder="Descrição do conjunto de metadados" />
          </Form.Item>

          <Space>
            <Form.Item label="Ativo" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item label="Ordem" name="orderIndex">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={editingMetadata ? 'Editar Metadado' : 'Novo Metadado'}
        open={openMetadataModal}
        onCancel={handleCloseMetadataModal}
        onOk={() => metadataForm.submit()}
        confirmLoading={createMetadataMutation.isPending || updateMetadataMutation.isPending}
        width={900}
        destroyOnClose
      >
        <Form
          form={metadataForm}
          layout="vertical"
          onFinish={handleSubmitMetadata}
          initialValues={{
            label: '',
            name: '',
            fieldType: 'text',
            maskType: 'none',
            isRequired: false,
            isActive: true,
            orderIndex: 1,
            metadataSetId: selectedSetId,
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            <Space align="start" wrap style={{ width: '100%' }}>
              <Form.Item
                label="Nome Externo"
                name="label"
                rules={[{ required: true, message: 'Informe o nome externo do metadado.' }]}
                style={{ width: 320 }}
              >
                <Input placeholder="Ex.: Número do Contrato" />
              </Form.Item>

              <Form.Item
                label="Nome Interno"
                name="name"
                style={{ width: 260 }}
                extra="Gerado automaticamente a partir do nome externo."
              >
                <Input disabled />
              </Form.Item>
            </Space>

            <Space align="start" wrap style={{ width: '100%' }}>
              <Form.Item
                label="Conjunto de Metadados"
                name="metadataSetId"
                rules={[{ required: true, message: 'Selecione o conjunto.' }]}
                style={{ width: 280 }}
              >
                <Select
                  placeholder="Selecione..."
                  options={metadataSets.map((item) => ({
                    label: item.name,
                    value: item.id,
                  }))}
                  onChange={(value) => {
                    const nextOrder = getNextMetadataOrder(value)

                    if (!editingMetadata || editingMetadata.metadataSetId !== value) {
                      metadataForm.setFieldValue('orderIndex', nextOrder)
                    }
                  }}
                />
              </Form.Item>

              <Form.Item
                label="Tipo de campo"
                name="fieldType"
                rules={[{ required: true, message: 'Selecione o tipo do campo.' }]}
                style={{ width: 260 }}
              >
                <Select
                  options={FIELD_TYPES}
                  onChange={(value) => {
                    setFieldType(value)

                    if (value !== 'text') {
                      metadataForm.setFieldValue('maskType', 'none')
                    }

                    if (value !== 'table') {
                      setTableColumns([])
                    }

                    if (!LIST_FIELD_TYPES.includes(value)) {
                      setOptionsText('')
                    }

                    if (!ORG_FIELD_TYPES.includes(value)) {
                      setMultipleSelection(false)
                    }
                  }}
                />
              </Form.Item>
            </Space>

            {isOrgField(fieldType) && (
              <Form.Item label="Seleção">
                <Switch
                  checked={multipleSelection}
                  onChange={setMultipleSelection}
                  checkedChildren="Múltipla"
                  unCheckedChildren="Única"
                />
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  {multipleSelection
                    ? 'O usuário poderá selecionar vários itens.'
                    : 'O usuário poderá selecionar apenas um item.'}
                </Text>
              </Form.Item>
            )}

            {fieldType === 'text' && (
              <Form.Item
                label="Máscara"
                name="maskType"
                style={{ width: 260 }}
                extra="Opcional para campos de texto curto."
              >
                <Select options={STRING_MASKS} />
              </Form.Item>
            )}

            <Space align="start" wrap>
              <Form.Item
                label="Obrigatório"
                name="isRequired"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="Ativo"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="Ordem"
                name="orderIndex"
                extra="Ao informar uma ordem já existente, os demais metadados serão reorganizados automaticamente."
              >
                <InputNumber min={1} style={{ width: 160 }} />
              </Form.Item>
            </Space>

            {isListField(fieldType) && (
              <Form.Item
                label={fieldType === 'sigla_select' ? 'Opções da lista por sigla' : 'Opções da lista'}
                required
                extra={
                  fieldType === 'sigla_select'
                    ? 'Use uma linha por item no formato SIGLA=Descrição.'
                    : 'Use uma linha por item no formato valor=Label.'
                }
              >
                <Input.TextArea
                  rows={6}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={
                    fieldType === 'sigla_select'
                      ? 'EA=Em análise\nAP=Aprovado\nRP=Reprovado'
                      : 'fornecimento=Fornecimento\nservico=Prestação de Serviço\nlocacao=Locação'
                  }
                />
              </Form.Item>
            )}

            {fieldType === 'table' && (
              <Card
                size="small"
                title="Composição da Tabela"
                extra={
                  <Text type="secondary">
                    Adicione metadados do conjunto para montar as colunas da tabela.
                  </Text>
                }
              >
                <Space align="start" wrap style={{ width: '100%', marginBottom: 16 }}>
                  <Select
                    style={{ width: 360 }}
                    value={selectedTableMetadataId}
                    onChange={(value) => setSelectedTableMetadataId(value)}
                    placeholder="Selecione um metadado para adicionar como coluna"
                    options={availableMetadataForTable.map((item) => ({
                      label: `${item.label} (${item.name})`,
                      value: item.id,
                    }))}
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTableColumn}>
                    Adicionar Coluna
                  </Button>
                </Space>

                {tableColumns.length === 0 ? (
                  <Empty
                    description="Nenhuma coluna adicionada à tabela."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <List
                    bordered
                    dataSource={tableColumns}
                    renderItem={(column, index) => (
                      <List.Item
                        actions={[
                          <Button
                            key="up"
                            size="small"
                            icon={<ArrowUpOutlined />}
                            onClick={() => handleMoveTableColumn(index, 'up')}
                            disabled={index === 0}
                          />,
                          <Button
                            key="down"
                            size="small"
                            icon={<ArrowDownOutlined />}
                            onClick={() => handleMoveTableColumn(index, 'down')}
                            disabled={index === tableColumns.length - 1}
                          />,
                          <Button
                            key="delete"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveTableColumn(column.id)}
                          />,
                        ]}
                      >
                        <Space wrap>
                          <Text strong>{column.externalName}</Text>
                          <Text type="secondary">({column.internalName})</Text>
                          <Tag>{typeLabels[column.fieldType] ?? column.fieldType}</Tag>
                          <Tag color="blue">Ordem {index + 1}</Tag>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            )}
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
