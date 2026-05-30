import { apiClient } from '@/shared/lib/apiClient'

export interface KbNode {
  id: string
  type: string
  title: string
  has_embedding: boolean
  degree: number
}

export interface KbNodesResp {
  total: number
  stances: number
  concepts: number
  items: KbNode[]
}

export interface KbSearchHit {
  id: string
  title: string
  type: string
  is_seed: boolean
  score: number | null
}

export interface KbGraphNode {
  id: string
  title: string
  type: string
  degree: number
}

export interface KbGraphEdge {
  source: string
  target: string
  rel: string
}

export interface KbGraph {
  nodes: KbGraphNode[]
  edges: KbGraphEdge[]
}

export async function listKbNodes(node_type?: string, q?: string): Promise<KbNodesResp> {
  return (await apiClient.get<KbNodesResp>('/kb/nodes', { params: { node_type, q } })).data
}

export async function getKbGraph(): Promise<KbGraph> {
  return (await apiClient.get<KbGraph>('/kb/graph')).data
}

export interface KbNeighbor {
  id: string
  title: string
  type: string
  rel: string
}

export interface KbNodeDetail {
  id: string
  type: string
  title: string
  body: string | null
  has_embedding: boolean
  neighbors: KbNeighbor[]
}

export async function getKbNode(id: string): Promise<KbNodeDetail> {
  return (await apiClient.get<KbNodeDetail>(`/kb/node/${encodeURIComponent(id)}`)).data
}

export async function searchKb(query: string): Promise<{ items: KbSearchHit[] }> {
  return (await apiClient.post<{ items: KbSearchHit[] }>('/kb/search', { query })).data
}
