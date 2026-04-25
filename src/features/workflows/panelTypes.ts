import type { WorkflowElementConfig } from './storage'

/**
 * Payload que os painéis filhos passam para onSave.
 *
 * NÃO inclui os campos de scope (accountId, scopeLevel, processId, etc.)
 * porque esses são injetados pelo WorkflowElementConfigPanel via onSaveWithScope
 * antes de chegar ao WorkflowStudioPage.
 */
export type ElementConfigSavePayload = Omit<
  WorkflowElementConfig,
  'id' | 'createdAt' | 'updatedAt' | 'accountId' | 'scopeLevel' | 'accountName' | 'processId' | 'processName' | 'tenantId'
>