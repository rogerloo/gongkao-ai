import type { ComponentType } from 'react'
import {
  AuditOutlined,
  DashboardOutlined,
  MessageOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  DollarOutlined,
} from '@ant-design/icons'

/** 四级 RBAC 角色。task4 接入鉴权后生效,此处先定义供菜单/路由共用。 */
export type Role = 'admin' | 'editor' | 'analyst' | 'viewer'

export interface AppRouteMeta {
  title: string
  icon?: ComponentType
  /** 允许访问的角色;留空 = 任意登录用户可见 */
  roles?: Role[]
  hideInMenu?: boolean
}

export interface AppRoute {
  /** 绝对路径(如 /dashboard),同时用作菜单 key */
  path: string
  meta: AppRouteMeta
  /** 懒加载页面组件(默认导出) */
  load: () => Promise<{ default: ComponentType }>
}

/**
 * 应用路由表 —— 路由与侧边栏菜单的单一数据源(PLAN §9.1)。
 * task4 起:RequireAuth 按 meta.roles 守卫,AppSider 按角色过滤菜单。
 */
export const appRoutes: AppRoute[] = [
  {
    path: '/dashboard',
    meta: { title: '数据看板', icon: DashboardOutlined },
    load: () => import('@/features/dashboard/DashboardPage'),
  },
  {
    path: '/chat',
    meta: { title: 'AI 对话工作台', icon: MessageOutlined },
    load: () => import('@/features/chat/ChatPage'),
  },
  {
    path: '/interview',
    meta: { title: '面试模拟评分', icon: AuditOutlined },
    load: () => import('@/features/interview/InterviewPage'),
  },
  {
    path: '/prompts',
    meta: { title: 'Prompt 配置中心', icon: FileTextOutlined, roles: ['admin', 'editor'] },
    load: () => import('@/features/prompts/PromptsPage'),
  },
  {
    path: '/kb',
    meta: { title: '知识库管理', icon: DatabaseOutlined, roles: ['admin', 'editor'] },
    load: () => import('@/features/kb/KbPage'),
  },
  {
    path: '/usage',
    meta: { title: 'LLM 用量监控', icon: DollarOutlined, roles: ['admin', 'editor'] },
    load: () => import('@/features/usage/UsagePage'),
  },
]

/** 登录后默认落地路由 */
export const DEFAULT_ROUTE = '/dashboard'
