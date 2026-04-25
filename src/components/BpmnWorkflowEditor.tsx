// import { useEffect, useMemo, useRef } from 'react'
// import Modeler from 'bpmn-js/lib/Modeler'
// import {
//   BpmnPropertiesPanelModule,
//   BpmnPropertiesProviderModule,
// } from 'bpmn-js-properties-panel'

// import 'bpmn-js/dist/assets/diagram-js.css'
// import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

// // Tente este import no Vite.
// // Se o bundler reclamar, use a alternativa no index.html mostrada abaixo.
// import '@bpmn-io/properties-panel/dist/assets/properties-panel.css'

// import type { Workflow, WorkflowStep, WorkflowTransition } from '../types'
// import {
//   createWorkflowBpmnXml,
//   findStepByBpmnElementId,
//   findTransitionByBpmnFlowId,
// } from '../utils/workflowBpm'

// export type BpmnSelection =
//   | { kind: 'start'; element: unknown }
//   | { kind: 'end'; element: unknown }
//   | { kind: 'step'; element: unknown; step: WorkflowStep }
//   | { kind: 'transition'; element: unknown; transition?: WorkflowTransition }
//   | { kind: 'other'; element: unknown }
//   | null

// type Props = {
//   workflow: Workflow
//   height?: number
//   onXmlChange?: (xml: string) => void
//   onSelectionChange?: (selection: BpmnSelection) => void
// }

// function getElementType(element: any) {
//   return element?.businessObject?.$type || element?.type || ''
// }

// export function BpmnWorkflowEditor({
//   workflow,
//   height = 760,
//   onXmlChange,
//   onSelectionChange,
// }: Props) {
//   const canvasRef = useRef<HTMLDivElement | null>(null)
//   const propertiesRef = useRef<HTMLDivElement | null>(null)
//   const modelerRef = useRef<Modeler | null>(null)
//   const importingRef = useRef(false)
//   const lastLoadedXmlRef = useRef('')
//   const latestWorkflowRef = useRef(workflow)

//   latestWorkflowRef.current = workflow

//   const xmlToLoad = useMemo(() => {
//     return workflow.bpmnXml?.trim() || createWorkflowBpmnXml(workflow)
//   }, [workflow])

//   useEffect(() => {
//     if (!canvasRef.current || !propertiesRef.current) return

//     const modeler = new Modeler({
//       container: canvasRef.current,
//       propertiesPanel: {
//         parent: propertiesRef.current,
//       },
//       additionalModules: [
//         BpmnPropertiesPanelModule,
//         BpmnPropertiesProviderModule,
//       ],
//       keyboard: {
//         bindTo: window,
//       },
//     })

//     modelerRef.current = modeler

//     const handleSelectionChanged = (event: any) => {
//       const element = event?.newSelection?.[0]

//       if (!element) {
//         onSelectionChange?.(null)
//         return
//       }

//       const type = getElementType(element)
//       const currentWorkflow = latestWorkflowRef.current

//       if (type === 'bpmn:StartEvent') {
//         onSelectionChange?.({ kind: 'start', element })
//         return
//       }

//       if (type === 'bpmn:EndEvent') {
//         onSelectionChange?.({ kind: 'end', element })
//         return
//       }

//       if (
//         type === 'bpmn:Task' ||
//         type === 'bpmn:UserTask' ||
//         type === 'bpmn:ManualTask' ||
//         type === 'bpmn:ServiceTask'
//       ) {
//         const step = findStepByBpmnElementId(currentWorkflow, element.id)

//         if (step) {
//           onSelectionChange?.({ kind: 'step', element, step })
//           return
//         }
//       }

//       if (type === 'bpmn:SequenceFlow') {
//         const transition = findTransitionByBpmnFlowId(currentWorkflow, element.id)

//         onSelectionChange?.({ kind: 'transition', element, transition })
//         return
//       }

//       onSelectionChange?.({ kind: 'other', element })
//     }

//     const handleCommandChanged = async () => {
//       if (importingRef.current || !modelerRef.current) return

//       try {
//         const { xml } = await modelerRef.current.saveXML({ format: true })
//         const safeXml = xml || ''
//         lastLoadedXmlRef.current = safeXml
//         onXmlChange?.(safeXml)
//       } catch (error) {
//         console.error('Erro ao exportar BPMN XML', error)
//       }
//     }

//     modeler.on('selection.changed', handleSelectionChanged)
//     modeler.on('commandStack.changed', handleCommandChanged)

//     return () => {
//       modeler.destroy()
//       modelerRef.current = null
//     }
//   }, [onSelectionChange, onXmlChange])

//   useEffect(() => {
//     const modeler = modelerRef.current
//     if (!modeler) return
//     if (xmlToLoad === lastLoadedXmlRef.current) return

//     let cancelled = false

//     const run = async () => {
//       importingRef.current = true

//       try {
//         if (xmlToLoad?.trim()) {
//           await modeler.importXML(xmlToLoad)
//         } else {
//           await modeler.createDiagram()
//         }

//         if (cancelled) return

//         const canvas = modeler.get('canvas') as any
//         canvas.zoom('fit-viewport')

//         const { xml } = await modeler.saveXML({ format: true })
//         const safeXml = xml || ''
//         lastLoadedXmlRef.current = safeXml
//         onXmlChange?.(safeXml)
//       } catch (error) {
//         console.error('Erro ao importar XML; criando diagrama novo...', error)

//         try {
//           await modeler.createDiagram()

//           if (cancelled) return

//           const canvas = modeler.get('canvas') as any
//           canvas.zoom('fit-viewport')

//           const { xml } = await modeler.saveXML({ format: true })
//           const safeXml = xml || ''
//           lastLoadedXmlRef.current = safeXml
//           onXmlChange?.(safeXml)
//         } catch (fallbackError) {
//           console.error('Erro ao criar diagrama inicial', fallbackError)
//         }
//       } finally {
//         importingRef.current = false
//       }
//     }

//     run()

//     return () => {
//       cancelled = true
//     }
//   }, [xmlToLoad, onXmlChange])

//   return (
//     <div
//       style={{
//         display: 'grid',
//         gridTemplateColumns: '1fr 360px',
//         gap: 12,
//         width: '100%',
//         height,
//       }}
//     >
//       <div
//         style={{
//           border: '1px solid #e5e7eb',
//           borderRadius: 12,
//           overflow: 'hidden',
//           background: '#fff',
//           minWidth: 0,
//         }}
//       >
//         <div
//           ref={canvasRef}
//           style={{
//             width: '100%',
//             height: '100%',
//           }}
//         />
//       </div>

//       <div
//         style={{
//           border: '1px solid #e5e7eb',
//           borderRadius: 12,
//           overflow: 'hidden',
//           background: '#fff',
//           minWidth: 280,
//         }}
//       >
//         <div
//           ref={propertiesRef}
//           style={{
//             width: '100%',
//             height: '100%',
//             overflow: 'auto',
//           }}
//         />
//       </div>
//     </div>
//   )
// }