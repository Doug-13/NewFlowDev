import { Card, Empty, List, Progress, Space, Tag, Typography } from 'antd'
import type { WorkflowValidationIssue } from '../storage'
import type { WorkflowStudioValidation } from '../studioValidation'

const { Text } = Typography

type WorkflowValidationPanelProps = {
  validation: WorkflowStudioValidation
}

export function WorkflowValidationPanel({
  validation,
}: WorkflowValidationPanelProps) {
  const { summary, issues } = validation

  return (
    <Card variant="borderless" style={{ borderRadius: 18 }} title="Validação do fluxo">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">Prontidão operacional</Text>
          <Progress percent={summary.readinessPercent} />
        </div>

        <Space wrap>
          <Tag color="blue">
            Elementos relevantes: {summary.totalRelevantElements}
          </Tag>
          <Tag color="green">
            Configurados: {summary.configuredRelevantElements}
          </Tag>
          <Tag color="red">Erros: {summary.errors}</Tag>
          <Tag color="gold">Alertas: {summary.warnings}</Tag>
        </Space>

        {issues.length === 0 ? (
          <Empty description="Fluxo validado sem pendências" />
        ) : (
          <List
            dataSource={issues}
            renderItem={(item: WorkflowValidationIssue) => (
              <List.Item key={item.id}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={item.severity === 'error' ? 'red' : 'gold'}>
                      {item.severity === 'error' ? 'Erro' : 'Alerta'}
                    </Tag>
                    {item.elementId ? <Tag>{item.elementId}</Tag> : null}
                  </Space>
                  <Text>{item.message}</Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  )
}