import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  BellOutlined,
  CodeOutlined,
  FileTextOutlined,
  PlusOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

import type {
  SystemTaskActionType,
  SystemTaskConfig,
  WorkflowElementConfig,
} from '../storage'
import type { BpmnElementSummary } from '../studioValidation'
import type { ElementConfigSavePayload } from '../panelTypes'

const { Text } = Typography

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SystemTaskConfigPanelProps = {
  workflowId: string
  selectedElement: BpmnElementSummary | null
  initialConfig: WorkflowElementConfig | null
  onSave: (values: ElementConfigSavePayload) => void
}

type FormValues = SystemTaskConfig

type AllowedSystemTaskActionType = Exclude<
  SystemTaskActionType,
  'create-subprocess'
>

type ActionOption = {
  label: string
  value: AllowedSystemTaskActionType
  tag: string
  tagColor: string
  description: string
  auditPlaceholder: string
}

// ─────────────────────────────────────────────
// Custom script types
// ─────────────────────────────────────────────

type RuleOperator =
  | '='
  | '!='
  | 'contém'
  | 'não contém'
  | '>'
  | '<'
  | 'está vazio'
  | 'não está vazio'

type RuleAction = 'definir valor' | 'copiar para' | 'incrementar' | 'limpar'

type VisualRule = {
  id: number
  ifField: string
  op: RuleOperator
  ifValue: string
  thenField: string
  action: RuleAction
  thenValue: string
}

type ScriptEditorMode = 'visual' | 'code'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ACTION_OPTIONS: ActionOption[] = [
  {
    label: 'Incrementar revisão',
    value: 'increment-revision',
    tag: 'Revisão',
    tagColor: 'blue',
    description:
      'Avança o campo de revisão do documento conforme a regra definida no processo.',
    auditPlaceholder:
      'Ex.: Avança a revisão do documento após aprovação gerencial.',
  },
  {
    label: 'Definir valor de metadado',
    value: 'set-metadata',
    tag: 'Metadado',
    tagColor: 'purple',
    description:
      'Atribui um valor ao campo configurado no processo, como status aprovado ou data de publicação.',
    auditPlaceholder:
      'Ex.: Marca o documento como aprovado e registra a data.',
  },
  {
    label: 'Copiar metadado',
    value: 'copy-metadata',
    tag: 'Metadado',
    tagColor: 'purple',
    description:
      'Copia o valor de um campo para outro, conforme mapeamento definido no processo.',
    auditPlaceholder:
      'Ex.: Copia a data de revisão para a data de publicação.',
  },
  {
    label: 'Requisição HTTP',
    value: 'http-request',
    tag: 'Integração',
    tagColor: 'orange',
    description:
      'Chama um endpoint externo, webhook ou API configurada no processo.',
    auditPlaceholder:
      'Ex.: Notifica o sistema ERP sobre a aprovação do contrato.',
  },
  {
    label: 'Script personalizado',
    value: 'custom-script',
    tag: 'Script',
    tagColor: 'volcano',
    description:
      'Executa uma expressão ou script definido na configuração do processo.',
    auditPlaceholder:
      'Ex.: Executa regra de negócio específica do tipo documental.',
  },
]

const RULE_OPERATORS: RuleOperator[] = [
  '=',
  '!=',
  'contém',
  'não contém',
  '>',
  '<',
  'está vazio',
  'não está vazio',
]

const RULE_ACTIONS: RuleAction[] = [
  'definir valor',
  'copiar para',
  'incrementar',
  'limpar',
]

const JS_SNIPPETS: Record<string, string> = {
  getmeta: "const valor = ctx.getMetadata('campo');",
  setmeta: "ctx.setMetadata('campo', valor);",
  ifelse: 'if (condicao) {\n  // ...\n} else {\n  // ...\n}',
  log: "ctx.log('mensagem de debug');",
  trycatch: "try {\n  // código\n} catch (err) {\n  ctx.log('Erro: ' + err.message);\n}",
}

const DEFAULT_CONFIG: FormValues = {
  actionType: 'increment-revision',
  auditNote: undefined,
  notificationTemplateIds: [],
  customScript: undefined,
}

const DEFAULT_RULES: VisualRule[] = [
  {
    id: 1,
    ifField: 'status',
    op: '=',
    ifValue: 'aprovado',
    thenField: 'publicado',
    action: 'definir valor',
    thenValue: 'true',
  },
]

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isAllowedSystemTaskActionType(
  value: unknown,
): value is AllowedSystemTaskActionType {
  return ACTION_OPTIONS.some((option) => option.value === value)
}

function normalizeSavedSystemTaskConfig(
  config: SystemTaskConfig | null,
): FormValues {
  if (!config) return DEFAULT_CONFIG

  const actionType = isAllowedSystemTaskActionType(config.actionType)
    ? config.actionType
    : DEFAULT_CONFIG.actionType

  return {
    actionType,
    auditNote: config.auditNote,
    notificationTemplateIds: config.notificationTemplateIds ?? [],
    customScript: config.customScript,
  }
}

function opToJs(op: RuleOperator, field: string, val: string): string {
  const f = `ctx.getMetadata('${field || 'campo'}')`
  const v = isNaN(Number(val)) ? `'${val}'` : val
  switch (op) {
    case '=':            return `${f} === ${v}`
    case '!=':           return `${f} !== ${v}`
    case '>':            return `${f} > ${val}`
    case '<':            return `${f} < ${val}`
    case 'contém':       return `String(${f}).includes('${val}')`
    case 'não contém':   return `!String(${f}).includes('${val}')`
    case 'está vazio':   return `!${f}`
    case 'não está vazio': return `!!${f}`
    default:             return `${f} === ${v}`
  }
}

function actionToJs(r: VisualRule): string {
  switch (r.action) {
    case 'definir valor': {
      const v = isNaN(Number(r.thenValue)) ? `'${r.thenValue}'` : r.thenValue
      return `ctx.setMetadata('${r.thenField}', ${v});`
    }
    case 'copiar para':
      return `ctx.setMetadata('${r.thenField}', ctx.getMetadata('${r.ifField}'));`
    case 'incrementar':
      return `ctx.setMetadata('${r.thenField}', (Number(ctx.getMetadata('${r.thenField}')) || 0) + 1);`
    case 'limpar':
      return `ctx.setMetadata('${r.thenField}', null);`
    default:
      return ''
  }
}

function rulesToCode(rules: VisualRule[]): string {
  if (rules.length === 0) return '// nenhuma regra configurada'
  return (
    rules
      .map((r, i) => {
        const cond = opToJs(r.op, r.ifField, r.ifValue)
        const act = actionToJs(r)
        const kw = i === 0 ? 'if' : '} else if'
        return `${kw} (${cond}) {\n  ${act}`
      })
      .join('\n') + '\n}'
  )
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const monoStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
}

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#94a3b8',
  marginBottom: 12,
  display: 'block',
}

const tabPaneStyle: CSSProperties = {
  padding: '20px 24px 4px',
  minHeight: 260,
}

// ─────────────────────────────────────────────
// RuleRow
// ─────────────────────────────────────────────

function RuleRow({
  rule,
  index,
  onChange,
  onRemove,
}: {
  rule: VisualRule
  index: number
  onChange: (id: number, key: keyof VisualRule, val: string) => void
  onRemove: (id: number) => void
}) {
  const needsVal = !['está vazio', 'não está vazio'].includes(rule.op)
  const needsThenVal = rule.action !== 'limpar' && rule.action !== 'incrementar'

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag
          color={index === 0 ? 'blue' : 'geekblue'}
          style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}
        >
          {index === 0 ? 'SE' : 'SENÃO SE'}
        </Tag>
        <Text style={{ fontSize: 11, color: '#94a3b8' }}>Condição {index + 1}</Text>
        <Button
          type="text"
          size="small"
          danger
          style={{ marginLeft: 'auto', fontSize: 11, height: 22, padding: '0 8px' }}
          onClick={() => onRemove(rule.id)}
        >
          remover
        </Button>
      </div>

      {/* IF row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <Input
          size="small"
          placeholder="campo (ex: status)"
          value={rule.ifField}
          onChange={(e) => onChange(rule.id, 'ifField', e.target.value)}
          style={{ ...monoStyle }}
        />
        <Select
          size="small"
          value={rule.op}
          style={{ width: 140 }}
          onChange={(v) => onChange(rule.id, 'op', v)}
          options={RULE_OPERATORS.map((o) => ({ label: o, value: o }))}
        />
        <Input
          size="small"
          placeholder="valor"
          value={rule.ifValue}
          disabled={!needsVal}
          onChange={(e) => onChange(rule.id, 'ifValue', e.target.value)}
          style={{ ...monoStyle, opacity: needsVal ? 1 : 0.4 }}
        />
      </div>

      {/* THEN label */}
      <div>
        <Tag
          color="green"
          style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}
        >
          ENTÃO
        </Tag>
      </div>

      {/* THEN row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <Input
          size="small"
          placeholder="campo destino"
          value={rule.thenField}
          onChange={(e) => onChange(rule.id, 'thenField', e.target.value)}
          style={{ ...monoStyle }}
        />
        <Select
          size="small"
          value={rule.action}
          style={{ width: 140 }}
          onChange={(v) => onChange(rule.id, 'action', v)}
          options={RULE_ACTIONS.map((a) => ({ label: a, value: a }))}
        />
        <Input
          size="small"
          placeholder="valor"
          value={rule.thenValue}
          disabled={!needsThenVal}
          onChange={(e) => onChange(rule.id, 'thenValue', e.target.value)}
          style={{ ...monoStyle, opacity: needsThenVal ? 1 : 0.4 }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CodePreview
// ─────────────────────────────────────────────

function CodePreview({ code }: { code: string }) {
  const highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /\b(if|else|const|let|var|return|true|false|null)\b/g,
      '<span style="color:#60a5fa;font-weight:600">$1</span>',
    )
    .replace(
      /'([^']*)'/g,
      "<span style=\"color:#86efac\">'$1'</span>",
    )
    .replace(
      /\b(\d+)\b/g,
      '<span style="color:#fbbf24">$1</span>',
    )

  return (
    <pre
      style={{
        ...monoStyle,
        background: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 10,
        padding: '12px 14px',
        margin: 0,
        overflowX: 'auto',
        lineHeight: 1.7,
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}

// ─────────────────────────────────────────────
// CustomScriptEditor
// ─────────────────────────────────────────────

type CustomScriptEditorProps = {
  value?: string
  onChange?: (script: string) => void
}

function CustomScriptEditor({ value, onChange }: CustomScriptEditorProps) {
  const [mode, setMode] = useState<ScriptEditorMode>('visual')
  const [rules, setRules] = useState<VisualRule[]>(DEFAULT_RULES)
  const [codeValue, setCodeValue] = useState<string>(
    value ?? rulesToCode(DEFAULT_RULES),
  )
  const ruleIdRef = useRef(2)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Notify parent on change
  useEffect(() => {
    const script = mode === 'visual' ? rulesToCode(rules) : codeValue
    onChange?.(script)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, codeValue, mode])

  const handleSwitchMode = (m: ScriptEditorMode) => {
    if (m === 'code') setCodeValue(rulesToCode(rules))
    setMode(m)
  }

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: ruleIdRef.current++,
        ifField: '',
        op: '=',
        ifValue: '',
        thenField: '',
        action: 'definir valor',
        thenValue: '',
      },
    ])
  }

  const removeRule = (id: number) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRule = useCallback(
    (id: number, key: keyof VisualRule, val: string) => {
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)),
      )
    },
    [],
  )

  const insertSnippet = (key: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const snippet = JS_SNIPPETS[key] ?? ''
    const start = ta.selectionStart
    const before = codeValue.substring(0, start)
    const after = codeValue.substring(ta.selectionEnd)
    const newVal =
      before +
      (before && !before.endsWith('\n') ? '\n' : '') +
      snippet +
      '\n' +
      after
    setCodeValue(newVal)
    ta.focus()
  }

  const toggleStyle = (active: boolean): CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 8,
    border: active ? '1px solid #e2e8f0' : 'none',
    background: active ? '#fff' : 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? '#0f172a' : '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all .15s',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mode toggle */}
      <div>
        <span style={sectionLabelStyle}>Modo de edição</span>
        <div
          style={{
            display: 'flex',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: 3,
            gap: 3,
            width: 'fit-content',
          }}
        >
          <button style={toggleStyle(mode === 'visual')} onClick={() => handleSwitchMode('visual')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Construtor visual
          </button>
          <button style={toggleStyle(mode === 'code')} onClick={() => handleSwitchMode('code')}>
            <CodeOutlined style={{ fontSize: 13 }} />
            JavaScript
          </button>
        </div>
      </div>

      {/* ── Visual builder ── */}
      {mode === 'visual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Alert
            type="info"
            showIcon={false}
            style={{ borderRadius: 10 }}
            message={
              <Text style={{ fontSize: 12, color: '#475569' }}>
                Cada regra avalia um metadado e executa uma ação. As condições
                são verificadas em ordem — a primeira correspondente é executada.
              </Text>
            }
          />

          {rules.map((rule, i) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              index={i}
              onChange={updateRule}
              onRemove={removeRule}
            />
          ))}

          {/* SENÃO placeholder */}
          {rules.length > 0 && (
            <div
              style={{
                background: '#fafafa',
                border: '1px dashed #cbd5e1',
                borderRadius: 10,
                padding: '10px 14px',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Tag
                color="orange"
                style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}
              >
                SENÃO
              </Tag>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                Nenhuma condição correspondeu — nenhuma ação será executada
              </Text>
            </div>
          )}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addRule}
            style={{ borderRadius: 8, height: 36 }}
            block
          >
            Adicionar condição
          </Button>

          {/* Live code preview */}
          <div>
            <span style={{ ...sectionLabelStyle, marginBottom: 8 }}>
              Preview do script gerado
            </span>
            <CodePreview code={rulesToCode(rules)} />
          </div>
        </div>
      )}

      {/* ── JS editor ── */}
      {mode === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Alert
            type="info"
            showIcon={false}
            style={{ borderRadius: 10 }}
            message={
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
                <strong>Contexto disponível:</strong>{' '}
                {[
                  'ctx.getMetadata(campo)',
                  'ctx.setMetadata(campo, valor)',
                  'ctx.log(msg)',
                  'ctx.documentId',
                ].map((s) => (
                  <code
                    key={s}
                    style={{
                      ...monoStyle,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      padding: '1px 6px',
                      borderRadius: 4,
                      marginRight: 4,
                      fontSize: 11,
                    }}
                  >
                    {s}
                  </code>
                ))}
              </div>
            }
          />

          {/* Snippet toolbar + textarea */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '7px 12px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <Text style={{ fontSize: 11, color: '#94a3b8', marginRight: 4 }}>
                Inserir:
              </Text>
              {Object.keys(JS_SNIPPETS).map((key) => (
                <Tooltip key={key} title={JS_SNIPPETS[key]} placement="top">
                  <button
                    onClick={() => insertSnippet(key)}
                    style={{
                      ...monoStyle,
                      fontSize: 11,
                      padding: '2px 10px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {key}
                  </button>
                </Tooltip>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              placeholder={
                "// Escreva seu script JavaScript aqui...\n// Exemplo:\nconst status = ctx.getMetadata('status');\nif (status === 'aprovado') {\n  ctx.setMetadata('publicado', true);\n  ctx.log('Documento publicado');\n}"
              }
              style={{
                ...monoStyle,
                width: '100%',
                minHeight: 200,
                padding: '12px 14px',
                border: 'none',
                background: '#0f172a',
                color: '#e2e8f0',
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.7,
                display: 'block',
              }}
            />
          </div>

          <Button
            type="dashed"
            onClick={() => handleSwitchMode('visual')}
            style={{ borderRadius: 8, height: 36 }}
            block
          >
            Voltar ao construtor visual
          </Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SystemTaskConfigPanel (main export)
// ─────────────────────────────────────────────

export function SystemTaskConfigPanel({
  workflowId,
  selectedElement,
  initialConfig,
  onSave,
}: SystemTaskConfigPanelProps) {
  const [form] = Form.useForm<FormValues>()
  const actionType = Form.useWatch('actionType', form)
  const [scriptValue, setScriptValue] = useState<string>('')

  const selectedAction = ACTION_OPTIONS.find((o) => o.value === actionType)

  useEffect(() => {
    if (!selectedElement) return

    const saved =
      initialConfig?.kind === 'system-task'
        ? (initialConfig.config as SystemTaskConfig)
        : null

    const normalized = normalizeSavedSystemTaskConfig(saved)
    form.setFieldsValue(normalized)

    if (normalized.customScript) {
      setScriptValue(normalized.customScript)
    }
  }, [form, initialConfig, selectedElement])

  if (!selectedElement) {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty description="Selecione uma tarefa de sistema no fluxo" />
      </Card>
    )
  }

  if (selectedElement.kind !== 'system-task') {
    return (
      <Card variant="borderless" style={{ borderRadius: 18 }}>
        <Empty description="Este elemento não é uma tarefa de sistema" />
      </Card>
    )
  }

  const handleSubmit = (values: FormValues) => {
    const normalizedActionType = isAllowedSystemTaskActionType(values.actionType)
      ? values.actionType
      : DEFAULT_CONFIG.actionType

    const normalizedConfig: SystemTaskConfig = {
      actionType: normalizedActionType,
      auditNote: values.auditNote,
      notificationTemplateIds: values.notificationTemplateIds ?? [],
      subprocess: undefined,
      // Only persist script when action is custom-script
      customScript:
        normalizedActionType === 'custom-script' ? scriptValue : undefined,
    }

    onSave({
      workflowId,
      elementId: selectedElement.id,
      elementType: selectedElement.type,
      elementName: selectedElement.name,
      kind: 'system-task',
      config: normalizedConfig,
    })
  }

  return (
    <Form<FormValues> form={form} layout="vertical" onFinish={handleSubmit}>
      <Card
        variant="borderless"
        style={{ borderRadius: 18 }}
        title={
          <Space>
            <SettingOutlined style={{ color: '#1677ff' }} />
            <span>Tarefa de sistema</span>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Alert
          type="info"
          showIcon
          style={{ margin: '16px 16px 0 16px' }}
          message={selectedElement.name || 'Tarefa de sistema'}
          description={
            <>
              Executada <strong>automaticamente pelo motor</strong> ao chegar
              nesta etapa, sem interação humana. Para criação de subprocesso,
              use o painel específico de subprocesso.
            </>
          }
        />

        <Tabs
          size="small"
          tabBarStyle={{
            margin: '16px 0 0 0',
            paddingLeft: 24,
            paddingRight: 24,
            borderBottom: '1px solid #f1f5f9',
            background: '#fafbfc',
          }}
          items={[
            {
              key: 'action',
              label: (
                <Space size={6}>
                  <ThunderboltOutlined />
                  <span>Ação</span>
                </Space>
              ),
              children: (
                <div style={tabPaneStyle}>
                  <Text style={sectionLabelStyle}>O que esta etapa faz</Text>

                  <Form.Item
                    label="Tipo de ação"
                    name="actionType"
                    rules={[{ required: true, message: 'Selecione a ação' }]}
                    style={{ marginBottom: 16 }}
                  >
                    <Select
                      options={ACTION_OPTIONS.map((option) => ({
                        label: (
                          <Space size={8}>
                            <Tag color={option.tagColor} style={{ margin: 0 }}>
                              {option.tag}
                            </Tag>
                            {option.label}
                          </Space>
                        ),
                        value: option.value,
                      }))}
                    />
                  </Form.Item>

                  {/* Description for non-script actions */}
                  {selectedAction && actionType !== 'custom-script' && (
                    <Alert
                      type="success"
                      showIcon={false}
                      style={{ borderRadius: 10 }}
                      message={
                        <Space direction="vertical" size={2}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {selectedAction.description}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Os parâmetros específicos, como campo, formato,
                            valor, URL ou script, são tratados pelo motor do
                            processo.
                          </Text>
                        </Space>
                      }
                    />
                  )}

                  {/* ── Custom Script Editor — rendered inline in the Ação tab ── */}
                  {actionType === 'custom-script' && (
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 12,
                        padding: 16,
                        background: '#fafbfc',
                        marginTop: 4,
                      }}
                    >
                      {/* Sub-header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 14,
                          paddingBottom: 12,
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        <CodeOutlined style={{ color: '#fa541c', fontSize: 15 }} />
                        <Text style={{ fontWeight: 600, fontSize: 13 }}>
                          Script personalizado
                        </Text>
                        <Tag color="volcano" style={{ margin: 0, fontSize: 10 }}>
                          JS
                        </Tag>
                      </div>

                      <CustomScriptEditor
                        value={scriptValue}
                        onChange={setScriptValue}
                      />
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'audit',
              label: (
                <Space size={6}>
                  <FileTextOutlined />
                  <span>Auditoria</span>
                </Space>
              ),
              children: (
                <div style={tabPaneStyle}>
                  <Text style={sectionLabelStyle}>Rastreabilidade</Text>

                  <Form.Item
                    label="Nota de auditoria"
                    name="auditNote"
                    tooltip="Texto em linguagem de negócio registrado no histórico da instância."
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder={
                        selectedAction?.auditPlaceholder ??
                        'Descreva o efeito desta etapa no documento...'
                      }
                    />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'notifications',
              label: (
                <Space size={6}>
                  <BellOutlined />
                  <span>Notificações</span>
                </Space>
              ),
              children: (
                <div style={tabPaneStyle}>
                  <Text style={sectionLabelStyle}>Disparos após execução</Text>

                  <Form.Item
                    label="Notificações após execução"
                    name="notificationTemplateIds"
                    tooltip="Templates disparados imediatamente após o motor executar esta tarefa."
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      mode="tags"
                      placeholder="Ex.: notif-revisao-atualizada, notif-sistema"
                    />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />

        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f1f5f9',
            background: '#fafbfc',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button
            type="primary"
            htmlType="submit"
            style={{
              borderRadius: 8,
              background: '#0f172a',
              borderColor: '#0f172a',
              fontWeight: 600,
              paddingLeft: 28,
              paddingRight: 28,
            }}
          >
            Salvar tarefa de sistema
          </Button>
        </div>
      </Card>
    </Form>
  )
}