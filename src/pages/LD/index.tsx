import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  ImportOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { ldDownloadTemplate, ldImport, ldPreview, type LdRow } from '../../api/ld'

const { Title, Text } = Typography
const { Dragger } = Upload

export function LDPage() {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [rows, setRows] = useState<LdRow[]>([])
  const [importResult, setImportResult] = useState<{ created: number; errors: string[] } | null>(null)

  const previewMutation = useMutation({
    mutationFn: (file: File) => ldPreview(file),
    onSuccess: (data) => {
      setRows(data)
      setImportResult(null)
      if (data.length === 0) {
        message.warning('Nenhuma linha encontrada no arquivo.')
      } else {
        message.success(`${data.length} linha(s) carregada(s).`)
      }
    },
    onError: () => {
      message.error('Erro ao processar o arquivo. Verifique se é um Excel válido.')
    },
  })

  const importMutation = useMutation({
    mutationFn: () =>
      ldImport(
        rows
          .filter((r) => r.isValid)
          .map((r) => ({
            rowNumber: r.rowNumber,
            code: r.code,
            title: r.title,
            discipline: r.discipline,
            documentTypeId: r.documentTypeId,
            workflowId: r.workflowId,
            description: r.description,
          }))
      ),
    onSuccess: (data) => {
      setImportResult(data)
      if (data.created > 0) {
        message.success(`${data.created} documento(s) criado(s) com sucesso!`)
        setRows([])
        setFileList([])
      }
    },
    onError: () => {
      message.error('Erro ao importar documentos.')
    },
  })

  const handleUpload = (file: File) => {
    setRows([])
    setImportResult(null)
    previewMutation.mutate(file)
    return false // prevent auto-upload
  }

  const validRows = rows.filter((r) => r.isValid)
  const invalidRows = rows.filter((r) => !r.isValid)

  const columns = [
    {
      title: '#',
      dataIndex: 'rowNumber',
      key: 'rowNumber',
      width: 50,
    },
    {
      title: 'Status',
      key: 'status',
      width: 80,
      render: (_: unknown, r: LdRow) =>
        r.isValid ? (
          <Tag icon={<CheckCircleOutlined />} color="success">OK</Tag>
        ) : (
          <Tooltip title={r.errors.join(', ')}>
            <Tag icon={<CloseCircleOutlined />} color="error">Erro</Tag>
          </Tooltip>
        ),
    },
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r: LdRow) => (
        <Text strong={r.isValid} type={r.isValid ? undefined : 'danger'}>{v || '—'}</Text>
      ),
    },
    {
      title: 'Disciplina',
      dataIndex: 'discipline',
      key: 'discipline',
      width: 130,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Tipo de Documento',
      dataIndex: 'documentTypeName',
      key: 'documentTypeName',
      width: 180,
      render: (v: string, r: LdRow) =>
        r.documentTypeId !== '00000000-0000-0000-0000-000000000000' ? (
          <Tag color="blue">{v}</Tag>
        ) : (
          <Tag color="red">{v || '—'}</Tag>
        ),
    },
    {
      title: 'Workflow',
      dataIndex: 'workflowName',
      key: 'workflowName',
      width: 160,
      render: (v: string, r: LdRow) =>
        r.workflowId !== '00000000-0000-0000-0000-000000000000' ? (
          <Tag color="geekblue">{v}</Tag>
        ) : (
          <Tag color="red">{v || '—'}</Tag>
        ),
    },
    {
      title: 'Descrição',
      dataIndex: 'description',
      key: 'description',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>LD — Lista de Documentos</Title>
        <Text type="secondary">Criação em lote de documentos via planilha Excel</Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* Área de upload */}
        <Col xs={24}>
          <Card
            title="1. Faça upload da planilha"
            extra={
              <Button
                icon={<DownloadOutlined />}
                onClick={() => ldDownloadTemplate()}
              >
                Baixar template
              </Button>
            }
          >
            <Dragger
              name="file"
              multiple={false}
              accept=".xlsx,.xls"
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([file as unknown as UploadFile])
                handleUpload(file)
                return false
              }}
              onRemove={() => {
                setFileList([])
                setRows([])
                setImportResult(null)
              }}
              style={{ padding: '20px 0' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: '#1677ff' }} />
              </p>
              <p className="ant-upload-text">
                Clique ou arraste o arquivo Excel aqui
              </p>
              <p className="ant-upload-hint">
                Suporte para .xlsx e .xls — use o template para garantir o formato correto
              </p>
            </Dragger>
          </Card>
        </Col>

        {/* Preview da planilha */}
        {rows.length > 0 && (
          <Col xs={24}>
            <Card
              title={
                <Space>
                  <span>2. Conferir dados</span>
                  <Tag color="blue">{rows.length} linhas</Tag>
                  {validRows.length > 0 && <Tag color="success">{validRows.length} válidas</Tag>}
                  {invalidRows.length > 0 && <Tag color="error">{invalidRows.length} com erro</Tag>}
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  icon={<ImportOutlined />}
                  loading={importMutation.isPending}
                  disabled={validRows.length === 0}
                  onClick={() => importMutation.mutate()}
                >
                  Importar {validRows.length} documento{validRows.length !== 1 ? 's' : ''}
                </Button>
              }
            >
              {invalidRows.length > 0 && (
                <Alert
                  type="warning"
                  message={`${invalidRows.length} linha(s) com erro serão ignoradas na importação.`}
                  style={{ marginBottom: 16 }}
                  showIcon
                />
              )}
              <Table
                dataSource={rows}
                columns={columns}
                rowKey="rowNumber"
                size="small"
                pagination={{ pageSize: 20 }}
                scroll={{ x: 1000 }}
                rowClassName={(r) => (!r.isValid ? 'ant-table-row-danger' : '')}
              />
            </Card>
          </Col>
        )}

        {/* Resultado da importação */}
        {importResult && (
          <Col xs={24}>
            <Alert
              type={importResult.created > 0 ? 'success' : 'warning'}
              icon={<CloudUploadOutlined />}
              message={
                importResult.created > 0
                  ? `${importResult.created} documento(s) criado(s) com sucesso!`
                  : 'Nenhum documento foi criado.'
              }
              description={
                importResult.errors.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                ) : undefined
              }
              showIcon
            />
          </Col>
        )}
      </Row>
    </div>
  )
}
