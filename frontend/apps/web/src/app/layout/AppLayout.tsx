import { Layout } from 'antd'
import { Outlet, useLocation, useNavigation } from 'react-router'
import ErrorBoundary from '../ErrorBoundary'
import AppSider from './AppSider'
import AppHeader from './AppHeader'

const { Content } = Layout

/** 中后台布局壳:左侧栏 + 顶栏 + 内容区(Outlet) */
export default function AppLayout() {
  const location = useLocation()
  const navigation = useNavigation()
  const navigating = navigation.state !== 'idle'
  return (
    <Layout className="h-screen">
      <AppSider />
      <Layout>
        <AppHeader />
        {/* 懒加载路由切换时的顶部进度条 */}
        {navigating && <div className="h-0.5 animate-pulse bg-blue-500" />}
        <Content className="m-4 overflow-auto rounded-lg bg-white p-6">
          {/* 按路由 key,切换页面时重置错误态 */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  )
}
