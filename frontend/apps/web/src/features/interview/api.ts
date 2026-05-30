import { apiClient } from '@/shared/lib/apiClient'

export interface ScoreDimension {
  name: string
  score: number
  comment: string
}

export interface ScoreResult {
  total: number
  dimensions: ScoreDimension[]
  summary: string
  suggestions: string[]
  sources: string[]
  model?: string
}

/** 面试模拟评分:作答 → 依知识库 rubric 结构化打分。 */
export async function scoreInterview(question: string, answer: string): Promise<ScoreResult> {
  return (await apiClient.post<ScoreResult>('/interview/score', { question, answer })).data
}
