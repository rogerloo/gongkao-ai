import { apiClient } from '@/shared/lib/apiClient'

export interface PromptSummary {
  id: number
  name: string
  current_version: number
  versions: number
}

export interface PromptVersion {
  id: number
  version: number
  system_prompt: string
  variables: string[]
  created_at: string | null
}

export interface PromptDetail {
  id: number
  name: string
  current_version: number
  versions: PromptVersion[]
}

export async function listPrompts(): Promise<PromptSummary[]> {
  return (await apiClient.get<PromptSummary[]>('/prompts')).data
}

export async function getPrompt(id: number): Promise<PromptDetail> {
  return (await apiClient.get<PromptDetail>(`/prompts/${id}`)).data
}

export async function createPrompt(name: string, system_prompt: string): Promise<{ id: number }> {
  return (await apiClient.post<{ id: number }>('/prompts', { name, system_prompt })).data
}

export async function addVersion(id: number, system_prompt: string): Promise<{ version: number }> {
  return (await apiClient.post<{ version: number }>(`/prompts/${id}/versions`, { system_prompt }))
    .data
}

export async function setCurrent(id: number, version: number): Promise<unknown> {
  return (await apiClient.put(`/prompts/${id}/current/${version}`)).data
}
