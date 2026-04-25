import { api } from './client'

export type ProcessoVisualizacaoConfig = {
  processId: string
  visualizacaoIdsAtivas: string[]
}

const BASE_PATH = '/processoVisualizacoes'

export async function getConfigByProcesso(processId: string): Promise<ProcessoVisualizacaoConfig | null> {
  try {
    const { data } = await api.get<ProcessoVisualizacaoConfig[]>(BASE_PATH, {
      params: { processId },
    })
    return data[0] ?? null
  } catch {
    return null
  }
}

export async function saveConfigProcesso(processId: string, visualizacaoIdsAtivas: string[]): Promise<void> {
  await api.post(BASE_PATH, { processId, visualizacaoIdsAtivas })
}