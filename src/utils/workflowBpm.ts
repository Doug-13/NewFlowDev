import type { Workflow, WorkflowStep, WorkflowTransition } from '../types'

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'
const BPMNDI_NS = 'http://www.omg.org/spec/BPMN/20100524/DI'
const DC_NS = 'http://www.omg.org/spec/DD/20100524/DC'
const DI_NS = 'http://www.omg.org/spec/DD/20100524/DI'

const START_ID = 'StartEvent_1'
const END_ID = 'EndEvent_1'

type Point = { x: number; y: number }

function escapeXml(value?: string) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function safeId(value: string) {
  return String(value || 'item')
    .trim()
    .replace(/[^a-zA-Z0-9_:-]/g, '_')
}

export function toBpmnTaskId(stepId: string) {
  return `Activity_${safeId(stepId)}`
}

export function toBpmnFlowId(
  sourceKey: string,
  targetKey: string,
  index?: number,
) {
  return `Flow_${safeId(sourceKey)}_${safeId(targetKey)}${index !== undefined ? `_${index + 1}` : ''}`
}

function getOrderedSteps(workflow: Workflow) {
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

function getTaskBounds(index: number) {
  return {
    x: 260 + index * 220,
    y: 220,
    width: 120,
    height: 80,
  }
}

function getStartBounds() {
  return { x: 90, y: 242, width: 36, height: 36 }
}

function getEndBounds(totalSteps: number) {
  return {
    x: 260 + totalSteps * 220 + 80,
    y: 242,
    width: 36,
    height: 36,
  }
}

function getCenter(bounds: { x: number; y: number; width: number; height: number }) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}

function getRightAnchor(bounds: {
  x: number
  y: number
  width: number
  height: number
}) {
  const center = getCenter(bounds)
  return { x: bounds.x + bounds.width, y: center.y }
}

function getLeftAnchor(bounds: {
  x: number
  y: number
  width: number
  height: number
}) {
  const center = getCenter(bounds)
  return { x: bounds.x, y: center.y }
}

function buildWaypoints(
  sourceBounds: { x: number; y: number; width: number; height: number },
  targetBounds: { x: number; y: number; width: number; height: number },
): Point[] {
  const start = getRightAnchor(sourceBounds)
  const end = getLeftAnchor(targetBounds)

  if (end.x >= start.x) {
    const midX = start.x + Math.max(40, (end.x - start.x) / 2)

    if (Math.abs(end.y - start.y) < 10) {
      return [start, end]
    }

    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ]
  }

  const routeY = Math.min(start.y, end.y) - 100
  const leftX = start.x + 40
  const rightX = end.x - 40

  return [
    start,
    { x: leftX, y: start.y },
    { x: leftX, y: routeY },
    { x: rightX, y: routeY },
    { x: rightX, y: end.y },
    end,
  ]
}

function serializeWaypoints(points: Point[]) {
  return points
    .map((point) => `<di:waypoint x="${point.x}" y="${point.y}" />`)
    .join('')
}

export function findStepByBpmnElementId(
  workflow: Workflow,
  elementId?: string,
): WorkflowStep | undefined {
  if (!elementId) return undefined
  return (workflow.steps ?? []).find(
    (step) => toBpmnTaskId(step.id) === elementId,
  )
}

export function findTransitionByBpmnFlowId(
  workflow: Workflow,
  flowId?: string,
): WorkflowTransition | undefined {
  if (!flowId) return undefined

  const steps = getOrderedSteps(workflow)

  for (const step of steps) {
    const transitions = step.transitions ?? []

    transitions.forEach(() => undefined)

    for (let index = 0; index < transitions.length; index += 1) {
      const transition = transitions[index]
      const targetStep = resolveTargetStep(transition, steps)
      if (!targetStep) continue

      const expectedId = toBpmnFlowId(step.id, targetStep.id, index)
      if (expectedId === flowId) {
        return transition
      }
    }
  }

  return undefined
}

export function createWorkflowBpmnXml(workflow: Workflow) {
  const steps = getOrderedSteps(workflow)
  const processId = `Process_${safeId(workflow.id || workflow.name || 'workflow')}`
  const diagramId = `BPMNDiagram_${safeId(workflow.id || '1')}`
  const planeId = `BPMNPlane_${safeId(workflow.id || '1')}`

  if (!steps.length) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="${BPMN_NS}"
  xmlns:bpmndi="${BPMNDI_NS}"
  xmlns:dc="${DC_NS}"
  xmlns:di="${DI_NS}"
  id="Definitions_${safeId(workflow.id || '1')}"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" isExecutable="false">
    <bpmn:startEvent id="${START_ID}" name="${escapeXml(workflow.startConfig?.name || 'Início')}" />
    <bpmn:endEvent id="${END_ID}" name="${escapeXml(workflow.endConfig?.name || 'Fim')}" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="${diagramId}">
    <bpmndi:BPMNPlane id="${planeId}" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="${START_ID}_di" bpmnElement="${START_ID}">
        <dc:Bounds x="90" y="242" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="${END_ID}_di" bpmnElement="${END_ID}">
        <dc:Bounds x="320" y="242" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
  }

  const taskBoundsMap = new Map<string, ReturnType<typeof getTaskBounds>>()
  steps.forEach((step, index) => {
    taskBoundsMap.set(step.id, getTaskBounds(index))
  })

  const startBounds = getStartBounds()
  const endBounds = getEndBounds(steps.length)

  const initialStep =
    steps.find((step) => step.id === workflow.startConfig?.initialStepId) ??
    steps.find((step) => step.isInitial) ??
    steps[0]

  const incomingMap = new Map<string, string[]>()
  const outgoingMap = new Map<string, string[]>()

  const sequenceFlows: Array<{
    id: string
    name?: string
    sourceRef: string
    targetRef: string
    waypoints: Point[]
  }> = []

  function pushIncoming(targetId: string, flowId: string) {
    incomingMap.set(targetId, [...(incomingMap.get(targetId) ?? []), flowId])
  }

  function pushOutgoing(sourceId: string, flowId: string) {
    outgoingMap.set(sourceId, [...(outgoingMap.get(sourceId) ?? []), flowId])
  }

  const startFlowId = toBpmnFlowId('start', initialStep.id)
  sequenceFlows.push({
    id: startFlowId,
    sourceRef: START_ID,
    targetRef: toBpmnTaskId(initialStep.id),
    waypoints: buildWaypoints(startBounds, taskBoundsMap.get(initialStep.id)!),
  })
  pushOutgoing(START_ID, startFlowId)
  pushIncoming(toBpmnTaskId(initialStep.id), startFlowId)

  steps.forEach((step) => {
    const transitions = step.transitions ?? []

    if (!transitions.length || step.isFinal) {
      const flowId = toBpmnFlowId(step.id, 'end')
      sequenceFlows.push({
        id: flowId,
        sourceRef: toBpmnTaskId(step.id),
        targetRef: END_ID,
        waypoints: buildWaypoints(taskBoundsMap.get(step.id)!, endBounds),
      })
      pushOutgoing(toBpmnTaskId(step.id), flowId)
      pushIncoming(END_ID, flowId)
      return
    }

    transitions.forEach((transition, index) => {
      const targetStep = resolveTargetStep(transition, steps)
      if (!targetStep) return

      const flowId = toBpmnFlowId(step.id, targetStep.id, index)

      sequenceFlows.push({
        id: flowId,
        name: transition.triggerAction,
        sourceRef: toBpmnTaskId(step.id),
        targetRef: toBpmnTaskId(targetStep.id),
        waypoints: buildWaypoints(
          taskBoundsMap.get(step.id)!,
          taskBoundsMap.get(targetStep.id)!,
        ),
      })

      pushOutgoing(toBpmnTaskId(step.id), flowId)
      pushIncoming(toBpmnTaskId(targetStep.id), flowId)
    })
  })

  const startEventXml = `
    <bpmn:startEvent id="${START_ID}" name="${escapeXml(workflow.startConfig?.name || 'Início')}">
      ${(outgoingMap.get(START_ID) ?? [])
        .map((flowId) => `<bpmn:outgoing>${flowId}</bpmn:outgoing>`)
        .join('')}
    </bpmn:startEvent>`

  const tasksXml = steps
    .map((step) => {
      const taskId = toBpmnTaskId(step.id)

      return `
    <bpmn:task id="${taskId}" name="${escapeXml(step.name)}">
      ${(incomingMap.get(taskId) ?? [])
        .map((flowId) => `<bpmn:incoming>${flowId}</bpmn:incoming>`)
        .join('')}
      ${(outgoingMap.get(taskId) ?? [])
        .map((flowId) => `<bpmn:outgoing>${flowId}</bpmn:outgoing>`)
        .join('')}
    </bpmn:task>`
    })
    .join('')

  const endEventXml = `
    <bpmn:endEvent id="${END_ID}" name="${escapeXml(workflow.endConfig?.name || 'Fim')}">
      ${(incomingMap.get(END_ID) ?? [])
        .map((flowId) => `<bpmn:incoming>${flowId}</bpmn:incoming>`)
        .join('')}
    </bpmn:endEvent>`

  const flowsXml = sequenceFlows
    .map(
      (flow) => `
    <bpmn:sequenceFlow
      id="${flow.id}"
      sourceRef="${flow.sourceRef}"
      targetRef="${flow.targetRef}"
      ${flow.name ? `name="${escapeXml(flow.name)}"` : ''}
    />`,
    )
    .join('')

  const startShapeXml = `
      <bpmndi:BPMNShape id="${START_ID}_di" bpmnElement="${START_ID}">
        <dc:Bounds x="${startBounds.x}" y="${startBounds.y}" width="${startBounds.width}" height="${startBounds.height}" />
      </bpmndi:BPMNShape>`

  const taskShapesXml = steps
    .map((step) => {
      const bounds = taskBoundsMap.get(step.id)!
      const taskId = toBpmnTaskId(step.id)

      return `
      <bpmndi:BPMNShape id="${taskId}_di" bpmnElement="${taskId}">
        <dc:Bounds x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />
      </bpmndi:BPMNShape>`
    })
    .join('')

  const endShapeXml = `
      <bpmndi:BPMNShape id="${END_ID}_di" bpmnElement="${END_ID}">
        <dc:Bounds x="${endBounds.x}" y="${endBounds.y}" width="${endBounds.width}" height="${endBounds.height}" />
      </bpmndi:BPMNShape>`

  const edgesXml = sequenceFlows
    .map(
      (flow) => `
      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">
        ${serializeWaypoints(flow.waypoints)}
      </bpmndi:BPMNEdge>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="${BPMN_NS}"
  xmlns:bpmndi="${BPMNDI_NS}"
  xmlns:dc="${DC_NS}"
  xmlns:di="${DI_NS}"
  id="Definitions_${safeId(workflow.id || '1')}"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" isExecutable="false">
    ${startEventXml}
    ${tasksXml}
    ${endEventXml}
    ${flowsXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="${diagramId}">
    <bpmndi:BPMNPlane id="${planeId}" bpmnElement="${processId}">
      ${startShapeXml}
      ${taskShapesXml}
      ${endShapeXml}
      ${edgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}