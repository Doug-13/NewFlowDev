import { api } from './client'

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface UnitDto {
  id: string
  name: string
  code?: string
  description?: string
  isActive: boolean
  createdAt: string
}

export interface AreaDto {
  id: string
  name: string
  code?: string
  description?: string
  unitId?: string
  unitName?: string
  isActive: boolean
  createdAt: string
}

export interface DisciplineDto {
  id: string
  name: string
  code?: string
  description?: string
  areaId?: string
  areaName?: string
  unitId?: string
  unitName?: string
  isActive: boolean
  createdAt: string
}

export interface OrgRoleDto {
  id: string
  name: string
  code?: string
  description?: string
  disciplineId?: string
  disciplineName?: string
  areaId?: string
  areaName?: string
  isActive: boolean
  createdAt: string
}

export interface OrgGroupDto {
  id: string
  name: string
  code?: string
  description?: string
  /** IDs dos usuários membros do grupo */
  memberIds: string[]
  /** Nomes dos membros (preenchido pelo backend na leitura) */
  memberNames?: string[]
  isActive: boolean
  createdAt: string
}

// ─── UNITS ───────────────────────────────────────────────────────────────────

export const getUnits = async () =>
  (await api.get('/organization/units')).data as UnitDto[]

export const getUnitById = async (id: string) =>
  (await api.get(`/organization/units/${id}`)).data as UnitDto

export const createUnit = async (data: { name: string; code?: string; description?: string }) =>
  (await api.post('/organization/units', data)).data as UnitDto

export const updateUnit = async (id: string, data: { name: string; code?: string; description?: string }) =>
  (await api.put(`/organization/units/${id}`, data)).data as UnitDto

export const deleteUnit = async (id: string) =>
  api.delete(`/organization/units/${id}`)

// ─── AREAS ───────────────────────────────────────────────────────────────────

export const getAreas = async () =>
  (await api.get('/organization/areas')).data as AreaDto[]

export const getAreasByUnit = async (unitId: string) =>
  (await api.get('/organization/areas', { params: { unitId } })).data as AreaDto[]

export const getAreaById = async (id: string) =>
  (await api.get(`/organization/areas/${id}`)).data as AreaDto

export const createArea = async (data: { name: string; code?: string; description?: string; unitId?: string }) =>
  (await api.post('/organization/areas', data)).data as AreaDto

export const updateArea = async (id: string, data: { name: string; code?: string; description?: string; unitId?: string }) =>
  (await api.put(`/organization/areas/${id}`, data)).data as AreaDto

export const deleteArea = async (id: string) =>
  api.delete(`/organization/areas/${id}`)

// ─── DISCIPLINES ─────────────────────────────────────────────────────────────

export const getDisciplines = async () =>
  (await api.get('/organization/disciplines')).data as DisciplineDto[]

export const getDisciplinesByArea = async (areaId: string) =>
  (await api.get('/organization/disciplines', { params: { areaId } })).data as DisciplineDto[]

export const getDisciplineById = async (id: string) =>
  (await api.get(`/organization/disciplines/${id}`)).data as DisciplineDto

export const createDiscipline = async (data: {
  name: string; code?: string; description?: string; areaId?: string
}) => (await api.post('/organization/disciplines', data)).data as DisciplineDto

export const updateDiscipline = async (id: string, data: {
  name: string; code?: string; description?: string; areaId?: string
}) => (await api.put(`/organization/disciplines/${id}`, data)).data as DisciplineDto

export const deleteDiscipline = async (id: string) =>
  api.delete(`/organization/disciplines/${id}`)

// ─── ROLES ───────────────────────────────────────────────────────────────────

export const getOrgRoles = async () =>
  (await api.get('/organization/roles')).data as OrgRoleDto[]

export const getOrgRolesByDiscipline = async (disciplineId: string) =>
  (await api.get('/organization/roles', { params: { disciplineId } })).data as OrgRoleDto[]

export const getOrgRoleById = async (id: string) =>
  (await api.get(`/organization/roles/${id}`)).data as OrgRoleDto

export const createOrgRole = async (data: {
  name: string; code?: string; description?: string; areaId?: string; disciplineId?: string
}) => (await api.post('/organization/roles', data)).data as OrgRoleDto

export const updateOrgRole = async (id: string, data: {
  name: string; code?: string; description?: string; areaId?: string; disciplineId?: string
}) => (await api.put(`/organization/roles/${id}`, data)).data as OrgRoleDto

export const deleteOrgRole = async (id: string) =>
  api.delete(`/organization/roles/${id}`)

// ─── GROUPS ──────────────────────────────────────────────────────────────────

export const getOrgGroups = async () =>
  (await api.get('/organization/groups')).data as OrgGroupDto[]

export const createOrgGroup = async (data: {
  name: string
  code?: string
  description?: string
  memberIds?: string[]
}) => (await api.post('/organization/groups', data)).data as OrgGroupDto

export const updateOrgGroup = async (id: string, data: {
  name: string
  code?: string
  description?: string
  memberIds?: string[]
}) => (await api.put(`/organization/groups/${id}`, data)).data as OrgGroupDto

export const deleteOrgGroup = async (id: string) =>
  api.delete(`/organization/groups/${id}`)