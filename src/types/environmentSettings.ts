export type CodingPartType =
  | 'fixed'
  | 'metadata'
  | 'year'
  | 'unit'
  | 'area'
  | 'process'
  | 'sequential'

export type CodingSeparator = '' | '-' | '/' | '.'

export interface CodingRulePart {
  type: CodingPartType
  fixedValue?: string
  metadataDefinitionId?: string
  metadataLabel?: string
  separatorAfter?: CodingSeparator
}

export interface EnvironmentSettings {
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