export type CodingPartType =
  | 'fixed'
  | 'metadata'
  | 'year'
  | 'unit'
  | 'area'
  | 'process'
  | 'sequential'

export interface CodingRulePart {
  type: CodingPartType
  fixedValue?: string
  metadataDefinitionId?: string
  metadataLabel?: string
  separatorAfter?: string
}

export interface EnvironmentSettings {
  id?: string
  accountId?: string
  processId?: string
  name?: string
  code?: string
  description?: string
  isActive?: boolean
  revision: {
    pattern: 'numeric' | 'alphabetic' | 'alphanumeric'
    initialValue: string
    autoIncrementOnApproval: boolean
    allowManualEdition: boolean
  }
  creationMode: {
    mode: 'manual' | 'batch' | 'both'
    requireTemplateInBatch: boolean
  }
  codingRule: {
    parts: CodingRulePart[]
  }
  sequential: {
    startAt: number
    digits: number
    resetPeriod: 'never' | 'yearly' | 'monthly'
  }
  deadlines: {
    totalProcessDays: number
  }
}
