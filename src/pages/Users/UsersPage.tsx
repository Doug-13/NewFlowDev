import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, Select, Typography, Tag,
  Avatar, Upload, message, Tabs, Space, Empty, Row, Col, Tooltip, Divider,
} from 'antd'
import type { UploadChangeParam, UploadFile } from 'antd/es/upload/interface'
import type { UploadProps } from 'antd'
import {
  PlusOutlined, UserOutlined, UploadOutlined, ApartmentOutlined, DeleteOutlined, DownloadOutlined, FileAddOutlined, TeamOutlined,
} from '@ant-design/icons'
import { getUsers, createUser, updateUser } from '../../api/users'
import type { UserItem } from '../../api/users'
import { getUnits, getAreas, getDisciplines, getOrgRoles, getOrgGroups, type OrgGroupDto } from '../../api/organization'
import { useAuthStore } from '../../store/authStore'
import './UsersPage.css'

const { Title, Text } = Typography
const { TextArea } = Input

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserPosition {
  id: string
  unitId?: string; unitName?: string
  areaId?: string; areaName?: string
  disciplineId?: string; disciplineName?: string
  roleId?: string; roleName?: string
}

type ExtendedUserListItem = UserItem & {
  cpf?: string
  phone?: string
  photoUrl?: string
  department?: string
  jobTitle?: string
  position?: string
  notes?: string
  positions?: UserPosition[]
  groupIds?: string[]
  substituteId?: string
  substituteName?: string
  environments?: string[]
  status?: 'active' | 'inactive' | 'absent'
}

type UserFormValues = {
  name: string
  email: string
  password?: string
  role: string
  cpf?: string
  phone?: string
  photoFile?: File
  department?: string
  jobTitle?: string
  position?: string
  status: 'active' | 'inactive' | 'absent'
  notes?: string
  substituteId?: string
  environments?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENVIRONMENTS = ['Web', 'Mobile', 'Desktop', 'API', 'Totem']

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active:   { color: 'green',  label: 'Ativo'   },
  inactive: { color: 'red',    label: 'Inativo' },
  absent:   { color: 'orange', label: 'Ausente' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
  })
}

function generateTempId() {
  return `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function maskCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

// ─── GroupsTab ────────────────────────────────────────────────────────────────

function GroupsTab({ userId, selectedGroupIds, onChange }: {
  userId?: string
  selectedGroupIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [selectValue, setSelectValue] = useState<string | undefined>()
  const { data: allGroups = [] } = useQuery({ queryKey: ['org-groups'], queryFn: getOrgGroups })

  const groupsViaMembership = useMemo(() => {
    if (!userId) return [] as string[]
    return (allGroups as OrgGroupDto[])
      .filter((g) => g.memberIds?.includes(userId))
      .map((g) => g.id)
  }, [allGroups, userId])

  const effectiveGroupIds = useMemo(
    () => Array.from(new Set([...selectedGroupIds, ...groupsViaMembership])),
    [selectedGroupIds, groupsViaMembership],
  )

  useMemo(() => {
    const missing = groupsViaMembership.filter((id) => !selectedGroupIds.includes(id))
    if (missing.length > 0) onChange([...selectedGroupIds, ...missing])
  }, [groupsViaMembership]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    if (!selectValue || effectiveGroupIds.includes(selectValue)) return
    onChange([...selectedGroupIds, selectValue])
    setSelectValue(undefined)
  }

  const handleRemove = (id: string) => {
    if (groupsViaMembership.includes(id)) {
      message.warning('Este grupo foi atribuído via estrutura organizacional. Para remover, edite o grupo na tela de Organização.')
      return
    }
    onChange(selectedGroupIds.filter((gid) => gid !== id))
  }

  const availableOptions = (allGroups as OrgGroupDto[])
    .filter((g) => !effectiveGroupIds.includes(g.id))
    .map((g) => ({ label: g.code ? `${g.name} (${g.code})` : g.name, value: g.id }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#f5f7fb', borderRadius: 10, padding: 16, border: '1px solid #eee' }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Adicionar grupo manualmente</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select style={{ flex: 1 }} placeholder="Selecione um grupo..." value={selectValue}
            onChange={setSelectValue} options={availableOptions} showSearch optionFilterProp="label" allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!selectValue}>Adicionar</Button>
        </div>
      </div>

      {effectiveGroupIds.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum grupo vinculado" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {effectiveGroupIds.map((id) => {
            const group = (allGroups as OrgGroupDto[]).find((g) => g.id === id)
            if (!group) return null
            const viaOrg = groupsViaMembership.includes(id)
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: viaOrg ? '#f0f9ff' : '#fff', border: `1px solid ${viaOrg ? '#bae0ff' : '#eee'}`, borderRadius: 8 }}>
                <Space>
                  <TeamOutlined style={{ color: viaOrg ? '#1677ff' : '#8c8c8c' }} />
                  <span>{group.name}</span>
                  {group.code && <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{group.code}</Tag>}
                  {viaOrg && <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>via organização</Tag>}
                </Space>
                <Tooltip title={viaOrg ? 'Remova pelo cadastro do grupo em Organização' : 'Remover do grupo'}>
                  <Button type="text" danger={!viaOrg} icon={<DeleteOutlined />} size="small" disabled={viaOrg} onClick={() => handleRemove(id)} />
                </Tooltip>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PositionsTab ─────────────────────────────────────────────────────────────

function PositionsTab({ positions, onChange }: {
  positions: UserPosition[]
  onChange: (positions: UserPosition[]) => void
}) {
  const [unitId, setUnitId] = useState<string | undefined>()
  const [areaId, setAreaId] = useState<string | undefined>()
  const [disciplineId, setDisciplineId] = useState<string | undefined>()
  const [roleId, setRoleId] = useState<string | undefined>()

  const { data: units = [] }           = useQuery({ queryKey: ['org-units'],       queryFn: getUnits })
  const { data: allAreas = [] }        = useQuery({ queryKey: ['org-areas'],       queryFn: getAreas })
  const { data: allDisciplines = [] }  = useQuery({ queryKey: ['org-disciplines'], queryFn: getDisciplines })
  const { data: allRoles = [] }        = useQuery({ queryKey: ['org-roles'],       queryFn: getOrgRoles })

  const canAdd = unitId || areaId || disciplineId || roleId

  const handleAdd = () => {
    if (!canAdd) return
    const unit       = units.find((u) => u.id === unitId)
    const area       = allAreas.find((a) => a.id === areaId)
    const discipline = allDisciplines.find((d) => d.id === disciplineId)
    const role       = allRoles.find((r) => r.id === roleId)

    const already = positions.some((p) =>
      (p.unitId ?? null) === (unitId ?? null) &&
      (p.areaId ?? null) === (areaId ?? null) &&
      (p.disciplineId ?? null) === (disciplineId ?? null) &&
      (p.roleId ?? null) === (roleId ?? null),
    )
    if (already) { message.warning('Esta posição já foi adicionada.'); return }

    onChange([...positions, {
      id: generateTempId(),
      unitId: unit?.id, unitName: unit?.name,
      areaId: area?.id, areaName: area?.name,
      disciplineId: discipline?.id, disciplineName: discipline?.name,
      roleId: role?.id, roleName: role?.name,
    }])
    setUnitId(undefined); setAreaId(undefined)
    setDisciplineId(undefined); setRoleId(undefined)
  }

  return (
    <div className="positions-tab">
      <div className="positions-tab__form">
        <div className="positions-tab__form-label">Adicionar posição</div>
        <div className="positions-tab__selects">
          {[
            { label: 'Unidade',    value: unitId,       onChange: setUnitId,       options: units.map(u => ({ label: u.code ? `${u.name} (${u.code})` : u.name, value: u.id })) },
            { label: 'Área',       value: areaId,       onChange: setAreaId,       options: allAreas.map(a => ({ label: a.code ? `${a.name} (${a.code})` : a.name, value: a.id })) },
            { label: 'Disciplina', value: disciplineId, onChange: setDisciplineId, options: allDisciplines.map(d => ({ label: d.code ? `${d.name} (${d.code})` : d.name, value: d.id })) },
            { label: 'Função',     value: roleId,       onChange: setRoleId,       options: allRoles.map(r => ({ label: r.code ? `${r.name} (${r.code})` : r.name, value: r.id })) },
          ].map(({ label, value, onChange: onCh, options }) => (
            <div key={label} className="positions-tab__select-item">
              <label>{label}</label>
              <Select placeholder="Selecione..." value={value} onChange={onCh} options={options} allowClear style={{ width: '100%' }} />
            </div>
          ))}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} disabled={!canAdd} className="positions-tab__add-btn">
          Adicionar posição
        </Button>
      </div>

      <div className="positions-tab__list">
        {positions.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma posição adicionada" className="positions-tab__empty" />
        ) : positions.map((pos) => (
          <div key={pos.id} className="positions-tab__position-card">
            <div className="positions-tab__position-icon"><ApartmentOutlined /></div>
            <div className="positions-tab__position-info">
              <div className="positions-tab__position-breadcrumb">
                {pos.unitName && <span className="positions-tab__crumb positions-tab__crumb--unit">{pos.unitName}</span>}
                {pos.unitName && pos.areaName && <span className="positions-tab__crumb-sep">›</span>}
                {pos.areaName && <span className="positions-tab__crumb positions-tab__crumb--area">{pos.areaName}</span>}
                {pos.areaName && pos.disciplineName && <span className="positions-tab__crumb-sep">›</span>}
                {pos.disciplineName && <span className="positions-tab__crumb positions-tab__crumb--discipline">{pos.disciplineName}</span>}
              </div>
              {pos.roleName && <div className="positions-tab__position-role">{pos.roleName}</div>}
            </div>
            <Button type="text" danger icon={<DeleteOutlined />} size="small"
              onClick={() => onChange(positions.filter((p) => p.id !== pos.id))}
              className="positions-tab__remove-btn" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── UsersPage ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const [open, setOpen]             = useState(false)
  const [editingUser, setEditingUser] = useState<ExtendedUserListItem | null>(null)
  const [activeTab, setActiveTab]   = useState('data')
  const [positions, setPositions]   = useState<UserPosition[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [form]                      = Form.useForm<UserFormValues>()
  const qc                          = useQueryClient()
  const [photoPreview, setPhotoPreview] = useState<string | undefined>()
  const [fileList, setFileList]     = useState<UploadFile[]>([])

  // ── Pega accountId do usuário logado ────────────────────────────────────────
  const loggedUser = useAuthStore((s) => s.user)
  const accountId  = (loggedUser as any)?.accountId ?? ''

  const [filterDept,   setFilterDept]   = useState<string | undefined>()
  const [filterJob,    setFilterJob]    = useState<string | undefined>()
  const [filterRole,   setFilterRole]   = useState<string | undefined>()
  const [filterEnv,    setFilterEnv]    = useState<string | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [filterGroup,  setFilterGroup]  = useState<string | undefined>()
  const [search,       setSearch]       = useState<string>('')

  const [bulkOpen,      setBulkOpen]      = useState(false)
  const [bulkPasteText, setBulkPasteText] = useState('')
  const [bulkErrors,    setBulkErrors]    = useState<string[]>([])
  const [bulkPreview,   setBulkPreview]   = useState<any[]>([])

  const { data: allUsers, isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: allGroups = [] }      = useQuery({ queryKey: ['org-groups'], queryFn: getOrgGroups })

  const deptOptions = useMemo(() => {
    const vals = [...new Set((allUsers ?? []).map((u: any) => u.department).filter(Boolean))]
    return vals.map((v) => ({ label: v as string, value: v as string }))
  }, [allUsers])

  const jobOptions = useMemo(() => {
    const vals = [...new Set((allUsers ?? []).map((u: any) => u.jobTitle).filter(Boolean))]
    return vals.map((v) => ({ label: v as string, value: v as string }))
  }, [allUsers])

  const roleOptions    = [{ label: 'Admin', value: 'Admin' }, { label: 'Gestor', value: 'Gestor' }, { label: 'Operador', value: 'Operador' }]
  const envOptions     = ENVIRONMENTS.map((e) => ({ label: e, value: e }))
  const statusOptions  = Object.entries(STATUS_CONFIG).map(([v, { label }]) => ({ label, value: v }))

  const data = useMemo(() => {
    let rows = (allUsers ?? []) as ExtendedUserListItem[]
    if (search)       rows = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
    if (filterDept)   rows = rows.filter((r) => r.department === filterDept)
    if (filterJob)    rows = rows.filter((r) => r.jobTitle === filterJob)
    if (filterRole)   rows = rows.filter((r) => r.role === filterRole)
    if (filterEnv)    rows = rows.filter((r) => r.environments?.includes(filterEnv))
    if (filterStatus) rows = rows.filter((r) => (r.status ?? 'active') === filterStatus)
    if (filterGroup)  rows = rows.filter((r) => {
      const byUserGroupIds = r.groupIds?.includes(filterGroup)
      const byMembership   = (allGroups as OrgGroupDto[]).find((g) => g.id === filterGroup)?.memberIds?.includes(r.id)
      return byUserGroupIds || byMembership
    })
    return rows
  }, [allUsers, allGroups, search, filterDept, filterJob, filterRole, filterEnv, filterStatus, filterGroup])

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { message.success('Usuário criado com sucesso.'); qc.invalidateQueries({ queryKey: ['users'] }); handleCloseModal() },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Erro ao criar usuário.'),
  })
  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => { message.success('Usuário atualizado com sucesso.'); qc.invalidateQueries({ queryKey: ['users'] }); handleCloseModal() },
    onError: (err: any) => message.error(err?.response?.data?.message ?? 'Erro ao atualizar usuário.'),
  })
  const isSaving = createMutation.isPending || updateMutation.isPending

  const roleColors: Record<string, string> = { Admin: 'purple', Gestor: 'blue', Operador: 'default' }

  const BULK_CSV_HEADERS = ['nome', 'email', 'senha', 'papel', 'setor', 'cargo', 'telefone', 'status', 'ambientes']

  const downloadUserTemplate = () => {
    const rows = [
      BULK_CSV_HEADERS.join(';'),
      'João Silva;joao@empresa.com;Senha@123;Operador;Jurídico;Analista;(11) 99999-0010;active;Web,Mobile',
      'Maria Costa;maria@empresa.com;Senha@123;Gestor;RH;Coordenadora;;active;Web',
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = 'modelo_usuarios.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const parseBulkCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return { rows: [], errors: ['Arquivo vazio ou sem dados.'] }

    const header = lines[0].toLowerCase().split(';').map((h) => h.trim())
    const idx = {
      name: header.indexOf('nome'), email: header.indexOf('email'),
      password: header.indexOf('senha'), role: header.indexOf('papel'),
      department: header.indexOf('setor'), jobTitle: header.indexOf('cargo'),
      phone: header.indexOf('telefone'), status: header.indexOf('status'),
      environments: header.indexOf('ambientes'),
    }

    const errors: string[] = []
    const rows: any[] = []
    const existingEmails = new Set((allUsers ?? []).map((u: any) => u.email.toLowerCase()))
    const seenEmails = new Set<string>()

    lines.slice(1).forEach((line, i) => {
      const cols   = line.split(';').map((c) => c.trim())
      const rowNum = i + 2
      const name   = idx.name  >= 0 ? cols[idx.name]  : ''
      const email  = idx.email >= 0 ? cols[idx.email] : ''
      if (!name)  { errors.push(`Linha ${rowNum}: nome obrigatório`); return }
      if (!email) { errors.push(`Linha ${rowNum}: e-mail obrigatório`); return }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) { errors.push(`Linha ${rowNum}: e-mail inválido — "${email}"`); return }
      if (existingEmails.has(email.toLowerCase())) { errors.push(`Linha ${rowNum}: e-mail já cadastrado — "${email}"`); return }
      if (seenEmails.has(email.toLowerCase())) { errors.push(`Linha ${rowNum}: e-mail duplicado no arquivo — "${email}"`); return }
      seenEmails.add(email.toLowerCase())
      const rawRole  = (idx.role >= 0 ? cols[idx.role] : '') || 'Operador'
      const role     = ['Admin', 'Gestor', 'Operador'].find((r) => r.toLowerCase() === rawRole.toLowerCase()) ?? 'Operador'
      const rawStatus = (idx.status >= 0 ? cols[idx.status] : '') || 'active'
      const status   = ['active', 'inactive', 'absent'].includes(rawStatus.toLowerCase()) ? rawStatus.toLowerCase() : 'active'
      const envStr   = idx.environments >= 0 ? cols[idx.environments] : ''
      const environments = envStr ? envStr.split(',').map((e) => e.trim()).filter(Boolean) : []
      rows.push({
        accountId,  // ← inclui accountId do usuário logado
        name, email,
        password:   idx.password   >= 0 ? cols[idx.password]   : 'Trocar@123',
        role,
        department: idx.department >= 0 ? cols[idx.department] : '',
        jobTitle:   idx.jobTitle   >= 0 ? cols[idx.jobTitle]   : '',
        phone:      idx.phone      >= 0 ? cols[idx.phone]      : '',
        status, environments, isActive: status === 'active',
      })
    })
    return { rows, errors }
  }

  const handleBulkCsvUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const { rows, errors } = parseBulkCsv(e.target?.result as string)
      setBulkPreview(rows); setBulkErrors(errors); setBulkOpen(true); setBulkPasteText('')
    }
    reader.readAsText(file, 'UTF-8')
    return false
  }

  const handleBulkPasteParse = () => {
    const { rows, errors } = parseBulkCsv(bulkPasteText)
    setBulkPreview(rows); setBulkErrors(errors)
  }

  const handleBulkConfirm = async () => {
    let ok = 0
    for (const row of bulkPreview) {
      try { await createUser(row); ok++ } catch { /* */ }
    }
    qc.invalidateQueries({ queryKey: ['users'] })
    message.success(`${ok} usuário(s) criado(s) com sucesso.`)
    setBulkOpen(false); setBulkPasteText(''); setBulkPreview([]); setBulkErrors([])
  }

  const handleCloseModal = () => {
    setOpen(false); setEditingUser(null); setActiveTab('data')
    setPositions([]); setSelectedGroupIds([]); form.resetFields()
    setPhotoPreview(undefined); setFileList([])
  }

  const handleOpenCreate = () => {
    setEditingUser(null); setActiveTab('data'); setPositions([]); setSelectedGroupIds([])
    form.setFieldsValue({ role: 'Operador', status: 'active' })
    setPhotoPreview(undefined); setFileList([]); setOpen(true)
  }

  const handleOpenEdit = (user: ExtendedUserListItem) => {
    setEditingUser(user); setActiveTab('data')
    setPositions(user.positions ?? [])
    setSelectedGroupIds(user.groupIds ?? [])
    form.setFieldsValue({
      name: user.name, email: user.email, password: '',
      role: user.role, cpf: user.cpf, phone: user.phone,
      department: user.department, jobTitle: user.jobTitle,
      position: user.position, status: user.status ?? 'active',
      notes: user.notes, substituteId: user.substituteId,
      environments: user.environments ?? [],
    })
    setPhotoPreview(user.photoUrl); setFileList([]); setOpen(true)
  }

  const handleBeforeUpload = (file: File) => {
    if (!file.type.startsWith('image/')) { message.error('Selecione um arquivo de imagem válido.'); return Upload.LIST_IGNORE }
    if (file.size / 1024 / 1024 >= 3)   { message.error('A imagem deve ter no máximo 3MB.');        return Upload.LIST_IGNORE }
    return false
  }

  const handleUploadChange = async (info: UploadChangeParam<UploadFile>) => {
    const newFileList = info.fileList.slice(-1)
    setFileList(newFileList)
    const currentFile = newFileList[0]?.originFileObj
    if (currentFile) {
      const base64 = await getBase64(currentFile as File)
      setPhotoPreview(base64); form.setFieldValue('photoFile', currentFile as File)
    } else {
      setPhotoPreview(editingUser?.photoUrl); form.setFieldValue('photoFile', undefined)
    }
  }

  const handleSubmit = (values: UserFormValues) => {
    const payload = {
      ...values,
      accountId,            // ← sempre do token, não pode ser sobrescrito
      cpf:      values.cpf?.replace(/\D/g, '') || undefined,
      phone:    values.phone?.replace(/\D/g, '') || undefined,
      photoUrl: photoPreview,
      positions,
      groupIds: selectedGroupIds,
      isActive: values.status !== 'inactive',
    }

    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        ...payload,
        password: values.password?.trim() || undefined,
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  const columns = useMemo(() => [
    {
      title: 'Usuário', key: 'user',
      render: (_: unknown, r: ExtendedUserListItem) => (
        <div className="users-page__user-cell">
          <Avatar size={42} src={r.photoUrl} icon={!r.photoUrl ? <UserOutlined /> : undefined} className="users-page__user-avatar" />
          <div className="users-page__user-info">
            <div className="users-page__user-name">{r.name}</div>
            <div className="users-page__user-email">{r.email}</div>
          </div>
        </div>
      ),
    },
    { title: 'Setor', dataIndex: 'department', key: 'department', render: (v: string) => <span className="users-page__muted">{v || '—'}</span> },
    { title: 'Cargo', dataIndex: 'jobTitle',   key: 'jobTitle',   render: (v: string) => <span className="users-page__muted">{v || '—'}</span> },
    { title: 'Papel', key: 'role', render: (_: unknown, r: ExtendedUserListItem) => <Tag color={roleColors[r.role] || 'default'}>{r.role}</Tag> },
    {
      title: 'Ambientes', key: 'environments',
      render: (_: unknown, r: ExtendedUserListItem) =>
        r.environments?.length
          ? <Space size={4} wrap>{r.environments.map((e) => <Tag key={e}>{e}</Tag>)}</Space>
          : <span className="users-page__muted">—</span>,
    },
    {
      title: 'Grupos', key: 'groups',
      render: (_: unknown, r: ExtendedUserListItem) => {
        const byMembership = (allGroups as OrgGroupDto[]).filter((g) => g.memberIds?.includes(r.id)).map((g) => g.id)
        const allGroupIds  = Array.from(new Set([...(r.groupIds ?? []), ...byMembership]))
        if (allGroupIds.length === 0) return <span className="users-page__muted">—</span>
        return (
          <Space size={4} wrap>
            {allGroupIds.slice(0, 3).map((id) => {
              const g = (allGroups as OrgGroupDto[]).find((g) => g.id === id)
              return g ? <Tag key={id} color="geekblue" style={{ fontSize: 11 }}>{g.name}</Tag> : null
            })}
            {allGroupIds.length > 3 && <Tag style={{ fontSize: 11 }}>+{allGroupIds.length - 3}</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Status', key: 'status',
      render: (_: unknown, r: ExtendedUserListItem) => {
        const s = r.status ?? 'active'
        const cfg = STATUS_CONFIG[s] ?? STATUS_CONFIG.active
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Substituto', key: 'substitute',
      render: (_: unknown, r: ExtendedUserListItem) => <span className="users-page__muted">{r.substituteName || '—'}</span>,
    },
  ], [allGroups])

  const substituteOptions = useMemo(() =>
    (allUsers ?? []).filter((u: any) => u.id !== editingUser?.id).map((u: any) => ({ label: u.name, value: u.id })),
    [allUsers, editingUser],
  )

  const tabItems = [
    {
      key: 'data', label: 'Dados do usuário',
      children: (
        <Form form={form} layout="vertical" initialValues={{ role: 'Operador', status: 'active' }} onFinish={handleSubmit}>
          <div className="users-page__profile-upload">
            <Avatar size={80} src={photoPreview} icon={!photoPreview ? <UserOutlined /> : undefined} className="users-page__profile-avatar" />
            <div className="users-page__profile-upload-content">
              <div className="users-page__profile-upload-title">Foto do perfil</div>
              <Form.Item name="photoFile" valuePropName="file" style={{ marginBottom: 0 }}>
                <Upload accept="image/*" beforeUpload={handleBeforeUpload} onChange={handleUploadChange} fileList={fileList} maxCount={1} showUploadList={false}>
                  <Button size="small" icon={<UploadOutlined />}>Selecionar foto</Button>
                </Upload>
              </Form.Item>
            </div>
          </div>

          <Row gutter={12}>
            <Col span={16}><Form.Item label="Nome completo" name="name" rules={[{ required: true, message: 'Informe o nome' }]}><Input placeholder="Nome completo" /></Form.Item></Col>
            <Col span={8}><Form.Item label="Papel" name="role"><Select options={roleOptions} /></Form.Item></Col>
            <Col span={14}><Form.Item label="E-mail" name="email" rules={[{ required: true, message: 'Informe o e-mail' }, { type: 'email', message: 'E-mail inválido' }]}><Input placeholder="usuario@empresa.com" /></Form.Item></Col>
            <Col span={10}><Form.Item label="Senha" name="password" rules={editingUser ? [{ min: 6, message: 'Mín. 6 caracteres' }] : [{ required: true, message: 'Informe a senha' }, { min: 6, message: 'Mín. 6 caracteres' }]} extra={editingUser ? 'Deixe em branco para manter.' : undefined}><Input.Password placeholder={editingUser ? '••••••' : 'Digite a senha'} /></Form.Item></Col>
            <Col span={8}><Form.Item label="CPF" name="cpf" rules={[{ pattern: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/, message: 'CPF inválido' }]}><Input placeholder="000.000.000-00" maxLength={14} onChange={(e) => form.setFieldValue('cpf', maskCpf(e.target.value))} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Telefone" name="phone"><Input placeholder="(51) 99999-9999" maxLength={15} /></Form.Item></Col>
            <Col span={8}><Form.Item label="Status" name="status"><Select options={statusOptions} placeholder="Selecione o status" /></Form.Item></Col>
            <Col span={12}><Form.Item label="Setor / Departamento" name="department"><Input placeholder="Ex.: Jurídico, RH, TI" /></Form.Item></Col>
            <Col span={12}><Form.Item label="Cargo / Função" name="jobTitle"><Input placeholder="Ex.: Analista, Coordenador" /></Form.Item></Col>
            <Col span={12}><Form.Item label="Usuário Substituto" name="substituteId"><Select allowClear placeholder="Selecione o substituto..." options={substituteOptions} showSearch filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} /></Form.Item></Col>
            <Col span={12}><Form.Item label="Ambientes" name="environments"><Select mode="multiple" allowClear placeholder="Selecione os ambientes..." options={envOptions} /></Form.Item></Col>
          </Row>

          <Form.Item label="Observações" name="notes">
            <TextArea rows={2} placeholder="Informações adicionais" />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'positions',
      label: (<Space size={6}><ApartmentOutlined />Posições{positions.length > 0 && <Tag color="geekblue" style={{ marginLeft: 2, lineHeight: '18px' }}>{positions.length}</Tag>}</Space>),
      children: <PositionsTab positions={positions} onChange={setPositions} />,
    },
    {
      key: 'groups',
      label: (<Space size={6}><TeamOutlined />Grupos{selectedGroupIds.length > 0 && <Tag color="geekblue" style={{ marginLeft: 2, lineHeight: '18px' }}>{selectedGroupIds.length}</Tag>}</Space>),
      children: <GroupsTab userId={editingUser?.id} selectedGroupIds={selectedGroupIds} onChange={setSelectedGroupIds} />,
    },
  ]

  return (
    <div className="users-page">
      <div className="users-page__header">
        <div className="users-page__title-wrap">
          <Title level={4} className="users-page__title">Usuários</Title>
          <Text className="users-page__subtitle">Gerencie o cadastro e os perfis dos usuários do sistema</Text>
        </div>
        <Space>
          <Tooltip title="Importar usuários via CSV">
            <Upload beforeUpload={handleBulkCsvUpload} accept=".csv" showUploadList={false}>
              <Button icon={<UploadOutlined />} type="default">Importar CSV</Button>
            </Upload>
          </Tooltip>
          <Button icon={<FileAddOutlined />} onClick={() => { setBulkOpen(true); setBulkPasteText(''); setBulkPreview([]); setBulkErrors([]) }}>
            Colar dados
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>Novo Usuário</Button>
        </Space>
      </div>

      <div className="users-page__filters">
        <Input.Search placeholder="Buscar por nome ou e-mail..." allowClear value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} />
        <Select allowClear placeholder="Setor"    style={{ width: 160 }} options={deptOptions}   value={filterDept}   onChange={setFilterDept} />
        <Select allowClear placeholder="Cargo"    style={{ width: 180 }} options={jobOptions}    value={filterJob}    onChange={setFilterJob} />
        <Select allowClear placeholder="Papel"    style={{ width: 130 }} options={roleOptions}   value={filterRole}   onChange={setFilterRole} />
        <Select allowClear placeholder="Ambiente" style={{ width: 140 }} options={envOptions}    value={filterEnv}    onChange={setFilterEnv} />
        <Select allowClear placeholder="Status"   style={{ width: 130 }} options={statusOptions} value={filterStatus} onChange={setFilterStatus} />
        <Select allowClear placeholder="Grupo"    style={{ width: 150 }}
          options={(allGroups as OrgGroupDto[]).map((g) => ({ label: g.name, value: g.id }))}
          value={filterGroup} onChange={setFilterGroup} optionFilterProp="label" showSearch />
        {(search || filterDept || filterJob || filterRole || filterEnv || filterStatus || filterGroup) && (
          <Button size="small" type="link" onClick={() => {
            setSearch(''); setFilterDept(undefined); setFilterJob(undefined)
            setFilterRole(undefined); setFilterEnv(undefined); setFilterStatus(undefined); setFilterGroup(undefined)
          }}>Limpar filtros</Button>
        )}
      </div>

      <div className="users-page__table-card">
        <Table
          dataSource={data} columns={columns} rowKey="id" loading={isLoading}
          scroll={{ x: 1100 }} pagination={{ pageSize: 10, showSizeChanger: false }}
          onRow={(record: ExtendedUserListItem) => ({ onClick: () => handleOpenEdit(record), style: { cursor: 'pointer' } })}
        />
      </div>

      <Modal
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        open={open} onCancel={handleCloseModal} onOk={() => form.submit()}
        okText={editingUser ? 'Salvar alterações' : 'Criar usuário'}
        confirmLoading={isSaving} width={900} destroyOnHidden className="users-page__modal"
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="users-page__modal-tabs" />
      </Modal>

      <Modal
        title="Importar Usuários em Lote"
        open={bulkOpen}
        onCancel={() => { setBulkOpen(false); setBulkPasteText(''); setBulkPreview([]); setBulkErrors([]) }}
        onOk={handleBulkConfirm}
        okText={`Confirmar importação${bulkPreview.length > 0 ? ` (${bulkPreview.length})` : ''}`}
        okButtonProps={{ disabled: bulkPreview.length === 0 }}
        width={860} destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
              Cole ou faça upload de um CSV com <strong>ponto-e-vírgula</strong> como separador.<br />
              Cabeçalho: <code>nome;email;senha;papel;setor;cargo;telefone;status;ambientes</code>
            </div>
            <Button size="small" icon={<DownloadOutlined />} onClick={downloadUserTemplate} style={{ flexShrink: 0 }}>Baixar modelo</Button>
          </div>

          <Input.TextArea rows={6} value={bulkPasteText}
            onChange={(e) => { setBulkPasteText(e.target.value); setBulkPreview([]); setBulkErrors([]) }}
            placeholder={"nome;email;senha;papel;setor;cargo;telefone;status;ambientes\nJoão Silva;joao@empresa.com;Senha@123;Operador;Jurídico;Analista;(11) 99999-0010;active;Web,Mobile"}
            style={{ fontFamily: 'monospace', fontSize: 12 }} />

          {bulkPasteText.trim() && bulkPreview.length === 0 && (
            <Button size="small" type="dashed" onClick={handleBulkPasteParse}>Validar dados colados</Button>
          )}

          {bulkErrors.length > 0 && (
            <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', maxHeight: 100, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#d48806', marginBottom: 4 }}>{bulkErrors.length} aviso(s):</div>
              {bulkErrors.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#875800' }}>{e}</div>)}
            </div>
          )}

          {bulkPreview.length > 0 && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: '#52c41a' }}>✓ {bulkPreview.length} usuário(s) prontos para importação:</div>
              <Table size="small" dataSource={bulkPreview.map((r, i) => ({ ...r, key: i }))}
                pagination={{ pageSize: 5, showSizeChanger: false }}
                columns={[
                  { title: 'Nome',      dataIndex: 'name',        key: 'name' },
                  { title: 'E-mail',    dataIndex: 'email',       key: 'email' },
                  { title: 'Papel',     dataIndex: 'role',        key: 'role',        render: (v: string) => <Tag color={v === 'Admin' ? 'purple' : v === 'Gestor' ? 'blue' : 'default'}>{v}</Tag> },
                  { title: 'Setor',     dataIndex: 'department',  key: 'department',  render: (v: string) => v || '—' },
                  { title: 'Status',    dataIndex: 'status',      key: 'status',      render: (v: string) => { const cfg = STATUS_CONFIG[v] ?? STATUS_CONFIG.active; return <Tag color={cfg.color}>{cfg.label}</Tag> } },
                  { title: 'Ambientes', dataIndex: 'environments', key: 'environments', render: (v: string[]) => v?.length ? v.map((e) => <Tag key={e}>{e}</Tag>) : '—' },
                ]}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}