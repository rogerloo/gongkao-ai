import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '@/app/routes'

interface RequireAuthProps {
  children: ReactNode
  /** 限定角色;留空 = 仅需登录 */
  roles?: Role[]
}

/**
 * 路由守卫(PLAN §9.1):
 *  - 未登录 → 跳 /login(记住来源 from,登录后跳回)
 *  - 已登录但角色不符 → 跳 /403
 */
export default function RequireAuth({ children, roles }: RequireAuthProps) {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />
  }
  return <>{children}</>
}
