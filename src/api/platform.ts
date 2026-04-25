import { api } from './client'
import type { Tenant } from '../types'

export const listTenants = async (): Promise<Tenant[]> => {
  const res = await api.get('/platform/tenants')
  return res.data
}

export const createTenant = async (data: { name: string; slug: string; modules: string[] }) => {
  const res = await api.post('/platform/tenants', data)
  return res.data
}

export const updateTenant = async (id: string, data: { name: string; isActive: boolean; modules: string[] }) => {
  const res = await api.put(`/platform/tenants/${id}`, data)
  return res.data
}

export const deleteTenant = async (id: string) => {
  await api.delete(`/platform/tenants/${id}`)
}

export const listPlatformAdmins = async () => {
  const res = await api.get('/platform/admins')
  return res.data
}

export const createPlatformAdmin = async (data: { name: string; email: string; password: string }) => {
  const res = await api.post('/platform/admins', data)
  return res.data
}

export const updatePlatformAdmin = async (id: string, data: { name: string; isActive: boolean; password?: string }) => {
  const res = await api.put(`/platform/admins/${id}`, data)
  return res.data
}

export const deletePlatformAdmin = async (id: string) => {
  await api.delete(`/platform/admins/${id}`)
}

export const listTenantUsers = async (tenantId: string) => {
  const res = await api.get(`/platform/tenants/${tenantId}/users`)
  return res.data
}

export const createTenantUser = async (tenantId: string, data: { name: string; email: string; password: string; role: string }) => {
  const res = await api.post(`/platform/tenants/${tenantId}/users`, data)
  return res.data
}

export const updateTenantUser = async (tenantId: string, userId: string, data: { name: string; role: string; isActive: boolean; password?: string }) => {
  const res = await api.put(`/platform/tenants/${tenantId}/users/${userId}`, data)
  return res.data
}

export const deleteTenantUser = async (tenantId: string, userId: string) => {
  await api.delete(`/platform/tenants/${tenantId}/users/${userId}`)
}
