// ─── StudioElementKind ────────────────────────────────────────────────────────

export type StudioElementKind =
  | 'start'
  | 'activity'
  | 'subprocess'
  | 'system-task'
  | 'gateway'
  | 'flow'
  | 'end'
  | 'notification'
  | 'message'
  | 'timer'
  | 'signal'
  | 'conditional'
  | 'unsupported'

// ─── Mapa: eventDefinition.$type → StudioElementKind ─────────────────────────

const EVENT_DEFINITION_KIND: Record<string, StudioElementKind> = {
  'bpmn:MessageEventDefinition': 'message',
  'bpmn:TimerEventDefinition': 'timer',
  'bpmn:SignalEventDefinition': 'signal',
  'bpmn:ConditionalEventDefinition': 'conditional',
}

// ─── getStudioElementKind ─────────────────────────────────────────────────────
// Resolve o kind do elemento a partir do type BPMN e, opcionalmente,
// do tipo da eventDefinition (para eventos intermediários).
//
// Uso:
//   getStudioElementKind(element.type)
//     → 'notification' (fallback para IntermediateCatchEvent sem eventDef)
//
//   getStudioElementKind(
//     element.type,
//     element.businessObject?.eventDefinitions?.[0]?.$type
//   )
//     → 'message' | 'timer' | 'signal' | 'conditional'

export function getStudioElementKind(
  type?: string,
  eventDefinitionType?: string,
): StudioElementKind {
  switch (type) {
    case 'bpmn:StartEvent':
      return 'start'

    case 'bpmn:Task':
    case 'bpmn:UserTask':
    case 'bpmn:ManualTask':
    case 'bpmn:BusinessRuleTask':
    case 'bpmn:ReceiveTask':
      return 'activity'

    case 'bpmn:CallActivity':
    case 'bpmn:SubProcess':
      return 'subprocess'

    // ScriptTask → system-task (executado pelo motor, sem interação humana)
    case 'bpmn:ScriptTask':
    case 'bpmn:ServiceTask':
      return 'system-task'

    // SendTask → sempre notificação (envia mensagem)
    case 'bpmn:SendTask':
      return 'notification'

    // Eventos intermediários — diferenciados pela eventDefinition
    case 'bpmn:IntermediateCatchEvent':
    case 'bpmn:IntermediateThrowEvent': {
      if (eventDefinitionType && EVENT_DEFINITION_KIND[eventDefinitionType]) {
        return EVENT_DEFINITION_KIND[eventDefinitionType]
      }
      // Sem eventDefinition específica → notificação (comportamento legado)
      return 'notification'
    }

    case 'bpmn:ExclusiveGateway':
    case 'bpmn:InclusiveGateway':
    case 'bpmn:ParallelGateway':
    case 'bpmn:EventBasedGateway':
    case 'bpmn:ComplexGateway':
      return 'gateway'

    case 'bpmn:SequenceFlow':
      return 'flow'

    case 'bpmn:EndEvent':
      return 'end'

    default:
      return 'unsupported'
  }
}

// ─── isConfigurableBpmnElement ────────────────────────────────────────────────

export function isConfigurableBpmnElement(
  type?: string,
  eventDefinitionType?: string,
): boolean {
  return getStudioElementKind(type, eventDefinitionType) !== 'unsupported'
}

// ─── Labels para UI ───────────────────────────────────────────────────────────

export const STUDIO_KIND_LABELS: Record<StudioElementKind, string> = {
  start: 'Evento de início',
  activity: 'Atividade',
  subprocess: 'Subprocesso',
  'system-task': 'Tarefa de sistema',
  gateway: 'Gateway',
  flow: 'Fluxo de sequência',
  end: 'Evento de fim',
  notification: 'Notificação',
  message: 'Evento de Mensagem',
  timer: 'Evento Temporal',
  signal: 'Evento de Sinal',
  conditional: 'Evento Condicional',
  unsupported: 'Não suportado',
}