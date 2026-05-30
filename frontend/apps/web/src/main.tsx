import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import axios from 'axios'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { tokens } from '@gongkao/ui'
import AuthGate from './app/AuthGate'
import { errMessage, notifyError } from './shared/lib/notify'
import './index.css'

// 全局请求错误提示(401 交由 apiClient 静默刷新/登出,不重复提示)
function onQueryError(e: unknown): void {
  if (axios.isAxiosError(e) && e.response?.status === 401) return
  notifyError(errMessage(e))
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onQueryError }),
  mutationCache: new MutationCache({ onError: onQueryError }),
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{ token: { colorPrimary: tokens.colorPrimary, borderRadius: tokens.radius } }}
      >
        <AntdApp>
          <AuthGate />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
