import { Card, Empty, Typography } from 'antd'

import type { WorkflowActivityConfig, WorkflowElementConfig, WorkflowScopedBase } from '../storage'
import type { BpmnElementSummary } from '../studioValidation'

import { ActivityConfigPanel } from './ActivityConfigPanel'
import { ConditionalEventConfigPanel } from './Conditionaleventconfigpanel'
import { EndEventConfigPanel } from './EndEventConfigPanel'
import { FlowConfigPanel } from './FlowConfigPanel'
import { GatewayConfigPanel } from './GatewayConfigPanel'
import { MessageEventConfigPanel } from './Messageeventconfigpanel'
import { NotificationEventConfigPanel } from './Notificationeventconfigpanel'
import { SignalEventConfigPanel } from './Signaleventconfigpanel'
import { StartEventConfigPanel } from './StartEventConfigPanel'
import { SubProcessConfigPanel } from './SubProcessConfigPanel'
import { SystemTaskConfigPanel } from './Systemtaskconfigpanel'
import { TimerEventConfigPanel } from './Timereventconfigpanel'

const { Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkflowElementConfigPanelProps = {
  workflowId: string
  bpmnXml: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  elementConfigs: WorkflowElementConfig[]
  scopeContext: Pick<
    WorkflowScopedBase,
    'accountId' | 'scopeLevel' | 'accountName' | 'processId' | 'processName' | 'tenantId'
  >
  onSave: (
    values: Omit<WorkflowElementConfig, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toActivityConfig(cfg: WorkflowElementConfig): WorkflowActivityConfig {
  return {
    id: cfg.id,
    workflowId: cfg.workflowId,
    elementId: cfg.elementId,
    elementType: cfg.elementType,
    elementName: cfg.elementName,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
    accountId: cfg.accountId,
    accountName: cfg.accountName,
    scopeLevel: cfg.scopeLevel,
    processId: cfg.processId,
    processName: cfg.processName,
    tenantId: cfg.tenantId,
    ...(cfg.config as object),
  } as WorkflowActivityConfig
}

function resolveActivityPanel(
  kind: string,
  elementType: string,
): 'subprocess' | 'default' {
  if (kind === 'subprocess') return 'subprocess'

  if (
    elementType === 'bpmn:SubProcess' ||
    elementType === 'bpmn:CallActivity'
  ) {
    return 'subprocess'
  }

  return 'default'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkflowElementConfigPanel({
  workflowId,
  bpmnXml,
  selectedElement,
  initialConfig,
  elementConfigs,
  scopeContext,
  onSave,
}: WorkflowElementConfigPanelProps) {

  // Injeta o escopo completo em qualquer payload salvo pelos painéis filhos
  const onSaveWithScope = (
    values: Omit<WorkflowElementConfig, 'id' | 'createdAt' | 'updatedAt' | 'accountId' | 'scopeLevel' | 'accountName' | 'processId' | 'processName' | 'tenantId'>
      & Partial<Pick<WorkflowElementConfig, 'accountId' | 'scopeLevel' | 'accountName' | 'processId' | 'processName' | 'tenantId'>>,
  ) => {
    onSave({
      accountId: scopeContext.accountId,
      accountName: scopeContext.accountName,
      scopeLevel: scopeContext.scopeLevel,
      processId: scopeContext.processId ?? null,
      processName: scopeContext.processName ?? null,
      tenantId: scopeContext.tenantId ?? scopeContext.accountId,
      ...values,
    } as Omit<WorkflowElementConfig, 'id' | 'createdAt' | 'updatedAt'>)
  }

  // ── Nenhum elemento selecionado ───────────────────────────────────────────
  if (!selectedElement) {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty
          description={
            <Text type="secondary">
              Clique em um elemento do diagrama para configurá-lo
            </Text>
          }
        />
      </Card>
    )
  }

  // ── Elemento não configurável ─────────────────────────────────────────────
  if (!selectedElement.isConfigurable) {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty
          description={
            <Text type="secondary">
              Este tipo de elemento não possui configuração
            </Text>
          }
        />
      </Card>
    )
  }

  // ── Roteamento por kind ───────────────────────────────────────────────────
  switch (selectedElement.kind) {

    // ── Evento de início ────────────────────────────────────────────────────
    case 'start':
      return (
        <StartEventConfigPanel
          workflowId={workflowId}
          scopeContext={scopeContext}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Evento de fim ────────────────────────────────────────────────────────
    case 'end':
      return (
        <EndEventConfigPanel
          workflowId={workflowId}
          scopeContext={scopeContext}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Notificação (legado — NotificationEvent do Workflow Studio antigo) ──
    case 'notification':
      return (
        <NotificationEventConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Tarefa de sistema ────────────────────────────────────────────────────
    case 'system-task':
      return (
        <SystemTaskConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Message Intermediate Catch Event — notificações ─────────────────────
    // bpmn:IntermediateCatchEvent com bpmn:MessageEventDefinition
    case 'message':
      return (
        <MessageEventConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Timer Intermediate Catch Event — evento temporal ─────────────────────
    // bpmn:IntermediateCatchEvent com bpmn:TimerEventDefinition
    case 'timer':
      return (
        <TimerEventConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Signal Intermediate Throw Event — sinal para outro fluxo ────────────
    // bpmn:IntermediateThrowEvent com bpmn:SignalEventDefinition
    case 'signal':
      return (
        <SignalEventConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Conditional Intermediate Catch Event — criar revisão ─────────────────
    // bpmn:IntermediateCatchEvent com bpmn:ConditionalEventDefinition
    case 'conditional':
      return (
        <ConditionalEventConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Subprocesso / Call Activity ──────────────────────────────────────────
    case 'subprocess':
      return (
        <SubProcessConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          workflowElementConfigs={elementConfigs}
          currentProcessId={scopeContext.processId}
          currentProcessName={scopeContext.processName}
          onSave={(values) =>
            onSaveWithScope({
              ...values,
              kind: 'subprocess',
            })
          }
        />
      )

    // ── Atividade humana ─────────────────────────────────────────────────────
    case 'activity': {
      const panel = resolveActivityPanel(selectedElement.kind, selectedElement.type)

      if (panel === 'subprocess') {
        return (
          <SubProcessConfigPanel
            workflowId={workflowId}
            selectedElement={selectedElement}
            initialConfig={initialConfig}
            workflowElementConfigs={elementConfigs}
            currentProcessId={scopeContext.processId}
            currentProcessName={scopeContext.processName}
            onSave={(values) =>
              onSaveWithScope({
                ...values,
                kind: 'subprocess',
              })
            }
          />
        )
      }

      const activityConfig =
        initialConfig?.kind === 'activity' ? toActivityConfig(initialConfig) : null

      return (
        <ActivityConfigPanel
          workflowId={workflowId}
          scopeContext={scopeContext}
          selectedElement={selectedElement}
          initialConfig={activityConfig}
          onSave={(activityValues) =>
            onSaveWithScope({
              ...activityValues,
              kind: 'activity',
            })
          }
        />
      )
    }
    // ── Gateway ───────────────────────────────────────────────────────────────
    case 'gateway':
      return (
        <GatewayConfigPanel
          workflowId={workflowId}
          bpmnXml={bpmnXml}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          elementConfigs={elementConfigs}
          onSave={onSaveWithScope}
        />
      )

    // ── Fluxo de sequência ────────────────────────────────────────────────────
    case 'flow':
      return (
        <FlowConfigPanel
          workflowId={workflowId}
          selectedElement={selectedElement}
          initialConfig={initialConfig}
          onSave={onSaveWithScope}
        />
      )

    // ── Elemento não reconhecido ──────────────────────────────────────────────
    default:
      return (
        <Card variant="borderless" style={{ borderRadius: 18 }}>
          <Empty
            description={
              <Text type="secondary">
                Elemento não reconhecido: <code>{selectedElement.kind}</code>
              </Text>
            }
          />
        </Card>
      )
  }
}