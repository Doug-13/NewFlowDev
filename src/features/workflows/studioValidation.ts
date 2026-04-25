import type {
  ActivityConfig,
  EndEventConfig,
  FlowConfig,
  GatewayConfig,
  NotificationEventConfig,
  StartEventConfig,
  SystemTaskConfig,
  WorkflowDefinition,
  WorkflowElementConfig,
  WorkflowValidationIssue,
} from './storage'
import { getStudioElementKind, type StudioElementKind } from './studioElementKinds'

export type BpmnElementSummary = {
  id: string
  type: string
  name?: string
  kind: StudioElementKind
  isConfigurable: boolean
  sourceId?: string
  targetId?: string
  sourceType?: string
  targetType?: string
}

export type WorkflowStudioValidation = {
  issues: WorkflowValidationIssue[]
  summary: {
    totalRelevantElements: number
    configuredRelevantElements: number
    errors: number
    warnings: number
    readinessPercent: number
  }
}

function issue(
  workflowId: string,
  severity: 'error' | 'warning',
  code: string,
  message: string,
  elementId?: string,
): WorkflowValidationIssue {
  return {
    id: `${workflowId}:${elementId || 'workflow'}:${code}`,
    workflowId,
    elementId,
    severity,
    code,
    message,
  }
}

function getConfigMap(elementConfigs: WorkflowElementConfig[]) {
  return new Map(elementConfigs.map((item) => [item.elementId, item]))
}

function hasAssignment(config: ActivityConfig) {
  return (
    config.responsibleUserIds.length > 0 ||
    config.responsibleRoleIds.length > 0 ||
    config.responsibleAreaIds.length > 0 ||
    config.responsibleFunctionIds.length > 0
  )
}

function hasAnyAction(config: ActivityConfig) {
  if (config.actions && config.actions.length > 0) return true

  return (
    config.allowApprove ||
    config.allowReject ||
    config.allowRequestChanges ||
    config.allowForward
  )
}

function isRelevantFlow(element: BpmnElementSummary) {
  if (element.kind !== 'flow') return false

  return (
    getStudioElementKind(element.sourceType) === 'gateway' ||
    getStudioElementKind(element.targetType) === 'gateway'
  )
}

function validateStartEvent(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'start') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'START_CONFIG_REQUIRED',
        `O evento inicial "${label}" precisa ser configurado.`,
        element.id,
      ),
    )
    return
  }

  const startConfig = config.config as StartEventConfig

  if (startConfig.initialMetadataDefinitionIds.length === 0) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'START_METADATA_RECOMMENDED',
        `O evento inicial "${label}" está sem metadados de abertura configurados.`,
        element.id,
      ),
    )
  }

  if (!startConfig.formTitle?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'START_FORM_TITLE_RECOMMENDED',
        `O evento inicial "${label}" está sem título do formulário inicial.`,
        element.id,
      ),
    )
  }
}

function validateActivity(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'activity') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'ACTIVITY_CONFIG_REQUIRED',
        `A atividade "${label}" precisa ser configurada.`,
        element.id,
      ),
    )
    return
  }

  const activityConfig = config.config as ActivityConfig

  if (!hasAssignment(activityConfig)) {
    issues.push(
      issue(
        workflow.id,
        'error',
        'ACTIVITY_ASSIGNMENT_REQUIRED',
        `A atividade "${label}" precisa ter responsável definido.`,
        element.id,
      ),
    )
  }

  if (
    activityConfig.deadlineValue === undefined ||
    activityConfig.deadlineValue === null ||
    `${activityConfig.deadlineValue}`.trim() === ''
  ) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'ACTIVITY_DEADLINE_RECOMMENDED',
        `A atividade "${label}" está sem prazo configurado.`,
        element.id,
      ),
    )
  }

  if (!hasAnyAction(activityConfig)) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'ACTIVITY_ACTION_RECOMMENDED',
        `A atividade "${label}" está sem ações habilitadas.`,
        element.id,
      ),
    )
  }

  if (!activityConfig.instructions?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'ACTIVITY_INSTRUCTIONS_RECOMMENDED',
        `A atividade "${label}" está sem instruções para o executor.`,
        element.id,
      ),
    )
  }
}

function validateSystemTask(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'system-task') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'SYSTEM_TASK_CONFIG_REQUIRED',
        `A tarefa de sistema "${label}" precisa ser configurada.`,
        element.id,
      ),
    )
    return
  }

  const taskConfig = config.config as SystemTaskConfig

  if (!taskConfig.actionType) {
    issues.push(
      issue(
        workflow.id,
        'error',
        'SYSTEM_TASK_ACTION_REQUIRED',
        `A tarefa de sistema "${label}" está sem tipo de ação definido.`,
        element.id,
      ),
    )
  }

  if (!taskConfig.auditNote?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'SYSTEM_TASK_AUDIT_NOTE_RECOMMENDED',
        `A tarefa de sistema "${label}" está sem nota de auditoria — recomendado para rastreabilidade.`,
        element.id,
      ),
    )
  }
}

function validateNotificationEvent(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'notification') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'NOTIFICATION_CONFIG_REQUIRED',
        `O evento de notificação "${label}" precisa ser configurado.`,
        element.id,
      ),
    )
    return
  }

  const notifConfig = config.config as NotificationEventConfig

  if (!notifConfig.notificationTemplateId?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'NOTIFICATION_TEMPLATE_RECOMMENDED',
        `O evento de notificação "${label}" está sem template definido.`,
        element.id,
      ),
    )
  }

  const hasRecipients =
    notifConfig.recipientRoleIds.length > 0 ||
    notifConfig.recipientUserIds.length > 0 ||
    notifConfig.recipientAreaIds.length > 0 ||
    notifConfig.notifyInitiator ||
    notifConfig.notifyPreviousAssignees

  if (!hasRecipients) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'NOTIFICATION_RECIPIENTS_RECOMMENDED',
        `O evento de notificação "${label}" está sem destinatários definidos.`,
        element.id,
      ),
    )
  }
}

function validateGateway(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'gateway') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'GATEWAY_CONFIG_REQUIRED',
        `O gateway "${label}" precisa ser configurado.`,
        element.id,
      ),
    )
    return
  }

  const gatewayConfig = config.config as GatewayConfig

  if (!gatewayConfig.decisionDescription?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'GATEWAY_DESCRIPTION_RECOMMENDED',
        `O gateway "${label}" está sem descrição da decisão.`,
        element.id,
      ),
    )
  }
}

function validateFlow(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'flow') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'FLOW_CONFIG_REQUIRED',
        `O fluxo/desvio "${label}" precisa ser configurado.`,
        element.id,
      ),
    )
    return
  }

  const flowConfig = config.config as FlowConfig

  if (!flowConfig.label?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'FLOW_LABEL_RECOMMENDED',
        `O fluxo "${label}" está sem nome do ramo.`,
        element.id,
      ),
    )
  }

  if (flowConfig.conditionType === 'expression' && !flowConfig.expression?.trim()) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'FLOW_EXPRESSION_REQUIRED',
        `O fluxo "${label}" foi marcado como expressão, mas está sem expressão preenchida.`,
        element.id,
      ),
    )
  }

  if (flowConfig.conditionType === 'metadata-value') {
    if (!flowConfig.metadataFieldId?.trim()) {
      issues.push(
        issue(
          workflow.id,
          'warning',
          'FLOW_METADATA_FIELD_REQUIRED',
          `O fluxo "${label}" foi marcado como valor de metadado, mas está sem campo configurado.`,
          element.id,
        ),
      )
    }

    if (!flowConfig.expectedValue?.trim()) {
      issues.push(
        issue(
          workflow.id,
          'warning',
          'FLOW_EXPECTED_VALUE_REQUIRED',
          `O fluxo "${label}" foi marcado como valor de metadado, mas está sem valor esperado.`,
          element.id,
        ),
      )
    }
  }
}

function validateEndEvent(
  workflow: WorkflowDefinition,
  element: BpmnElementSummary,
  config: WorkflowElementConfig | undefined,
  issues: WorkflowValidationIssue[],
) {
  const label = element.name || element.id

  if (!config || config.kind !== 'end') {
    issues.push(
      issue(
        workflow.id,
        'error',
        'END_CONFIG_REQUIRED',
        `O evento final "${label}" precisa ser configurado.`,
        element.id,
      ),
    )
    return
  }

  const endConfig = config.config as EndEventConfig

  if (endConfig.finalMetadataDefinitionIds.length === 0) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'END_METADATA_RECOMMENDED',
        `O evento final "${label}" está sem metadados finais configurados.`,
        element.id,
      ),
    )
  }

  if (endConfig.summarySections.length === 0) {
    issues.push(
      issue(
        workflow.id,
        'warning',
        'END_SUMMARY_RECOMMENDED',
        `O evento final "${label}" está sem seções de resumo configuradas.`,
        element.id,
      ),
    )
  }

  if (
    endConfig.finalAction === 'open-linked-workflow' &&
    !endConfig.linkedWorkflowId?.trim()
  ) {
    issues.push(
      issue(
        workflow.id,
        'error',
        'END_LINKED_WORKFLOW_REQUIRED',
        `O evento final "${label}" exige um workflow vinculado.`,
        element.id,
      ),
    )
  }
}

export function validateWorkflowStudio(
  workflow: WorkflowDefinition,
  elements: BpmnElementSummary[],
  elementConfigs: WorkflowElementConfig[],
): WorkflowStudioValidation {
  const issues: WorkflowValidationIssue[] = []
  const configMap = getConfigMap(elementConfigs)

  const startEvents = elements.filter((e) => e.kind === 'start')
  const activities = elements.filter((e) => e.kind === 'activity')
  const systemTasks = elements.filter((e) => e.kind === 'system-task')
  const notifications = elements.filter((e) => e.kind === 'notification')
  const gateways = elements.filter((e) => e.kind === 'gateway')
  const relevantFlows = elements.filter(isRelevantFlow)
  const endEvents = elements.filter((e) => e.kind === 'end')

  const relevantElements = [
    ...startEvents,
    ...activities,
    ...systemTasks,
    ...notifications,
    ...gateways,
    ...relevantFlows,
    ...endEvents,
  ]

  if (!workflow.name.trim()) {
    issues.push(
      issue(workflow.id, 'error', 'WORKFLOW_NAME_REQUIRED', 'Informe o nome do workflow.'),
    )
  }

  if (startEvents.length === 0) {
    issues.push(
      issue(
        workflow.id,
        'error',
        'START_EVENT_REQUIRED',
        'O fluxo precisa ter pelo menos um evento de início.',
      ),
    )
  }

  if (endEvents.length === 0) {
    issues.push(
      issue(
        workflow.id,
        'error',
        'END_EVENT_REQUIRED',
        'O fluxo precisa ter pelo menos um evento de fim.',
      ),
    )
  }

  relevantElements.forEach((element) => {
    const config = configMap.get(element.id)

    switch (element.kind) {
      case 'start':
        validateStartEvent(workflow, element, config, issues)
        break
      case 'activity':
        validateActivity(workflow, element, config, issues)
        break
      case 'system-task':
        validateSystemTask(workflow, element, config, issues)
        break
      case 'notification':
        validateNotificationEvent(workflow, element, config, issues)
        break
      case 'gateway':
        validateGateway(workflow, element, config, issues)
        break
      case 'flow':
        validateFlow(workflow, element, config, issues)
        break
      case 'end':
        validateEndEvent(workflow, element, config, issues)
        break
      default:
        break
    }
  })

  const configuredRelevantElements = relevantElements.filter((element) =>
    configMap.has(element.id),
  ).length

  const errors = issues.filter((item) => item.severity === 'error').length
  const warnings = issues.filter((item) => item.severity === 'warning').length

  const readinessPercent =
    relevantElements.length > 0
      ? Math.round((configuredRelevantElements / relevantElements.length) * 100)
      : 0

  return {
    issues,
    summary: {
      totalRelevantElements: relevantElements.length,
      configuredRelevantElements,
      errors,
      warnings,
      readinessPercent,
    },
  }
}