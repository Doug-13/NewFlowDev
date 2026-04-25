import { api } from './client'
import type { Visualizacao } from '../pages/Exibicao/ExibicaoPage'

const BASE_PATH = '/visualizacoes'

export async function getVisualizacoes(): Promise<Visualizacao[]> {
  const { data } = await api.get<Visualizacao[]>(BASE_PATH)
  return [...data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function createVisualizacao(payload: Omit<Visualizacao, 'id'>): Promise<Visualizacao> {
  const { data } = await api.post<Visualizacao>(BASE_PATH, payload)
  return data
}

export async function updateVisualizacao(id: string, payload: Omit<Visualizacao, 'id'>): Promise<Visualizacao> {
  const { data } = await api.put<Visualizacao>(`${BASE_PATH}/${id}`, payload)
  return data
}

export async function deleteVisualizacao(id: string): Promise<void> {
  await api.delete(`${BASE_PATH}/${id}`)
}