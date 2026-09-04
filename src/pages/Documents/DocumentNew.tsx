import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Form, Input, Button, Card, Typography, Space, message,
  Upload, Alert, Descriptions, Spin,
} from 'antd'
import {
  UploadOutlined, ArrowLeftOutlined, LockOutlined,
  ApartmentOutlined, FolderOpenOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons'
import { getOrgGroups } from '../../api/organization'
import { createDocument, uploadFile } from '../../api/documents'
import {
  getMetadataDefinitions,
  type MetadataDefinitionDto,
  type MetadataValueDto,
} from '../../api/metadata'
import { MetadataForm } from '../../components/MetadataForm'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../api/client'
import { getElementConfigsByWorkflow } from '../../features/workflows/storage'

const { Title, Text } = Typography


function checkPermission(perms: any, userId: string, userRole: string, userProcessMemberships: any[], userGroups: any[]): boolean {
  if (userRole === 'Admin' || userRole === 'admin') return true
  if (!perms) return true
  const hasRestriction = (perms.userIds?.length ?? 0) > 0 || (perms.groupIds?.length ?? 0) > 0 ||
    (perms.processIds?.length ?? 0) > 0 || (perms.areaIds?.length ?? 0) > 0
  if (!hasRestriction) return true
  if (perms.userIds?.includes(userId)) return true
  if (perms.processIds?.some((pid: string) => userProcessMemberships.some((m: any) => m.processId === pid && m.isActive !== false))) return true
  if (perms.groupIds?.some((gid: string) => userGroups.some((g: any) => g.id === gid && (g.memberIds ?? []).includes(userId)))) return true
  return false
}

function mergeCreationFields(
  workflowId: string,
  workflowSteps: any[],
  metadataDefinitions: MetadataDefinitionDto[],
): MetadataValueDto[] {
  const elementConfigs = getElementConfigsByWorkflow(workflowId)

  // ✅ CORREÇÃO: prioriza o Start Event configurado no elementConfigs
  // O start event é o elemento correto para definir os campos de criação do documento
  const startElementConfig = elementConfigs.find((c) => c.kind === 'start') ?? null

  // Fallback legado: tenta achar pelo steps da API com isInitial, depois steps[0]
  const initialStep =
    workflowSteps.find((s: any) => s.isInitial === true) ?? workflowSteps[0] ?? null

  // Resolução do config a usar: Start Event tem prioridade absoluta
  let selectedConfig: any = null

  if (startElementConfig) {
    // Usa diretamente o config do Start Event — este é o caminho correto
    selectedConfig = startElementConfig.config
  } else if (initialStep) {
    // Fallback legado: tenta encontrar config pelo elementId do initialStep
    const activityConfig = elementConfigs.find(
      (c) =>
        c.elementId === String(initialStep.id ?? '') &&
        (c.kind === 'activity' || c.kind === 'start'),
    )
    selectedConfig = activityConfig?.config ?? null
  }

  if (!selectedConfig) return []

  // Campos explícitos definidos no config (metadataFields com isRequired/isReadOnly por campo)
  const explicitFields: Array<Record<string, unknown>> = Array.isArray(
    (selectedConfig as any)?.metadataFields,
  )
    ? (selectedConfig as any).metadataFields
    : Array.isArray(initialStep?.metadataFields)
      ? initialStep.metadataFields
      : []

  // IDs de metadados definidos no start event (initialMetadataDefinitionIds tem prioridade)
  const metadataDefinitionIds: string[] = Array.isArray(
    (selectedConfig as any)?.initialMetadataDefinitionIds,
  )
    ? (selectedConfig as any).initialMetadataDefinitionIds
    : Array.isArray((selectedConfig as any)?.metadataDefinitionIds)
      ? (selectedConfig as any).metadataDefinitionIds
      : []

  const fromDefinitions = metadataDefinitionIds
    .map((id) => metadataDefinitions.find((d) => d.id === id))
    .filter(Boolean)
    .map((d) => ({
      metadataDefinitionId: String(d!.id),
      name: String(d!.name ?? d!.label ?? d!.id),
      label: String(d!.label ?? d!.name ?? d!.id),
      fieldType: String(d!.fieldType ?? 'text'),
      maskType: d!.maskType === undefined ? null : d!.maskType,
      isRequired: Boolean(d!.isRequired),
      value: null,
      options: Array.isArray(d!.options) ? d!.options : [],
      tableColumns: Array.isArray(d!.tableColumns) ? d!.tableColumns : [],
    }))

  const fromExplicitFields = explicitFields.map((field) => {
    const defId = String(field.metadataDefinitionId ?? '')
    const d = metadataDefinitions.find((i) => i.id === defId)
    return {
      metadataDefinitionId: defId,
      name: String(field.name ?? d?.name ?? field.label ?? d?.label ?? defId),
      label: String(field.label ?? d?.label ?? field.name ?? d?.name ?? defId),
      fieldType: String(field.fieldType ?? d?.fieldType ?? 'text'),
      maskType: field.maskType !== undefined ? String(field.maskType) : d?.maskType ?? null,
      isRequired: field.isRequired !== undefined ? Boolean(field.isRequired) : Boolean(d?.isRequired ?? false),
      isReadOnly: Boolean(field.isReadOnly),
      value: null,
      options: Array.isArray(d?.options) ? d?.options : [],
      tableColumns: Array.isArray(d?.tableColumns) ? d?.tableColumns : [],
    }
  })

  const map = new Map<string, MetadataValueDto>()
  fromDefinitions.forEach((f) => map.set(f.metadataDefinitionId, f as MetadataValueDto))
  fromExplicitFields.forEach((f) => {
    const prev = map.get(f.metadataDefinitionId)
    map.set(f.metadataDefinitionId, {
      metadataDefinitionId: f.metadataDefinitionId,
      name: f.name ?? prev?.name ?? f.metadataDefinitionId,
      label: f.label ?? prev?.label ?? f.metadataDefinitionId,
      fieldType: f.fieldType ?? prev?.fieldType ?? 'text',
      maskType: f.maskType ?? prev?.maskType ?? null,
      isRequired: f.isRequired,
      value: null,
      options: f.options ?? prev?.options,
      tableColumns: f.tableColumns ?? prev?.tableColumns,
    })
  })
  return Array.from(map.values())
}

export function DocumentNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [form] = Form.useForm()
  const [fileToUpload, setFileToUpload] = useState<File | null>(null)

  const paramWorkflowId = searchParams.get('workflowId')
  const paramProcessId = searchParams.get('processId')
  const paramProcessName = searchParams.get('processName')

  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data } = await api.get('/workflows')
      return Array.isArray(data) ? data : []
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const { data: metadataDefinitions = [] } = useQuery({
    queryKey: ['metadata-definitions'],
    queryFn: () => getMetadataDefinitions(),
  })

  const { data: userProcessMemberships = [] } = useQuery({
    queryKey: ['user-process-memberships', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await api.get('/user-process-memberships', { params: { userId: user.id } })
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const { data: orgGroups = [] } = useQuery({
    queryKey: ['org-groups'],
    queryFn: getOrgGroups,
  })

  const workflow = (workflows as any[]).find((w: any) =>
    paramWorkflowId ? w.id === paramWorkflowId : paramProcessId ? w.processId === paramProcessId : false,
  ) ?? null

  const steps = (workflow?.steps as any[]) ?? []

  // ✅ CORREÇÃO: busca o Start Event diretamente nos elementConfigs do workflow
  const workflowElementConfigs = workflow
    ? getElementConfigsByWorkflow(String(workflow.id))
    : []

  const startElementConfig = workflowElementConfigs.find((c) => c.kind === 'start') ?? null

  // Nome exibido no card de resumo: prioriza o nome do Start Event configurado
  const initialStepDisplayName =
    startElementConfig?.elementName ??
    steps.find((s: any) => s.isInitial === true)?.name ??
    steps[0]?.name ??
    null

  const creationFields = useMemo(
    () => workflow ? mergeCreationFields(String(workflow.id), steps, metadataDefinitions) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workflow, steps, metadataDefinitions],
  )

  const canCreate = workflow
    ? checkPermission(workflow.permissions?.creation, user?.id ?? '', user?.role ?? '', userProcessMemberships as any[], orgGroups as any[])
    : false

  const mutation = useMutation({
    mutationFn: createDocument,
    onSuccess: async (data: any) => {
      const createdId = data?.id ?? data?._id?.toString?.()

      if (!createdId) {
        message.error('Documento criado sem identificador válido.')
        return
      }

      if (fileToUpload) {
        try {
          await uploadFile(createdId, fileToUpload)
        } catch {
          message.warning(
            'O documento foi criado, mas ocorreu um erro no envio do arquivo.',
          )
        }
      }

      await qc.invalidateQueries({ queryKey: ['documents'] })
      await qc.invalidateQueries({ queryKey: ['tasks', 'all'] })
      await qc.invalidateQueries({ queryKey: ['tasks'] })

      message.success('Documento criado com sucesso.')
      navigate(`/documents/${createdId}`)
    },
    onError: (error: any) => {
      console.error('createDocument error =>', error?.response?.data ?? error)
      message.error(
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        error?.message ??
        'Erro ao criar documento.'
      )
    },
  })

  const handleSubmit = (values: Record<string, any>) => {
    if (!canCreate) {
      message.error('Você não tem permissão para criar documentos neste processo.')
      return
    }
    if (!workflow) {
      message.error('Nenhum fluxo encontrado para este processo.')
      return
    }

    const resolvedProcessId = paramProcessId ?? workflow.processId ?? null
    const resolvedProcessName = paramProcessName ?? workflow.processName ?? ''

    if (!resolvedProcessId) {
      message.error('Processo não identificado. Volte à lista e tente novamente.')
      return
    }

    const initialMetadataValues = creationFields.reduce<Record<string, unknown>>((acc, f) => {
      acc[f.metadataDefinitionId] = values[f.metadataDefinitionId]
      return acc
    }, {})

    mutation.mutate({
      title: values.title,
      workflowId: workflow.id,
      workflowName: workflow.name,
      accountId: user?.accountId ?? (workflow as any).accountId ?? '',
      processId: resolvedProcessId,
      processName: resolvedProcessName,
      createdById: user?.id ?? '',
      createdByName: user?.name ?? '',
      steps: workflow.steps ?? [],
      initialMetadataValues,
    })
  }

  useEffect(() => {
    if (!loadingWorkflows && !paramProcessId && !paramWorkflowId) navigate('/documents')
  }, [loadingWorkflows, paramProcessId, paramWorkflowId, navigate])

  if (loadingWorkflows) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>

  const missingProcessId = !loadingWorkflows && !!workflow && !paramProcessId && !workflow.processId

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/documents')}>Voltar</Button>
        <Title level={4} style={{ margin: 0 }}>Novo Documento</Title>
      </Space>

      <Card style={{ marginBottom: 16, background: '#f6f8fa' }} styles={{ body: { padding: '14px 20px' } }}>
        <Descriptions size="small" column={2}>
          <Descriptions.Item label={<><FolderOpenOutlined /> Processo</>}>
            <Text strong>{paramProcessName ?? workflow?.processName ?? '-'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={<><ApartmentOutlined /> Fluxo vinculado</>}>
            {workflow ? <Text strong>{workflow.name}</Text>
              : <Text type="danger"><ExclamationCircleOutlined /> Nenhum fluxo encontrado para este processo</Text>}
          </Descriptions.Item>
          {/* ✅ CORREÇÃO: exibe o nome do Start Event (evento de início), não da primeira atividade */}
          {initialStepDisplayName && (
            <Descriptions.Item label="Evento de início" span={2}>
              <Text type="secondary">
                O documento será iniciado em: <strong>{initialStepDisplayName}</strong>
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {!workflow && (
        <Alert type="warning" showIcon icon={<ExclamationCircleOutlined />}
          message="Nenhum fluxo cadastrado para este processo"
          description="Acesse as configurações do processo e cadastre um workflow antes de criar documentos."
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => navigate('/documents')}>Voltar</Button>}
        />
      )}

      {workflow && !canCreate && (
        <Alert type="error" showIcon icon={<LockOutlined />}
          message="Sem permissão de criação"
          description={`Você não tem permissão para criar documentos no processo "${paramProcessName ?? workflow.processName}".`}
          style={{ marginBottom: 16 }}
        />
      )}

      {missingProcessId && (
        <Alert type="error" showIcon icon={<ExclamationCircleOutlined />}
          message="Processo não vinculado ao fluxo"
          description="O fluxo selecionado não possui um processo associado. Verifique as configurações do workflow."
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => navigate('/documents')}>Voltar</Button>}
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Card style={{ marginBottom: 16 }}>
          <Form.Item label="Título do documento" name="title" rules={[{ required: true, message: 'Informe o título do documento' }]}>
            <Input placeholder="Ex.: Contrato de Prestação de Serviços — Empresa X" disabled={!workflow || !canCreate || missingProcessId} />
          </Form.Item>
          {creationFields.length > 0 && (
            <><Title level={5}>Metadados iniciais</Title><MetadataForm fields={creationFields} form={form} /></>
          )}
          <Form.Item label="Arquivo inicial (opcional)">
            <Upload beforeUpload={(file) => { setFileToUpload(file); return false }} maxCount={1} disabled={!workflow || !canCreate || missingProcessId}>
              <Button icon={<UploadOutlined />} disabled={!workflow || !canCreate || missingProcessId}>Selecionar arquivo</Button>
            </Upload>
          </Form.Item>
        </Card>
        <Button type="primary" htmlType="submit" loading={mutation.isPending}
          disabled={!workflow || !canCreate || missingProcessId}
          icon={(!workflow || !canCreate || missingProcessId) ? <LockOutlined /> : undefined}
          size="large"
        >
          {!canCreate && workflow ? 'Sem permissão' : missingProcessId ? 'Processo inválido' : 'Criar Documento'}
        </Button>
      </Form>
    </div>
  )
}