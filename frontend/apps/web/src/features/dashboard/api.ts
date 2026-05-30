import { apiClient } from '@/shared/lib/apiClient'

export interface Kpi {
  total_jobs: number
  total_headcount: number
  avg_apply_ratio: number | null
  avg_interview_score: number | null
  avg_value_score: number | null
}

export interface JobStats {
  kpi: Kpi
  by_year: { year: number; jobs: number; headcount: number }[]
  ratio_hist: { bucket: string; count: number }[]
  by_education: { education: string; jobs: number; headcount: number }[]
  by_province: { province: string; jobs: number; headcount: number; avg_ratio: number | null }[]
  top_units: { unit: string; jobs: number; headcount: number }[]
}

export interface JobFilters {
  provinces: { province: string; cities: string[] }[]
  years: number[]
}

export interface ScatterPoint {
  value_score: number
  interview_score: number
  headcount: number
  education: string
}

export interface MapData {
  level: 'province' | 'city'
  items: { name: string; jobs: number; headcount: number; avg_ratio: number | null }[]
}

export interface JobRow {
  id: number
  province: string | null
  city: string | null
  year: number | null
  unit: string | null
  position: string | null
  education: string | null
  apply_ratio: number | null
  interview_score: number | null
  headcount: number | null
  value_score: number | null
}

export interface DashFilters {
  province?: string
  city?: string
  year?: number
  education?: string
}

export async function getStats(f: DashFilters): Promise<JobStats> {
  return (await apiClient.get<JobStats>('/jobs/stats', { params: f })).data
}

export async function getFilters(): Promise<JobFilters> {
  return (await apiClient.get<JobFilters>('/jobs/filters')).data
}

export async function getScatter(f: DashFilters): Promise<ScatterPoint[]> {
  return (await apiClient.get<ScatterPoint[]>('/jobs/scatter', { params: f })).data
}

export async function getMap(f: { province?: string; year?: number }): Promise<MapData> {
  return (await apiClient.get<MapData>('/jobs/map', { params: f })).data
}

export async function getList(
  f: DashFilters,
  limit = 1000,
): Promise<{ total: number; items: JobRow[] }> {
  return (
    await apiClient.get<{ total: number; items: JobRow[] }>('/jobs/list', {
      params: { ...f, limit },
    })
  ).data
}
