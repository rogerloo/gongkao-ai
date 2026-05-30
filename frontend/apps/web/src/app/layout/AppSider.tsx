import { createElement, useMemo } from 'react'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { useLocation, useNavigate } from 'react-router'
import { appRoutes } from '../routes'
import { useAuthStore } from '@/stores/auth'

const { Sider } = Layout

/** 侧边栏:菜单由 appRoutes 动态生成,并按当前用户角色过滤(四级 RBAC 动态菜单) */
export default function AppSider() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  const items = useMemo<MenuProps['items']>(
    () =>
      appRoutes
        .filter((r) => !r.meta.hideInMenu)
        .filter((r) => !r.meta.roles || (user != null && r.meta.roles.includes(user.role)))
        .map((r) => ({
          key: r.path,
          icon: r.meta.icon ? createElement(r.meta.icon) : undefined,
          label: r.meta.title,
        })),
    [user],
  )

  return (
    <Sider collapsible theme="dark" width={232}>
      <div className="flex h-12 items-center justify-center px-2 text-base font-semibold text-white">
        公考 AI 工作台
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  )
}
