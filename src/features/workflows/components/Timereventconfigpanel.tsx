import { useEffect, useMemo } from 'react'
import {
  Alert, Button, Card, Empty, Form, Input, InputNumber, Select, Space, Typography,
} from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getMetadataDefinitions } from '../../../api/metadataDefinitions'
import type { WorkflowElementConfig } from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimerEventConfig = {
  timerType: 'fixed-delay' | 'fixed-date' | 'metadata-date'
  delayUnit?: 'minutes' | 'hours' | 'days'
  delayValue?: number
  fixedDate?: string
  metadataDefinitionId?: string
  metadataOffsetDays?: number   // ex: -2 = 2 dias antes da data do metadado
  auditNote?: string
}

type FormValues = TimerEventConfig

type Props = {
  workflowId: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

const DEFAULT: FormValues = {
  timerType:   'fixed-delay',
  delayUnit:   'days',
  delayValue:  1,
}

const tabPaneStyle: React.CSSProperties = { padding: '20px 24px 16px' }
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 12, display: 'block',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimerEventConfigPanel({ workflowId, selectedElement, initialConfig, onSave }: Props) {
  const [form] = Form.useForm<FormValues>()
  const timerType = Form.useWatch('timerType', form)

  const { data: metadataDefinitions = [] } = useQuery({
    queryKey: ['metadata-definitions'],
    queryFn: () => getMetadataDefinitions(),
  })

  const dateMetadataOptions = useMemo(() =>
    (metadataDefinitions as any[])
      .filter((d: any) => d.fieldType === 'date' || d.fieldType === 'datetime')
      .map((d: any) => ({ value: d.id, label: `${d.label} (${d.name})` })),
    [metadataDefinitions])

  useEffect(() => {
    if (!selectedElement) return
    const saved = initialConfig?.kind === 'timer'
      ? (initialConfig.config as TimerEventConfig)
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
      kind: 'timer',
      config: values satisfies TimerEventConfig,
    })
  }

  const timerTypeOptions = [
    { value: 'fixed-delay',    label: 'Atraso fixo (esperar N horas/dias)' },
    { value: 'fixed-date',     label: 'Data específica'                    },
    { value: 'metadata-date',  label: 'Baseado em metadado de data'        },
  ]

  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit} initialValues={DEFAULT}>
      <Card
        variant="borderless"
        style={{ borderRadius: 18 }}
        title={<Space><ClockCircleOutlined style={{ color: '#faad14' }} /><span>Evento Temporal</span></Space>}
        bodyStyle={{ padding: 0 }}
      >
        <Alert
          type="warning" showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message={selectedElement.name || 'Evento Temporal'}
          description="O motor aguarda o tempo configurado antes de avançar automaticamente para a próxima etapa. Nenhuma ação humana é necessária."
        />

        <div style={tabPaneStyle}>
          <Text style={sectionLabel}>Tipo de temporizador</Text>
          <Form.Item name="timerType" label="Como o timer é definido" rules={[{ required: true }]} style={{ marginBottom: 24 }}>
            <Select options={timerTypeOptions} />
          </Form.Item>

          {/* Atraso fixo */}
          {timerType === 'fixed-delay' && (
            <>
              <Text style={sectionLabel}>Duração do atraso</Text>
              <Space.Compact style={{ width: '100%', marginBottom: 24 }}>
                <Form.Item name="delayValue" noStyle rules={[{ required: true, message: 'Informe o valor' }]}>
                  <InputNumber min={1} style={{ width: '60%' }} placeholder="Ex.: 2" />
                </Form.Item>
                <Form.Item name="delayUnit" noStyle rules={[{ required: true }]}>
                  <Select style={{ width: '40%' }} options={[
                    { value: 'minutes', label: 'Minutos' },
                    { value: 'hours',   label: 'Horas'   },
                    { value: 'days',    label: 'Dias'    },
                  ]} />
                </Form.Item>
              </Space.Compact>
            </>
          )}

          {/* Data fixa */}
          {timerType === 'fixed-date' && (
            <>
              <Text style={sectionLabel}>Data e hora</Text>
              <Form.Item name="fixedDate" label="Data específica (AAAA-MM-DD HH:mm)" rules={[{ required: true, message: 'Informe a data' }]} style={{ marginBottom: 24 }}>
                <Input placeholder="Ex.: 2026-12-31 09:00" />
              </Form.Item>
            </>
          )}

          {/* Baseado em metadado */}
          {timerType === 'metadata-date' && (
            <>
              <Text style={sectionLabel}>Metadado de data</Text>
              <Form.Item name="metadataDefinitionId" label="Campo de data" rules={[{ required: true, message: 'Selecione o metadado' }]} style={{ marginBottom: 16 }}>
                <Select
                  allowClear showSearch placeholder="Selecione um metadado do tipo data..."
                  options={dateMetadataOptions}
                  filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum metadado de data encontrado" />}
                />
              </Form.Item>
              <Form.Item
                name="metadataOffsetDays"
                label="Deslocamento em dias (negativo = antes da data)"
                extra="Ex.: -2 = disparar 2 dias antes da data do campo. 0 = na data exata."
                style={{ marginBottom: 0 }}
              >
                <InputNumber style={{ width: '100%' }} placeholder="Ex.: -2, 0, 1" />
              </Form.Item>
            </>
          )}

          <Alert
            type="success" showIcon style={{ borderRadius: 8, marginTop: 8 }}
            message="Execução automática"
            description="Após o tempo configurado, o motor avança o fluxo automaticamente para a próxima etapa sem interação humana."
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