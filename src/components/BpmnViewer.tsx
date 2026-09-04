import { useEffect, useRef, useState, useCallback } from 'react'
import { Spin, Alert } from 'antd'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

export type BpmnNodeStatus =
  | 'completed'
  | 'current'
  | 'pending'
  | 'rejected'
  | 'skipped'

export type BpmnNodeOverride = {
  elementId: string
  status: BpmnNodeStatus
}

type BpmnViewerProps = {
  bpmnXml: string
  overrides?: BpmnNodeOverride[]
  height?: number | string
}

const STATUS_STYLES: Record<BpmnNodeStatus, { fill: string; stroke: string; strokeWidth: number }> = {
  completed: { fill: '#dcfce7', stroke: '#16a34a', strokeWidth: 2 },
  current:   { fill: '#dbeafe', stroke: '#1d4ed8', strokeWidth: 2.5 },
  pending:   { fill: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 1 },
  rejected:  { fill: '#fee2e2', stroke: '#dc2626', strokeWidth: 2 },
  skipped:   { fill: '#fef9c3', stroke: '#ca8a04', strokeWidth: 1.5 },
}

/**
 * Aplica cor diretamente nos elementos SVG do diagrama.
 * Compatível com bpmn-js v9+ (não acessa businessObject.di).
 *
 * Estratégia: pega o gráfico SVG do elemento via canvas.getGraphics(element)
 * e manipula os atributos fill/stroke dos shapes internos.
 */
function applyColorToElement(
  canvas: any,
  elementRegistry: any,
  elementId: string,
  status: BpmnNodeStatus,
) {
  const element = elementRegistry.get(elementId)
  if (!element) return

  // Ignora conexões (SequenceFlow) e labels
  if (element.waypoints || element.labelTarget || element.type === 'label') return

  const style = STATUS_STYLES[status]
  if (!style) return

  try {
    const gfx: SVGElement = canvas.getGraphics(element)
    if (!gfx) return

    // bpmn-js renderiza shapes dentro de .djs-visual
    const visual = gfx.querySelector('.djs-visual') as SVGGElement | null
    if (!visual) return

    // Aplica fill em todos os rects, circles, polygons e paths do visual
    const fillTargets = visual.querySelectorAll('rect, circle, ellipse, polygon, path')
    fillTargets.forEach((el) => {
      const svgEl = el as SVGElement
      // Preserva elementos que são apenas stroke (ex: setas internas)
      const currentFill = svgEl.getAttribute('fill') ?? svgEl.style.fill
      if (currentFill === 'none') return

      svgEl.style.fill   = style.fill
      svgEl.style.stroke = style.stroke
      svgEl.style.strokeWidth = String(style.strokeWidth)
    })

    // Aplica stroke no contorno principal (primeiro rect/circle/polygon)
    const outline = visual.querySelector('rect, circle, ellipse, polygon') as SVGElement | null
    if (outline) {
      outline.style.stroke      = style.stroke
      outline.style.strokeWidth = String(style.strokeWidth)
    }
  } catch (err) {
    console.warn('[BpmnViewer] falha ao colorir elemento', elementId, err)
  }
}

export function BpmnViewer({ bpmnXml, overrides = [], height = 400 }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef    = useRef<InstanceType<typeof NavigatedViewer> | null>(null)
  const isMountedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const applyOverrides = useCallback(
    (viewer: InstanceType<typeof NavigatedViewer>, nodeOverrides: BpmnNodeOverride[]) => {
      if (!nodeOverrides.length) return

      const canvas          = viewer.get('canvas') as any
      const elementRegistry = viewer.get('elementRegistry') as any

      // Primeiro reseta todos os elementos para pending
      const allElements: any[] = elementRegistry.getAll?.() ?? []
      allElements.forEach((el: any) => {
        if (el.waypoints || el.labelTarget || el.type === 'label') return
        applyColorToElement(canvas, elementRegistry, el.id, 'pending')
      })

      // Depois aplica as overrides específicas
      nodeOverrides.forEach(({ elementId, status }) => {
        applyColorToElement(canvas, elementRegistry, elementId, status)
      })
    },
    [],
  )

  useEffect(() => {
    isMountedRef.current = true
    if (!containerRef.current) return

    const viewer = new NavigatedViewer({ container: containerRef.current })
    viewerRef.current = viewer

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        await viewer.importXML(bpmnXml)

        const canvas = viewer.get('canvas') as any
        canvas?.zoom('fit-viewport', 'auto')

        // Pequeno delay para garantir que o SVG foi renderizado antes de colorir
        setTimeout(() => {
          if (isMountedRef.current) {
            applyOverrides(viewer, overrides)
          }
        }, 80)
      } catch (err) {
        console.error('[BpmnViewer] erro ao importar XML =>', err)
        if (isMountedRef.current) setError('Não foi possível renderizar o diagrama.')
      } finally {
        if (isMountedRef.current) setLoading(false)
      }
    }

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => { void load() })
      return () => cancelAnimationFrame(raf2)
    })

    return () => {
      cancelAnimationFrame(raf1)
      isMountedRef.current = false
      try { viewer.destroy() } catch { /* ignore */ }
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmnXml])

  // Re-aplica cores quando overrides mudam sem reimportar o XML
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || loading) return
    applyOverrides(viewer, overrides)
  }, [overrides, loading, applyOverrides])

  return (
    <div style={{ position: 'relative', height: typeof height === 'number' ? `${height}px` : height }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          background: 'rgba(255,255,255,0.85)',
          zIndex: 2, borderRadius: 12,
        }}>
          <Spin tip="Carregando diagrama..." />
        </div>
      )}

      {error && !loading && (
        <Alert type="error" showIcon message={error} style={{ margin: 16 }} />
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#fafbfc',
        }}
      />

      {!loading && !error && (
        <div style={{
          position: 'absolute',
          bottom: 12, right: 12,
          background: 'rgba(255,255,255,0.93)',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '7px 12px',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 11,
          color: '#475569',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          zIndex: 1,
          pointerEvents: 'none',
        }}>
          {([
            ['completed', 'Concluída'],
            ['current',   'Em andamento'],
            ['pending',   'Pendente'],
            ['rejected',  'Reprovada'],
          ] as [BpmnNodeStatus, string][]).map(([status, label]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 12, height: 12, borderRadius: 3,
                background: STATUS_STYLES[status].fill,
                border: `${STATUS_STYLES[status].strokeWidth}px solid ${STATUS_STYLES[status].stroke}`,
                flexShrink: 0,
              }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}