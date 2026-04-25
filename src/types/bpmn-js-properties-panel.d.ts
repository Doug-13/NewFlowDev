declare module 'bpmn-js-properties-panel' {
  import type { ModuleDeclaration } from 'didi'

  export const BpmnPropertiesPanelModule: ModuleDeclaration
  export const BpmnPropertiesProviderModule: ModuleDeclaration
  export const ZeebePropertiesProviderModule: ModuleDeclaration
}

declare module 'diagram-js-minimap' {
  import type { ModuleDeclaration } from 'didi'

  const minimapModule: ModuleDeclaration
  export default minimapModule
}