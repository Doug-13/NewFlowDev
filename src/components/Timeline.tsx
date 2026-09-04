import { Timeline as AntTimeline, Tag } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileAddOutlined,
  PaperClipOutlined,
  ThunderboltOutlined,
  StopOutlined,
  GlobalOutlined,
  EditOutlined,
  SyncOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AuditLog } from '../types'

const ACTION_LABELS: Record<string, string> = {
  DocumentCreated:           'Documento criado',
  DocumentoCancelled:        'Documento cancelado',
  DocumentCancelled:         'Documento cancelado',
  DocumentoPublished:        'Documento publicado',
  DocumentPublished:         'Documento publicado',
  DocumentoRejected:         'Documento reprovado',
  DocumentRejected:          'Documento reprovado',
  approve:                   'Aprovado',
  aprovar:                   'Aprovado',
  reject:                    'Reprovado',
  reprovar:                  'Reprovado',
  'request-changes':         'Solicitadas alterações',
  request_changes:           'Solicitadas alterações',
  forward:                   'Encaminhado',
  encaminhar:                'Encaminhado',
  complete:                  'Concluído',
  concluir:                  'Concluído',
  publish:                   'Publicado',
  publicar:                  'Publicado',
  cancel:                    'Cancelado',
  cancelar:                  'Cancelado',
  submit:                    'Submetido',
  FileUploaded:              'Arquivo enviado',
  TaskExecuted:              'Ação executada',
  RevisionCreated:           'Revisão criada',
  RevisionGenerated:         'Revisão gerada',
  SubprocessWaitingChildren: 'Aguardando subprocessos',
  SubprocessChildCompleted:  'Subprocesso filho concluído',
  ParentFlowFinished:        'Fluxo pai encerrado',
  ParentFlowResumed:         'Fluxo pai retomado',
  SubprocessExecutionFailed: 'Erro ao criar subprocesso',
}

const STATUS_LABELS: Record<string, string> = {
  approved:    'Aprovado',
  published:   'Publicado',
  rejected:    'Reprovado',
  cancelled:   'Cancelado',
  archived:    'Arquivado',
  completed:   'Concluído',
  in_progress: 'Em andamento',
  draft:       'Rascunho',
}

const FINISHED_STATUSES = new Set([
  'approved', 'published', 'rejected', 'cancelled', 'archived', 'completed',
])

type DotConfig = { color: string; icon: React.ReactNode }

function getDotConfig(action: string): DotConfig {
  const a = String(action ?? '').toLowerCase()
  if (a === 'documentcreated' || a === 'documentocreated')
    return { color: '#1677ff', icon: <FileAddOutlined /> }
  if (['approve', 'aprovar', 'complete', 'concluir', 'publish', 'publicar'].includes(a))
    return { color: '#52c41a', icon: <CheckCircleOutlined /> }
  if (['reject', 'reprovar'].includes(a))
    return { color: '#ff4d4f', icon: <CloseCircleOutlined /> }
  if (['request-changes', 'request_changes'].includes(a))
    return { color: '#fa8c16', icon: <EditOutlined /> }
  if (a === 'cancel' || a === 'cancelar' || a.includes('cancelled'))
    return { color: '#8c8c8c', icon: <StopOutlined /> }
  if (a.includes('file'))
    return { color: '#13c2c2', icon: <PaperClipOutlined /> }
  if (a.includes('revision'))
    return { color: '#722ed1', icon: <BranchesOutlined /> }
  if (a.includes('subprocess') || a.includes('parent'))
    return { color: '#1677ff', icon: <SyncOutlined /> }
  if (a.includes('published'))
    return { color: '#52c41a', icon: <GlobalOutlined /> }
  if (a.includes('waiting'))
    return { color: '#fa8c16', icon: <ClockCircleOutlined /> }
  return { color: '#1677ff', icon: <ThunderboltOutlined /> }
}

function getStatusDotConfig(status: string): DotConfig {
  if (['approved', 'completed'].includes(status))
    return { color: '#52c41a', icon: <TrophyOutlined /> }
  if (status === 'published')
    return { color: '#1677ff', icon: <GlobalOutlined /> }
  if (status === 'rejected')
    return { color: '#ff4d4f', icon: <CloseCircleOutlined /> }
  if (['cancelled', 'archived'].includes(status))
    return { color: '#8c8c8c', icon: <StopOutlined /> }
  return { color: '#52c41a', icon: <CheckCircleOutlined /> }
}

function getStatusTagColor(status: string): string {
  if (['approved', 'completed', 'published'].includes(status)) return 'success'
  if (['rejected', 'cancelled'].includes(status)) return 'error'
  if (status === 'archived') return 'default'
  return 'processing'
}

function safeFormatDate(value: string) {
  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return value
  }
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? ACTION_LABELS[action.toLowerCase()] ?? action
}

type TimelineProps = {
  logs: AuditLog[]
  documentStatus?: string | null
  documentUpdatedAt?: string | null
}

export function Timeline({ logs, documentStatus, documentUpdatedAt }: TimelineProps) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return (
      <p style={{ color: '#aaa', textAlign: 'center', padding: '24px 0' }}>
        Nenhum evento registrado.
      </p>
    )
  }

  const isFinished = FINISHED_STATUSES.has(String(documentStatus ?? '').toLowerCase())

  // Inverte: backend retorna DESC (mais recente primeiro), queremos ASC (mais antigo no topo)
  const orderedLogs = [...logs].reverse()

  const finishedItem = isFinished && documentStatus
    ? (() => {
        const { color, icon } = getStatusDotConfig(documentStatus)
        const statusLabel = STATUS_LABELS[documentStatus] ?? documentStatus
        return {
          dot: (
            <span style={{ color, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </span>
          ),
          color,
          children: (
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                <strong style={{ fontSize: 13, color: '#0f172a' }}>
                  Documento encerrado
                </strong>
                <Tag color={getStatusTagColor(documentStatus)} style={{ fontSize: 11, margin: 0 }}>
                  {statusLabel}
                </Tag>
              </div>
              {documentUpdatedAt && (
                <small style={{ color: '#94a3b8', fontSize: 11 }}>
                  {safeFormatDate(documentUpdatedAt)}
                </small>
              )}
            </div>
          ),
        }
      })()
    : null

  const items = [
    ...orderedLogs.map((log) => {
      const { color, icon } = getDotConfig(log.action)
      const label = getActionLabel(log.action)
      const stepName = (log as any).stepName ?? null

      let parsedMeta: Record<string, any> | null = null
      try {
        const raw = (log as any).metadata
        parsedMeta = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
      } catch {
        parsedMeta = null
      }

      const finalStatus = parsedMeta?.finalStatus ?? null

      return {
        dot: (
          <span style={{ color, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </span>
        ),
        color,
        children: (
          <div style={{ paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>{label}</strong>
              {stepName && (
                <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{stepName}</Tag>
              )}
              {finalStatus && (
                <Tag
                  color={
                    ['approved', 'published'].includes(finalStatus) ? 'success'
                    : ['rejected', 'cancelled'].includes(finalStatus) ? 'error'
                    : 'default'
                  }
                  style={{ fontSize: 11, margin: 0 }}
                >
                  {STATUS_LABELS[finalStatus] ?? finalStatus}
                </Tag>
              )}
            </div>

            {log.userName && (
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 2 }}>
                por <strong style={{ color: '#334155' }}>{log.userName}</strong>
              </div>
            )}

            {log.comment && (
              <p style={{
                margin: '4px 0',
                color: '#475569',
                fontSize: 12,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '4px 8px',
              }}>
                {log.comment}
              </p>
            )}

            <small style={{ color: '#94a3b8', fontSize: 11 }}>
              {safeFormatDate(log.createdAt)}
            </small>
          </div>
        ),
      }
    }),
    ...(finishedItem ? [finishedItem] : []),
  ]

  return <AntTimeline mode="left" items={items} />
}