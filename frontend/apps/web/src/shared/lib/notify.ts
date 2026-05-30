import axios from 'axios'
import type { MessageInstance } from 'antd/es/message/interface'

/**
 * 全局消息桥:AntD v6 静态 message 无法消费 ConfigProvider 上下文,
 * 故在 <App> 内用 App.useApp() 取得实例并注册,供拦截器/Query 全局错误调用。
 */
let api: MessageInstance | null = null

export function bindMessage(instance: MessageInstance): void {
  api = instance
}

export function notifyError(msg: string): void {
  api?.error(msg)
}

export function notifySuccess(msg: string): void {
  api?.success(msg)
}

/** 从未知错误(尤其 axios)提取友好提示文案。 */
export function errMessage(e: unknown, fallback = '请求失败,请稍后重试'): string {
  if (axios.isAxiosError(e)) {
    const detail = (e.response?.data as { detail?: string } | undefined)?.detail
    return detail ?? e.message ?? fallback
  }
  return e instanceof Error ? e.message : fallback
}
