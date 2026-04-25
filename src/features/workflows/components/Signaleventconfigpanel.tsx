import { useEffect, useMemo } from 'react'
import {
  Alert, Button, Card, Empty, Form, Select, Space, Tag, Typography,
} from 'antd'
import { ApartmentOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getProcesses, type Process } from '../../../api/processos'
import type { WorkflowElementConfig } from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'
import { useAuthStore } from '../../../store/authStore'

const { Text } = Typography

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalEventConfig = {
  targetProcessId:   string
  targetProcessName?: string
  relationDirection: 'parent-to-child' | 'child-to-parent'
  targetAction:      string
  targetActionLabel?: string
  auditNote?:        string
}

type FormValues = SignalEventConfig

type Props = {
  workflowId:      string
  selectedElement: BpmnElementSummary | null
  initialConfig:   WorkflowElementConfig | null
  onSave:          (values: ElementConfigSavePayload) => void
}

const DEFAULT: Partial<FormValues> = {
  relationDirection: 'parent-to-child',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 12, display: 'block',
}

const COMMON_ACTIONS = [
  { value: 'submit',  label: 'Submeter'            },
  { value: 'approve', label: 'Aprovar'              },
  { value: 'reject',  label: 'Reprovar'             },
  { value: 'return',  label: 'Devolver para ajuste' },
  { value: 'publish', label: 'Publicar'             },
  { value: 'cancel',  label: 'Cancelar'             },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function SignalEventConfigPanel({ workflowId, selectedElement, initialConfig, onSave }: Props) {
  const [form]    = Form.useForm<FormValues>()
  const user      = useAuthStore((s) => s.user)
  const accountId = (user as any)?.accountId ?? (user as any)?.tenantId ?? ''

  const { data: processes = [] } = useQuery<Process[]>({
    queryKey: ['processes', accountId],
    queryFn:  () => getProcesses(accountId),
    enabled:  !!accountId,
  })

  const processOptions = useMemo(() =>
    processes
      .filter((p) => p.isActive)
      .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
    [processes])

  useEffect(() => {
    if (!selectedElement) return
    const saved = initialConfig?.kind === 'signal'
      ? (initialConfig.config as SignalEventConfig)
      : null
    form.setFieldsValue(saved ? { ...DEFAULT, ...saved } : { ...DEFAULT })
  }, [form, initialConfig, selectedElement])

  if (!selectedElement) return <Card variant="borderless"><Empty description="Selecione um evento no fluxo" /></Card>

  const handleSubmit = (values: FormValues) => {
    const targetProcess     = processes.find((p) => p.id === values.targetProcessId)
    const targetActionEntry = COMMON_ACTIONS.find((a) => a.value === values.targetAction)
    onSave({
      workflowId,
      elementId:   selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'signal',
      config: {
        ...values,
        targetProcessName: targetProcess?.name,
        targetActionLabel: targetActionEntry?.label ?? values.targetAction,
      } satisfies SignalEventConfig,
    })
  }

  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit} initialValues={DEFAULT}>
      <Card
        variant="borderless"
        style={{ borderRadius: 18 }}
        title={<Space><ThunderboltOutlined style={{ color: '#7c3aed' }} /><span>Evento de Sinal</span></Space>}
        bodyStyle={{ padding: 0 }}
      >
        <Alert
          type="info" showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message={selectedElement.name || 'Evento de Sinal'}
          description="Ao chegar neste evento, o motor dispara uma ação em um documento relacionado de outro processo — sem interação humana."
        />

        <div style={{ padding: '20px 24px 16px' }}>

          <Text style={sectionLabel}>Direção do relacionamento</Text>
          <Form.Item name="relationDirection" label="Este documento é" rules={[{ required: true }]} style={{ marginBottom: 20 }}>
            <Select options={[
              { value: 'parent-to-child', label: <Space><Tag color="blue">Pai → Filho</Tag><span>Este é o pai — dispara ação no documento filho</span></Space> },
              { value: 'child-to-parent', label: <Space><Tag color="purple">Filho → Pai</Tag><span>Este é o filho — dispara ação no documento pai</span></Space> },
            ]} />
          </Form.Item>

          <Text style={sectionLabel}>Processo de destino</Text>
          <Form.Item
            name="targetProcessId"
            label={<Space size={4}><ApartmentOutlined /><span>Processo</span></Space>}
            rules={[{ required: true, message: 'Selecione o processo de destino' }]}
            style={{ marginBottom: 20 }}
            extra="O documento relacionado deve pertencer a este processo."
          >
            <Select
              allowClear showSearch
              placeholder="Selecione o processo de destino..."
              options={processOptions}
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum processo encontrado" />}
            />
          </Form.Item>

          <Text style={sectionLabel}>Ação no documento relacionado</Text>
          <Form.Item
            name="targetAction"
            label="Ação a executar"
            rules={[{ required: true, message: 'Selecione a ação' }]}
            style={{ marginBottom: 0 }}
            extra="A ação será executada no documento relacionado que estiver aguardando este sinal."
          >
            <Select
              allowClear showSearch
              placeholder="Selecione a ação..."
              options={COMMON_ACTIONS}
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          <Alert
            type="warning" showIcon style={{ borderRadius: 8, marginTop: 20 }}
            message="Vínculo em runtime"
            description="O motor busca documentos do processo de destino que estejam vinculados a este pelo campo de relacionamento (parentDocumentId ou metadado de referência) e executa a ação configurada."
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