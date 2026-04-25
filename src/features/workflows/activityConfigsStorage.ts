export type WorkflowActivityConfig = {
  id: string
  workflowId: string
  elementId: string
  elementType: string
  elementName?: string

  responsibleRoleIds: string[]
  responsibleUserIds: string[]

  deadlineMode: 'hours' | 'days' | 'date'
  deadlineValue?: number | string

  metadataDefinitionIds: string[]
  notificationTemplateIds: string[]

  allowApprove: boolean
  allowReject: boolean
  allowRequestChanges: boolean

  instructions?: string

  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'gestao-docs:workflow-activity-configs'

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function loadWorkflowActivityConfigs(): WorkflowActivityConfig[] {
  return safeParseJson<WorkflowActivityConfig[]>(
    localStorage.getItem(STORAGE_KEY),
    [],
  )
}

export function saveWorkflowActivityConfigs(items: WorkflowActivityConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function getActivityConfig(workflowId: string, elementId: string) {
  return (
    loadWorkflowActivityConfigs().find(
      (item) => item.workflowId === workflowId && item.elementId === elementId,
    ) ?? null
  )
}

export function upsertActivityConfig(
  input: Omit<WorkflowActivityConfig, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const items = loadWorkflowActivityConfigs()
  const now = new Date().toISOString()

  const index = items.findIndex(
    (item) => item.workflowId === input.workflowId && item.elementId === input.elementId,
  )

  if (index >= 0) {
    items[index] = {
      ...items[index],
      ...input,
      updatedAt: now,
    }
  } else {
    items.unshift({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    })
  }

  saveWorkflowActivityConfigs(items)
}

export function removeMissingActivityConfigs(workflowId: string, validElementIds: string[]) {
  const items = loadWorkflowActivityConfigs()
  const nextItems = items.filter((item) => {
    if (item.workflowId !== workflowId) return true
    return validElementIds.includes(item.elementId)
  })

  saveWorkflowActivityConfigs(nextItems)
}