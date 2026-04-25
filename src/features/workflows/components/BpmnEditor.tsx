import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  Alert,
  Button,
  Card,
  Space,
  Spin,
  Typography,
} from 'antd'
import {
  CompressOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  RedoOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import BpmnModeler from 'bpmn-js/lib/Modeler'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

import type { BpmnElementSummary } from '../studioValidation'
import { getStudioElementKind } from '../studioElementKinds'

// ─────────────────────────────────────────────────────────────────────────────
// Custom Palette — remove itens indesejados da paleta nativa
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_PALETTE_ENTRIES = new Set([
  'create.data-object',
  'create.data-store',
  'create.subprocess-expanded',
  'create.group',
])

function CustomPaletteProvider(
  this: any,
  palette: any,
  originalPaletteProvider: any,
) {
  this._palette = palette
  this._original = originalPaletteProvider
  palette.registerProvider(500, this)
}

CustomPaletteProvider.$inject = ['palette', 'paletteProvider']

CustomPaletteProvider.prototype.getPaletteEntries = function () {
  const entries = this._original.getPaletteEntries()
  const filtered: Record<string, unknown> = {}
  for (const key of Object.keys(entries)) {
    if (!BLOCKED_PALETTE_ENTRIES.has(key)) {
      filtered[key] = entries[key]
    }
  }
  return filtered
}

const customPaletteModule = {
  __init__: ['customPaletteProvider'],
  customPaletteProvider: ['type', CustomPaletteProvider],
}

const { Text } = Typography

// ─────────────────────────────────────────────────────────────────────────────
// Paleta de cores
// ─────────────────────────────────────────────────────────────────────────────

export type ColorEntry = {
  label: string
  fill: string
  stroke: string
}

export const COLOR_PALETTE: ColorEntry[] = [
  { label: 'Padrão',   fill: '#ffffff', stroke: '#000000' },
  { label: 'Azul',     fill: '#dbeafe', stroke: '#1d4ed8' },
  { label: 'Verde',    fill: '#dcfce7', stroke: '#15803d' },
  { label: 'Amarelo',  fill: '#fef9c3', stroke: '#a16207' },
  { label: 'Laranja',  fill: '#ffedd5', stroke: '#c2410c' },
  { label: 'Vermelho', fill: '#fee2e2', stroke: '#b91c1c' },
  { label: 'Roxo',     fill: '#ede9fe', stroke: '#6d28d9' },
  { label: 'Rosa',     fill: '#fce7f3', stroke: '#9d174d' },
  { label: 'Cinza',    fill: '#f3f4f6', stroke: '#4b5563' },
  { label: 'Ciano',    fill: '#cffafe', stroke: '#0e7490' },
]

type BpmnEditorProps = {
  initialXml?: string
  onChange?: (xml: string) => void
  onSelectionChange?: (element: BpmnElementSummary | null) => void
  onElementsChange?: (elements: BpmnElementSummary[]) => void
  onElementDoubleClick?: (element: BpmnElementSummary | null) => void
  renameRef?: React.MutableRefObject<((id: string, name: string) => void) | null>
  colorRef?: React.MutableRefObject<((id: string, color: ColorEntry) => void) | null>
  height?: number | string
  disabled?: boolean
}

const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Início" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="120" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

type BpmnModelerInstance = InstanceType<typeof BpmnModeler>

function normalizeXml(xml?: string) {
  return (xml ?? '').trim()
}

// ─── Conversão de elemento bpmn.io → BpmnElementSummary ──────────────────────
// CORREÇÃO: extrai eventDefinitionType do businessObject para distinguir
// Message / Timer / Signal / Conditional de eventos genéricos de notificação.

function toElementSummary(element: any): BpmnElementSummary | null {
  if (!element || !element.id || !element.type) return null
  if (element.labelTarget || element.type === 'label') return null

  // Extrai a eventDefinition para eventos intermediários
  // bpmn.io expõe em element.businessObject.eventDefinitions[0].$type
  const eventDefinitions: any[] = element.businessObject?.eventDefinitions ?? []
  const eventDefinitionType: string | undefined = eventDefinitions[0]?.$type

  const kind = getStudioElementKind(element.type, eventDefinitionType)

  const businessObject = element.businessObject

  return {
    id:   element.id,
    type: element.type,
    name:
      typeof businessObject?.name === 'string' && businessObject.name.trim()
        ? businessObject.name
        : undefined,
    kind,
    isConfigurable: kind !== 'unsupported',
    sourceId:   element.source?.id,
    targetId:   element.target?.id,
    sourceType: element.source?.type,
    targetType: element.target?.type,
  }
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob   = new Blob([content], { type: mimeType })
  const url    = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function BpmnEditor({
  initialXml,
  onChange,
  onSelectionChange,
  onElementsChange,
  onElementDoubleClick,
  renameRef,
  colorRef,
  height = 900,
  disabled = false,
}: BpmnEditorProps) {
  const canvasRef       = useRef<HTMLDivElement | null>(null)
  const fileInputRef    = useRef<HTMLInputElement | null>(null)
  const modelerRef      = useRef<BpmnModelerInstance | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const isMountedRef    = useRef(false)
  const lastImportedXmlRef = useRef('')
  const lastEmittedXmlRef  = useRef('')
  const isImportingRef  = useRef(false)
  const pendingXmlRef   = useRef<string | null>(null)

  const onChangeRef             = useRef(onChange)
  const onSelectionChangeRef    = useRef(onSelectionChange)
  const onElementsChangeRef     = useRef(onElementsChange)
  const onElementDoubleClickRef = useRef(onElementDoubleClick)

  useEffect(() => { onChangeRef.current = onChange },             [onChange])
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange },    [onSelectionChange])
  useEffect(() => { onElementsChangeRef.current = onElementsChange },      [onElementsChange])
  useEffect(() => { onElementDoubleClickRef.current = onElementDoubleClick }, [onElementDoubleClick])

  const [loading, setLoading]                     = useState(true)
  const [error, setError]                         = useState<string | null>(null)
  const [zoomPercent, setZoomPercent]             = useState(100)
  const [selectedElementLabel, setSelectedElementLabel] = useState('Nenhum elemento selecionado')

  const normalizedInitialXml = useMemo(() => normalizeXml(initialXml), [initialXml])

  const updateZoomPercent = useCallback(() => {
    const modeler = modelerRef.current
    if (!modeler) return
    const canvas = modeler.get('canvas') as any
    const currentZoom = canvas?.zoom?.()
    if (typeof currentZoom === 'number' && Number.isFinite(currentZoom)) {
      setZoomPercent(Math.round(currentZoom * 100))
    }
  }, [])

  const focusCanvas = useCallback(() => {
    const modeler = modelerRef.current
    if (!modeler) return
    const canvas = modeler.get('canvas') as any
    if (typeof canvas?.focus === 'function') { canvas.focus(); return }
    canvasRef.current?.focus()
  }, [])

  const fitViewport = useCallback(() => {
    const modeler = modelerRef.current
    if (!modeler) return
    const canvas = modeler.get('canvas') as any
    canvas?.zoom?.('fit-viewport', 'auto')
    updateZoomPercent()
    focusCanvas()
  }, [focusCanvas, updateZoomPercent])

  const openDiagram = useCallback(async (xml?: string) => {
    const modeler = modelerRef.current
    if (!modeler) return
    const container = canvasRef.current
    if (!container || container.clientWidth === 0) return

    if (isImportingRef.current) {
      pendingXmlRef.current = xml ?? ''
      return
    }

    isImportingRef.current = true
    setLoading(true)
    setError(null)

    const content = normalizeXml(xml) || DEFAULT_BPMN_XML

    try {
      await modeler.importXML(content)
      lastImportedXmlRef.current = content

      const elementRegistry = modeler.get('elementRegistry') as any
      const rawElements     = (elementRegistry?.getAll?.() ?? []) as any[]
      const summaries       = rawElements
        .map(toElementSummary)
        .filter((item): item is BpmnElementSummary => item !== null)
        .sort((a, b) => a.id.localeCompare(b.id))

      onElementsChangeRef.current?.(summaries)

      const result      = await modeler.saveXML({ format: true })
      const savedXml    = result.xml ?? ''
      const normalizedSaved = normalizeXml(savedXml)

      if (normalizedSaved !== lastEmittedXmlRef.current) {
        lastEmittedXmlRef.current = normalizedSaved
        onChangeRef.current?.(savedXml)
      }

      fitViewport()
    } catch (importError) {
      console.error('Erro ao importar BPMN XML:', importError)
      setError('Não foi possível carregar o diagrama BPMN.')
    } finally {
      isImportingRef.current = false
      if (isMountedRef.current) setLoading(false)
      if (pendingXmlRef.current !== null) {
        const next = pendingXmlRef.current
        pendingXmlRef.current = null
        void openDiagram(next)
      }
    }
  }, [fitViewport])

  useEffect(() => {
    isMountedRef.current = true

    if (!canvasRef.current || modelerRef.current) {
      return () => { isMountedRef.current = false }
    }

    const modeler = new BpmnModeler({
      container: canvasRef.current,
      additionalModules: [customPaletteModule],
    })

    modelerRef.current = modeler

    const eventBus  = modeler.get('eventBus') as any
    const canvas    = modeler.get('canvas') as any
    const selection = modeler.get('selection') as any

    const handleCommandStackChanged = async () => {
      if (isImportingRef.current) return

      const elementRegistry = modeler.get('elementRegistry') as any
      const rawElements     = (elementRegistry?.getAll?.() ?? []) as any[]
      const summaries       = rawElements
        .map(toElementSummary)
        .filter((item): item is BpmnElementSummary => item !== null)
        .sort((a, b) => a.id.localeCompare(b.id))

      onElementsChangeRef.current?.(summaries)

      const result      = await modeler.saveXML({ format: true })
      const savedXml    = result.xml ?? ''
      const normalizedSaved = normalizeXml(savedXml)

      if (normalizedSaved !== lastEmittedXmlRef.current) {
        lastEmittedXmlRef.current = normalizedSaved
        onChangeRef.current?.(savedXml)
      }

      const currentZoom = canvas?.zoom?.()
      if (typeof currentZoom === 'number' && Number.isFinite(currentZoom)) {
        setZoomPercent(Math.round(currentZoom * 100))
      }
    }

    const handleSelectionChanged = (event: any) => {
      const selected = event?.newSelection?.[0] ?? selection?.get?.()[0] ?? null
      const summary  = selected ? toElementSummary(selected) : null
      setSelectedElementLabel(summary ? (summary.name || summary.id) : 'Nenhum elemento selecionado')
      onSelectionChangeRef.current?.(summary)
    }

    const handleElementDoubleClick = (event: any) => {
      const summary = toElementSummary(event?.element)
      onElementDoubleClickRef.current?.(summary)
    }

    const handleCanvasViewboxChanged = () => {
      const currentZoom = canvas?.zoom?.()
      if (typeof currentZoom === 'number' && Number.isFinite(currentZoom)) {
        setZoomPercent(Math.round(currentZoom * 100))
      }
    }

    eventBus.on('selection.changed',       handleSelectionChanged)
    eventBus.on('commandStack.changed',    handleCommandStackChanged)
    eventBus.on('canvas.viewbox.changed',  handleCanvasViewboxChanged)
    eventBus.on('element.dblclick',        handleElementDoubleClick)

    resizeObserverRef.current = new ResizeObserver(() => {
      try {
        canvas?.resized?.()
        const currentZoom = canvas?.zoom?.()
        if (typeof currentZoom === 'number' && Number.isFinite(currentZoom)) {
          setZoomPercent(Math.round(currentZoom * 100))
        }
      } catch (resizeError) {
        console.error('Erro ao redimensionar canvas BPMN:', resizeError)
      }
    })

    resizeObserverRef.current.observe(canvasRef.current)

    let raf1: number
    let raf2: number

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        void openDiagram(normalizeXml(initialXml))
      })
    })

    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      try {
        eventBus.off('selection.changed',      handleSelectionChanged)
        eventBus.off('commandStack.changed',   handleCommandStackChanged)
        eventBus.off('canvas.viewbox.changed', handleCanvasViewboxChanged)
        eventBus.off('element.dblclick',       handleElementDoubleClick)
      } catch { /* ignore */ }
      try { modeler.destroy() } catch { /* ignore */ }
      modelerRef.current  = null
      isMountedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const nextXml = normalizedInitialXml
    if (!modelerRef.current) return
    if (!nextXml && lastImportedXmlRef.current === DEFAULT_BPMN_XML) return
    if (nextXml === lastImportedXmlRef.current) return
    if (nextXml === lastEmittedXmlRef.current) return
    void openDiagram(nextXml)
  }, [normalizedInitialXml, openDiagram])

  const handleNewDiagram  = async () => { await openDiagram(DEFAULT_BPMN_XML) }
  const handleImportClick = () => { fileInputRef.current?.click() }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { await openDiagram(await file.text()) }
    finally { event.target.value = '' }
  }

  const handleExportXml = async () => {
    const modeler = modelerRef.current
    if (!modeler) return
    const result = await modeler.saveXML({ format: true })
    downloadTextFile(result.xml ?? '', 'workflow.bpmn', 'application/xml;charset=utf-8')
  }

  const handleExportSvg = async () => {
    const modeler = modelerRef.current
    if (!modeler) return
    const result = await modeler.saveSVG()
    downloadTextFile(result.svg ?? '', 'workflow.svg', 'image/svg+xml;charset=utf-8')
  }

  const handleUndo = () => {
    const modeler = modelerRef.current
    if (!modeler) return
    const commandStack = modeler.get('commandStack') as any
    commandStack?.undo?.()
    focusCanvas()
  }

  const handleRedo = () => {
    const modeler = modelerRef.current
    if (!modeler) return
    const commandStack = modeler.get('commandStack') as any
    commandStack?.redo?.()
    focusCanvas()
  }

  const handleZoomIn = () => {
    const modeler = modelerRef.current
    if (!modeler) return
    const canvas  = modeler.get('canvas') as any
    const current = canvas?.zoom?.()
    if (typeof current === 'number') { canvas.zoom(current + 0.1); updateZoomPercent(); focusCanvas() }
  }

  const handleZoomOut = () => {
    const modeler = modelerRef.current
    if (!modeler) return
    const canvas  = modeler.get('canvas') as any
    const current = canvas?.zoom?.()
    if (typeof current === 'number') { canvas.zoom(Math.max(0.2, current - 0.1)); updateZoomPercent(); focusCanvas() }
  }

  const renameElement = useCallback((elementId: string, newName: string) => {
    const modeler = modelerRef.current
    if (!modeler) return
    const elementRegistry = modeler.get('elementRegistry') as any
    const element = elementRegistry?.get?.(elementId)
    if (!element) return
    const modeling = modeler.get('modeling') as any
    modeling.updateLabel(element, newName)
    focusCanvas()
  }, [focusCanvas])

  const setElementColor = useCallback((elementId: string, entry: ColorEntry) => {
    const modeler = modelerRef.current
    if (!modeler) return
    const elementRegistry = modeler.get('elementRegistry') as any
    const element = elementRegistry?.get?.(elementId)
    if (!element) return
    if (element.type === 'bpmn:Process' || element.type === 'label' || element.labelTarget) return
    const modeling = modeler.get('modeling') as any
    modeling.setColor(element, { fill: entry.fill, stroke: entry.stroke })
    focusCanvas()
  }, [focusCanvas])

  useEffect(() => {
    if (renameRef) renameRef.current = renameElement
    if (colorRef)  colorRef.current  = setElementColor
    return () => {
      if (renameRef) renameRef.current = null
      if (colorRef)  colorRef.current  = null
    }
  }, [renameRef, colorRef, renameElement, setElementColor])

  return (
    <Card variant="borderless" style={{ borderRadius: 20 }} title="Modelador BPMN">
      <Space wrap style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />}     onClick={handleNewDiagram}  disabled={disabled}>Novo fluxo</Button>
        <Button icon={<FolderOpenOutlined />} onClick={handleImportClick} disabled={disabled}>Importar XML</Button>
        <Button icon={<DownloadOutlined />}  onClick={handleExportXml}  disabled={disabled}>Exportar BPMN</Button>
        <Button icon={<DownloadOutlined />}  onClick={handleExportSvg}  disabled={disabled}>Exportar SVG</Button>
        <Button icon={<UndoOutlined />}      onClick={handleUndo}       disabled={disabled}>Desfazer</Button>
        <Button icon={<RedoOutlined />}      onClick={handleRedo}       disabled={disabled}>Refazer</Button>
        <Button icon={<ZoomOutOutlined />}   onClick={handleZoomOut}    disabled={disabled} />
        <Button disabled>{zoomPercent}%</Button>
        <Button icon={<ZoomInOutlined />}    onClick={handleZoomIn}     disabled={disabled} />
        <Button icon={<CompressOutlined />}  onClick={fitViewport}      disabled={disabled}>Ajustar</Button>
      </Space>

      <input
        ref={fileInputRef}
        type="file"
        accept=".bpmn,.xml,text/xml,application/xml"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, minHeight: 32, flexWrap: 'wrap' }}>
        <Text type="secondary">{selectedElementLabel}</Text>
      </div>

      {error && (
        <Alert type="error" showIcon message="Falha ao carregar BPMN" description={error} style={{ marginBottom: 12 }} />
      )}

      <div style={{ height: typeof height === 'number' ? `${height}px` : height, border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.72)', zIndex: 2 }}>
            <Spin tip="Carregando editor BPMN..." />
          </div>
        )}
        <div ref={canvasRef} tabIndex={0} onMouseDown={focusCanvas} style={{ width: '100%', height: '100%', outline: 'none' }} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Text type="secondary">Dica: clique para selecionar e dê duplo clique para abrir o modal de configuração.</Text>
      </div>
    </Card>
  )
}