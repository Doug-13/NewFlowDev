import { api } from './client'

export type ConfigEnvironment = { id: string; name: string; code: string; description?: string; isActive: boolean }
export type ConfigResourceKind = 'scripts' | 'visualization' | 'document-policy'
export type ConfigResource = { id: string; kind: ConfigResourceKind; name: string; code: string; content: Record<string, unknown>; isActive: boolean }
export type ConfigInput = { name: string; code: string; description?: string; isActive: boolean }
export type ResourceInput = { name: string; code: string; content: Record<string, unknown>; isActive: boolean }

export const getConfigEnvironments = async () => (await api.get<ConfigEnvironment[]>('/configuration/environments')).data
export const createConfigEnvironment = async (v: ConfigInput) => (await api.post<ConfigEnvironment>('/configuration/environments', v)).data
export const updateConfigEnvironment = async (id: string, v: ConfigInput) => (await api.patch<ConfigEnvironment>(`/configuration/environments/${id}`, v)).data
export const getEnvironmentProcessIds = async (id: string) => (await api.get<string[]>(`/configuration/environments/${id}/processes`)).data
export const attachEnvironmentProcess = async (id: string, processId: string) => (await api.post(`/configuration/environments/${id}/processes`, { processId })).data
export const detachEnvironmentProcess = async (id: string, processId: string) => (await api.delete(`/configuration/environments/${id}/processes/${processId}`)).data
export const getConfigResources = async (id: string, kind: ConfigResourceKind) => (await api.get<ConfigResource[]>(`/configuration/environments/${id}/resources/${kind}`)).data
export const createConfigResource = async (id: string, kind: ConfigResourceKind, v: ResourceInput) => (await api.post<ConfigResource>(`/configuration/environments/${id}/resources/${kind}`, v)).data
export const updateConfigResource = async (id: string, kind: ConfigResourceKind, rid: string, v: ResourceInput) => (await api.patch<ConfigResource>(`/configuration/environments/${id}/resources/${kind}/${rid}`, v)).data
