import { useEffect, useMemo } from 'react'
import {
  Alert,
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { ArrowRightOutlined, BranchesOutlined } from '@ant-design/icons'

import type {
  ActivityAction,
  ActivityConfig,
  GatewayConfig,
  WorkflowElementConfig,
} from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'
import {
  findUpstreamActivityId,
  getOutgoingFlows,
  parseBpmnGraph,
  type BpmnEdge,
} from '../bpmnGraphUtils'

const { Text, Title } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionRoute = {
  actionId: string
  actionLabel: string
  sequenceFlowId?: string
}

export type GatewayConfigWithRoutes = GatewayConfig & {
  actionRoutes?: ActionRoute[]
}

type GatewayConfigPanelProps = {
  workflowId: string
  bpmnXml: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  elementConfigs: WorkflowElementConfig[]
  onSave: (values: ElementConfigSavePayload) => void
}

type FormValues = {
  decisionMode: 'manual' | 'metadata-rule' | 'expression'
  decisionDescription?: string
  decisionFieldId?: string
  notificationTemplateIds: string[]
  instructions?: string
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function routeKey(actionId: string) {
  return `route_${actionId}`
}

function flowLabel(flow: BpmnEdge, targetName?: string): string {
  if (flow.name?.trim()) return flow.name
  if (targetName?.trim()) return `→ ${targetName}`
  return flow.targetRef
}

function resolveActions(cfg: ActivityConfig): ActivityAction[] {
  const dynamic = (cfg as any).actions as ActivityAction[] | undefined
  if (dynamic && dynamic.length > 0) return dynamic

  const fallback: ActivityAction[] = []
  if (cfg.allowApprove)        fallback.push({ id: 'legacy-approve',          label: 'Aprovar',          color: 'green',  outcome: 'approve',          requiresComment: false })
  if (cfg.allowReject)         fallback.push({ id: 'legacy-reject',           label: 'Reprovar',         color: 'red',    outcome: 'reject',           requiresComment: true  })
  if (cfg.allowRequestChanges) fallback.push({ id: 'legacy-request-changes',  label: 'Solicitar revisão',color: 'orange', outcome: 'request-changes',  requiresComment: true  })
  if (cfg.allowForward)        fallback.push({ id: 'legacy-forward',          label: 'Encaminhar',       color: 'blue',   outcome: 'forward',          requiresComment: false })
  return fallback
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GatewayConfigPanel({
  workflowId,
  bpmnXml,
  selectedElement,
  initialConfig,
  elementConfigs,
  onSave,
}: GatewayConfigPanelProps) {
  const [form] = Form.useForm<FormValues>()

  const graph = useMemo(() => parseBpmnGraph(bpmnXml), [bpmnXml])

  const upstreamActivity = useMemo<ActivityConfig | null>(() => {
    if (!selectedElement) return null
    const upstreamId = findUpstreamActivityId(graph, selectedElement.id)
    if (!upstreamId) return null
    const cfg = elementConfigs.find((c) => c.elementId === upstreamId && c.kind === 'activity')
    return cfg ? (cfg.config as ActivityConfig) : null
  }, [graph, selectedElement, elementConfigs])

  const actions = useMemo<ActivityAction[]>(
    () => (upstreamActivity ? resolveActions(upstreamActivity) : []),
    [upstreamActivity],
  )

  const outgoingFlows = useMemo<BpmnEdge[]>(() => {
    if (!selectedElement) return []
    return getOutgoingFlows(graph, selectedElement.id)
  }, [graph, selectedElement])

  const flowOptions = useMemo(() =>
    outgoingFlows.map((flow) => {
      const targetNode = graph.nodes.find((n) => n.id === flow.targetRef)
      const targetCfg  = elementConfigs.find((c) => c.elementId === flow.targetRef)
      const targetName = targetCfg?.elementName ?? targetNode?.name ?? undefined
      return {
        value: flow.id,
        label: targetName
          ? `${flowLabel(flow, targetName)} (${targetName})`
          : flowLabel(flow, targetName),
      }
    }),
    [outgoingFlows, graph.nodes, elementConfigs],
  )

  useEffect(() => {
    if (!selectedElement) return

    const saved =
      initialConfig?.kind === 'gateway'
        ? (initialConfig.config as GatewayConfigWithRoutes)
        : null

    const routeValues: Record<string, string | undefined> = {}
    if (saved?.actionRoutes) {
      for (const r of saved.actionRoutes) {
        routeValues[routeKey(r.actionId)] = r.sequenceFlowId
      }
    }

    form.setFieldsValue({
      decisionMode:            saved?.decisionMode            ?? 'manual',
      decisionDescription:     saved?.decisionDescription,
      decisionFieldId:         saved?.decisionFieldId,
      notificationTemplateIds: saved?.notificationTemplateIds ?? [],
      instructions:            saved?.instructions,
      ...routeValues,
    })
  }, [form, initialConfig, selectedElement])

  if (!selectedElement) {
    return <Card variant="borderless" style={{ borderRadius: 18 }}><Empty description="Selecione um gateway" /></Card>
  }
  if (selectedElement.kind !== 'gateway') {
    return <Card variant="borderless" style={{ borderRadius: 18 }}><Empty description="Selecione um gateway" /></Card>
  }

  const handleSubmit = (values: FormValues) => {
    const actionRoutes: ActionRoute[] = actions.map((action) => ({
      actionId:       action.id,
      actionLabel:    action.label,
      sequenceFlowId: values[routeKey(action.id)] as string | undefined,
    }))

    const config: GatewayConfigWithRoutes = {
      decisionMode:            values.decisionMode,
      decisionDescription:     values.decisionDescription,
      decisionFieldId:         values.decisionFieldId,
      notificationTemplateIds: values.notificationTemplateIds ?? [],
      instructions:            values.instructions,
      actionRoutes:            actionRoutes.length > 0 ? actionRoutes : undefined,
    }

    onSave({
      workflowId,
      elementId:   selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'gateway',
      config,
    })
  }

  return (
    <Card variant="borderless" style={{ borderRadius: 18 }} title="Configuração do gateway">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={selectedElement.name || 'Gateway'}
        description="Use o gateway para definir a lógica de decisão. As saídas específicas devem ser detalhadas nos fluxos de sequência."
      />

      <Form<FormValues>
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ decisionMode: 'manual', notificationTemplateIds: [] }}
      >
        <Form.Item label="Modo de decisão" name="decisionMode">
          <Select options={[
            { label: 'Manual (executor decide)', value: 'manual' },
            { label: 'Regra por metadado',        value: 'metadata-rule' },
            { label: 'Expressão',                 value: 'expression' },
          ]} />
        </Form.Item>

        <Form.Item label="Descrição da decisão" name="decisionDescription">
          <Input.TextArea rows={3} placeholder="Ex.: Documento aprovado pela gerência?" />
        </Form.Item>

        <Form.Item label="Campo base da decisão" name="decisionFieldId">
          <Input placeholder="Ex.: statusAprovacao, valorContrato" />
        </Form.Item>

        <Form.Item label="Templates de notificação" name="notificationTemplateIds">
          <Select mode="tags" placeholder="Ex.: notif-decisao, notif-gateway" />
        </Form.Item>

        <Form.Item label="Instruções" name="instructions">
          <Input.TextArea rows={3} placeholder="Explique como essa decisão deve ser interpretada" />
        </Form.Item>

        {actions.length > 0 && (
          <>
            <Divider />
            <Space style={{ marginBottom: 12 }}>
              <BranchesOutlined style={{ color: '#1677ff', fontSize: 16 }} />
              <Title level={5} style={{ margin: 0 }}>Roteamento por ação</Title>
            </Space>

            <Alert
              type="success" showIcon style={{ marginBottom: 16 }}
              title={`${actions.length} ação(ões) configurada(s) na atividade anterior`}
              description="Defina para qual caminho de saída cada ação deve encaminhar o processo."
            />

            {outgoingFlows.length === 0 && (
              <Alert type="warning" showIcon style={{ marginBottom: 16 }}
                title="Sem caminhos de saída"
                description="Conecte este gateway a outros elementos no diagrama para que os caminhos apareçam aqui."
              />
            )}

            {actions.map((action) => (
              <Form.Item
                key={action.id}
                name={routeKey(action.id)}
                label={
                  <Space size={6}>
                    <Tag color={action.color}>{action.label}</Tag>
                    <ArrowRightOutlined style={{ color: '#8c8c8c' }} />
                    <Text type="secondary">encaminhar para</Text>
                  </Space>
                }
              >
                <Select
                  allowClear
                  disabled={outgoingFlows.length === 0}
                  placeholder={outgoingFlows.length === 0 ? 'Nenhum caminho disponível' : 'Selecione o caminho de saída'}
                  options={flowOptions}
                />
              </Form.Item>
            ))}
          </>
        )}

        {upstreamActivity === null && (
          <>
            <Divider />
            <Alert type="info" showIcon
              title="Atividade anterior não configurada"
              description="Configure a atividade que precede este gateway para que o roteamento por ação apareça aqui."
            />
          </>
        )}

        {upstreamActivity !== null && actions.length === 0 && (
          <>
            <Divider />
            <Alert type="warning" showIcon
              title="Nenhuma ação cadastrada na atividade anterior"
              description="Adicione ações na atividade que precede este gateway para configurar o roteamento."
            />
          </>
        )}

        <Button type="primary" htmlType="submit" block style={{ marginTop: 16 }}>
          Salvar configuração do gateway
        </Button>
      </Form>
    </Card>
  )
}