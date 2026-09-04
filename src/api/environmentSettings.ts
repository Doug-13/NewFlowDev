import { api } from './client'
import type { CodingRulePart, EnvironmentSettings } from '../types/environmentSettings'

export type { CodingRulePart, EnvironmentSettings } from '../types/environmentSettings'

type EnvironmentSettingsApiResponse = {
  id?: string
  accountId?: string
  revision?: Partial<EnvironmentSettings['revision']>
  creationMode?: Partial<EnvironmentSettings['creationMode']>
  codingRule?: {
    parts?: CodingRulePart[]
  }
  sequential?: Partial<EnvironmentSettings['sequential']>
  deadlines?: Partial<EnvironmentSettings['deadlines']>
}

type EnvironmentSettingsInput = {
  id?: string
  accountId?: string
  processId?: string
  name?: string
  code?: string
  description?: string
  isActive?: boolean
  revision?: Partial<EnvironmentSettings['revision']>
  creationMode?: Partial<EnvironmentSettings['creationMode']>
  codingRule?: {
    parts?: CodingRulePart[]
  }
  sequential?: Partial<EnvironmentSettings['sequential']>
  deadlines?: Partial<EnvironmentSettings['deadlines']>
}

const DEFAULT_VALUES: EnvironmentSettings = {
  revision: {
    pattern: 'numeric',
    initialValue: '00',
    autoIncrementOnApproval: true,
    allowManualEdition: false,
  },
  creationMode: {
    mode: 'both',
    requireTemplateInBatch: true,
  },
  codingRule: {
    parts: [
      { type: 'fixed', fixedValue: 'DOC', separatorAfter: '-' },
      { type: 'year', separatorAfter: '-' },
      { type: 'sequential', separatorAfter: '' },
    ],
  },
  sequential: {
    startAt: 1,
    digits: 4,
    resetPeriod: 'yearly',
  },
  deadlines: {
    totalProcessDays: 15,
  },
}

export function normalizeEnvironmentSettings(
  values?: EnvironmentSettingsInput | null,
): EnvironmentSettings {
  return {
    id: values?.id,
    accountId: values?.accountId,
    processId: values?.processId,
    name: String(values?.name ?? ''),
    code: String(values?.code ?? ''),
    description: String(values?.description ?? ''),
    isActive: values?.isActive ?? true,
    revision: {
      pattern: values?.revision?.pattern ?? DEFAULT_VALUES.revision.pattern,
      initialValue: values?.revision?.initialValue ?? DEFAULT_VALUES.revision.initialValue,
      autoIncrementOnApproval:
        values?.revision?.autoIncrementOnApproval ??
        DEFAULT_VALUES.revision.autoIncrementOnApproval,
      allowManualEdition:
        values?.revision?.allowManualEdition ?? DEFAULT_VALUES.revision.allowManualEdition,
    },
    creationMode: {
      mode: values?.creationMode?.mode ?? DEFAULT_VALUES.creationMode.mode,
      requireTemplateInBatch:
        values?.creationMode?.requireTemplateInBatch ??
        DEFAULT_VALUES.creationMode.requireTemplateInBatch,
    },
    codingRule: {
      parts:
        Array.isArray(values?.codingRule?.parts) && values!.codingRule!.parts!.length > 0
          ? values!.codingRule!.parts!.map((part) => ({
              ...part,
              separatorAfter: part.separatorAfter ?? '',
            }))
          : DEFAULT_VALUES.codingRule.parts.map((part) => ({ ...part })),
    },
    sequential: {
      startAt: values?.sequential?.startAt ?? DEFAULT_VALUES.sequential.startAt,
      digits: values?.sequential?.digits ?? DEFAULT_VALUES.sequential.digits,
      resetPeriod: values?.sequential?.resetPeriod ?? DEFAULT_VALUES.sequential.resetPeriod,
    },
    deadlines: {
      totalProcessDays:
        values?.deadlines?.totalProcessDays ?? DEFAULT_VALUES.deadlines.totalProcessDays,
    },
  }
}

function extractEnvironmentSettings(
  data?: EnvironmentSettingsApiResponse | null,
): EnvironmentSettings {
  return normalizeEnvironmentSettings({
    id: data?.id,
    accountId: data?.accountId,
    revision: data?.revision,
    creationMode: data?.creationMode,
    codingRule: data?.codingRule,
    sequential: data?.sequential,
    deadlines: data?.deadlines,
  })
}

export async function getEnvironmentSettings(accountId: string): Promise<EnvironmentSettings> {
  if (!accountId) {
    throw new Error('accountId é obrigatório para carregar as configurações.')
  }

  const { data } = await api.get<EnvironmentSettingsApiResponse | null>(
    '/environment-settings',
    {
      params: { accountId },
    },
  )

  return extractEnvironmentSettings(data)
}

export async function saveEnvironmentSettings(
  accountId: string,
  values: EnvironmentSettings,
): Promise<EnvironmentSettings> {
  if (!accountId) {
    throw new Error('accountId é obrigatório para salvar.')
  }

  const normalized = normalizeEnvironmentSettings(values)

  const payload = {
    revision: normalized.revision,
    creationMode: normalized.creationMode,
    codingRule: {
      parts: Array.isArray(normalized.codingRule.parts)
        ? normalized.codingRule.parts
        : [],
    },
    sequential: normalized.sequential,
    deadlines: normalized.deadlines,
  }

  const { data } = await api.put<EnvironmentSettingsApiResponse>(
    '/environment-settings',
    payload,
  )

  return extractEnvironmentSettings(data)
}
