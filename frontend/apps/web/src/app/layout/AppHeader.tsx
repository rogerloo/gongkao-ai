import { Avatar, Dropdown, Layout, Space, Tag, theme, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router'
import { appRoutes } from '../routes'
import { useAuthStore } from '@/stores/auth'
import type { Role } from '../routes'

const { Header } = Layout

const ROLE_LABEL: Record<Role, string> = {
  admin: '管理员',
  editor: '内容编辑',
  analyst: '数据分析师',
  viewer: '只读访客',
}

/** 顶栏:当前页标题 + 用户信息/登出 */
export default function AppHeader() {
  const { token } = theme.useToken()
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const current = appRoutes.find((r) => r.path === location.pathname)

  const userMenu: MenuProps = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout()
        navigate('/login', { replace: true })
      }
    },
  }

  return (
    <Header
      className="flex items-center justify-between px-6"
      style={{ background: token.colorBgContainer }}
    >
      <Typography.Title level={4} className="!mb-0">
        {current?.meta.title ?? '公考 AI 工作台'}
      </Typography.Title>
      {user && (
        <Dropdown menu={userMenu} placement="bottomRight">
          <Space className="cursor-pointer">
            <Avatar size="small" icon={<UserOutlined />} />
            <span>{user.username}</span>
            <Tag color="blue" className="!mr-0">
              {ROLE_LABEL[user.role]}
            </Tag>
          </Space>
        </Dropdown>
      )}
    </Header>
  )
}
