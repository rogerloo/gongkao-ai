import { useEffect } from 'react'
import { App, Spin } from 'antd'
import { RouterProvider } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { bindMessage } from '@/shared/lib/notify'
import { router } from './router'

/**
 * 启动门:挂载时静默 refresh(用 localStorage 的 refresh token 换 access),
 * 完成前显示全屏加载,避免持有有效会话却被误判未登录而闪跳 /login。
 */
export default function AuthGate() {
  const ready = useAuthStore((s) => s.ready)
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const { message } = App.useApp()

  // 注册 message 实例供全局拦截器/Query 错误提示使用(消费 ConfigProvider 上下文)
  useEffect(() => {
    bindMessage(message)
  }, [message])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (!ready) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Spin size="large" />
        <span className="text-gray-400">正在恢复会话…</span>
      </div>
    )
  }
  return <RouterProvider router={router} />
}
