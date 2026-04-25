// /**
//  * workflowStorage.ts
//  *
//  * Reconstrói `steps` com transições corretas a partir do BPMN XML.
//  *
//  * ESTRATÉGIA DE TRANSIÇÕES:
//  * O BPMN XML já contém sourceRef/targetRef em cada sequenceFlow.
//  * O atributo `name` do sequenceFlow (ex: "Aprovar", "Reprovar") é o triggerAction.
//  * Quando há FlowConfigs salvos com label, esses prevalecem sobre o name do XML.
//  * Gateways são atravessados transparentemente — a transição vai da atividade
//  * diretamente até a próxima atividade, usando o label do arco de saída do gateway.
//  */

// const WORKFLOWS_KEY               = 'gestao-docs:workflows'
// const ELEMENT_CONFIGS_KEY         = 'gestao-docs:workflow-element-configs'
// const LEGACY_ELEMENT_CONFIGS_KEY  = 'workflow-element-configs'
// const LEGACY_ACTIVITY_CONFIGS_KEY = 'gestao-docs:workflow-activity-configs'

// export type StoredWorkflowStep = {
//   id: string
//   name: string
//   orderIndex: number
//   isInitial?: boolean
//   isFinal?: boolean
//   kind?: string
//   allowedActions?: string[]
//   actions?: Array<{
//     id: string
//     label: string
//     color: string
//     outcome: string
//     requiresComment: boolean
//   }>
//   responsibles?: Array<{ type: string; id?: string; name: string }>
//   transitions?: Array<{ triggerAction: string; toStepOrderIndex: number; intermediateEventIds?: string[] }>
//   deadlineMode?: string
//   deadlineValue?: number | string
//   metadataFields?: Array<{
//     metadataDefinitionId: string
//     name?: string
//     label?: string
//     fieldType?: string
//     isRequired: boolean
//     isReadOnly?: boolean
//   }>
// }

// export type StoredWorkflow = {
//   id: string
//   name: string
//   description?: string
//   processId?: string
//   processName?: string
//   version?: string
//   status: 'draft' | 'active' | 'inactive' | 'archived'
//   stepsCount?: number
//   updatedAt: string
//   createdAt?: string
//   permissions?: {
//     visualization?: {
//       userIds?: string[]
//       groupIds?: string[]
//       processIds?: string[]
//       areaIds?: string[]
//       disciplineIds?: string[]
//       roleIds?: string[]
//     }
//     creation?: {
//       userIds?: string[]
//       groupIds?: string[]
//       processIds?: string[]
//       areaIds?: string[]
//       disciplineIds?: string[]
//       roleIds?: string[]
//     }
//   }
//   steps?: StoredWorkflowStep[]
// }

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// function safeParseJson<T>(value: string | null, fallback: T): T {
//   if (!value) return fallback
//   try { return JSON.parse(value) as T } catch { return fallback }
// }

// function readArray(key: string): any[] {
//   const raw = safeParseJson<any[]>(localStorage.getItem(key), [])
//   return Array.isArray(raw) ? raw : []
// }

// // ─── Tipos internos ───────────────────────────────────────────────────────────

// type BpmnEdge = {
//   id: string
//   sourceRef: string
//   targetRef: string
//   name?: string
// }

// type BpmnNode = {
//   id: string
//   type: string
//   name?: string
// }

// // ─── Parser BPMN XML ──────────────────────────────────────────────────────────

// function parseBpmnGraph(xml: string): { nodes: BpmnNode[]; edges: BpmnEdge[] } {
//   const nodes: BpmnNode[] = []
//   const edges: BpmnEdge[] = []
//   if (!xml?.trim()) return { nodes, edges }

//   try {
//     const doc     = new DOMParser().parseFromString(xml, 'application/xml')
//     const process = doc.querySelector('process') ?? doc.querySelector('[localName="process"]')
//     if (!process) return { nodes, edges }

//     for (const el of Array.from(process.children)) {
//       const id = el.getAttribute('id')
//       if (!id) continue
//       const name = el.getAttribute('name') ?? undefined

//       if (el.localName === 'sequenceFlow') {
//         const sourceRef = el.getAttribute('sourceRef')
//         const targetRef = el.getAttribute('targetRef')
//         if (sourceRef && targetRef) {
//           edges.push({ id, sourceRef, targetRef, name: name?.trim() || undefined })
//         }
//       } else {
//         nodes.push({ id, type: el.localName, name })
//       }
//     }
//   } catch { /* ignore */ }

//   return { nodes, edges }
// }

// function isActivityNode(type: string): boolean {
//   return ['task', 'userTask', 'manualTask', 'serviceTask', 'scriptTask',
//           'receiveTask', 'sendTask', 'businessRuleTask', 'callActivity'].includes(type)
// }
// function isStartNode(type: string): boolean { return type === 'startEvent' }
// function isEndNode(type: string): boolean   { return type === 'endEvent' }
// function isGateway(type: string): boolean   {
//   return ['exclusiveGateway', 'inclusiveGateway', 'parallelGateway',
//           'eventBasedGateway', 'complexGateway'].includes(type)
// }

// // ─── Resolve atividades alcançáveis atravessando gateways e eventos ──────────

// function isIntermediateAutoEvent(type: string): boolean {
//   return type === 'intermediateCatchEvent' || type === 'intermediateThrowEvent'
// }

// type ResolvedTarget = {
//   activityId: string
//   edgeLabel?: string
//   edgeId: string
//   intermediateEventIds: string[]
// }

// function resolveActivityTargets(
//   fromNodeId: string,
//   nodeMap: Map<string, BpmnNode>,
//   outEdges: Map<string, BpmnEdge[]>,
//   seen = new Set<string>(),
//   inheritedLabel?: string,
//   inheritedEdgeId = '',
//   inheritedEventIds: string[] = [],
// ): ResolvedTarget[] {
//   if (seen.has(fromNodeId)) return []
//   seen.add(fromNodeId)

//   const results: ResolvedTarget[] = []

//   for (const edge of outEdges.get(fromNodeId) ?? []) {
//     const target = nodeMap.get(edge.targetRef)
//     if (!target) continue

//     const currentLabel  = edge.name?.trim() || inheritedLabel
//     const currentEdgeId = edge.id || inheritedEdgeId

//     if (isActivityNode(target.type)) {
//       results.push({
//         activityId: edge.targetRef,
//         edgeLabel:  currentLabel,
//         edgeId:     currentEdgeId,
//         intermediateEventIds: [...inheritedEventIds],
//       })
//     } else if (isIntermediateAutoEvent(target.type)) {
//       const inner = resolveActivityTargets(
//         edge.targetRef, nodeMap, outEdges, new Set(seen),
//         currentLabel, currentEdgeId, [...inheritedEventIds, edge.targetRef],
//       )
//       results.push(...inner)
//     } else if (!isEndNode(target.type)) {
//       const inner = resolveActivityTargets(
//         edge.targetRef, nodeMap, outEdges, new Set(seen),
//         currentLabel, currentEdgeId, inheritedEventIds,
//       )
//       results.push(...inner)
//     }
//   }

//   return results
// }

// function leadsToEnd(
//   fromNodeId: string,
//   nodeMap: Map<string, BpmnNode>,
//   outEdges: Map<string, BpmnEdge[]>,
//   seen = new Set<string>(),
// ): boolean {
//   if (seen.has(fromNodeId)) return false
//   seen.add(fromNodeId)
//   for (const edge of outEdges.get(fromNodeId) ?? []) {
//     const target = nodeMap.get(edge.targetRef)
//     if (!target) continue
//     if (isEndNode(target.type)) return true
//     if (!isActivityNode(target.type)) {
//       if (leadsToEnd(edge.targetRef, nodeMap, outEdges, new Set(seen))) return true
//     }
//   }
//   return false
// }

// // ─── Constrói ações ───────────────────────────────────────────────────────────

// type ActionItem = { id: string; label: string; color: string; outcome: string; requiresComment: boolean }
// type ActionsResult = { allowedActions: string[]; actions: ActionItem[] }

// function buildActions(cfg: any, isFinal: boolean, isInitial: boolean): ActionsResult {
//   const c = cfg?.config ?? cfg

//   if (c && Array.isArray(c.actions) && c.actions.length > 0) {
//     const actions = c.actions.map((a: any) => ({
//       id:              String(a.id      ?? a.outcome ?? ''),
//       label:           String(a.label   ?? a.outcome ?? ''),
//       color:           String(a.color   ?? 'default'),
//       outcome:         String(a.outcome ?? ''),
//       requiresComment: Boolean(a.requiresComment),
//     }))
//     return { allowedActions: actions.map((a: any) => a.outcome).filter(Boolean), actions }
//   }

//   if (c) {
//     type Row = [boolean, string, string, string, boolean]
//     const rows: Row[] = [
//       [c.allowApprove        !== false, 'approve',         'Aprovar',           'green',  false],
//       [c.allowReject         !== false, 'reject',          'Reprovar',          'red',    true ],
//       [c.allowRequestChanges !== false, 'request-changes', 'Solicitar ajustes', 'orange', true ],
//       [Boolean(c.allowForward),         'forward',         'Encaminhar',        'blue',   false],
//     ]
//     const actions = rows
//       .filter(([enabled]) => enabled)
//       .map(([, outcome, label, color, requiresComment]) => ({
//         id: outcome, label, color, outcome, requiresComment,
//       }))
//     return { allowedActions: actions.map((a: { outcome: string }) => a.outcome), actions }
//   }

//   if (isFinal)   return { allowedActions: ['publish'],         actions: [{ id: 'publish', label: 'Publicar', color: 'green', outcome: 'publish', requiresComment: false }] }
//   if (isInitial) return { allowedActions: ['submit'],          actions: [{ id: 'submit',  label: 'Submeter', color: 'blue',  outcome: 'submit',  requiresComment: false }] }
//   return {
//     allowedActions: ['approve', 'reject'],
//     actions: [
//       { id: 'approve', label: 'Aprovar',  color: 'green', outcome: 'approve', requiresComment: false },
//       { id: 'reject',  label: 'Reprovar', color: 'red',   outcome: 'reject',  requiresComment: true  },
//     ],
//   }
// }

// // ─── Constrói responsáveis ────────────────────────────────────────────────────

// function buildResponsibles(cfg: any): StoredWorkflowStep['responsibles'] {
//   const c = cfg?.config ?? cfg
//   if (!c) return [{ type: 'dynamic', name: 'Criador' }]
//   const mode = String(c.assignmentMode ?? '')
//   const try_ = (ids: any, type: string) =>
//     Array.isArray(ids) && ids.length > 0 ? [{ type, id: String(ids[0]), name: '' }] : null
//   if (mode === 'user')      return try_(c.responsibleUserIds,     'user')     ?? [{ type: 'dynamic', name: 'Criador' }]
//   if (mode === 'role')      return try_(c.responsibleRoleIds,     'role')     ?? [{ type: 'dynamic', name: 'Criador' }]
//   if (mode === 'group')     return try_(c.responsibleGroupIds,    'group')    ?? [{ type: 'dynamic', name: 'Criador' }]
//   if (mode === 'positions') return try_(c.responsibleRoleIds, 'role') ?? try_(c.responsibleFunctionIds, 'function') ?? [{ type: 'dynamic', name: 'Criador' }]
//   if (mode === 'mixed')     return try_(c.responsibleUserIds, 'user') ?? try_(c.responsibleRoleIds, 'role') ?? try_(c.responsibleGroupIds, 'group') ?? [{ type: 'dynamic', name: 'Criador' }]
//   return [{ type: 'dynamic', name: 'Criador' }]
// }

// // ─── Constrói metadados ───────────────────────────────────────────────────────

// function buildMetadataFields(cfg: any): StoredWorkflowStep['metadataFields'] {
//   const c = cfg?.config ?? cfg
//   if (!c || !Array.isArray(c.metadataFields) || !c.metadataFields.length) return undefined
//   return c.metadataFields.map((f: any) => ({
//     metadataDefinitionId: String(f.metadataDefinitionId ?? ''),
//     name:       typeof f.name      === 'string' ? f.name      : undefined,
//     label:      typeof f.label     === 'string' ? f.label     : undefined,
//     fieldType:  typeof f.fieldType === 'string' ? f.fieldType : 'text',
//     isRequired: Boolean(f.isRequired),
//     isReadOnly: Boolean(f.isReadOnly),
//   }))
// }

// // ─── Conjuntos de outcomes ────────────────────────────────────────────────────

// const REJECTION_OUTCOMES = new Set(['reject', 'return', 'request-changes'])
// const FORWARD_OUTCOMES   = new Set(['approve', 'submit', 'publish', 'forward', 'complete'])

// // ─── buildStepsFromBpmn ───────────────────────────────────────────────────────

// function buildStepsFromBpmn(
//   bpmnXml: string,
//   workflowId: string,
//   allElementConfigs: any[],
// ): StoredWorkflowStep[] {
//   const { nodes, edges } = parseBpmnGraph(bpmnXml)
//   if (!nodes.length) return []

//   const nodeMap  = new Map<string, BpmnNode>(nodes.map((n) => [n.id, n]))
//   const outEdges = new Map<string, BpmnEdge[]>()
//   for (const edge of edges) {
//     const list = outEdges.get(edge.sourceRef) ?? []
//     list.push(edge)
//     outEdges.set(edge.sourceRef, list)
//   }

//   const wfConfigs       = allElementConfigs.filter((c: any) => c.workflowId === workflowId)
//   const configByElement = new Map<string, any>(wfConfigs.map((c: any) => [String(c.elementId), c]))

//   // Labels salvos nos FlowConfigs prevalecem sobre os do XML
//   const flowLabelByEdge = new Map<string, string>()
//   for (const cfg of wfConfigs) {
//     if (cfg.kind === 'flow') {
//       const label = cfg.config?.label?.trim()
//       if (label) flowLabelByEdge.set(String(cfg.elementId), label)
//     }
//   }

//   // GatewayConfigs com actionRoutes salvos — mapeiam sequenceFlowId por actionId/outcome
//   // Estrutura: gatewayId → { actionId/outcome → sequenceFlowId }
//   const gatewayRoutesByElement = new Map<string, Map<string, string>>()
//   for (const cfg of wfConfigs) {
//     if (cfg.kind === 'gateway' && Array.isArray(cfg.config?.actionRoutes)) {
//       const routeMap = new Map<string, string>()
//       for (const r of cfg.config.actionRoutes as Array<{ actionId: string; actionLabel: string; sequenceFlowId?: string }>) {
//         if (r.sequenceFlowId) {
//           // Indexa tanto pelo actionId quanto pelo outcome inferido do label
//           routeMap.set(r.actionId, r.sequenceFlowId)
//           // Também indexa pelo outcome canônico (approve, reject, etc.)
//           const outcomeLower = r.actionLabel?.toLowerCase() ?? ''
//           if (outcomeLower.includes('aprov')) routeMap.set('approve', r.sequenceFlowId)
//           else if (outcomeLower.includes('reprov')) routeMap.set('reject', r.sequenceFlowId)
//           else if (outcomeLower.includes('revis') || outcomeLower.includes('ajust') || outcomeLower.includes('solicit')) routeMap.set('request-changes', r.sequenceFlowId)
//           else if (outcomeLower.includes('encamin')) routeMap.set('forward', r.sequenceFlowId)
//           else if (outcomeLower.includes('submet')) routeMap.set('submit', r.sequenceFlowId)
//           else if (outcomeLower.includes('publi')) routeMap.set('publish', r.sequenceFlowId)
//         }
//       }
//       gatewayRoutesByElement.set(String(cfg.elementId), routeMap)
//     }
//   }

//   // Resolve o gateway imediatamente após uma atividade e retorna suas actionRoutes
//   function getGatewayRoutesForActivity(activityId: string): Map<string, string> | null {
//     for (const edge of outEdges.get(activityId) ?? []) {
//       const target = nodeMap.get(edge.targetRef)
//       if (target && isGateway(target.type)) {
//         const routes = gatewayRoutesByElement.get(edge.targetRef)
//         if (routes && routes.size > 0) return routes
//       }
//     }
//     return null
//   }
//   const startNode = nodes.find((n) => isStartNode(n.type))
//   if (!startNode) return []

//   const visited = new Set<string>()
//   const queue   = [startNode.id]
//   const activityOrder: string[] = []

//   while (queue.length > 0) {
//     const cur = queue.shift()!
//     if (visited.has(cur)) continue
//     visited.add(cur)
//     const node = nodeMap.get(cur)
//     if (node && isActivityNode(node.type)) activityOrder.push(cur)
//     for (const edge of outEdges.get(cur) ?? []) {
//       if (!visited.has(edge.targetRef)) queue.push(edge.targetRef)
//     }
//   }

//   if (!activityOrder.length) return []

//   const orderByActivity = new Map<string, number>(activityOrder.map((id, i) => [id, i]))

//   return activityOrder.map((actId, idx) => {
//     const node        = nodeMap.get(actId)!
//     const elementName = node.name?.trim() || `Etapa ${idx + 1}`
//     const cfg         = configByElement.get(actId) ?? null
//     const isInitial   = idx === 0
//     const targets     = resolveActivityTargets(actId, nodeMap, outEdges)
//     const isFinal     = leadsToEnd(actId, nodeMap, outEdges) && targets.length === 0

//     const { allowedActions, actions } = buildActions(cfg, isFinal, isInitial)
//     const responsibles   = buildResponsibles(cfg)
//     const metadataFields = buildMetadataFields(cfg)

//     const c = cfg?.config ?? cfg
//     const deadlineMode  = c ? (String(c.deadlineMode ?? '') || undefined) : undefined
//     const deadlineValue = c ? c.deadlineValue : undefined

//     // ── Monta transições ────────────────────────────────────────────────────
//     const transitions: Array<{ triggerAction: string; toStepOrderIndex: number; intermediateEventIds?: string[] }> = []

//     // PRIORIDADE 1: actionRoutes salvos no GatewayConfig
//     // Se a atividade tem um gateway logo após ela com actionRoutes configurados,
//     // usa esses mapeamentos (outcome → sequenceFlowId → targetRef → orderIndex)
//     const gatewayRoutes = getGatewayRoutesForActivity(actId)
//     if (gatewayRoutes && gatewayRoutes.size > 0) {
//       const used = new Set<string>()
//       for (const action of allowedActions) {
//         const flowId = gatewayRoutes.get(action)
//         if (!flowId) continue
//         // Encontra o arco pelo ID e resolve o destino final (atravessando gateways)
//         const edge = edges.find((e) => e.id === flowId)
//         if (!edge) continue
//         // Resolve o orderIndex do destino (pode ser atividade direta ou via outro nó)
//         let destIdx: number | undefined
//         if (orderByActivity.has(edge.targetRef)) {
//           destIdx = orderByActivity.get(edge.targetRef)
//         } else {
//           // O targetRef pode ser um gateway/evento intermediário — resolve recursivamente
//           const innerTargets = resolveActivityTargets(edge.targetRef, nodeMap, outEdges)
//           if (innerTargets.length > 0) {
//             destIdx = orderByActivity.get(innerTargets[0].activityId)
//           }
//         }
//         if (destIdx !== undefined && !used.has(action)) {
//           // Captura eventos intermediários no caminho (ex: evento condicional de revisão)
//           const innerTargets = resolveActivityTargets(edge.targetRef, nodeMap, outEdges)
//           const evtIds = innerTargets.length > 0 ? innerTargets[0].intermediateEventIds : []
//           // Se o targetRef já é uma atividade, verifica se há eventos antes dela via resolução
//           const directEvts = isIntermediateAutoEvent(nodeMap.get(edge.targetRef)?.type ?? '')
//             ? [edge.targetRef, ...(resolveActivityTargets(edge.targetRef, nodeMap, outEdges)[0]?.intermediateEventIds ?? [])]
//             : evtIds
//           transitions.push({
//             triggerAction: action,
//             toStepOrderIndex: destIdx,
//             ...(directEvts.length > 0 ? { intermediateEventIds: directEvts } : {}),
//           })
//           used.add(action)
//         }
//       }
//       // Se montou transições via actionRoutes, retorna sem passar pelo fallback
//       if (transitions.length > 0) {
//         return {
//           id: actId, name: elementName, orderIndex: idx, isInitial, isFinal,
//           kind: 'activity', allowedActions, actions, responsibles, transitions,
//           ...(deadlineMode  !== undefined ? { deadlineMode }  : {}),
//           ...(deadlineValue !== undefined ? { deadlineValue } : {}),
//           ...(metadataFields?.length      ? { metadataFields } : {}),
//         } satisfies StoredWorkflowStep
//       }
//     }

//     if (targets.length === 0) {
//       // Nenhuma saída — etapa final
//     } else if (targets.length === 1) {
//       const destIdx  = orderByActivity.get(targets[0].activityId)
//       if (destIdx !== undefined) {
//         const label  = flowLabelByEdge.get(targets[0].edgeId) ?? targets[0].edgeLabel
//         const evtIds = targets[0].intermediateEventIds.length > 0
//           ? { intermediateEventIds: targets[0].intermediateEventIds } : {}

//         if (label) {
//           const matched = allowedActions.filter((a) =>
//             a === label ||
//             label.toLowerCase().includes(a.toLowerCase()) ||
//             a.toLowerCase().includes(label.toLowerCase()),
//           )
//           const toAdd = matched.length > 0 ? matched : [label]
//           toAdd.forEach((a) => transitions.push({ triggerAction: a, toStepOrderIndex: destIdx, ...evtIds }))
//           allowedActions
//             .filter((a) => !REJECTION_OUTCOMES.has(a) && !transitions.some((t) => t.triggerAction === a))
//             .forEach((a) => transitions.push({ triggerAction: a, toStepOrderIndex: destIdx, ...evtIds }))
//         } else {
//           allowedActions
//             .filter((a) => !REJECTION_OUTCOMES.has(a))
//             .forEach((a) => transitions.push({ triggerAction: a, toStepOrderIndex: destIdx, ...evtIds }))
//         }
//       }
//     } else {
//       // Múltiplos destinos: ordena por orderIndex
//       const sorted = targets
//         .map((t) => ({ ...t, destIdx: orderByActivity.get(t.activityId) }))
//         .filter((t) => t.destIdx !== undefined)
//         .sort((a, b) => a.destIdx! - b.destIdx!)

//       const used = new Set<string>()

//       // Primeira passagem: usa labels configurados nos FlowConfigs/arcos XML
//       for (const target of sorted) {
//         const label = flowLabelByEdge.get(target.edgeId) ?? target.edgeLabel
//         if (!label) continue

//         const matched = allowedActions.filter((a) =>
//           !used.has(a) && (
//             a === label ||
//             label.toLowerCase().includes(a.toLowerCase()) ||
//             a.toLowerCase().includes(label.toLowerCase())
//           ),
//         )

//         const tEvtIds = target.intermediateEventIds?.length > 0
//           ? { intermediateEventIds: target.intermediateEventIds } : {}
//         if (matched.length > 0) {
//           matched.forEach((a) => {
//             transitions.push({ triggerAction: a, toStepOrderIndex: target.destIdx!, ...tEvtIds })
//             used.add(a)
//           })
//         } else if (!used.has(label)) {
//           transitions.push({ triggerAction: label, toStepOrderIndex: target.destIdx!, ...tEvtIds })
//           used.add(label)
//         }
//       }

//       // Segunda passagem: ações restantes por inferência
//       // Destino de maior orderIndex = avanço, menor = retorno/desvio
//       const mainTarget       = sorted.find((t) => t.destIdx! > idx) ?? sorted[sorted.length - 1]
//       const correctionTarget = sorted.find((t) => t !== mainTarget && t.destIdx! <= idx) ?? sorted[0]

//       if (mainTarget) {
//         const mEvtIds = mainTarget.intermediateEventIds?.length > 0
//           ? { intermediateEventIds: mainTarget.intermediateEventIds } : {}
//         allowedActions
//           .filter((a) => !used.has(a) && FORWARD_OUTCOMES.has(a))
//           .forEach((a) => {
//             transitions.push({ triggerAction: a, toStepOrderIndex: mainTarget.destIdx!, ...mEvtIds })
//             used.add(a)
//           })
//       }

//       if (correctionTarget && correctionTarget !== mainTarget) {
//         const cEvtIds = correctionTarget.intermediateEventIds?.length > 0
//           ? { intermediateEventIds: correctionTarget.intermediateEventIds } : {}
//         allowedActions
//           .filter((a) => !used.has(a) && REJECTION_OUTCOMES.has(a))
//           .forEach((a) => {
//             transitions.push({ triggerAction: a, toStepOrderIndex: correctionTarget.destIdx!, ...cEvtIds })
//             used.add(a)
//           })
//       }

//       // Restantes → caminho principal
//       if (mainTarget) {
//         const mEvtIds2 = mainTarget.intermediateEventIds?.length > 0
//           ? { intermediateEventIds: mainTarget.intermediateEventIds } : {}
//         allowedActions
//           .filter((a) => !used.has(a))
//           .forEach((a) => transitions.push({ triggerAction: a, toStepOrderIndex: mainTarget.destIdx!, ...mEvtIds2 }))
//       }
//     }

//     return {
//       id:         actId,
//       name:       elementName,
//       orderIndex: idx,
//       isInitial,
//       isFinal,
//       kind:       'activity',
//       allowedActions,
//       actions,
//       responsibles,
//       transitions,
//       ...(deadlineMode  !== undefined ? { deadlineMode }  : {}),
//       ...(deadlineValue !== undefined ? { deadlineValue } : {}),
//       ...(metadataFields?.length      ? { metadataFields } : {}),
//     } satisfies StoredWorkflowStep
//   })
// }

// // ─── Carrega configs ──────────────────────────────────────────────────────────

// function loadAllElementConfigs(): any[] {
//   return [
//     ...readArray(ELEMENT_CONFIGS_KEY),
//     ...readArray(LEGACY_ELEMENT_CONFIGS_KEY),
//     ...readArray(LEGACY_ACTIVITY_CONFIGS_KEY),
//   ]
// }

// // ─── API pública ──────────────────────────────────────────────────────────────

// export function loadStoredWorkflows(): StoredWorkflow[] {
//   const raw = safeParseJson<any[]>(localStorage.getItem(WORKFLOWS_KEY), [])
//   if (!Array.isArray(raw)) return []

//   const allElementConfigs = loadAllElementConfigs()

//   return raw.map((item: any) => {
//     const bpmnXml    = typeof item?.bpmnXml === 'string' ? item.bpmnXml : ''
//     const savedSteps = Array.isArray(item?.steps) ? item.steps : undefined
//     const steps      = savedSteps ?? (bpmnXml
//       ? buildStepsFromBpmn(bpmnXml, String(item?.id ?? ''), allElementConfigs)
//       : [])

//     return {
//       id:          String(item?.id ?? ''),
//       name:        String(item?.name ?? item?.title ?? 'Workflow sem nome'),
//       description: typeof item?.description === 'string' ? item.description : undefined,
//       processId:   typeof item?.processId === 'string' && item.processId ? item.processId : undefined,
//       processName: typeof item?.processName === 'string' ? item.processName : undefined,
//       version:     typeof item?.version === 'string' ? item.version : '1.0',
//       status:      (['draft', 'active', 'inactive', 'archived'] as const).includes(item?.status)
//         ? item.status : 'draft',
//       stepsCount:  typeof item?.stepsCount === 'number' ? item.stepsCount : steps?.length ?? 0,
//       updatedAt:   typeof item?.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
//       createdAt:   typeof item?.createdAt === 'string' ? item.createdAt : undefined,
//       permissions: item?.permissions ?? undefined,
//       steps:       steps.length > 0 ? steps : undefined,
//     }
//   })
// }

// export function findWorkflowByProcess(processId: string): StoredWorkflow | null {
//   return loadStoredWorkflows().find((w) => w.processId === processId) ?? null
// }

// export function findWorkflowById(id: string): StoredWorkflow | null {
//   return loadStoredWorkflows().find((w) => w.id === id) ?? null
// }