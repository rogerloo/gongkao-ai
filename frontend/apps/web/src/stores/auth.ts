import axios from 'axios'
import { create } from 'zustand'
import type { Role } from '@/app/routes'

export interface AuthUser {
  username: string
  role: Role
}

interface TokenResp {
  access_token: string
  refresh_token: string
  user: { username: string; role: string }
}

/**
 * JWT 双 token(PLAN §10):
 *  - access token 仅存内存(XSS 下不落盘);
 *  - refresh token 存 localStorage,刷新页时静默换新 access(bootstrap)。
 * 独立 axios 实例(无拦截器),避免与 apiClient 的 401 重试拦截相互递归。
 */
const REFRESH_KEY = 'gongkao.refresh'
const authHttp = axios.create({ baseURL: '/api', timeout: 15_000 })

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  /** 启动静默刷新是否完成(完成前 App 显示加载,避免误跳登录页) */
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  bootstrap: () => Promise<void>
}

function applyTokens(data: TokenResp): void {
  localStorage.setItem(REFRESH_KEY, data.refresh_token)
  useAuthStore.setState({
    accessToken: data.access_token,
    user: { username: data.user.username, role: data.user.role as Role },
  })
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  ready: false,

  login: async (username, password) => {
    try {
      const { data } = await authHttp.post<TokenResp>('/auth/login', { username, password })
      applyTokens(data)
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? ((e.response?.data as { detail?: string } | undefined)?.detail ?? '登录失败')
        : '登录失败'
      throw new Error(msg)
    }
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY)
    set({ user: null, accessToken: null })
  },

  bootstrap: async () => {
    const refresh = localStorage.getItem(REFRESH_KEY)
    if (!refresh) {
      set({ ready: true })
      return
    }
    try {
      const { data } = await authHttp.post<TokenResp>('/auth/refresh', { refresh_token: refresh })
      applyTokens(data)
    } catch {
      localStorage.removeItem(REFRESH_KEY)
      set({ user: null, accessToken: null })
    } finally {
      set({ ready: true })
    }
  },
}))

/** 供 apiClient 的 401 拦截器调用:用 refresh 换新 access,返回新 token(失败则登出并返回 null)。 */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) return null
  try {
    const { data } = await authHttp.post<TokenResp>('/auth/refresh', { refresh_token: refresh })
    applyTokens(data)
    return data.access_token
  } catch {
    localStorage.removeItem(REFRESH_KEY)
    useAuthStore.setState({ user: null, accessToken: null })
    return null
  }
}
