import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Card, Empty, Typography, Space, Button } from 'antd'
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  DragOutlined,
  BranchesOutlined,
} from '@ant-design/icons'
import type {
  Workflow,
  WorkflowStep,
  WorkflowTransition,
  WorkflowEventDefinition,
  WorkflowNodePosition,
  WorkflowLayout,
  WorkflowEdgeControl,
} from '../types'

const { Text } = Typography

type DiagramNodeType = 'start' | 'activity' | 'gateway' | 'end'

type DiagramNode = {
  id: string
  type: DiagramNodeType
  label: string
  x: number
  y: number
  stepId?: string
  orderIndex?: number
  step?: WorkflowStep
  subtitle?: string
  events?: WorkflowEventDefinition[]
}

type DiagramEdge = {
  id: string
  source: string
  target: string
  label?: string
  color?: string
  kind?: 'normal' | 'gateway' | 'return' | 'to-end'
  lane?: number
  transition?: WorkflowTransition
  events?: WorkflowEventDefinition[]
}

type EventClickPayload = {
  scope: 'start' | 'end' | 'step' | 'transition'
  workflow: Workflow
  events: WorkflowEventDefinition[]
  step?: WorkflowStep
  transition?: WorkflowTransition
}

type Props = {
  workflow: Workflow
  height?: number
  editable?: boolean
  onStepClick?: (step: WorkflowStep) => void
  onStartClick?: (workflow: Workflow) => void
  onEndClick?: (workflow: Workflow) => void
  onEventClick?: (payload: EventClickPayload) => void
  onLayoutChange?: (layout: WorkflowLayout) => void
}

const NODE_WIDTH = 170
const NODE_HALF_WIDTH = NODE_WIDTH / 2
const START_RADIUS = 30
const END_RADIUS = 24
const GATEWAY_HALF = 22
const ACTIVITY_BOX_HEIGHT = 96
const SMALL_NODE_BOX = 76
const NODE_GAP = 18
const GRID_STEP = 24

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function truncate(text?: string, max = 18) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function getNodeHalf(nodeType: DiagramNodeType) {
  if (nodeType === 'activity') return NODE_HALF_WIDTH
  if (nodeType === 'gateway') return GATEWAY_HALF
  if (nodeType === 'start') return START_RADIUS
  return END_RADIUS
}

function getNodeBox(node: DiagramNode, x = node.x, y = node.y) {
  if (node.type === 'activity') {
    return {
      left: x - NODE_HALF_WIDTH,
      right: x + NODE_HALF_WIDTH,
      top: y - ACTIVITY_BOX_HEIGHT / 2,
      bottom: y + ACTIVITY_BOX_HEIGHT / 2,
      width: NODE_WIDTH,
      height: ACTIVITY_BOX_HEIGHT,
    }
  }

  const size =
    node.type === 'start'
      ? 76
      : node.type === 'end'
        ? 60
        : SMALL_NODE_BOX

  return {
    left: x - size / 2,
    right: x + size / 2,
    top: y - size / 2,
    bottom: y + size / 2,
    width: size,
    height: size,
  }
}

function boxesOverlap(
  a: ReturnType<typeof getNodeBox>,
  b: ReturnType<typeof getNodeBox>,
) {
  return !(
    a.right + NODE_GAP <= b.left ||
    a.left >= b.right + NODE_GAP ||
    a.bottom + NODE_GAP <= b.top ||
    a.top >= b.bottom + NODE_GAP
  )
}

function isPositionFree(
  node: DiagramNode,
  x: number,
  y: number,
  otherNodes: DiagramNode[],
) {
  const nextBox = getNodeBox(node, x, y)
  return !otherNodes.some((other) => boxesOverlap(nextBox, getNodeBox(other)))
}

function findSafeNodePosition(
  node: DiagramNode,
  desiredX: number,
  desiredY: number,
  otherNodes: DiagramNode[],
  canvasWidth: number,
  canvasHeight: number,
) {
  const currentBox = getNodeBox(node, desiredX, desiredY)
  const marginX = Math.ceil(currentBox.width / 2) + 12
  const marginY = Math.ceil(currentBox.height / 2) + 12

  const baseX = clamp(desiredX, marginX, canvasWidth - marginX)
  const baseY = clamp(desiredY, marginY, canvasHeight - marginY)

  if (isPositionFree(node, baseX, baseY, otherNodes)) {
    return { x: baseX, y: baseY }
  }

  for (let radius = GRID_STEP; radius <= 720; radius += GRID_STEP) {
    for (let dx = -radius; dx <= radius; dx += GRID_STEP) {
      for (let dy = -radius; dy <= radius; dy += GRID_STEP) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue

        const candidateX = clamp(baseX + dx, marginX, canvasWidth - marginX)
        const candidateY = clamp(baseY + dy, marginY, canvasHeight - marginY)

        if (isPositionFree(node, candidateX, candidateY, otherNodes)) {
          return { x: candidateX, y: candidateY }
        }
      }
    }
  }

  return { x: baseX, y: baseY }
}

function sanitizeNodeCollection(
  nodes: DiagramNode[],
  canvasWidth: number,
  canvasHeight: number,
) {
  const placed: DiagramNode[] = []

  return nodes.map((node) => {
    const safe = findSafeNodePosition(
      node,
      node.x,
      node.y,
      placed,
      canvasWidth,
      canvasHeight,
    )

    const next = {
      ...node,
      x: safe.x,
      y: safe.y,
    }

    placed.push(next)
    return next
  })
}

function getOrderedSteps(workflow: Workflow): WorkflowStep[] {
  return [...(workflow.steps ?? [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
  )
}

function resolveTargetStep(
  transition: WorkflowTransition,
  steps: WorkflowStep[],
): WorkflowStep | undefined {
  if (transition.toStepId) {
    const byId = steps.find((step) => step.id === transition.toStepId)
    if (byId) return byId
  }

  if (transition.toStepOrderIndex !== undefined) {
    const byOrder = steps.find(
      (step) => step.orderIndex === transition.toStepOrderIndex,
    )
    if (byOrder) return byOrder
  }

  if (transition.toStepName) {
    const byName = steps.find((step) => step.name === transition.toStepName)
    if (byName) return byName
  }

  return undefined
}

function getEdgeColor(action?: string) {
  const map: Record<string, string> = {
    aprovar: '#52c41a',
    reprovar: '#ff4d4f',
    devolver: '#fa8c16',
    enviar: '#1677ff',
    concluir: '#13c2c2',
    publicar: '#722ed1',
    arquivar: '#64748b',
    cancelar: '#8c8c8c',
    solicitar: '#eb2f96',
    revisar: '#13c2c2',
  }

  return map[(action || '').toLowerCase()] || '#64748b'
}

function getResponsibleLabel(step: WorkflowStep): string | null {
  const s = step as WorkflowStep & {
    responsibles?: Array<
      | string
      | {
          id?: string
          name?: string
          fullName?: string
          roleName?: string
          positionName?: string
        }
    >
    assignees?: Array<
      | string
      | {
          id?: string
          name?: string
          fullName?: string
          roleName?: string
        }
    >
    users?: Array<
      | string
      | {
          id?: string
          name?: string
          fullName?: string
        }
    >
  }

  const list = s.responsibles ?? s.assignees ?? s.users ?? []
  if (!list.length) return null

  const first = list[0]
  if (typeof first === 'string') return first

  return (
    first.name ||
    first.fullName ||
    (first as { roleName?: string }).roleName ||
    (first as { positionName?: string }).positionName ||
    null
  )
}

function getActiveEvents(events?: WorkflowEventDefinition[]) {
  return (events ?? []).filter((event) => event.active !== false)
}

function getEventColor(type?: WorkflowEventDefinition['type']) {
  switch (type) {
    case 'notification':
      return '#1677ff'
    case 'flow-change':
      return '#722ed1'
    case 'extra-check':
      return '#fa8c16'
    case 'webhook':
      return '#13c2c2'
    case 'integration':
      return '#52c41a'
    case 'task':
      return '#eb2f96'
    default:
      return '#64748b'
  }
}

function getEventShortLabel(type?: WorkflowEventDefinition['type']) {
  switch (type) {
    case 'notification':
      return 'NOT'
    case 'flow-change':
      return 'FLX'
    case 'extra-check':
      return 'CHK'
    case 'webhook':
      return 'WEB'
    case 'integration':
      return 'INT'
    case 'task':
      return 'TSK'
    default:
      return 'EV'
  }
}

function getEventSummary(events?: WorkflowEventDefinition[]) {
  const list = getActiveEvents(events)
  if (!list.length) return null

  const distinctTypes = Array.from(
    new Set(list.map((item) => getEventShortLabel(item.type))),
  )

  const typesPreview = distinctTypes.slice(0, 3).join(' • ')
  return `${list.length} evento${list.length > 1 ? 's' : ''}${
    typesPreview ? ` · ${typesPreview}` : ''
  }`
}

function buildDiagram(workflow: Workflow) {
  const steps = getOrderedSteps(workflow)

  if (!steps.length) {
    return {
      nodes: [] as DiagramNode[],
      edges: [] as DiagramEdge[],
      width: 1400,
      height: 820,
      topReturnY: 110,
    }
  }

  const nodes: DiagramNode[] = []
  const edges: DiagramEdge[] = []

  const START_X = 110
  const STEP_X_1 = 260
  const STEP_X_2 = 500
  const GATEWAY_X = 700
  const BRANCH_X = 980
  const END_X = 1280

  const BASE_Y = 320
  const TOP_RETURN_Y = 110
  const BRANCH_GAP_Y = 180

  const startNodeId = 'start-node'
  const endNodeId = 'end-node'

  const stepNodeMap = new Map<string, DiagramNode>()

  const startEvents = getActiveEvents(workflow.startConfig?.events)
  const endEvents = getActiveEvents(workflow.endConfig?.events)

  const initialStep =
    steps.find((step) => step.id === workflow.startConfig?.initialStepId) ??
    steps.find((step) => step.isInitial) ??
    steps[0]

  const gatewaySourceStep = steps.find(
    (step) => (step.transitions?.length ?? 0) > 1,
  )

  const gatewayResolvedTargets = gatewaySourceStep
    ? (gatewaySourceStep.transitions ?? [])
        .map((transition) => resolveTargetStep(transition, steps))
        .filter(Boolean) as WorkflowStep[]
    : []

  const gatewayForwardTargets = gatewaySourceStep
    ? gatewayResolvedTargets.filter(
        (target) =>
          (target.orderIndex ?? 0) >= (gatewaySourceStep.orderIndex ?? 0),
      )
    : []

  const gatewayForwardTargetKeys = new Set(
    gatewayForwardTargets.map((step) => step.id || String(step.orderIndex)),
  )

  const normalMainSteps = steps.filter((step) => {
    const key = step.id || String(step.orderIndex)
    if (step.isFinal && gatewayForwardTargetKeys.has(key)) return false
    return true
  })

  let mainIndex = 0

  nodes.push({
    id: startNodeId,
    type: 'start',
    label: workflow.startConfig?.name || 'Início',
    subtitle: workflow.startConfig?.description,
    x: START_X,
    y: BASE_Y,
    events: startEvents,
  })

  normalMainSteps.forEach((step) => {
    let x = STEP_X_1 + mainIndex * 240

    if (gatewaySourceStep && step.id === gatewaySourceStep.id) {
      x = STEP_X_2
    }

    const node: DiagramNode = {
      id: `step-${step.id || step.orderIndex}`,
      type: 'activity',
      label: step.name,
      x,
      y: BASE_Y,
      stepId: step.id,
      orderIndex: step.orderIndex,
      step,
      events: getActiveEvents(step.events),
    }

    stepNodeMap.set(step.id || String(step.orderIndex), node)
    nodes.push(node)

    if (!gatewaySourceStep || step.id !== gatewaySourceStep.id) {
      mainIndex += 1
    }
  })

  if (gatewaySourceStep) {
    gatewayForwardTargets.forEach((step, idx) => {
      const total = gatewayForwardTargets.length
      const startY =
        total === 1 ? BASE_Y : BASE_Y - ((total - 1) * BRANCH_GAP_Y) / 2

      const node: DiagramNode = {
        id: `step-${step.id || step.orderIndex}`,
        type: 'activity',
        label: step.name,
        x: BRANCH_X,
        y: startY + idx * BRANCH_GAP_Y,
        stepId: step.id,
        orderIndex: step.orderIndex,
        step,
        events: getActiveEvents(step.events),
      }

      stepNodeMap.set(step.id || String(step.orderIndex), node)
      nodes.push(node)
    })
  }

  nodes.push({
    id: endNodeId,
    type: 'end',
    label: workflow.endConfig?.name || 'Fim',
    subtitle: workflow.endConfig?.description,
    x: END_X,
    y: BASE_Y,
    events: endEvents,
  })

  const initialNode = stepNodeMap.get(
    initialStep.id || String(initialStep.orderIndex),
  )

  if (initialNode) {
    edges.push({
      id: 'edge-start-initial',
      source: startNodeId,
      target: initialNode.id,
      color: '#1677ff',
      kind: 'normal',
      lane: 0,
    })
  }

  steps.forEach((step) => {
    const sourceNode = stepNodeMap.get(step.id || String(step.orderIndex))
    if (!sourceNode) return

    const transitions = step.transitions ?? []

    if (step.isFinal) {
      edges.push({
        id: `edge-${sourceNode.id}-end`,
        source: sourceNode.id,
        target: endNodeId,
        color: '#52c41a',
        kind: 'to-end',
        lane: 0,
      })
      return
    }

    if (transitions.length === 0) {
      edges.push({
        id: `edge-${sourceNode.id}-end`,
        source: sourceNode.id,
        target: endNodeId,
        color: '#94a3b8',
        kind: 'to-end',
        lane: 0,
      })
      return
    }

    if (transitions.length === 1) {
      const transition = transitions[0]
      const targetStep = resolveTargetStep(transition, steps)
      if (!targetStep) return

      const targetNode = stepNodeMap.get(
        targetStep.id || String(targetStep.orderIndex),
      )
      if (!targetNode) return

      const sourceOrderIndex = step.orderIndex ?? 0
      const targetOrderIndex = targetStep.orderIndex ?? 0
      const isReturn = targetOrderIndex < sourceOrderIndex

      edges.push({
        id: `edge-${sourceNode.id}-${targetNode.id}-${transition.triggerAction || 'flow'}`,
        source: sourceNode.id,
        target: targetNode.id,
        label: transition.triggerAction,
        color: getEdgeColor(transition.triggerAction),
        kind: isReturn ? 'return' : 'normal',
        lane: 0,
        transition,
        events: getActiveEvents(transition.events),
      })
      return
    }

    const gatewayId = `gateway-${step.id || step.orderIndex}`

    nodes.push({
      id: gatewayId,
      type: 'gateway',
      label: '',
      x: GATEWAY_X,
      y: sourceNode.y,
      stepId: step.id,
      orderIndex: step.orderIndex,
    })

    edges.push({
      id: `edge-${sourceNode.id}-${gatewayId}`,
      source: sourceNode.id,
      target: gatewayId,
      color: '#1677ff',
      kind: 'gateway',
      lane: 0,
    })

    transitions.forEach((transition, index) => {
      const targetStep = resolveTargetStep(transition, steps)
      if (!targetStep) return

      const targetNode = stepNodeMap.get(
        targetStep.id || String(targetStep.orderIndex),
      )
      if (!targetNode) return

      const sourceOrderIndex = step.orderIndex ?? 0
      const targetOrderIndex = targetStep.orderIndex ?? 0
      const isReturn = targetOrderIndex < sourceOrderIndex

      edges.push({
        id: `edge-${gatewayId}-${targetNode.id}-${index}`,
        source: gatewayId,
        target: targetNode.id,
        label: transition.triggerAction,
        color: getEdgeColor(transition.triggerAction),
        kind: isReturn ? 'return' : 'normal',
        lane: index,
        transition,
        events: getActiveEvents(transition.events),
      })
    })
  })

  return {
    nodes,
    edges,
    width: END_X + 220,
    height: 860,
    topReturnY: TOP_RETURN_Y,
  }
}

function applyManualPositions(
  nodes: DiagramNode[],
  nodePositions?: Record<string, WorkflowNodePosition>,
) {
  if (!nodePositions) return nodes

  return nodes.map((node) => {
    const custom = nodePositions[node.id]
    if (!custom) return node

    return {
      ...node,
      x: custom.x,
      y: custom.y,
    }
  })
}

function renderNodeEventBadge(
  x: number,
  y: number,
  events: WorkflowEventDefinition[],
  onClick?: () => void,
) {
  if (!events.length) return null

  const summary = getEventSummary(events) || `${events.length} evento(s)`
  const color = getEventColor(events[0]?.type)
  const width = Math.max(82, Math.min(132, summary.length * 6.1 + 18))

  return (
    <g
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <rect
        x={x - width / 2}
        y={y}
        width={width}
        height={18}
        rx={9}
        fill="#ffffff"
        stroke={color}
        strokeWidth={1.5}
      />
      <circle cx={x - width / 2 + 10} cy={y + 9} r={3.5} fill={color} />
      <text
        x={x - width / 2 + 18}
        y={y + 12}
        fontSize="10"
        fill="#334155"
        fontWeight="500"
      >
        {truncate(summary, 18)}
      </text>
    </g>
  )
}

function renderEdgeAnnotations(
  edge: DiagramEdge,
  workflow: Workflow,
  centerX: number,
  topY: number,
  maxWidth: number,
  onEventClick?: (payload: EventClickPayload) => void,
) {
  const events = getActiveEvents(edge.events)
  const hasLabel = !!edge.label
  const hasEvents = events.length > 0

  if (!hasLabel && !hasEvents) return null

  const labelWidth = hasLabel
    ? Math.max(56, Math.min(maxWidth, (edge.label?.length ?? 0) * 7.4 + 20))
    : 0

  const eventSummary = hasEvents
    ? `${events.length} evento${events.length > 1 ? 's' : ''}`
    : ''

  const eventWidth = hasEvents
    ? Math.max(74, Math.min(maxWidth, eventSummary.length * 6.8 + 20))
    : 0

  return (
    <g>
      {hasLabel && (
        <>
          <rect
            x={centerX - labelWidth / 2}
            y={topY}
            width={labelWidth}
            height={20}
            rx={8}
            fill="#ffffff"
            stroke="#e5e7eb"
          />
          <text
            x={centerX}
            y={topY + 13}
            fontSize="12"
            fill={edge.color || '#334155'}
            textAnchor="middle"
          >
            {edge.label}
          </text>
        </>
      )}

      {hasEvents && (
        <g
          style={{ cursor: onEventClick ? 'pointer' : 'default' }}
          onClick={(event) => {
            event.stopPropagation()
            if (!edge.transition) return

            onEventClick?.({
              scope: 'transition',
              workflow,
              transition: edge.transition,
              events,
            })
          }}
        >
          <rect
            x={centerX - eventWidth / 2}
            y={topY + (hasLabel ? 24 : 0)}
            width={eventWidth}
            height={18}
            rx={9}
            fill="#ffffff"
            stroke={getEventColor(events[0]?.type)}
            strokeWidth={1.5}
          />
          <circle
            cx={centerX - eventWidth / 2 + 10}
            cy={topY + (hasLabel ? 24 : 0) + 9}
            r={3.5}
            fill={getEventColor(events[0]?.type)}
          />
          <text
            x={centerX - eventWidth / 2 + 18}
            y={topY + (hasLabel ? 24 : 0) + 12}
            fontSize="10"
            fill="#334155"
            fontWeight="500"
          >
            {eventSummary}
          </text>
        </g>
      )}
    </g>
  )
}

function getForwardRoute(
  edge: DiagramEdge,
  nodeMap: Map<string, DiagramNode>,
  control?: WorkflowEdgeControl,
) {
  const source = nodeMap.get(edge.source)
  const target = nodeMap.get(edge.target)
  if (!source || !target) return null

  const sourceHalf = getNodeHalf(source.type)
  const targetHalf = getNodeHalf(target.type)

  const startX = source.x + sourceHalf
  const startY = source.y
  const endX = target.x - targetHalf
  const endY = target.y

  const defaultBendX = startX + Math.max(45, (endX - startX) / 2)
  const defaultRouteY = endY

  const bendX = control?.bendX ?? defaultBendX
  const routeY = control?.routeY ?? defaultRouteY

  const path = [
    `M ${startX} ${startY}`,
    `L ${bendX} ${startY}`,
    `L ${bendX} ${routeY}`,
    `L ${endX} ${routeY}`,
    `L ${endX} ${endY}`,
  ].join(' ')

  const availableWidth = Math.max(80, Math.abs(endX - startX) - 24)

  const midX = clamp(
    (bendX + endX) / 2,
    Math.min(startX, endX) + 40,
    Math.max(startX, endX) - 40,
  )

  const hasEvents = (edge.events?.length ?? 0) > 0
  const annotationY =
    Math.min(startY, endY, routeY) -
    (hasEvents && edge.label ? 58 : hasEvents ? 36 : 28)

  return {
    endX,
    endY,
    bendX,
    routeY,
    path,
    midX,
    annotationY,
    availableWidth,
    handleX: bendX,
    handleY: routeY,
  }
}

function getReturnRoute(
  edge: DiagramEdge,
  nodeMap: Map<string, DiagramNode>,
  topReturnY: number,
  control?: WorkflowEdgeControl,
) {
  const source = nodeMap.get(edge.source)
  const target = nodeMap.get(edge.target)
  if (!source || !target) return null

  const sourceHalf = getNodeHalf(source.type)
  const targetHalf = getNodeHalf(target.type)

  const startX = source.x + sourceHalf
  const startY = source.y
  const endX = target.x - targetHalf
  const endY = target.y

  const lane = edge.lane ?? 0
  const defaultRouteY = topReturnY - lane * 42
  const routeY = control?.routeY ?? defaultRouteY

  const leftX = startX + 40
  const rightX = endX - 40

  const path = [
    `M ${startX} ${startY}`,
    `L ${leftX} ${startY}`,
    `L ${leftX} ${routeY}`,
    `L ${rightX} ${routeY}`,
    `L ${rightX} ${endY}`,
    `L ${endX} ${endY}`,
  ].join(' ')

  const availableWidth = Math.max(80, Math.abs(endX - startX) - 24)
  const midX = clamp(
    (leftX + rightX) / 2,
    Math.min(startX, endX) + 40,
    Math.max(startX, endX) - 40,
  )

  const hasEvents = (edge.events?.length ?? 0) > 0
  const annotationY =
    routeY - (hasEvents && edge.label ? 58 : hasEvents ? 36 : 28)

  return {
    endX,
    endY,
    routeY,
    path,
    midX,
    annotationY,
    availableWidth,
    handleX: midX,
    handleY: routeY,
  }
}

function renderNode(
  node: DiagramNode,
  workflow: Workflow,
  editable: boolean,
  draggingNodeId: string | null,
  onNodePointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    node: DiagramNode,
  ) => void,
  shouldIgnoreNodeClick: (nodeId: string) => boolean,
  onStepClick?: (step: WorkflowStep) => void,
  onStartClick?: (workflow: Workflow) => void,
  onEndClick?: (workflow: Workflow) => void,
  onEventClick?: (payload: EventClickPayload) => void,
  hoveredNodeId?: string | null,
  setHoveredNodeId?: (id: string | null) => void,
) {
  const isHovered = hoveredNodeId === node.id
  const isDragging = draggingNodeId === node.id
  const isActivityClickable = node.type === 'activity' && !!node.step
  const isStartClickable = node.type === 'start' && !!onStartClick
  const isEndClickable = node.type === 'end' && !!onEndClick
  const isClickable = isActivityClickable || isStartClickable || isEndClickable
  const events = getActiveEvents(node.events)

  const cursor = editable
    ? isDragging
      ? 'grabbing'
      : 'grab'
    : isClickable
      ? 'pointer'
      : 'default'

  if (node.type === 'start') {
    return (
      <g
        key={node.id}
        style={{ cursor }}
        onPointerDown={(event) => onNodePointerDown(event, node)}
        onClick={() => {
          if (shouldIgnoreNodeClick(node.id)) return
          onStartClick?.(workflow)
        }}
        onMouseEnter={() => setHoveredNodeId?.(node.id)}
        onMouseLeave={() => setHoveredNodeId?.(null)}
      >
        {isHovered && (
          <circle
            cx={node.x}
            cy={node.y}
            r={40}
            fill="rgba(22,119,255,0.10)"
            stroke="none"
          />
        )}

        <circle
          cx={node.x}
          cy={node.y}
          r={30}
          fill={isHovered ? '#dbeafe' : '#e6f4ff'}
          stroke="#1677ff"
          strokeWidth={3}
        />
        <circle
          cx={node.x}
          cy={node.y}
          r={22}
          fill="none"
          stroke="#1677ff"
          strokeWidth={1.5}
          opacity={0.55}
        />

        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
          fontSize="12"
          fill="#0f172a"
          fontWeight="600"
          style={{ pointerEvents: 'none' }}
        >
          {truncate(node.label, 10)}
        </text>

        <text
          x={node.x}
          y={node.y + 46}
          textAnchor="middle"
          fontSize="11"
          fill="#64748b"
          style={{ pointerEvents: 'none' }}
        >
          {editable ? 'Clique ou arraste' : 'Clique para configurar'}
        </text>

        {events.length > 0 &&
          renderNodeEventBadge(node.x, node.y - 58, events, () => {
            onEventClick?.({
              scope: 'start',
              workflow,
              events,
            })
          })}
      </g>
    )
  }

  if (node.type === 'gateway') {
    const size = 22
    const points = [
      `${node.x},${node.y - size}`,
      `${node.x + size},${node.y}`,
      `${node.x},${node.y + size}`,
      `${node.x - size},${node.y}`,
    ].join(' ')

    return (
      <g
        key={node.id}
        style={{ cursor }}
        onPointerDown={(event) => onNodePointerDown(event, node)}
        onMouseEnter={() => setHoveredNodeId?.(node.id)}
        onMouseLeave={() => setHoveredNodeId?.(null)}
      >
        <polygon
          points={points}
          fill="#fff7e6"
          stroke="#fa8c16"
          strokeWidth={3}
        />
        <text
          x={node.x}
          y={node.y + 4}
          textAnchor="middle"
          fontSize="13"
          fill="#fa8c16"
          style={{ pointerEvents: 'none' }}
        >
          ×
        </text>
      </g>
    )
  }

  if (node.type === 'end') {
    return (
      <g
        key={node.id}
        style={{ cursor }}
        onPointerDown={(event) => onNodePointerDown(event, node)}
        onClick={() => {
          if (shouldIgnoreNodeClick(node.id)) return
          onEndClick?.(workflow)
        }}
        onMouseEnter={() => setHoveredNodeId?.(node.id)}
        onMouseLeave={() => setHoveredNodeId?.(null)}
      >
        {isHovered && (
          <circle
            cx={node.x}
            cy={node.y}
            r={34}
            fill="rgba(82,196,26,0.10)"
            stroke="none"
          />
        )}

        <circle
          cx={node.x}
          cy={node.y}
          r={24}
          fill="#f6ffed"
          stroke="#52c41a"
          strokeWidth={4}
        />
        <circle
          cx={node.x}
          cy={node.y}
          r={18}
          fill="none"
          stroke="#52c41a"
          strokeWidth={2}
        />
        <text
          x={node.x}
          y={node.y + 40}
          textAnchor="middle"
          fontSize="12"
          fill="#0f172a"
          style={{ pointerEvents: 'none' }}
        >
          {node.label}
        </text>

        {events.length > 0 &&
          renderNodeEventBadge(node.x, node.y - 54, events, () => {
            onEventClick?.({
              scope: 'end',
              workflow,
              events,
            })
          })}
      </g>
    )
  }

  const step = node.step
  const slaHours = step?.slaHours
  const responsible = step ? getResponsibleLabel(step) : null
  const isInitial = step?.isInitial
  const isFinal = step?.isFinal

  const borderColor = isInitial
    ? '#1677ff'
    : isFinal
      ? '#722ed1'
      : isHovered
        ? '#0ea5e9'
        : '#d9d9d9'

  const fillColor = isHovered ? '#f0f9ff' : '#ffffff'
  const hasInfoRow = !!(slaHours || responsible)
  const hasEventRow = events.length > 0

  const boxHeight = hasEventRow ? 96 : hasInfoRow ? 76 : 60
  const boxY = node.y - boxHeight / 2
  const titleY = hasInfoRow || hasEventRow ? node.y - 18 : node.y + 4

  return (
    <g
      key={node.id}
      style={{ cursor }}
      onPointerDown={(event) => onNodePointerDown(event, node)}
      onClick={() => {
        if (shouldIgnoreNodeClick(node.id)) return
        if (isActivityClickable && node.step && onStepClick) {
          onStepClick(node.step)
        }
      }}
      onMouseEnter={() => setHoveredNodeId?.(node.id)}
      onMouseLeave={() => setHoveredNodeId?.(null)}
    >
      {isHovered && (
        <rect
          x={node.x - 87}
          y={boxY - 2}
          width={174}
          height={boxHeight + 4}
          rx={16}
          fill="rgba(14,165,233,0.12)"
          stroke="none"
        />
      )}

      <rect
        x={node.x - 85}
        y={boxY}
        width={170}
        height={boxHeight}
        rx={14}
        ry={14}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={2}
      />

      {(isInitial || isFinal) && (
        <rect
          x={node.x - 85}
          y={boxY}
          width={170}
          height={18}
          rx={14}
          fill={isInitial ? '#1677ff' : '#722ed1'}
          opacity={0.92}
        />
      )}

      {isInitial && (
        <text
          x={node.x}
          y={boxY + 12}
          textAnchor="middle"
          fontSize="9"
          fill="#ffffff"
          fontWeight="600"
          style={{ pointerEvents: 'none' }}
        >
          INICIAL
        </text>
      )}

      {isFinal && (
        <text
          x={node.x}
          y={boxY + 12}
          textAnchor="middle"
          fontSize="9"
          fill="#ffffff"
          fontWeight="600"
          style={{ pointerEvents: 'none' }}
        >
          FINAL
        </text>
      )}

      <text
        x={node.x}
        y={titleY}
        textAnchor="middle"
        fontSize="13"
        fontWeight="500"
        fill="#0f172a"
        style={{ pointerEvents: 'none' }}
      >
        {truncate(node.label, 22)}
      </text>

      {(hasInfoRow || hasEventRow) && (
        <line
          x1={node.x - 75}
          y1={node.y - 4}
          x2={node.x + 75}
          y2={node.y - 4}
          stroke="#f0f0f0"
          strokeWidth={1}
        />
      )}

      {hasInfoRow && (
        <>
          {slaHours && (
            <text
              x={node.x - 70}
              y={node.y + 12}
              fontSize="10"
              fill="#fa8c16"
              fontWeight="500"
              style={{ pointerEvents: 'none' }}
            >
              SLA: {slaHours}h
            </text>
          )}

          {responsible && (
            <text
              x={slaHours ? node.x + 8 : node.x - 70}
              y={node.y + 12}
              fontSize="10"
              fill="#6b7280"
              style={{ pointerEvents: 'none' }}
            >
              Resp: {truncate(responsible, 12)}
            </text>
          )}
        </>
      )}

      {hasEventRow && (
        <>
          <line
            x1={node.x - 75}
            y1={node.y + 20}
            x2={node.x + 75}
            y2={node.y + 20}
            stroke="#f0f0f0"
            strokeWidth={1}
          />

          {renderNodeEventBadge(node.x, node.y + 28, events, () => {
            if (!node.step) return

            onEventClick?.({
              scope: 'step',
              workflow,
              step: node.step,
              events,
            })
          })}
        </>
      )}
    </g>
  )
}

export function WorkflowDiagram({
  workflow,
  height = 760,
  editable = false,
  onStepClick,
  onStartClick,
  onEndClick,
  onEventClick,
  onLayoutChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const renderedNodesRef = useRef<DiagramNode[]>([])

  const [scale, setScale] = useState(1)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [draggingEdgeId, setDraggingEdgeId] = useState<string | null>(null)

  const [nodePositions, setNodePositions] = useState<
    Record<string, WorkflowNodePosition>
  >(workflow.layout?.nodePositions ?? {})

  const [edgeControls, setEdgeControls] = useState<
    Record<string, WorkflowEdgeControl>
  >(workflow.layout?.edgeControls ?? {})

  const latestLayoutRef = useRef<WorkflowLayout>({
    nodePositions: workflow.layout?.nodePositions ?? {},
    edgeControls: workflow.layout?.edgeControls ?? {},
  })

  const dragRef = useRef<
    | {
        kind: 'node'
        nodeId: string
        pointerId: number
        startPointerX: number
        startPointerY: number
        startNodeX: number
        startNodeY: number
        moved: boolean
      }
    | {
        kind: 'edge'
        edgeId: string
        pointerId: number
        mode: 'forward' | 'return'
        startPointerX: number
        startPointerY: number
        startBendX?: number
        startRouteY: number
        moved: boolean
      }
    | null
  >(null)

  const suppressClickRef = useRef<string | null>(null)

  const externalLayoutKey = useMemo(
    () => JSON.stringify(workflow.layout ?? {}),
    [workflow.layout],
  )

  useEffect(() => {
    if (dragRef.current) return

    const nextNodePositions = workflow.layout?.nodePositions ?? {}
    const nextEdgeControls = workflow.layout?.edgeControls ?? {}

    setNodePositions(nextNodePositions)
    setEdgeControls(nextEdgeControls)
    latestLayoutRef.current = {
      nodePositions: nextNodePositions,
      edgeControls: nextEdgeControls,
    }
  }, [workflow.id, externalLayoutKey])

  const baseDiagram = useMemo(() => buildDiagram(workflow), [workflow])

  const nodes = useMemo(() => {
    const withManual = applyManualPositions(baseDiagram.nodes, nodePositions)
    return sanitizeNodeCollection(
      withManual,
      baseDiagram.width,
      Math.max(height, baseDiagram.height),
    )
  }, [baseDiagram, nodePositions, height])

  useEffect(() => {
    renderedNodesRef.current = nodes
  }, [nodes])

  const edges = baseDiagram.edges
  const width = baseDiagram.width
  const diagramHeight = baseDiagram.height
  const topReturnY = baseDiagram.topReturnY
  const svgHeight = Math.max(height, diagramHeight)

  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  )

  const clientToSvgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return null

      const rect = svg.getBoundingClientRect()

      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      }
    },
    [scale],
  )

  const emitLayoutChange = useCallback(
    (nextLayout: WorkflowLayout) => {
      latestLayoutRef.current = nextLayout
      onLayoutChange?.(nextLayout)
    },
    [onLayoutChange],
  )

  const shouldIgnoreNodeClick = useCallback((nodeId: string) => {
    if (suppressClickRef.current !== nodeId) return false
    suppressClickRef.current = null
    return true
  }, [])

  const handleNodePointerDown = useCallback(
    (event: ReactPointerEvent<SVGGElement>, node: DiagramNode) => {
      if (!editable) return
      if (event.button !== 0) return

      const point = clientToSvgPoint(event.clientX, event.clientY)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        //
      }

      setDraggingNodeId(node.id)

      dragRef.current = {
        kind: 'node',
        nodeId: node.id,
        pointerId: event.pointerId,
        startPointerX: point.x,
        startPointerY: point.y,
        startNodeX: node.x,
        startNodeY: node.y,
        moved: false,
      }
    },
    [editable, clientToSvgPoint],
  )

  const startForwardEdgeDrag = useCallback(
    (
      event: ReactPointerEvent<SVGPathElement | SVGCircleElement>,
      edgeId: string,
      bendX: number,
      routeY: number,
    ) => {
      if (!editable) return
      if (event.button !== 0) return

      const point = clientToSvgPoint(event.clientX, event.clientY)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        //
      }

      setDraggingEdgeId(edgeId)

      dragRef.current = {
        kind: 'edge',
        edgeId,
        pointerId: event.pointerId,
        mode: 'forward',
        startPointerX: point.x,
        startPointerY: point.y,
        startBendX: bendX,
        startRouteY: routeY,
        moved: false,
      }
    },
    [editable, clientToSvgPoint],
  )

  const startReturnEdgeDrag = useCallback(
    (
      event: ReactPointerEvent<SVGPathElement | SVGCircleElement>,
      edgeId: string,
      routeY: number,
    ) => {
      if (!editable) return
      if (event.button !== 0) return

      const point = clientToSvgPoint(event.clientX, event.clientY)
      if (!point) return

      event.preventDefault()
      event.stopPropagation()

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        //
      }

      setDraggingEdgeId(edgeId)

      dragRef.current = {
        kind: 'edge',
        edgeId,
        pointerId: event.pointerId,
        mode: 'return',
        startPointerX: point.x,
        startPointerY: point.y,
        startRouteY: routeY,
        moved: false,
      }
    },
    [editable, clientToSvgPoint],
  )

  useEffect(() => {
    if (!dragRef.current) return

    function handlePointerMove(event: PointerEvent) {
      const currentDrag = dragRef.current
      if (!currentDrag) return
      if (event.pointerId !== currentDrag.pointerId) return

      const point = clientToSvgPoint(event.clientX, event.clientY)
      if (!point) return

      const dx = point.x - currentDrag.startPointerX
      const dy = point.y - currentDrag.startPointerY

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        currentDrag.moved = true
      }

      if (currentDrag.kind === 'node') {
        const currentNode = renderedNodesRef.current.find(
          (item) => item.id === currentDrag.nodeId,
        )
        if (!currentNode) return

        const desiredX = clamp(currentDrag.startNodeX + dx, 40, width - 40)
        const desiredY = clamp(currentDrag.startNodeY + dy, 50, svgHeight - 50)

        const otherNodes = renderedNodesRef.current.filter(
          (item) => item.id !== currentDrag.nodeId,
        )

        const safePosition = findSafeNodePosition(
          currentNode,
          desiredX,
          desiredY,
          otherNodes,
          width,
          svgHeight,
        )

        setNodePositions((prev) => {
          const next = {
            ...prev,
            [currentDrag.nodeId]: {
              x: safePosition.x,
              y: safePosition.y,
            },
          }

          latestLayoutRef.current = {
            nodePositions: next,
            edgeControls,
          }

          return next
        })

        return
      }

      if (currentDrag.kind === 'edge') {
        if (currentDrag.mode === 'forward') {
          const nextBendX = clamp(
            (currentDrag.startBendX ?? 0) + dx,
            40,
            width - 40,
          )
          const nextRouteY = clamp(currentDrag.startRouteY + dy, 40, svgHeight - 40)

          setEdgeControls((prev) => {
            const next = {
              ...prev,
              [currentDrag.edgeId]: {
                ...(prev[currentDrag.edgeId] ?? {}),
                bendX: nextBendX,
                routeY: nextRouteY,
              },
            }

            latestLayoutRef.current = {
              nodePositions,
              edgeControls: next,
            }

            return next
          })

          return
        }

        const nextRouteY = clamp(currentDrag.startRouteY + dy, 40, svgHeight - 40)

        setEdgeControls((prev) => {
          const next = {
            ...prev,
            [currentDrag.edgeId]: {
              ...(prev[currentDrag.edgeId] ?? {}),
              routeY: nextRouteY,
            },
          }

          latestLayoutRef.current = {
            nodePositions,
            edgeControls: next,
          }

          return next
        })
      }
    }

    function handlePointerUp(event: PointerEvent) {
      const currentDrag = dragRef.current
      if (!currentDrag) return
      if (event.pointerId !== currentDrag.pointerId) return

      if (currentDrag.moved) {
        emitLayoutChange(latestLayoutRef.current)

        if (currentDrag.kind === 'node') {
          suppressClickRef.current = currentDrag.nodeId
        }
      }

      dragRef.current = null
      setDraggingNodeId(null)
      setDraggingEdgeId(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [clientToSvgPoint, edgeControls, emitLayoutChange, nodePositions, svgHeight, width])

  const zoomIn = () =>
    setScale((prev) => Math.min(2, Number((prev + 0.1).toFixed(2))))
  const zoomOut = () =>
    setScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))
  const resetZoom = () => setScale(1)

  const resetLayout = () => {
    const nextLayout: WorkflowLayout = {
      nodePositions: {},
      edgeControls: {},
    }

    setNodePositions({})
    setEdgeControls({})
    emitLayoutChange(nextLayout)
  }

  if (!nodes.length) {
    return <Empty description="Nenhum fluxo para exibir" />
  }

  const renderForwardEdge = (edge: DiagramEdge) => {
    const route = getForwardRoute(edge, nodeMap, edgeControls[edge.id])
    if (!route) return null

    const isDragging = draggingEdgeId === edge.id

    return (
      <g key={edge.id}>
        {editable && (
          <path
            d={route.path}
            fill="none"
            stroke="transparent"
            strokeWidth={22}
            style={{ cursor: 'grab' }}
            onPointerDown={(event) =>
              startForwardEdgeDrag(event, edge.id, route.bendX, route.routeY)
            }
          />
        )}

        <path
          d={route.path}
          fill="none"
          stroke={edge.color || '#64748b'}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <polygon
          points={`${route.endX},${route.endY} ${route.endX - 10},${route.endY - 6} ${route.endX - 10},${route.endY + 6}`}
          fill={edge.color || '#64748b'}
        />

        {editable && (
          <>
            <circle
              cx={route.handleX}
              cy={route.handleY}
              r={8}
              fill={isDragging ? '#1677ff' : '#ffffff'}
              stroke="#1677ff"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onPointerDown={(event) =>
                startForwardEdgeDrag(event, edge.id, route.bendX, route.routeY)
              }
            />
            <text
              x={route.handleX}
              y={route.handleY + 3}
              textAnchor="middle"
              fontSize="8"
              fill={isDragging ? '#ffffff' : '#1677ff'}
              style={{ pointerEvents: 'none' }}
            >
              ↕
            </text>
          </>
        )}

        {renderEdgeAnnotations(
          edge,
          workflow,
          route.midX,
          route.annotationY,
          route.availableWidth,
          onEventClick,
        )}
      </g>
    )
  }

  const renderReturnEdge = (edge: DiagramEdge) => {
    const route = getReturnRoute(
      edge,
      nodeMap,
      topReturnY,
      edgeControls[edge.id],
    )
    if (!route) return null

    const isDragging = draggingEdgeId === edge.id

    return (
      <g key={edge.id}>
        {editable && (
          <path
            d={route.path}
            fill="none"
            stroke="transparent"
            strokeWidth={22}
            style={{ cursor: 'grab' }}
            onPointerDown={(event) =>
              startReturnEdgeDrag(event, edge.id, route.routeY)
            }
          />
        )}

        <path
          d={route.path}
          fill="none"
          stroke={edge.color || '#64748b'}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <polygon
          points={`${route.endX},${route.endY} ${route.endX - 10},${route.endY - 6} ${route.endX - 10},${route.endY + 6}`}
          fill={edge.color || '#64748b'}
        />

        {editable && (
          <>
            <circle
              cx={route.handleX}
              cy={route.handleY}
              r={8}
              fill={isDragging ? '#1677ff' : '#ffffff'}
              stroke="#1677ff"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onPointerDown={(event) =>
                startReturnEdgeDrag(event, edge.id, route.routeY)
              }
            />
            <text
              x={route.handleX}
              y={route.handleY + 3}
              textAnchor="middle"
              fontSize="8"
              fill={isDragging ? '#ffffff' : '#1677ff'}
              style={{ pointerEvents: 'none' }}
            >
              ↕
            </text>
          </>
        )}

        {renderEdgeAnnotations(
          edge,
          workflow,
          route.midX,
          route.annotationY,
          route.availableWidth,
          onEventClick,
        )}
      </g>
    )
  }

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 16, background: '#f8fafc' }}
      extra={
        <Space>
          {editable && (
            <Button icon={<DragOutlined />} onClick={resetLayout}>
              Resetar layout
            </Button>
          )}
          <Button icon={<ZoomOutOutlined />} onClick={zoomOut}>
            Diminuir
          </Button>
          <Button icon={<ExpandOutlined />} onClick={resetZoom}>
            Resetar zoom
          </Button>
          <Button icon={<ZoomInOutlined />} onClick={zoomIn}>
            Aumentar
          </Button>
        </Space>
      }
    >
      <div
        style={{
          overflow: 'auto',
          width: '100%',
          maxHeight: 720,
          borderRadius: 12,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width,
            height: svgHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <svg
            ref={svgRef}
            width={width}
            height={svgHeight}
            style={{ touchAction: 'none', userSelect: 'none' }}
          >
            <defs>
              <pattern
                id="smallGrid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="#eef2f7"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#smallGrid)" />

            {edges
              .filter((edge) => edge.kind !== 'return')
              .map((edge) => renderForwardEdge(edge))}

            {edges
              .filter((edge) => edge.kind === 'return')
              .map((edge) => renderReturnEdge(edge))}

            {nodes.map((node) =>
              renderNode(
                node,
                workflow,
                editable,
                draggingNodeId,
                handleNodePointerDown,
                shouldIgnoreNodeClick,
                onStepClick,
                onStartClick,
                onEndClick,
                onEventClick,
                hoveredNodeId,
                setHoveredNodeId,
              ),
            )}
          </svg>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Text type="secondary">
          {editable
            ? '💡 Arraste nós e linhas. O início e o fim também são arrastáveis. Os blocos sempre procuram uma posição livre, sem sobreposição.'
            : '💡 Clique nos elementos do diagrama para visualizar e editar suas configurações.'}
        </Text>
      </div>

      {editable && (
        <div style={{ marginTop: 8 }}>
          <Space>
            <BranchesOutlined style={{ color: '#1677ff' }} />
            <Text type="secondary">
              Clique e arraste a própria linha ou o ponto azul da conexão.
            </Text>
          </Space>
        </div>
      )}
    </Card>
  )
}