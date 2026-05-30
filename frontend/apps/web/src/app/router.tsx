import { createBrowserRouter, Navigate } from 'react-router'
import AppLayout from './layout/AppLayout'
import NotFound from './NotFound'
import RequireAuth from './guards/RequireAuth'
import { appRoutes, DEFAULT_ROUTE } from './routes'

/**
 * library 模式数据路由。
 *  - /login 公开
 *  - / 整个布局壳被 RequireAuth 守卫(必须登录)
 *  - 带 meta.roles 的页面再包一层角色守卫
 *  - 页面级 lazy 实现按路由代码分割
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('@/features/auth/LoginPage')).default }),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to={DEFAULT_ROUTE} replace /> },
      ...appRoutes.map((r) => ({
        path: r.path.slice(1),
        lazy: async () => {
          const { default: Page } = await r.load()
          const { roles } = r.meta
          if (!roles) return { Component: Page }
          // 角色受限页:外包一层 RequireAuth(roles)
          const Guarded = () => (
            <RequireAuth roles={roles}>
              <Page />
            </RequireAuth>
          )
          return { Component: Guarded }
        },
      })),
      {
        path: '403',
        lazy: async () => ({
          Component: (await import('@/features/auth/ForbiddenPage')).default,
        }),
      },
      { path: '*', Component: NotFound },
    ],
  },
])
