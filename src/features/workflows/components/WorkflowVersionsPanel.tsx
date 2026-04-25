import { Button, Card, Empty, List, Modal, Space, Tag, Typography } from 'antd'
import { HistoryOutlined, RollbackOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { WorkflowVersionSnapshot } from '../storage'

const { Text } = Typography

type WorkflowVersionsPanelProps = {
  snapshots: WorkflowVersionSnapshot[]
  onCreateSnapshot: () => void
  onRestoreSnapshot: (snapshotId: string) => void
}

function formatDateTime(value: string) {
  try {
    return format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return value
  }
}

export function WorkflowVersionsPanel({
  snapshots,
  onCreateSnapshot,
  onRestoreSnapshot,
}: WorkflowVersionsPanelProps) {
  return (
    <Card
      bordered={false}
      style={{ borderRadius: 18 }}
      title="Versões e snapshots"
      extra={
        <Button icon={<HistoryOutlined />} onClick={onCreateSnapshot}>
          Criar snapshot
        </Button>
      }
    >
      {snapshots.length === 0 ? (
        <Empty description="Nenhum snapshot salvo" />
      ) : (
        <List
          dataSource={snapshots}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <Button
                  key="restore"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: 'Restaurar snapshot',
                      content:
                        'Deseja realmente restaurar esta versão do workflow?',
                      okText: 'Restaurar',
                      cancelText: 'Cancelar',
                      onOk: () => onRestoreSnapshot(item.id),
                    })
                  }}
                >
                  Restaurar
                </Button>,
              ]}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap>
                  <Text strong>{item.versionLabel}</Text>
                  <Tag>{formatDateTime(item.createdAt)}</Tag>
                  <Tag color="blue">{item.workflow.version}</Tag>
                  <Tag color="green">{item.elementConfigs.length} configs</Tag>
                </Space>

                {item.note ? <Text type="secondary">{item.note}</Text> : null}
              </Space>
            </List.Item>
          )}
        />
      )}
    </Card>
  )
}