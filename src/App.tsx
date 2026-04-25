import { useMemo, useState } from 'react'
import { Routes, Route, Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Layout, Menu, Avatar, Dropdown, Typography, Tag,
  Button, Space, Divider, Tooltip, Spin,
} from 'antd'
import {
  DashboardOutlined, ApartmentOutlined, CheckSquareOutlined,
  UserOutlined, LogoutOutlined, FolderOpenOutlined, DatabaseOutlined,
  TeamOutlined, SettingOutlined, GlobalOutlined, UnorderedListOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, BellOutlined, AppstoreOutlined,
  PlusOutlined, RightOutlined, EyeOutlined,
} from '@ant-design/icons'

import { api } from './api/client'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/Login/LoginPage'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { LDPage } from './pages/LD'
import { WorkflowsPage } from './pages/Workflows/WorkflowsPage'
import { WorkflowDetailPage } from './pages/Workflows/WorkflowDetail'
import { WorkflowNewPage } from './pages/Workflows/WorkflowNew'
import { NotificationTemplatesPage } from './pages/Notifications/NotificationTemplatesPage'
import { DocumentsPage } from './pages/Documents'
import { DocumentNewPage } from './pages/Documents/DocumentNew'
import { DocumentDetailPage } from './pages/Documents/DocumentDetail'
import { TasksPage } from './pages/Tasks'
import { UsersPage } from './pages/Users/UsersPage'
import { OrganizationPage } from './pages/Admin/OrganizationPage'
import { MetadataPage } from './pages/Admin/MetadataPage'
import { ExibicaoPage } from './pages/Exibicao/ExibicaoPage'
import { EnvironmentSettingsPage } from './pages/Admin/EnvironmentSettings'
import { TenantsPage } from './pages/Platform/TenantsPage'
import { PlatformAdminsPage } from './pages/Platform/PlatformAdminsPage'
import { TenantUsersPage } from './pages/Platform/TenantUsersPage'
import { WorkflowStudioPage } from './pages/Workflows/WorkflowStudioPage'
import { logout } from './api/auth'

const { Header, Sider, Content } = Layout
const { Text } = Typography

function ProcessSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const safeId = id && id !== 'undefined' ? id : undefined
  return <EnvironmentSettingsPage processId={safeId} />
}

type ScopeContextInfo = {
  accountLabel: string
  processLabel: string
}

function normalizeRole(role?: string | null): string {
  return String(role ?? '').trim().toLowerCase()
}

function isAdminUser(user: any): boolean {
  const role = normalizeRole(user?.role)
  return role === 'admin'
}

function resolveAppContext(user: any): ScopeContextInfo {
  const accountLabel =
    user?.accountName ??
    user?.account?.name ??
    user?.companyName ??
    user?.tenantName ??
    user?.tenant?.name ??
    user?.accountId ??
    user?.tenantId ??
    'Conta não selecionada'

  const processLabel =
    user?.defaultProcessName ??
    user?.processName ??
    user?.process?.name ??
    (user?.defaultProcessId ? `Processo ${user.defaultProcessId}` : 'Processo não selecionado')

  return {
    accountLabel,
    processLabel,
  }
}

function resolveAccountId(user: { accountId?: string; tenantId?: string } | null): string {
  return user?.accountId ?? user?.tenantId ?? ''
}

function SidebarBrand({
  collapsed,
  title,
  subtitle,
  tagText,
  logoUrl,
  accent = '#1677ff',
}: {
  collapsed: boolean
  title: string
  subtitle: string
  tagText?: string
  logoUrl?: string
  accent?: string
}) {
  return (
    <div
      style={{
        padding: collapsed ? '16px 10px' : '18px 16px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        minHeight: 92,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 12,
          width: '100%',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            minWidth: 42,
            borderRadius: 14,
            overflow: 'hidden',
            background: logoUrl ? '#ffffff' : `linear-gradient(135deg, ${accent} 0%, #69b1ff 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <AppstoreOutlined style={{ color: '#fff', fontSize: 20 }} />
          )}
        </div>

        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.62)',
                fontSize: 12,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subtitle}
            </div>
            {tagText && (
              <Tag color="blue" style={{ marginTop: 8, borderRadius: 999, fontSize: 10, paddingInline: 8 }}>
                {tagText}
              </Tag>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarUserCard({
  collapsed,
  name,
  role,
  accent = '#1677ff',
}: {
  collapsed: boolean
  name?: string
  role?: string
  accent?: string
}) {
  return (
    <div
      style={{
        margin: collapsed ? '12px 8px 14px' : '12px 12px 14px',
        padding: collapsed ? '10px 0' : '12px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 10,
      }}
    >
      <Avatar icon={<UserOutlined />} style={{ background: accent, boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }} />
      {!collapsed && (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name ?? 'Usuário'}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: 11,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {role ?? 'Perfil'}
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarScopeCard({ collapsed, context }: { collapsed: boolean; context: ScopeContextInfo }) {
  if (collapsed) return null

  const row: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 10px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.06)',
  }

  const lbl: React.CSSProperties = {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  }

  const val: React.CSSProperties = {
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div
        style={{
          borderRadius: 18,
          padding: 12,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={row}>
          <span style={lbl}>Conta / Empresa</span>
          <span style={val}>{context.accountLabel}</span>
        </div>
        <div style={row}>
          <span style={lbl}>Processo Ativo</span>
          <span style={val}>{context.processLabel}</span>
        </div>
      </div>
    </div>
  )
}

function Topbar({
  collapsed,
  onToggle,
  userName,
  userRole,
  onLogout,
  accent = '#1677ff',
  context,
}: {
  collapsed: boolean
  onToggle: () => void
  userName?: string
  userRole?: string
  onLogout: () => void
  accent?: string
  context: ScopeContextInfo
}) {
  return (
    <Header
      style={{
        background: '#ffffff',
        padding: '0 20px',
        minHeight: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #edf0f3',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
        <Button
          type="text"
          onClick={onToggle}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            Conta: {context.accountLabel}
          </Tag>
          <Tag color="purple" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
            Processo: {context.processLabel}
          </Tag>
        </div>
      </div>

      <Space size={12}>
        <Button
          type="text"
          icon={<BellOutlined />}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        <Dropdown
          menu={{
            items: [{ key: 'logout', label: 'Sair', icon: <LogoutOutlined />, onClick: onLogout }],
          }}
          trigger={['click']}
        >
          <div
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 14,
              border: '1px solid #edf0f3',
              background: '#fff',
            }}
          >
            <Avatar style={{ background: accent }} icon={<UserOutlined />} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <Text strong style={{ fontSize: 13 }}>
                {userName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {userRole}
              </Text>
            </div>
          </div>
        </Dropdown>
      </Space>
    </Header>
  )
}

function getTenantSelectedKey(pathname: string) {
  if (pathname === '/') return '/'
  if (pathname.startsWith('/processes/new')) return '/processes/new'
  const proc = pathname.match(/^\/processes\/([\w-]+)/)
  if (proc) return `/processes/${proc[1]}`
  if (pathname.startsWith('/documents')) return '/documents'
  if (pathname.startsWith('/workflows')) return '/workflows'
  if (pathname.startsWith('/ld')) return '/ld'
  if (pathname.startsWith('/tasks')) return '/tasks'
  if (pathname.startsWith('/users')) return '/users'
  if (pathname.startsWith('/metadata')) return '/metadata'
  if (pathname.startsWith('/exibicao')) return '/exibicao'
  if (pathname.startsWith('/organization')) return '/organization'
  if (pathname.startsWith('/notifications')) return '/notifications'
  if (pathname.startsWith('/environment-settings')) return '/environment-settings'
  return '/'
}

function getPlatformSelectedKey(pathname: string) {
  if (pathname.startsWith('/platform/admins')) return '/platform/admins'
  return '/platform'
}

function PlatformLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const platformAdmin = useAuthStore((s) => s.platformAdmin)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /**/
    }
    clearAuth()
    navigate('/login')
  }

  const menuItems = useMemo(
    () => [
      {
        type: 'group' as const,
        label: 'PLATAFORMA',
        children: [
          {
            key: '/platform',
            label: <Link to="/platform">Contas / Empresas</Link>,
            icon: <GlobalOutlined />,
          },
          {
            key: '/platform/admins',
            label: <Link to="/platform/admins">Admins da Plataforma</Link>,
            icon: <SettingOutlined />,
          },
        ],
      },
    ],
    [],
  )

  const context: ScopeContextInfo = {
    accountLabel: 'Gestão central da plataforma',
    processLabel: 'N/A',
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Sider
        width={272}
        collapsedWidth={88}
        collapsed={collapsed}
        trigger={null}
        style={{
          background: 'linear-gradient(180deg,#0f172a 0%,#111827 100%)',
          boxShadow: '6px 0 24px rgba(15,23,42,0.18)',
          overflow: 'hidden',
        }}
      >
        <SidebarBrand
          collapsed={collapsed}
          title="Plataforma"
          subtitle="Administração global"
          tagText="Super Admin"
          accent="#faad14"
        />
        <SidebarScopeCard collapsed={collapsed} context={context} />

        <div style={{ padding: 12 }}>
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[getPlatformSelectedKey(location.pathname)]}
            items={menuItems}
            style={{ background: 'transparent', border: 'none' }}
          />
        </div>

        <div style={{ marginTop: 'auto' }}>
          <SidebarUserCard
            collapsed={collapsed}
            name={platformAdmin?.name}
            role="Administrador da Plataforma"
            accent="#faad14"
          />
        </div>
      </Sider>

      <Layout>
        <Topbar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
          userName={platformAdmin?.name}
          userRole="Plataforma"
          onLogout={handleLogout}
          accent="#faad14"
          context={context}
        />
        <Content style={{ padding: 24 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: 24,
              minHeight: 'calc(100vh - 120px)',
              boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
            }}
          >
            <Routes>
              <Route index element={<TenantsPage />} />
              <Route path="admins" element={<PlatformAdminsPage />} />
              <Route path="tenants/:id/users" element={<TenantUsersPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const enabledModules = useAuthStore((s) => s.enabledModules)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [collapsed, setCollapsed] = useState(false)

  const isAdmin = isAdminUser(user)
  const has = (module: string) => isAdmin || enabledModules.includes(module)
  const context = resolveAppContext(user)
  const accountId = resolveAccountId(user)

  const { data: processes = [], isLoading: loadingProcesses } = useQuery<any[]>({
    queryKey: ['sidebar-processes', accountId],
    queryFn: async () => {
      const { data } = await api.get('/processes', { params: { accountId } })
      if (!Array.isArray(data)) return []

      return data
        .map((p: any) => ({ ...p, id: p.id ?? p._id?.toString?.() ?? null }))
        .filter((p: any) => !!p.id && p.id !== 'undefined')
    },
    enabled: !!accountId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const activeProcesses = useMemo(
    () => processes.filter((p: any) => p.isActive),
    [processes],
  )

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /**/
    }
    clearAuth()
    navigate('/login')
  }

  const contaEmpresaChildren = [
    ...(isAdmin
      ? [{ key: '/users', label: <Link to="/users">Usuários</Link>, icon: <UserOutlined /> }]
      : []),
    ...(has('organization')
      ? [{ key: '/organization', label: <Link to="/organization">Estrutura Organizacional</Link>, icon: <TeamOutlined /> }]
      : []),
    ...(has('notification_templates')
      ? [{ key: '/notifications', label: <Link to="/notifications">Templates de Notificação</Link>, icon: <BellOutlined /> }]
      : []),
    ...(has('metadata')
      ? [{ key: '/metadata', label: <Link to="/metadata">Metadados</Link>, icon: <DatabaseOutlined /> }]
      : []),
    { key: '/exibicao', label: <Link to="/exibicao">Exibição</Link>, icon: <EyeOutlined /> },
    ...(isAdmin
      ? [{ key: '/environment-settings', label: <Link to="/environment-settings">Configurações</Link>, icon: <SettingOutlined /> }]
      : []),
  ]

  const menuItems = useMemo(
    () => [
      {
        type: 'group' as const,
        label: 'VISÃO GERAL',
        children: [{ key: '/', label: <Link to="/">Dashboard</Link>, icon: <DashboardOutlined /> }],
      },
      {
        type: 'group' as const,
        label: 'CONTA / EMPRESA',
        children: contaEmpresaChildren,
      },
      {
        type: 'group' as const,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
            <span>PROCESSOS</span>
            {!collapsed && (
              <Tooltip title="Novo processo">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/processes/new')
                  }}
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    width: 22,
                    height: 22,
                    minWidth: 22,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </Tooltip>
            )}
          </div>
        ),
        children: [
          ...(loadingProcesses
            ? [{ key: '__loading__', label: <Spin size="small" />, icon: null, disabled: true }]
            : activeProcesses.map((proc: any) => ({
              key: `/processes/${proc.id}`,
              label: <Link to={`/processes/${proc.id}`}>{proc.name}</Link>,
              icon: <RightOutlined style={{ fontSize: 10 }} />,
            }))),
          { type: 'divider' as const },
          ...(has('workflows')
            ? [{ key: '/workflows', label: <Link to="/workflows">Workflows</Link>, icon: <ApartmentOutlined /> }]
            : []),
          { key: '/documents', label: <Link to="/documents">Documentos</Link>, icon: <FolderOpenOutlined /> },
          { key: '/ld', label: <Link to="/ld">LD</Link>, icon: <UnorderedListOutlined /> },
          { key: '/tasks', label: <Link to="/tasks">Tarefas</Link>, icon: <CheckSquareOutlined /> },
        ],
      },
    ],
    [collapsed, navigate, loadingProcesses, activeProcesses, contaEmpresaChildren, has],
  )

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Sider
        width={280}
        collapsedWidth={88}
        collapsed={collapsed}
        trigger={null}
        style={{
          background: 'linear-gradient(180deg,#0b1f3a 0%,#102a43 100%)',
          boxShadow: '6px 0 24px rgba(16,42,67,0.14)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SidebarBrand
          collapsed={collapsed}
          title={context.accountLabel}
          subtitle="Gestão de Documentos"
          tagText={user?.role ?? 'Usuário'}
          accent="#1677ff"
        />
        <SidebarScopeCard collapsed={collapsed} context={context} />

        <div style={{ padding: 12, flex: 1, overflowY: 'auto' }}>
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[getTenantSelectedKey(location.pathname)]}
            items={menuItems}
            style={{ background: 'transparent', border: 'none' }}
          />
        </div>

        {!collapsed && (
          <div style={{ paddingInline: 16 }}>
            <Divider style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '4px 0 10px' }} />
          </div>
        )}

        <SidebarUserCard collapsed={collapsed} name={user?.name} role={user?.role} accent="#1677ff" />
      </Sider>

      <Layout>
        <Topbar
          collapsed={collapsed}
          onToggle={() => setCollapsed((p) => !p)}
          userName={user?.name}
          userRole={user?.role}
          onLogout={handleLogout}
          accent="#1677ff"
          context={context}
        />

        <Content style={{ padding: 24 }}>
          <div
            style={{
              background: '#fff',
              borderRadius: 24,
              padding: 24,
              minHeight: 'calc(100vh - 120px)',
              boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
            }}
          >
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/new" element={<DocumentNewPage />} />
              <Route path="documents/:id" element={<DocumentDetailPage />} />
              <Route path="workflows" element={<WorkflowsPage />} />
              <Route path="workflows/new" element={<WorkflowNewPage />} />
              <Route path="workflows/:id" element={<WorkflowDetailPage />} />
              <Route path="workflows/:id/studio" element={<WorkflowStudioPage />} />
              <Route path="ld" element={<LDPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="metadata" element={<MetadataPage />} />
              <Route path="exibicao" element={<ExibicaoPage />} />
              <Route path="organization" element={<OrganizationPage />} />
              <Route path="notifications" element={<NotificationTemplatesPage />} />
              <Route path="environment-settings" element={<EnvironmentSettingsPage />} />
              <Route path="processes/new" element={<EnvironmentSettingsPage />} />
              <Route path="processes/:id" element={<ProcessSettingsPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/platform/*"
        element={
          <ProtectedRoute requirePlatformAdmin>
            <PlatformLayout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}