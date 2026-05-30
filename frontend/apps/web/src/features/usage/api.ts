import { apiClient } from '@/shared/lib/apiClient'

export interface LlmUsage {
  requests: number
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  avg_latency_ms: number
  est_cost_cny: number
  by_model: { model: string | null; requests: number; tokens: number }[]
  by_endpoint: { endpoint: string | null; requests: number; tokens: number }[]
}

export interface UsagePoint {
  t: string | null
  tokens: number
  latency_ms: number
  endpoint: string | null
  model: string | null
}

export async function getUsage(): Promise<LlmUsage> {
  return (await apiClient.get<LlmUsage>('/llm/usage')).data
}

export async function getUsageTimeseries(): Promise<UsagePoint[]> {
  return (await apiClient.get<UsagePoint[]>('/llm/usage/timeseries')).data
}
