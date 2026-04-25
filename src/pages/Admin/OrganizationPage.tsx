import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Table, Button, Modal, Form, Input, Select, Space,
  Popconfirm, Typography, Tag, Upload, message, Tooltip, Avatar,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, UploadOutlined, DownloadOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import {
  getUnits, createUnit, updateUnit, deleteUnit,
  getAreas, createArea, updateArea, deleteArea,
  getDisciplines, createDiscipline, updateDiscipline, deleteDiscipline,
  getOrgRoles, createOrgRole, updateOrgRole, deleteOrgRole,
  getOrgGroups, createOrgGroup, updateOrgGroup, deleteOrgGroup,
  type UnitDto, type AreaDto, type DisciplineDto, type OrgRoleDto, type OrgGroupDto,
} from '../../api/organization'
import { getUsers } from '../../api/users'

const { Title, Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgPosition {
  id: string
  userId?: string;   userName?: string
  unitId?: string;   unitName?: string
  areaId?: string;   areaName?: string
  disciplineId?: string; disciplineName?: string
  roleId?: string;   roleName?: string
}

// ─── CrudTable ────────────────────────────────────────────────────────────────

function CrudTable<
  T extends { id: string; name: string; code?: string; description?: string; isActive: boolean; createdAt: string }
>({
  queryKey, fetchFn, createFn, updateFn, deleteFn, extraColumns, extraFormFields,
}: {
  queryKey: string
  fetchFn: () => Promise<T[]>
  createFn: (data: any) => Promise<T>
  updateFn: (id: string, data: any) => Promise<T>
  deleteFn: (id: string) => Promise<any>
  extraColumns?: any[]
  extraFormFields?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: [queryKey], queryFn: fetchFn })

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); handleClose() },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateFn(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); handleClose() },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  })

  const handleOpen = (item?: T) => {
    setEditing(item ?? null)
    form.setFieldsValue(item ?? { name: '', code: '', description: '' })
    setOpen(true)
  }
  const handleClose = () => { setOpen(false); setEditing(null); form.resetFields() }
  const handleSubmit = (values: any) => {
    if (editing) updateMutation.mutate({ id: editing.id, data: values })
    else createMutation.mutate(values)
  }

  const columns = [
    {
      title: 'Sigla', key: 'code', width: 80,
      render: (_: any, r: T) =>
        r.code
          ? <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11, margin: 0 }}>{r.code}</Tag>
          : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'Descrição', dataIndex: 'description', key: 'description', render: (v: any) => v || '—' },
    ...(extraColumns ?? []),
    {
      title: 'Status', key: 'isActive', width: 90,
      render: (_: any, r: T) => (
        <Tag color={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Ativo' : 'Inativo'}</Tag>
      ),
    },
    {
      title: 'Ações', key: 'actions', width: 80,
      render: (_: any, r: T) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpen(r)} />
          <Popconfirm title="Desativar este registro?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Novo</Button>
      </div>

      <Table dataSource={data} columns={columns} rowKey="id" loading={isLoading}
        size="small" pagination={{ pageSize: 10, showSizeChanger: false }} />

      <Modal
        title={editing ? 'Editar registro' : 'Novo registro'}
        open={open} onCancel={handleClose} onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <Form.Item label="Nome" name="name" rules={[{ required: true, message: 'Informe o nome' }]}>
              <Input placeholder="Nome completo" />
            </Form.Item>
            <Form.Item label="Sigla" name="code" rules={[{ max: 10, message: 'Máx. 10 caracteres' }]}>
              <Input placeholder="Ex.: TI" maxLength={10}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                onChange={(e) => form.setFieldValue('code', e.target.value.toUpperCase())} />
            </Form.Item>
          </div>
          <Form.Item label="Descrição" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          {extraFormFields}
        </Form>
      </Modal>
    </>
  )
}

// ─── GroupsTab ────────────────────────────────────────────────────────────────
// Aba de grupos com select de membros embutido no modal de criação/edição

function GroupsTab() {
  const [open, setOpen]       = useState(false)
  const [editing, setEditing] = useState<OrgGroupDto | null>(null)
  const [form]                = Form.useForm()
  const qc                    = useQueryClient()

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['org-groups'],
    queryFn: getOrgGroups,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const userOptions = useMemo(
    () => (users as any[]).map((u: any) => ({
      value: u.id,
      label: u.name,
      email: u.email,
    })),
    [users],
  )

  const createMutation = useMutation({
    mutationFn: createOrgGroup,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-groups'] }); handleClose() },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateOrgGroup(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-groups'] }); handleClose() },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteOrgGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-groups'] }),
  })

  const handleOpen = (item?: OrgGroupDto) => {
    setEditing(item ?? null)
    form.setFieldsValue({
      name:        item?.name        ?? '',
      code:        item?.code        ?? '',
      description: item?.description ?? '',
      memberIds:   item?.memberIds   ?? [],
    })
    setOpen(true)
  }
  const handleClose = () => { setOpen(false); setEditing(null); form.resetFields() }

  const handleSubmit = (values: any) => {
    if (editing) updateMutation.mutate({ id: editing.id, data: values })
    else createMutation.mutate(values)
  }

  const columns = [
    {
      title: 'Sigla', key: 'code', width: 80,
      render: (_: any, r: OrgGroupDto) =>
        r.code
          ? <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11, margin: 0 }}>{r.code}</Tag>
          : <span style={{ color: '#bbb' }}>—</span>,
    },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'Descrição', dataIndex: 'description', key: 'description', render: (v: any) => v || '—' },
    {
      title: 'Membros',
      key: 'members',
      render: (_: any, r: OrgGroupDto) => {
        const count = r.memberIds?.length ?? 0
        if (count === 0) return <Text type="secondary" style={{ fontSize: 12 }}>Nenhum membro</Text>

        // Mostra até 3 avatares + badge com o total
        return (
          <Space size={4} wrap>
            <Avatar.Group max={{ count: 3, style: { background: '#1677ff' } }} size="small">
              {(r.memberNames ?? Array(count).fill('')).map((name: string, i: number) => (
                <Tooltip key={i} title={name || 'Membro'}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#69b1ff' }}>
                    {name?.[0]?.toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
            <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>
              <TeamOutlined /> {count} {count === 1 ? 'membro' : 'membros'}
            </Tag>
          </Space>
        )
      },
    },
    {
      title: 'Status', key: 'isActive', width: 90,
      render: (_: any, r: OrgGroupDto) => (
        <Tag color={r.isActive ? 'green' : 'red'}>{r.isActive ? 'Ativo' : 'Inativo'}</Tag>
      ),
    },
    {
      title: 'Ações', key: 'actions', width: 80,
      render: (_: any, r: OrgGroupDto) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpen(r)} />
          <Popconfirm title="Desativar este grupo?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>
          Novo grupo
        </Button>
      </div>

      <Table
        dataSource={groups} columns={columns} rowKey="id"
        loading={isLoading} size="small"
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />

      <Modal
        title={editing ? `Editar grupo — ${editing.name}` : 'Novo grupo'}
        open={open} onCancel={handleClose} onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {/* Nome + Sigla */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <Form.Item label="Nome" name="name" rules={[{ required: true, message: 'Informe o nome' }]}>
              <Input placeholder="Ex.: Equipe de Qualidade" />
            </Form.Item>
            <Form.Item label="Sigla" name="code" rules={[{ max: 10, message: 'Máx. 10 caracteres' }]}>
              <Input placeholder="Ex.: QLD" maxLength={10}
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                onChange={(e) => form.setFieldValue('code', e.target.value.toUpperCase())} />
            </Form.Item>
          </div>

          <Form.Item label="Descrição" name="description">
            <Input.TextArea rows={2} placeholder="Descreva o propósito deste grupo" />
          </Form.Item>

          {/* Membros — select com todos os usuários da empresa */}
          <Form.Item
            label={
              <Space size={6}>
                <TeamOutlined />
                <span>Membros do grupo</span>
              </Space>
            }
            name="memberIds"
            extra="Selecione os usuários que fazem parte deste grupo."
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="Buscar e adicionar usuários..."
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
                String((option as any)?.email ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={userOptions}
              optionRender={(option) => (
                <Space size={8}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#69b1ff', flexShrink: 0 }} />
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{option.label}</div>
                    {(option.data as any)?.email && (
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{(option.data as any).email}</div>
                    )}
                  </div>
                </Space>
              )}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ─── PositionsTab ─────────────────────────────────────────────────────────────

function generateTempId() {
  return `orgpos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function PositionsTab() {
  const [userId, setUserId]             = useState<string | undefined>()
  const [unitId, setUnitId]             = useState<string | undefined>()
  const [areaId, setAreaId]             = useState<string | undefined>()
  const [disciplineId, setDisciplineId] = useState<string | undefined>()
  const [roleId, setRoleId]             = useState<string | undefined>()
  const [positions, setPositions]       = useState<OrgPosition[]>([])

  const [fUser, setFUser] = useState<string | undefined>()
  const [fUnit, setFUnit] = useState<string | undefined>()
  const [fArea, setFArea] = useState<string | undefined>()
  const [fDisc, setFDisc] = useState<string | undefined>()
  const [fRole, setFRole] = useState<string | undefined>()

  const { data: users = [] }    = useQuery({ queryKey: ['users'],           queryFn: getUsers })
  const { data: units = [] }    = useQuery({ queryKey: ['org-units'],       queryFn: getUnits })
  const { data: allAreas = [] } = useQuery({ queryKey: ['org-areas'],       queryFn: getAreas })
  const { data: allDisc = [] }  = useQuery({ queryKey: ['org-disciplines'], queryFn: getDisciplines })
  const { data: allRoles = [] } = useQuery({ queryKey: ['org-roles'],       queryFn: getOrgRoles })

  const canAdd = userId || unitId || areaId || disciplineId || roleId

  const [pasteOpen, setPasteOpen]     = useState(false)
  const [pasteText, setPasteText]     = useState('')
  const [pasteErrors, setPasteErrors] = useState<string[]>([])
  const [preview, setPreview]         = useState<OrgPosition[]>([])

  const CSV_HEADERS = ['usuario', 'unidade', 'area', 'disciplina', 'funcao']

  const downloadTemplate = () => {
    const rows = [
      CSV_HEADERS.join(';'),
      'Carlos Mendes;Matriz São Paulo;Jurídico;Direito Contratual;Advogado Sênior',
      'Fernanda Oliveira;Matriz São Paulo;Compras;;Analista de Compras',
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'modelo_posicoes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const processCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return { added: 0, skipped: 0, errors: ['Arquivo vazio ou sem dados.'], newPositions: positions }

    const header = lines[0].toLowerCase().split(';').map((h) => h.trim())
    const idx = {
      user: header.indexOf('usuario'),
      unit: header.indexOf('unidade'),
      area: header.indexOf('area'),
      disc: header.indexOf('disciplina'),
      role: header.indexOf('funcao'),
    }

    let added = 0, skipped = 0
    const errors: string[] = []
    const newPositions = [...positions]

    lines.slice(1).forEach((line, i) => {
      const cols   = line.split(';').map((c) => c.trim())
      const rowNum = i + 2

      const findBy = (list: any[], col: number) => {
        if (col < 0 || !cols[col]) return undefined
        return list.find((item: any) => item.name.toLowerCase() === cols[col].toLowerCase())
      }

      const user = idx.user >= 0 && cols[idx.user] ? (users as any[]).find((u: any) => u.name.toLowerCase() === cols[idx.user].toLowerCase()) : undefined
      const unit = findBy(units, idx.unit)
      const area = findBy(allAreas, idx.area)
      const disc = findBy(allDisc, idx.disc)
      const role = findBy(allRoles, idx.role)

      if (idx.user >= 0 && cols[idx.user] && !user)  errors.push(`Linha ${rowNum}: usuário "${cols[idx.user]}" não encontrado`)
      if (idx.unit >= 0 && cols[idx.unit] && !unit)  errors.push(`Linha ${rowNum}: unidade "${cols[idx.unit]}" não encontrada`)
      if (idx.area >= 0 && cols[idx.area] && !area)  errors.push(`Linha ${rowNum}: área "${cols[idx.area]}" não encontrada`)
      if (idx.disc >= 0 && cols[idx.disc] && !disc)  errors.push(`Linha ${rowNum}: disciplina "${cols[idx.disc]}" não encontrada`)
      if (idx.role >= 0 && cols[idx.role] && !role)  errors.push(`Linha ${rowNum}: função "${cols[idx.role]}" não encontrada`)

      const userId_ = user?.id, unitId_ = unit?.id, areaId_ = area?.id
      const discId_ = disc?.id, roleId_ = role?.id

      if (!userId_ && !unitId_ && !areaId_ && !discId_ && !roleId_) return

      const already = newPositions.some((p) =>
        (p.userId ?? null) === (userId_ ?? null) &&
        (p.unitId ?? null) === (unitId_ ?? null) &&
        (p.areaId ?? null) === (areaId_ ?? null) &&
        (p.disciplineId ?? null) === (discId_ ?? null) &&
        (p.roleId ?? null) === (roleId_ ?? null),
      )
      if (already) { skipped++; return }

      newPositions.push({
        id: generateTempId(),
        userId: userId_, userName: user?.name,
        unitId: unitId_, unitName: unit?.name,
        areaId: areaId_, areaName: area?.name,
        disciplineId: discId_, disciplineName: disc?.name,
        roleId: roleId_, roleName: role?.name,
      })
      added++
    })

    return { added, skipped, errors, newPositions }
  }

  const handleCsvUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const { errors, newPositions } = processCsvText(e.target?.result as string)
      setPreview(newPositions.slice(positions.length))
      setPasteErrors(errors)
      setPasteText('')
      setPasteOpen(true)
    }
    reader.readAsText(file, 'UTF-8')
    return false
  }

  const handlePasteValidate = () => {
    const { skipped, errors, newPositions } = processCsvText(pasteText)
    setPreview(newPositions.slice(positions.length))
    setPasteErrors(errors)
    if (skipped > 0) message.warning(`${skipped} duplicata(s) detectada(s) e ignorada(s).`)
  }

  const handleConfirmImport = () => {
    if (preview.length === 0) return
    setPositions([...positions, ...preview])
    message.success(`${preview.length} posição(ões) importada(s) com sucesso.`)
    setPasteOpen(false); setPasteText(''); setPasteErrors([]); setPreview([])
  }

  const handleAdd = () => {
    if (!canAdd) return
    const user = (users as any[]).find((u) => u.id === userId)
    const unit = units.find((u) => u.id === unitId)
    const area = allAreas.find((a) => a.id === areaId)
    const disc = allDisc.find((d) => d.id === disciplineId)
    const role = allRoles.find((r) => r.id === roleId)

    const already = positions.some((p) =>
      (p.userId ?? null) === (userId ?? null) &&
      (p.unitId ?? null) === (unitId ?? null) &&
      (p.areaId ?? null) === (areaId ?? null) &&
      (p.disciplineId ?? null) === (disciplineId ?? null) &&
      (p.roleId ?? null) === (roleId ?? null),
    )
    if (already) { alert('Esta posição já foi adicionada.'); return }

    setPositions([...positions, {
      id: generateTempId(),
      userId: user?.id, userName: user?.name,
      unitId: unit?.id, unitName: unit?.name,
      areaId: area?.id, areaName: area?.name,
      disciplineId: disc?.id, disciplineName: disc?.name,
      roleId: role?.id, roleName: role?.name,
    }])
    setUserId(undefined); setUnitId(undefined)
    setAreaId(undefined); setDisciplineId(undefined); setRoleId(undefined)
  }

  const filteredPositions = useMemo(() => {
    let rows = positions
    if (fUser) rows = rows.filter((p) => p.userId === fUser)
    if (fUnit) rows = rows.filter((p) => p.unitId === fUnit)
    if (fArea) rows = rows.filter((p) => p.areaId === fArea)
    if (fDisc) rows = rows.filter((p) => p.disciplineId === fDisc)
    if (fRole) rows = rows.filter((p) => p.roleId === fRole)
    return rows
  }, [positions, fUser, fUnit, fArea, fDisc, fRole])

  const hasFilter = fUser || fUnit || fArea || fDisc || fRole

  const opt = () => (v: any) => ({ label: v.code ? `${v.name} (${v.code})` : v.name, value: v.id })

  const addSelects = [
    { label: 'Usuário',    value: userId,       set: setUserId,       opts: (users as any[]).map((u: any) => ({ label: u.name, value: u.id })) },
    { label: 'Unidade',    value: unitId,       set: setUnitId,       opts: units.map(opt()) },
    { label: 'Área',       value: areaId,       set: setAreaId,       opts: allAreas.map(opt()) },
    { label: 'Disciplina', value: disciplineId, set: setDisciplineId, opts: allDisc.map(opt()) },
    { label: 'Função',     value: roleId,       set: setRoleId,       opts: allRoles.map(opt()) },
  ]

  const positionColumns = [
    { title: 'Usuário',    key: 'user', render: (_: any, r: OrgPosition) => r.userName     ? <Tag color="cyan"   style={{ margin: 0 }}>{r.userName}</Tag>     : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Unidade',    key: 'unit', render: (_: any, r: OrgPosition) => r.unitName     ? <Tag color="green"  style={{ margin: 0 }}>{r.unitName}</Tag>     : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Área',       key: 'area', render: (_: any, r: OrgPosition) => r.areaName     ? <Tag color="orange" style={{ margin: 0 }}>{r.areaName}</Tag>     : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Disciplina', key: 'disc', render: (_: any, r: OrgPosition) => r.disciplineName ? <Tag color="purple" style={{ margin: 0 }}>{r.disciplineName}</Tag> : <span style={{ color: '#bbb' }}>—</span> },
    { title: 'Função',     key: 'role', render: (_: any, r: OrgPosition) => r.roleName     ? <Tag color="blue"   style={{ margin: 0 }}>{r.roleName}</Tag>     : <span style={{ color: '#bbb' }}>—</span> },
    {
      title: 'Ações', key: 'actions', width: 60,
      render: (_: any, r: OrgPosition) => (
        <Button type="text" danger icon={<DeleteOutlined />} size="small"
          onClick={() => setPositions(positions.filter((p) => p.id !== r.id))} />
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Adicionar posição
          </div>
          <Space>
            <Tooltip title="Baixar modelo CSV">
              <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>Modelo CSV</Button>
            </Tooltip>
            <Upload beforeUpload={handleCsvUpload} accept=".csv" showUploadList={false}>
              <Tooltip title="Importar posições via CSV">
                <Button size="small" icon={<UploadOutlined />} type="dashed">Importar CSV</Button>
              </Tooltip>
            </Upload>
            <Tooltip title="Colar dados CSV diretamente">
              <Button size="small" icon={<ApartmentOutlined />} type="dashed"
                onClick={() => { setPasteOpen(true); setPasteText(''); setPasteErrors([]); setPreview([]) }}>
                Colar dados
              </Button>
            </Tooltip>
          </Space>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {addSelects.map(({ label, value, set, opts }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>{label}</label>
              <Select placeholder="Selecione..." value={value} onChange={set}
                options={opts} allowClear showSearch
                filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                style={{ width: '100%' }} />
            </div>
          ))}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}
          disabled={!canAdd} style={{ alignSelf: 'flex-start' }}>
          Adicionar posição
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select allowClear placeholder="Filtrar usuário"    style={{ width: 160 }} value={fUser} onChange={setFUser} options={(users as any[]).map((u: any) => ({ label: u.name, value: u.id }))} showSearch filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
        <Select allowClear placeholder="Filtrar unidade"    style={{ width: 150 }} value={fUnit} onChange={setFUnit} options={units.map(opt())} />
        <Select allowClear placeholder="Filtrar área"       style={{ width: 150 }} value={fArea} onChange={setFArea} options={allAreas.map(opt())} />
        <Select allowClear placeholder="Filtrar disciplina" style={{ width: 160 }} value={fDisc} onChange={setFDisc} options={allDisc.map(opt())} />
        <Select allowClear placeholder="Filtrar função"     style={{ width: 150 }} value={fRole} onChange={setFRole} options={allRoles.map(opt())} />
        {hasFilter && (
          <Button size="small" type="link" onClick={() => { setFUser(undefined); setFUnit(undefined); setFArea(undefined); setFDisc(undefined); setFRole(undefined) }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Table dataSource={filteredPositions} columns={positionColumns} rowKey="id" size="small"
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: 'Nenhuma posição cadastrada' }} />

      <Modal
        title={preview.length > 0 ? `Prévia — ${preview.length} posição(ões) para importar` : 'Importar posições em lote (CSV)'}
        open={pasteOpen}
        onCancel={preview.length > 0 ? () => setPreview([]) : () => { setPasteOpen(false); setPasteText(''); setPasteErrors([]); setPreview([]) }}
        onOk={handleConfirmImport}
        okText={preview.length > 0 ? `Confirmar importação (${preview.length})` : 'Validar'}
        okButtonProps={{ disabled: preview.length === 0 }}
        cancelText={preview.length > 0 ? '← Editar CSV' : 'Cancelar'}
        width={780} destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {preview.length === 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                  Cole o CSV com <strong>ponto-e-vírgula</strong> como separador.<br />
                  Cabeçalho: <code>usuario;unidade;area;disciplina;funcao</code>
                </div>
                <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>Baixar modelo</Button>
              </div>
              <Input.TextArea rows={8} value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setPasteErrors([]); setPreview([]) }}
                placeholder={"usuario;unidade;area;disciplina;funcao\nCarlos Mendes;Matriz São Paulo;Jurídico;Direito Contratual;Advogado Sênior"}
                style={{ fontFamily: 'monospace', fontSize: 12 }} />
              <Button type="dashed" onClick={handlePasteValidate} disabled={!pasteText.trim()}>
                Validar e visualizar prévia →
              </Button>
              {pasteErrors.length > 0 && (
                <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', maxHeight: 120, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#d48806', marginBottom: 4 }}>{pasteErrors.length} aviso(s):</div>
                  {pasteErrors.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#875800' }}>{e}</div>)}
                </div>
              )}
            </>
          )}
          {preview.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#666' }}>Revise as posições abaixo antes de confirmar.</div>
              {pasteErrors.length > 0 && (
                <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', maxHeight: 80, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#d48806', marginBottom: 2 }}>{pasteErrors.length} aviso(s):</div>
                  {pasteErrors.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#875800' }}>{e}</div>)}
                </div>
              )}
              <Table size="small" dataSource={preview.map((r, i) => ({ ...r, key: i }))} pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: 'Usuário',    key: 'user', render: (_,r: OrgPosition) => r.userName     ? <Tag color="cyan"   style={{margin:0}}>{r.userName}</Tag>     : <span style={{color:'#bbb'}}>—</span> },
                  { title: 'Unidade',    key: 'unit', render: (_,r: OrgPosition) => r.unitName     ? <Tag color="green"  style={{margin:0}}>{r.unitName}</Tag>     : <span style={{color:'#bbb'}}>—</span> },
                  { title: 'Área',       key: 'area', render: (_,r: OrgPosition) => r.areaName     ? <Tag color="orange" style={{margin:0}}>{r.areaName}</Tag>     : <span style={{color:'#bbb'}}>—</span> },
                  { title: 'Disciplina', key: 'disc', render: (_,r: OrgPosition) => r.disciplineName ? <Tag color="purple" style={{margin:0}}>{r.disciplineName}</Tag> : <span style={{color:'#bbb'}}>—</span> },
                  { title: 'Função',     key: 'role', render: (_,r: OrgPosition) => r.roleName     ? <Tag color="blue"   style={{margin:0}}>{r.roleName}</Tag>     : <span style={{color:'#bbb'}}>—</span> },
                  { title: '', key: 'remove', width: 40, render: (_,r: OrgPosition) => <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setPreview(preview.filter((p) => p.id !== r.id))} /> },
                ]}
              />
              <Button type="link" size="small" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setPreview([])}>← Editar CSV</Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ─── OrganizationPage ─────────────────────────────────────────────────────────

export function OrganizationPage() {
  const { data: units } = useQuery({ queryKey: ['org-units'], queryFn: getUnits })

  return (
    <div>
      <Title level={4}>Estrutura Organizacional</Title>

      <Tabs items={[
        {
          key: 'units', label: 'Unidades',
          children: (
            <CrudTable<UnitDto>
              queryKey="org-units" fetchFn={getUnits}
              createFn={createUnit} updateFn={updateUnit} deleteFn={deleteUnit}
            />
          ),
        },
        {
          key: 'areas', label: 'Áreas / Departamentos',
          children: (
            <CrudTable<AreaDto>
              queryKey="org-areas" fetchFn={getAreas}
              createFn={createArea} updateFn={updateArea} deleteFn={deleteArea}
              extraFormFields={
                <Form.Item label="Unidade" name="unitId">
                  <Select allowClear placeholder="Selecione a unidade..."
                    options={units?.map(u => ({
                      label: u.code ? `${u.name} (${u.code})` : u.name,
                      value: u.id,
                    }))} />
                </Form.Item>
              }
            />
          ),
        },
        {
          key: 'disciplines', label: 'Disciplinas',
          children: (
            <CrudTable<DisciplineDto>
              queryKey="org-disciplines" fetchFn={getDisciplines}
              createFn={createDiscipline} updateFn={updateDiscipline} deleteFn={deleteDiscipline}
            />
          ),
        },
        {
          key: 'roles', label: 'Funções',
          children: (
            <CrudTable<OrgRoleDto>
              queryKey="org-roles" fetchFn={getOrgRoles}
              createFn={createOrgRole} updateFn={updateOrgRole} deleteFn={deleteOrgRole}
            />
          ),
        },
        {
          key: 'groups', label: 'Grupos',
          children: <GroupsTab />,
        },
        {
          key: 'positions',
          label: <Space size={6}><ApartmentOutlined />Posições</Space>,
          children: <PositionsTab />,
        },
      ]} />
    </div>
  )
}