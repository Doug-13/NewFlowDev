import { useMemo } from 'react'
import type { BpmnNodeOverride } from '../components/BpmnViewer'


type AuditLog = {
  action: string
  stepName?: string | null
  metadata?: any
  createdAt: string
}

type UseWorkflowNodeStatusesParams = {
  /** Todos os elementIds do workflow (de workflow.elements) */
  allElementIds: string[]
  /** ElementId da etapa atual do documento (null se encerrado) */
  currentElementId?: string | null
  /** Status do documento */
  documentStatus?: string | null
  /** Audit logs do documento (order DESC do backend) */
  auditLogs?: AuditLog[]
  /** workflow.elements completo (para saber quais são end events) */
  workflowElements?: any[]
}

const FINISHED_STATUSES = new Set([
  'approved', 'published', 'rejected', 'cancelled', 'archived', 'completed',
])

const REJECTED_STATUSES = new Set(['rejected', 'cancelled'])

export function useWorkflowNodeStatuses({
  allElementIds,
  currentElementId,
  documentStatus,
  auditLogs = [],
  workflowElements = [],
}: UseWorkflowNodeStatusesParams): BpmnNodeOverride[] {
  return useMemo(() => {
    const isFinished = FINISHED_STATUSES.has(String(documentStatus ?? '').toLowerCase())
    const isRejected = REJECTED_STATUSES.has(String(documentStatus ?? '').toLowerCase())

    // ── Monta set de elementIds que foram executados ──────────────────────────
    const executedIds = new Set<string>()

    for (const log of auditLogs) {
      let meta: Record<string, any> | null = null
      try {
        const raw = (log as any).metadata
        meta = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null
      } catch {
        meta = null
      }

      if (!meta) continue

      // fromElementId = etapa que executou a ação (foi concluída)
      if (meta.fromElementId) {
        executedIds.add(String(meta.fromElementId))
      }

      // toElementId sem finalStatus = etapa intermediária visitada
      if (meta.toElementId && !meta.finalStatus) {
        executedIds.add(String(meta.toElementId))
      }

      // toElementId COM finalStatus = é o End Event — adiciona também
      if (meta.toElementId && meta.finalStatus) {
        executedIds.add(String(meta.toElementId))
      }
    }

    // ── Descobre quais elementIds são End Events ───────────────────────────────
    const endEventIds = new Set<string>()

    // 1. Via workflowElements (mais preciso)
    workflowElements.forEach((el: any) => {
      const kind = String(
        el?.elementKind ?? el?.element_kind ?? el?.kind ?? '',
      ).toLowerCase()
      const elId = String(el?.elementId ?? el?.element_id ?? el?.id ?? '')
      if (kind === 'end' && elId) endEventIds.add(elId)
    })

    // 2. Fallback: via allElementIds prefixo/sufixo comum do BPMN
    if (endEventIds.size === 0) {
      allElementIds.forEach((id) => {
        if (
          id.toLowerCase().includes('endevent') ||
          id.toLowerCase().includes('end_event') ||
          id.toLowerCase().startsWith('end')
        ) {
          endEventIds.add(id)
        }
      })
    }

    // ── Se encerrado, marca todos os End Events como completed/rejected ───────
    if (isFinished) {
      endEventIds.forEach((id) => executedIds.add(id))
    }

    // ── Monta os overrides ────────────────────────────────────────────────────
    return allElementIds.map((elementId): BpmnNodeOverride => {
      const isEndEvent = endEventIds.has(elementId)

      // Etapa atual em andamento
      if (!isFinished && elementId === currentElementId) {
        return { elementId, status: 'current' }
      }

      // End Event quando documento encerrado
      if (isEndEvent && isFinished) {
        return { elementId, status: isRejected ? 'rejected' : 'completed' }
      }

      // Etapas executadas
      if (executedIds.has(elementId)) {
        return { elementId, status: isRejected ? 'rejected' : 'completed' }
      }

      return { elementId, status: 'pending' }
    })
  }, [allElementIds, currentElementId, documentStatus, auditLogs, workflowElements])
}