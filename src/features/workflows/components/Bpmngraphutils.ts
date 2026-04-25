/**
 * bpmnGraphUtils.ts
 *
 * Utilities for extracting connectivity information directly from BPMN XML,
 * without needing the bpmn-js modeler instance.
 */

export type BpmnEdge = {
  id: string
  sourceRef: string
  targetRef: string
  name?: string
}

export type BpmnNode = {
  id: string
  type: string
  name?: string
}

export type BpmnGraph = {
  nodes: BpmnNode[]
  edges: BpmnEdge[]
}

/**
 * Parses a BPMN XML string and returns a lightweight graph of nodes and edges.
 * Uses the browser's native DOMParser — no extra dependencies.
 */
export function parseBpmnGraph(bpmnXml: string): BpmnGraph {
  const nodes: BpmnNode[] = []
  const edges: BpmnEdge[] = []

  if (!bpmnXml?.trim()) return { nodes, edges }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(bpmnXml, 'application/xml')

    // Collect all elements inside <bpmn:process> (or <process>)
    const process =
      doc.querySelector('process') ??
      doc.querySelector('[localName="process"]')

    if (!process) return { nodes, edges }

    // Walk all child elements
    for (const el of Array.from(process.children)) {
      const localName = el.localName // e.g. "startEvent", "task", "sequenceFlow"
      const id = el.getAttribute('id')
      if (!id) continue

      const name = el.getAttribute('name') ?? undefined

      if (localName === 'sequenceFlow') {
        const sourceRef = el.getAttribute('sourceRef')
        const targetRef = el.getAttribute('targetRef')
        if (sourceRef && targetRef) {
          edges.push({ id, sourceRef, targetRef, name })
        }
      } else {
        // Map localName → bpmn: type string
        const type = toBpmnType(localName)
        nodes.push({ id, type, name })
      }
    }
  } catch {
    // Silently ignore parse errors
  }

  return { nodes, edges }
}

function toBpmnType(localName: string): string {
  const map: Record<string, string> = {
    startEvent: 'bpmn:StartEvent',
    endEvent: 'bpmn:EndEvent',
    task: 'bpmn:Task',
    userTask: 'bpmn:UserTask',
    manualTask: 'bpmn:ManualTask',
    serviceTask: 'bpmn:ServiceTask',
    businessRuleTask: 'bpmn:BusinessRuleTask',
    scriptTask: 'bpmn:ScriptTask',
    callActivity: 'bpmn:CallActivity',
    subProcess: 'bpmn:SubProcess',
    exclusiveGateway: 'bpmn:ExclusiveGateway',
    inclusiveGateway: 'bpmn:InclusiveGateway',
    parallelGateway: 'bpmn:ParallelGateway',
    eventBasedGateway: 'bpmn:EventBasedGateway',
    complexGateway: 'bpmn:ComplexGateway',
    sequenceFlow: 'bpmn:SequenceFlow',
  }
  return map[localName] ?? `bpmn:${localName.charAt(0).toUpperCase()}${localName.slice(1)}`
}

/**
 * Returns the IDs of all nodes that have a SequenceFlow pointing TO `targetId`.
 */
export function getIncomingNodeIds(graph: BpmnGraph, targetId: string): string[] {
  return graph.edges
    .filter((e) => e.targetRef === targetId)
    .map((e) => e.sourceRef)
}

/**
 * Returns the IDs of all nodes that `sourceId` points TO via SequenceFlow.
 */
export function getOutgoingNodeIds(graph: BpmnGraph, sourceId: string): string[] {
  return graph.edges
    .filter((e) => e.sourceRef === sourceId)
    .map((e) => e.targetRef)
}

/**
 * Given a gateway element ID, finds the activity immediately upstream
 * (the first node of kind activity among its direct incoming nodes).
 */
export function findUpstreamActivityId(
  graph: BpmnGraph,
  gatewayId: string,
): string | null {
  const incomingIds = getIncomingNodeIds(graph, gatewayId)

  // Direct incoming activity
  const directActivity = incomingIds.find((id) => {
    const node = graph.nodes.find((n) => n.id === id)
    return node && isActivityType(node.type)
  })

  if (directActivity) return directActivity

  // One hop back (gateway → gateway → activity is uncommon but handle it)
  for (const id of incomingIds) {
    const secondLevel = getIncomingNodeIds(graph, id)
    const found = secondLevel.find((sid) => {
      const node = graph.nodes.find((n) => n.id === sid)
      return node && isActivityType(node.type)
    })
    if (found) return found
  }

  return null
}

function isActivityType(type: string): boolean {
  return (
    type === 'bpmn:Task' ||
    type === 'bpmn:UserTask' ||
    type === 'bpmn:ManualTask' ||
    type === 'bpmn:ServiceTask' ||
    type === 'bpmn:BusinessRuleTask' ||
    type === 'bpmn:ScriptTask' ||
    type === 'bpmn:CallActivity' ||
    type === 'bpmn:SubProcess'
  )
}

/**
 * Given a gateway element ID, returns all outgoing SequenceFlow edges.
 */
export function getOutgoingFlows(graph: BpmnGraph, gatewayId: string): BpmnEdge[] {
  return graph.edges.filter((e) => e.sourceRef === gatewayId)
}