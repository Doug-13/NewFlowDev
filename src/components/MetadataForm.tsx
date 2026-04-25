import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  DatePicker,
  Typography,
  Alert,
  Space,
  Tag,
  Row,
  Col,
  Button,
} from 'antd'
import { DeleteOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { MetadataValueDto } from '../api/metadata'
import dayjs from 'dayjs'

const { Text } = Typography

interface Props {
  fields: MetadataValueDto[]
  form: any
  readOnly?: boolean
}

type TableColumnConfig = {
  id?: string
  fieldType?: string
  orderIndex?: number
  externalName?: string
  internalName?: string
  metadataDefinitionId?: string
}

function getFieldSpan(fieldType: string): number {
  if (
    fieldType === 'textarea' ||
    fieldType === 'table' ||
    fieldType === 'multiselect'
  ) return 24
  return 12
}

function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const parsed = dayjs(value)
    return parsed.isValid() ? value : null
  }
  if (typeof value === 'number') {
    const parsed = dayjs(value)
    return parsed.isValid() ? parsed.toISOString() : null
  }
  if (value && typeof (value as any).format === 'function') {
    try {
      return (value as any).format()
    } catch {
      return null
    }
  }
  return null
}

function toPickerValue(value: string | null): ReturnType<typeof dayjs> | null {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

function DateField({
  fieldType,
  disabled,
  isoValue,
  onChange,
}: {
  fieldType: string
  disabled: boolean
  isoValue: string | null
  onChange: (iso: string | null) => void
}) {
  return (
    <DatePicker
      style={{ width: '100%' }}
      format={fieldType === 'datetime' ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}
      showTime={fieldType === 'datetime' ? { format: 'HH:mm' } : false}
      disabled={disabled}
      value={toPickerValue(isoValue)}
      onChange={(dayjsValue) => {
        if (!dayjsValue) {
          onChange(null)
          return
        }
        try {
          onChange(dayjsValue.toISOString())
        } catch {
          onChange(dayjsValue.format('YYYY-MM-DDTHH:mm:ss.000Z'))
        }
      }}
    />
  )
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
  display: 'block',
  letterSpacing: '0.01em',
}

const READONLY_LABEL_STYLE: React.CSSProperties = {
  ...LABEL_STYLE,
  color: '#9ca3af',
}

const INPUT_STYLE: React.CSSProperties = {
  fontSize: 14,
  borderRadius: 8,
  border: '1.5px solid #e5e7eb',
  background: '#fff',
}

const READONLY_INPUT_STYLE: React.CSSProperties = {
  fontSize: 14,
  borderRadius: 8,
  border: '1.5px solid #f3f4f6',
  background: '#f9fafb',
  color: '#6b7280',
}

function getSelectOptions(field: MetadataValueDto) {
  return (field.options ?? []).map((option: any) => ({
    value: option.value,
    label:
      field.fieldType === 'sigla_select'
        ? `${option.sigla ?? option.value} - ${option.label}`
        : option.label,
  }))
}

function getFieldId(field: MetadataValueDto) {
  return String(field.metadataDefinitionId ?? '')
}

function getHiddenChildFieldIds(fields: MetadataValueDto[]) {
  const tableFields = fields.filter((field) => field.fieldType === 'table')
  const hiddenIds = new Set<string>()

  tableFields.forEach((tableField) => {
    const columns = Array.isArray(tableField.tableColumns) ? tableField.tableColumns : []
    columns.forEach((column: TableColumnConfig) => {
      const metadataDefinitionId = String(column.metadataDefinitionId ?? '').trim()
      if (metadataDefinitionId) {
        hiddenIds.add(metadataDefinitionId)
      }
    })
  })

  return hiddenIds
}

function normalizeTableColumns(
  tableField: MetadataValueDto,
  fields: MetadataValueDto[],
) {
  const columns = Array.isArray(tableField.tableColumns)
    ? [...tableField.tableColumns]
    : []

  return columns
    .sort(
      (a: any, b: any) => Number(a?.orderIndex ?? 0) - Number(b?.orderIndex ?? 0),
    )
    .map((column: any, index: number) => {
      const linkedField = fields.find(
        (item) =>
          String(item.metadataDefinitionId ?? '') ===
          String(column?.metadataDefinitionId ?? ''),
      )

      return {
        key:
          String(column?.metadataDefinitionId ?? '') ||
          String(column?.internalName ?? '') ||
          `column-${index}`,
        metadataDefinitionId:
          String(column?.metadataDefinitionId ?? linkedField?.metadataDefinitionId ?? ''),
        label:
          column?.externalName ??
          linkedField?.label ??
          linkedField?.name ??
          `Coluna ${index + 1}`,
        internalName:
          column?.internalName ??
          linkedField?.name ??
          `coluna_${index + 1}`,
        fieldType:
          column?.fieldType ??
          linkedField?.fieldType ??
          'text',
        maskType: linkedField?.maskType ?? null,
        isRequired: Boolean(linkedField?.isRequired),
        isReadOnly: Boolean((linkedField as any)?.isReadOnly),
        options: linkedField ? getSelectOptions(linkedField) : [],
      }
    })
}

function renderTableCellInput(
  column: ReturnType<typeof normalizeTableColumns>[number],
  readOnly: boolean,
) {
  const style = readOnly ? READONLY_INPUT_STYLE : INPUT_STYLE
  const disabled = readOnly || column.isReadOnly

  if (column.fieldType === 'text') {
    return <Input disabled={disabled} style={style} />
  }

  if (column.fieldType === 'textarea') {
    return (
      <Input.TextArea
        rows={2}
        disabled={disabled}
        style={{ ...style, resize: 'vertical' }}
      />
    )
  }

  if (column.fieldType === 'number') {
    return <InputNumber style={{ width: '100%', ...style }} disabled={disabled} />
  }

  if (column.fieldType === 'currency') {
    return (
      <InputNumber
        style={{ width: '100%', ...style }}
        prefix="R$"
        precision={2}
        decimalSeparator=","
        disabled={disabled}
      />
    )
  }

  if (column.fieldType === 'boolean') {
    return <Switch disabled={disabled} />
  }

  if (column.fieldType === 'select' || column.fieldType === 'sigla_select') {
    return (
      <Select
        options={column.options}
        placeholder="Selecione..."
        allowClear
        disabled={disabled}
        style={{ width: '100%' }}
      />
    )
  }

  if (column.fieldType === 'multiselect') {
    return (
      <Select
        mode="multiple"
        options={column.options}
        placeholder="Selecione..."
        allowClear
        disabled={disabled}
        style={{ width: '100%' }}
      />
    )
  }

  if (column.fieldType === 'date' || column.fieldType === 'datetime') {
    return (
      <DatePicker
        style={{ width: '100%' }}
        format={column.fieldType === 'datetime' ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}
        showTime={column.fieldType === 'datetime' ? { format: 'HH:mm' } : false}
        disabled={disabled}
      />
    )
  }

  if (column.fieldType === 'user') {
    return <Input placeholder="Nome do usuário" disabled={disabled} style={style} />
  }

  return <Input disabled={disabled} style={style} />
}

function normalizeTableValue(value: unknown) {
  if (Array.isArray(value)) return value

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  return []
}


function buildInitialValues(fields: MetadataValueDto[]) {
  const initial: Record<string, any> = {}
  const initialDates: Record<string, string | null> = {}

  fields.forEach((field) => {
    const fieldId = field.metadataDefinitionId
    if (!fieldId) return

    if (field.fieldType === 'date' || field.fieldType === 'datetime') {
      const iso = toIsoString(field.value)
      initialDates[fieldId] = iso
      initial[fieldId] = iso
      return
    }

    if (field.fieldType === 'table') {
      initial[fieldId] = normalizeTableValue(field.value)
      return
    }

    if (field.value !== null && field.value !== undefined) {
      initial[fieldId] = field.value
    }
  })

  return { initial, initialDates }
}

export function MetadataForm({ fields, form, readOnly: globalReadOnly = false }: Props) {
  const [dateValues, setDateValues] = useState<Record<string, string | null>>({})
  const initializedSignatureRef = useRef<string>('')

  const visibleFields = useMemo(() => {
    const hiddenChildIds = getHiddenChildFieldIds(fields)

    return fields.filter((field) => {
      const fieldId = getFieldId(field)
      if (!fieldId) return true
      if (field.fieldType === 'table') return true
      return !hiddenChildIds.has(fieldId)
    })
  }, [fields])

  const fieldsSignature = useMemo(() => {
    return JSON.stringify(
      visibleFields.map((field) => ({
        id: field.metadataDefinitionId,
        value: field.value,
        fieldType: field.fieldType,
      })),
    )
  }, [visibleFields])

  useEffect(() => {
    if (!visibleFields || visibleFields.length === 0) return
    if (initializedSignatureRef.current === fieldsSignature) return

    const { initial, initialDates } = buildInitialValues(visibleFields)
    initializedSignatureRef.current = fieldsSignature
    setDateValues(initialDates)
    form.setFieldsValue(initial)
  }, [visibleFields, fieldsSignature, form])

  if (visibleFields.length === 0) return null

  const renderNonDateField = (field: MetadataValueDto, readOnly: boolean) => {
    const style = readOnly ? READONLY_INPUT_STYLE : INPUT_STYLE
    const disabled = readOnly

    if (field.fieldType === 'text') {
      return <Input disabled={disabled} style={style} />
    }

    if (field.fieldType === 'textarea') {
      return (
        <Input.TextArea
          rows={3}
          disabled={disabled}
          style={{ ...style, resize: 'vertical' }}
        />
      )
    }

    if (field.fieldType === 'number') {
      return <InputNumber style={{ width: '100%', ...style }} disabled={disabled} />
    }

    if (field.fieldType === 'currency') {
      return (
        <InputNumber
          style={{ width: '100%', ...style }}
          prefix="R$"
          precision={2}
          decimalSeparator=","
          disabled={disabled}
        />
      )
    }

    if (field.fieldType === 'boolean') {
      return <Switch disabled={disabled} />
    }

    if (field.fieldType === 'select') {
      return (
        <Select
          options={getSelectOptions(field)}
          placeholder="Selecione..."
          allowClear
          disabled={disabled}
          style={{ width: '100%' }}
        />
      )
    }

    if (field.fieldType === 'multiselect') {
      return (
        <Select
          mode="multiple"
          options={getSelectOptions(field)}
          placeholder="Selecione..."
          allowClear
          disabled={disabled}
          style={{ width: '100%' }}
        />
      )
    }

    if (field.fieldType === 'sigla_select') {
      return (
        <Select
          options={getSelectOptions(field)}
          placeholder="Selecione a sigla..."
          allowClear
          disabled={disabled}
          style={{ width: '100%' }}
        />
      )
    }

    if (field.fieldType === 'user') {
      return <Input placeholder="Nome do usuário" disabled={disabled} style={style} />
    }

    if (field.fieldType === 'table') {
      const columns = normalizeTableColumns(field, fields)

      return (
        <div
          style={{
            border: '1px solid #93c5fd',
            background: '#eff6ff',
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <Space align="center">
              <InfoCircleOutlined style={{ color: '#2563eb' }} />
              <Text strong style={{ color: '#1d4ed8' }}>
                Campo tabela
              </Text>
            </Space>
          </div>

          {columns.length === 0 ? (
            <Alert
              type="info"
              showIcon
              title="Sem colunas configuradas."
            />
          ) : (
            <Form.List name={field.metadataDefinitionId} initialValue={[]}>
              {(rows, { add, remove }) => (
                <>
                  <div
                    style={{
                      overflowX: 'auto',
                      border: '1px solid #dbeafe',
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        minWidth: Math.max(columns.length * 220, 520),
                        borderCollapse: 'collapse',
                      }}
                    >
                      <thead>
                        <tr>
                          {columns.map((column) => (
                            <th
                              key={column.key}
                              style={{
                                textAlign: 'left',
                                padding: '12px 10px',
                                borderBottom: '1px solid #e5e7eb',
                                background: '#f8fafc',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#374151',
                              }}
                            >
                              <Space size={4}>
                                <span>{column.label}</span>
                                {column.isRequired && <Tag color="red">Obrig.</Tag>}
                              </Space>
                            </th>
                          ))}

                          <th
                            style={{
                              width: 80,
                              textAlign: 'center',
                              padding: '12px 10px',
                              borderBottom: '1px solid #e5e7eb',
                              background: '#f8fafc',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#374151',
                            }}
                          >
                            Ações
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {rows.length === 0 && (
                          <tr>
                            <td
                              colSpan={columns.length + 1}
                              style={{
                                textAlign: 'center',
                                padding: 16,
                                color: '#6b7280',
                              }}
                            >
                              Nenhuma linha adicionada.
                            </td>
                          </tr>
                        )}

                        {rows.map((row) => (
                          <tr key={row.key}>
                            {columns.map((column) => {
                              const booleanColumn = column.fieldType === 'boolean'

                              return (
                                <td
                                  key={`${row.key}-${column.key}`}
                                  style={{
                                    padding: 10,
                                    borderBottom: '1px solid #f3f4f6',
                                    verticalAlign: 'top',
                                  }}
                                >
                                  <Form.Item
                                    name={[row.name, column.internalName]}
                                    rules={
                                      !globalReadOnly && column.isRequired
                                        ? [
                                          {
                                            required: true,
                                            message: `${column.label} é obrigatório`,
                                          },
                                        ]
                                        : []
                                    }
                                    valuePropName={booleanColumn ? 'checked' : 'value'}
                                    style={{ marginBottom: 0 }}
                                  >
                                    {renderTableCellInput(column, globalReadOnly)}
                                  </Form.Item>
                                </td>
                              )
                            })}

                            <td
                              style={{
                                padding: 10,
                                borderBottom: '1px solid #f3f4f6',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                              }}
                            >
                              <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => remove(row.name)}
                                disabled={globalReadOnly}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const currentValue = form.getFieldValue(field.metadataDefinitionId)
                        if (!Array.isArray(currentValue)) {
                          form.setFieldValue(field.metadataDefinitionId, [])
                        }
                        add({})
                      }}
                      disabled={globalReadOnly}
                    >
                      Adicionar linha
                    </Button>
                  </div>
                </>
              )}
            </Form.List>
          )}
        </div>
      )
    }

    return <Input disabled={disabled} style={style} />
  }

  const renderLabel = (field: MetadataValueDto, readOnly: boolean) => {
    const labelStyle = readOnly ? READONLY_LABEL_STYLE : LABEL_STYLE
    return (
      <span style={labelStyle}>
        {!readOnly && field.isRequired && (
          <span style={{ color: '#ef4444', marginRight: 3 }}>*</span>
        )}
        {field.label}
        {readOnly && (
          <Tag
            style={{
              marginLeft: 6,
              fontSize: 10,
              padding: '0 5px',
              lineHeight: '16px',
              border: '1px solid #e5e7eb',
              color: '#9ca3af',
              background: '#f9fafb',
            }}
          >
            Etapa anterior
          </Tag>
        )}
      </span>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          marginTop: 4,
          paddingBottom: 12,
          borderBottom: '2px solid #f3f4f6',
        }}
      >
        <div
          style={{
            width: 4,
            height: 18,
            background: 'linear-gradient(180deg, #3b82f6, #6366f1)',
            borderRadius: 4,
            flexShrink: 0,
          }}
        />
        <Text
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.01em',
          }}
        >
          Informações do Documento
        </Text>
        <Tag
          style={{
            marginLeft: 'auto',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#3b82f6',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {visibleFields.filter((f) => !(f as any).isReadOnly).length} campo
          {visibleFields.filter((f) => !(f as any).isReadOnly).length !== 1 ? 's' : ''}
        </Tag>
      </div>

      <Row gutter={[16, 4]}>
        {visibleFields.map((field) => {
          const readOnly = globalReadOnly || Boolean((field as any).isReadOnly)
          const isDate = field.fieldType === 'date' || field.fieldType === 'datetime'
          const isBoolean = field.fieldType === 'boolean'
          const isTable = field.fieldType === 'table'
          const span = getFieldSpan(field.fieldType)
          const rules = !readOnly && field.isRequired
            ? [{ required: true, message: `${field.label} é obrigatório` }]
            : []

          const wrapperStyle: React.CSSProperties = readOnly
            ? {
              background: '#f9fafb',
              borderRadius: 10,
              padding: '2px 8px 4px',
              border: '1px solid #f3f4f6',
            }
            : {}

          if (isTable) {
            return (
              <Col key={field.metadataDefinitionId} xs={24} sm={24}>
                <div style={{ marginBottom: 20, ...wrapperStyle }}>
                  {renderLabel(field, readOnly)}
                  <div style={{ marginTop: 6 }}>
                    {renderNonDateField(field, readOnly)}
                  </div>
                </div>
              </Col>
            )
          }

          if (isDate) {
            return (
              <Col key={field.metadataDefinitionId} xs={24} sm={span}>
                <div style={{ marginBottom: 20, ...wrapperStyle }}>
                  <Form.Item name={field.metadataDefinitionId} hidden noStyle>
                    <Input />
                  </Form.Item>
                  {renderLabel(field, readOnly)}
                  <DateField
                    fieldType={field.fieldType}
                    disabled={readOnly}
                    isoValue={dateValues[field.metadataDefinitionId] ?? null}
                    onChange={(iso) => {
                      setDateValues((prev) => ({
                        ...prev,
                        [field.metadataDefinitionId]: iso,
                      }))
                      form.setFieldValue(field.metadataDefinitionId, iso)
                    }}
                  />
                </div>
              </Col>
            )
          }

          if (isBoolean) {
            return (
              <Col key={field.metadataDefinitionId} xs={24} sm={12}>
                <div style={{ marginBottom: 20, ...wrapperStyle }}>
                  <Form.Item
                    name={field.metadataDefinitionId}
                    valuePropName="checked"
                    rules={rules}
                    style={{ marginBottom: 0 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        paddingTop: 4,
                      }}
                    >
                      <Switch disabled={readOnly} />
                      {renderLabel(field, readOnly)}
                    </div>
                  </Form.Item>
                </div>
              </Col>
            )
          }

          return (
            <Col key={field.metadataDefinitionId} xs={24} sm={span}>
              <div style={{ marginBottom: 20, ...wrapperStyle }}>
                {renderLabel(field, readOnly)}
                <Form.Item
                  name={field.metadataDefinitionId}
                  rules={rules}
                  style={{ marginBottom: 0 }}
                  valuePropName="value"
                >
                  {renderNonDateField(field, readOnly)}
                </Form.Item>
              </div>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}