import type {
  ActivityConfig,
  ActivityMetadataFieldRule,
  EndEventConfig,
  StartEventConfig,
  WorkflowElementConfig,
} from './storage'

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeMetadataFieldRules(
  fields?: ActivityMetadataFieldRule[],
): ActivityMetadataFieldRule[] {
  if (!Array.isArray(fields)) return []

  return fields
    .filter((field) => Boolean(field?.metadataDefinitionId))
    .map((field) => ({
      metadataDefinitionId: String(field.metadataDefinitionId),
      isRequired: Boolean(field.isRequired),
      isReadOnly: Boolean(field.isReadOnly),
    }))
}

function sanitizeStartConfig(config: StartEventConfig): StartEventConfig {
  const metadataFields = normalizeMetadataFieldRules(config.metadataFields)

  return {
    ...config,
    metadataSetIds: uniqueStrings(config.metadataSetIds ?? []),
    initialMetadataDefinitionIds: uniqueStrings(config.initialMetadataDefinitionIds ?? []),
    metadataFields,
  }
}

function sanitizeActivityConfig(config: ActivityConfig): ActivityConfig {
  const metadataFields = normalizeMetadataFieldRules(config.metadataFields)
  const metadataDefinitionIdsFromRules = metadataFields.map(
    (field) => field.metadataDefinitionId,
  )

  return {
    ...config,
    metadataSetIds: uniqueStrings(config.metadataSetIds ?? []),
    metadataDefinitionIds: uniqueStrings([
      ...(config.metadataDefinitionIds ?? []),
      ...metadataDefinitionIdsFromRules,
    ]),
    metadataFields,
  }
}

function sanitizeEndConfig(config: EndEventConfig): EndEventConfig {
  const metadataFields = normalizeMetadataFieldRules(config.metadataFields)
  const metadataDefinitionIdsFromRules = metadataFields.map(
    (field) => field.metadataDefinitionId,
  )

  return {
    ...config,
    metadataSetIds: uniqueStrings(config.metadataSetIds ?? []),
    finalMetadataDefinitionIds: uniqueStrings([
      ...(config.finalMetadataDefinitionIds ?? []),
      ...metadataDefinitionIdsFromRules,
    ]),
    metadataFields,
  }
}

export function sanitizeElementConfigForPersistence(
  item: WorkflowElementConfig,
): WorkflowElementConfig {
  if (item.kind === 'start') {
    return {
      ...item,
      config: sanitizeStartConfig(item.config as StartEventConfig),
    }
  }

  if (item.kind === 'activity') {
    return {
      ...item,
      config: sanitizeActivityConfig(item.config as ActivityConfig),
    }
  }

  if (item.kind === 'end') {
    return {
      ...item,
      config: sanitizeEndConfig(item.config as EndEventConfig),
    }
  }

  if (item.kind === 'subprocess') {
    return item
  }

  return item
}

export function sanitizeElementConfigsForPersistence(
  items: WorkflowElementConfig[],
): WorkflowElementConfig[] {
  return items.map(sanitizeElementConfigForPersistence)
}