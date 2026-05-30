import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { refreshAccessToken, useAuthStore } from '@/stores/auth'

/**
 * Axios 实例。铁律 1:前端只调自己后端。
 *
 * baseURL 解析:
 *  - 默认 `/api` —— 同源部署(Vite 代理 / nginx / Caddy 反代到 FastAPI),开发与单机部署都走这条。
 *  - 设了 `VITE_API_BASE`(构建期)则用绝对地址 —— 前后端分开托管时(如前端 CF Pages、
 *    后端独立域名)指向后端 origin,需后端 CORS 放行该前端域名。
 *
 * JWT 双 token:
 *  - 请求拦截器:附带内存中的 access token(Bearer)
 *  - 响应拦截器:401 → 静默 refresh 换新 access 后重放原请求;刷新失败则登出
 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const isAuthCall = original?.url?.includes('/auth/')
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      }
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  },
)
