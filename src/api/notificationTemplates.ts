import { api } from './client'
import type {
  NotificationTemplate,
  NotificationTemplateListItem,
  NotificationTemplatePayload,
} from '../types/notificationTemplates'

const BASE_PATH = '/notificationTemplates'

function normalizePayload(payload: NotificationTemplatePayload): NotificationTemplatePayload {
  return {
    ...payload,
    name:        payload.name.trim(),
    code:        payload.code.trim(),
    description: payload.description?.trim() || '',
    subject:     payload.channel === 'email' ? payload.subject?.trim() || '' : '',
    body:        payload.body.trim(),
    isActive:    Boolean(payload.isActive),
  }
}

export async function getNotificationTemplates(): Promise<NotificationTemplateListItem[]> {
  const { data } = await api.get<NotificationTemplate[]>(BASE_PATH)
  return [...data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function getNotificationTemplateById(id: string): Promise<NotificationTemplate | null> {
  try {
    const { data } = await api.get<NotificationTemplate>(`${BASE_PATH}/${id}`)
    return data
  } catch {
    return null
  }
}

export async function createNotificationTemplate(payload: NotificationTemplatePayload): Promise<NotificationTemplate> {
  const { data } = await api.post<NotificationTemplate>(BASE_PATH, normalizePayload(payload))
  return data
}

export async function updateNotificationTemplate(id: string, payload: NotificationTemplatePayload): Promise<NotificationTemplate> {
  const { data } = await api.put<NotificationTemplate>(`${BASE_PATH}/${id}`, normalizePayload(payload))
  return data
}

export async function deleteNotificationTemplate(id: string): Promise<void> {
  await api.delete(`${BASE_PATH}/${id}`)
}