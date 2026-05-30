import { apiClient } from '@/shared/lib/apiClient'

export interface ModelInfo {
  id: string
  label: string
  desc: string
}

/** 可用模型目录(后端 /chat/models 单一数据源)。 */
export async function getModels(): Promise<ModelInfo[]> {
  return (await apiClient.get<ModelInfo[]>('/chat/models')).data
}

export interface ActivePrompt {
  name: string
  version: number | null
}

/** 各模式当前生效的 Prompt(配置中心改动即时生效的证据)。 */
export async function getActivePrompts(): Promise<Record<string, ActivePrompt>> {
  return (await apiClient.get<Record<string, ActivePrompt>>('/chat/active-prompts')).data
}
