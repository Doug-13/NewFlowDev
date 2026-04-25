import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Button, Select, Space, Typography, Card, Row, Col,
  Tag, Tooltip, Alert, Empty, Spin,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, ArrowLeftOutlined,
  FileTextOutlined, LockOutlined, FolderOpenOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getDocuments } from '../../api/documents'
import { getOrgGroups } from '../../api/organization'
import { StatusBadge } from '../../components/StatusBadge'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../api/client'
import type { DocumentInstance } from '../../types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const { Title, Text } = Typography

const STATUS_OPTIONS = [
  { label: 'Todos', value: '' },
  { label: 'Em Elaboração', value: 'in_progress' },
  { label: 'Publicado', value: 'published' },
  { label: 'Reprovado', value: 'rejected' },
  { label: 'Cancelado', value: 'cancelled' },
]

function checkPermission(
  perms: any,
  userId: string,
  userRole: string,
  userProcessMemberships: any[],
  userGroups: any[],
): boolean {
  if (userRole === 'Admin' || userRole === 'admin') return true
  if (!perms) return true

  const hasRestriction =
    (perms.userIds?.length ?? 0) > 0 ||
    (perms.groupIds?.length ?? 0) > 0 ||
    (perms.processIds?.length ?? 0) > 0 ||
    (perms.areaIds?.length ?? 0) > 0

  if (!hasRestriction) return true
  if (perms.userIds?.includes(userId)) return true
  if (
    perms.processIds?.some((pid: string) =>
      userProcessMemberships.some((m: any) => m.processId === pid && m.isActive !== false),
    )
  ) return true
  if (
    perms.groupIds?.some((gid: string) =>
      userGroups.some((g: any) => g.id === gid && (g.memberIds ?? []).includes(userId)),
    )
  ) return true

  return false
}

function normalizeDoc(p: any) {
  return { ...p, id: p.id ?? p._id?.toString?.() ?? null }
}

function formatDateSafe(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

interface ProcessEntry {
  process: any
  workflow: any | null
  hasView: boolean
  hasCreate: boolean
}

function ProcessList({
  entries,
  onSelect,
  onCreateDirect,
}: {
  entries: ProcessEntry[]
  onSelect: (e: ProcessEntry) => void
  onCreateDirect: (e: ProcessEntry) => void
}) {
  if (entries.length === 0) {
    return (
      <Empty
        image={<FolderOpenOutlined style={{ fontSize: 48, color: '#bbb' }} />}
        description="Você não tem acesso a nenhum processo no momento."
      />
    )
  }

  return (
    <Row gutter={[16, 16]}>
      {entries.map((entry) => {
        const { process, workflow, hasView, hasCreate } = entry

        return (
          <Col xs={24} md={12} lg={8} key={process.id}>
            <Card
              hoverable
              onClick={() => hasView && onSelect(entry)}
              style={{ borderRadius: 16 }}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space direction="vertical" size={4}>
                  <Text strong>{process.name}</Text>
                  <Space wrap>
                    <Tag style={{ margin: 0 }}>{process.code}</Tag>
                    {workflow ? (
                      <Tag style={{ margin: 0 }} color="green">
                        Workflow: {workflow.name}
                      </Tag>
                    ) : (
                      <Tag style={{ margin: 0 }} color="default">
                        Sem workflow
                      </Tag>
                    )}
                    {!hasView && (
                      <Tag style={{ margin: 0 }} color="orange">
                        <LockOutlined /> Restrito
                      </Tag>
                    )}
                  </Space>
                </Space>

                <Space>
                  <Button
                    icon={<EyeOutlined />}
                    disabled={!hasView}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (hasView) onSelect(entry)
                    }}
                  >
                    Abrir
                  </Button>

                  {hasCreate ? (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        onCreateDirect(entry)
                      }}
                    >
                      Novo Documento
                    </Button>
                  ) : (
                    <Tooltip title="Você não tem permissão para criar documentos neste processo">
                      <Button type="primary" icon={<LockOutlined />} disabled>
                        Novo Documento
                      </Button>
                    </Tooltip>
                  )}
                </Space>
              </Space>
            </Card>
          </Col>
        )
      })}
    </Row>
  )
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<ProcessEntry | null>(null)

  const accountId = user?.accountId ?? (user as any)?.tenantId ?? ''

  const { data: userProcessMemberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ['user-process-memberships', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await api.get('/user-process-memberships', {
        params: { userId: user.id },
      })
      return data ?? []
    },
    enabled: !!user?.id,
    staleTime: 0,
  })

  const { data: allProcesses = [], isLoading: loadingProcesses } = useQuery({
    queryKey: ['processes', accountId],
    queryFn: async () => {
      const { data } = await api.get('/processes', { params: { accountId } })
      return (Array.isArray(data) ? data : [])
        .map(normalizeDoc)
        .filter((p: any) => !!p.id && p.id !== 'undefined' && p.isActive !== false)
    },
    enabled: !!accountId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const { data: allWorkflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data } = await api.get('/workflows')
      return Array.isArray(data) ? data : []
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const { data: orgGroups = [] } = useQuery({
    queryKey: ['org-groups'],
    queryFn: getOrgGroups,
    staleTime: 0,
  })

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', selectedEntry?.process?.id, status],
    queryFn: () =>
      getDocuments({
        processId: selectedEntry!.process.id,
        ...(status ? { status } : {}),
      }),
    enabled: !!selectedEntry,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const isLoading = loadingMemberships || loadingProcesses

  const processEntries: ProcessEntry[] = (allProcesses as any[])
    .map((process) => {
      const isMember =
        user?.role === 'Admin' ||
        user?.role === 'admin' ||
        (userProcessMemberships as any[]).some(
          (m: any) => m.processId === process.id && m.isActive !== false,
        )

      if (!isMember) return null

      const workflow =
        (allWorkflows as any[]).find((w: any) => w.processId === process.id) ?? null

      const uid = user?.id ?? ''
      const role = user?.role ?? ''

      return {
        process,
        workflow,
        hasView: checkPermission(
          workflow?.permissions?.visualization,
          uid,
          role,
          userProcessMemberships as any[],
          orgGroups as any[],
        ),
        hasCreate: checkPermission(
          workflow?.permissions?.creation,
          uid,
          role,
          userProcessMemberships as any[],
          orgGroups as any[],
        ),
      }
    })
    .filter(Boolean) as ProcessEntry[]

  const handleCreateDirect = (entry: ProcessEntry) => {
    const params = new URLSearchParams({
      processId: entry.process.id,
      processName: entry.process.name,
      ...(entry.workflow ? { workflowId: entry.workflow.id } : {}),
    })
    navigate(`/documents/new?${params.toString()}`)
  }

  if (!selectedEntry) {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      )
    }

    return (
      <ProcessList
        entries={processEntries}
        onSelect={setSelectedEntry}
        onCreateDirect={handleCreateDirect}
      />
    )
  }

  const { process, workflow, hasCreate } = selectedEntry
  const filteredDocs = status
    ? (documents as any[]).filter((d: any) => d.status === status)
    : (documents as any[])

  const columns = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Etapa Atual',
      dataIndex: 'currentStepName',
      key: 'currentStepName',
      render: (v: any) => v ?? '-',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, r: DocumentInstance) => <StatusBadge status={r.status} />,
    },
    {
      title: 'Criado por',
      key: 'createdBy',
      render: (_: any, r: any) => r.createdByUserName ?? r.createdByName ?? '-',
    },
    {
      title: 'Atualizado',
      key: 'updatedAt',
      render: (_: any, r: DocumentInstance) => formatDateSafe((r as any).updatedAt),
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, r: DocumentInstance) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/documents/${r.id}`)}
        >
          Ver
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <Space align="start">
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedEntry(null)}>
            Processos
          </Button>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {process.name}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {workflow ? `Workflow: ${workflow.name}` : 'Sem workflow configurado'}
            </Text>
          </div>
        </Space>

        {hasCreate ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleCreateDirect(selectedEntry)}
          >
            Novo Documento
          </Button>
        ) : (
          <Tooltip title="Você não tem permissão para criar documentos neste processo">
            <Button type="primary" icon={<LockOutlined />} disabled>
              Novo Documento
            </Button>
          </Tooltip>
        )}
      </div>

      {!hasCreate && (
        <Alert
          type="warning"
          showIcon
          message="Você pode visualizar os documentos, mas não tem permissão de criação neste processo."
          style={{ marginBottom: 16 }}
        />
      )}

      <Space style={{ marginBottom: 16 }}>
        <span>Filtrar por status:</span>
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          style={{ width: 180 }}
          allowClear
          placeholder="Todos"
        />
      </Space>

      <Table
        dataSource={filteredDocs}
        columns={columns}
        rowKey="id"
        loading={loadingDocs}
        locale={{ emptyText: 'Nenhum documento encontrado.' }}
      />
    </div>
  )
}