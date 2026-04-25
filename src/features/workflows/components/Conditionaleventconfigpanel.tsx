import { useEffect } from 'react'
import {
  Alert, Button, Card, Empty, Form, Input, Radio, Select, Space, Typography,
} from 'antd'
import { BranchesOutlined, HistoryOutlined } from '@ant-design/icons'
import type { WorkflowElementConfig } from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConditionalEventConfig = {
  actionType: 'increment-revision'
  /** Se true, cria novo documentInstance (revisão separada). Se false, atualiza inline. */
  createNewInstance: boolean
  auditNote?: string
}

type FormValues = ConditionalEventConfig

type Props = {
  workflowId: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

const DEFAULT: FormValues = {
  actionType:        'increment-revision',
  createNewInstance: true,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 12, display: 'block',
}

// ─── Component ────────────────────────────────────────────────────────────────

  export function ConditionalEventConfigPanel({ workflowId, selectedElement, initialConfig, onSave }: Props) {
    const [form] = Form.useForm<FormValues>()

    useEffect(() => {
      if (!selectedElement) return
      const saved = initialConfig?.kind === 'conditional'
        ? (initialConfig.config as ConditionalEventConfig)
        : null
      form.setFieldsValue(saved ? { ...DEFAULT, ...saved } : DEFAULT)
    }, [form, initialConfig, selectedElement])

    if (!selectedElement) return <Card variant="borderless"><Empty description="Selecione um evento no fluxo" /></Card>

    const handleSubmit = (values: FormValues) => {
      onSave({
        workflowId,
        elementId:   selectedElement.id,
        elementType: selectedElement.type,
        elementName: selectedElement.name,
        kind: 'conditional',
        config: values satisfies ConditionalEventConfig,
      })
    }

  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit} initialValues={DEFAULT}>
      <Card
        variant="borderless"
        style={{ borderRadius: 18 }}
        title={<Space><BranchesOutlined style={{ color: '#52c41a' }} /><span>Evento Condicional</span></Space>}
        bodyStyle={{ padding: 0 }}
      >
        <Alert
          type="success" showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message={selectedElement.name || 'Evento Condicional'}
          description="Executado automaticamente pelo motor ao chegar neste ponto do fluxo — sem interação humana. Cria uma nova revisão do documento e reinicia o fluxo desde o início."
        />

        <div style={{ padding: '20px 24px 16px' }}>

          {/* Tipo de ação — fixo em increment-revision, mas extensível no futuro */}
          <Text style={sectionLabel}>Ação do evento</Text>
          <Form.Item name="actionType" label="Tipo de ação" style={{ marginBottom: 20 }}>
            <Select
              options={[
                {
                  value: 'increment-revision',
                  label: (
                    <Space>
                      <HistoryOutlined style={{ color: '#52c41a' }} />
                      <span>Incrementar revisão</span>
                    </Space>
                  ),
                },
              ]}
              disabled
            />
          </Form.Item>

          {/* Modo de criação */}
          <Text style={sectionLabel}>Comportamento da revisão</Text>
          <Form.Item
            name="createNewInstance"
            label="Como criar a revisão"
            style={{ marginBottom: 20 }}
          >
            <Radio.Group>
              <Space direction="vertical" size={12}>
                <Radio value={true}>
                  <div>
                    <Text strong>Nova instância de documento</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Cria um novo documento com código próprio (ex: DOC-2026-0006 Rev 02).
                      O documento original é preservado com seus dados históricos.
                    </Text>
                  </div>
                </Radio>
                <Radio value={false}>
                  <div>
                    <Text strong>Atualizar revisão inline</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Apenas incrementa o campo de revisão no documento atual,
                      sem criar nova instância.
                    </Text>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* Nota de auditoria */}
          <Text style={sectionLabel}>Rastreabilidade</Text>
          <Form.Item
            name="auditNote"
            label="Nota de auditoria"
            tooltip="Texto registrado no histórico quando a revisão é gerada."
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              rows={3}
              placeholder="Ex.: Revisão gerada após aprovação do ciclo de análise."
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Alert
            type="info" showIcon style={{ borderRadius: 8, marginTop: 16 }}
            message="Revisão automática"
            description={
              <>
                O padrão de revisão (numérico, alfabético, alfanumérico) e o valor inicial
                são definidos nas <strong>Configurações do processo</strong>.
                A nova revisão começa na primeira etapa do fluxo.
              </>
            }
          />
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" htmlType="submit" style={{ borderRadius: 8, background: '#0f172a', borderColor: '#0f172a', fontWeight: 600, paddingLeft: 28, paddingRight: 28 }}>
            Salvar evento
          </Button>
        </div>
      </Card>
    </Form>
  )
}
