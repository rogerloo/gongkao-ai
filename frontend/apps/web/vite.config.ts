import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // React 19。plugin-react v6 走 oxc 转换(无 babel 选项)。
    // TODO(阶段 4·性能): 用导出的 `reactCompilerPreset` 经 Rolldown babel 桥接入 React Compiler 自动 memo。
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    // antd/echarts 等重型 vendor 已按路由懒加载 + 独立分块;阈值上调以反映这是有意为之
    // TODO(性能): echarts 改用 echarts/core 按需注册可再砍约 50% 体积
    chunkSizeWarningLimit: 1200,
    // 拆分重型 vendor 到独立 chunk:改善缓存命中与并行加载
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('echarts') || id.includes('zrender')) return 'echarts'
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) return 'antd'
          if (
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          )
            return 'react'
          if (
            id.includes('streamdown') ||
            id.includes('micromark') ||
            id.includes('mdast') ||
            id.includes('hast') ||
            id.includes('unist') ||
            id.includes('remark') ||
            id.includes('rehype')
          )
            return 'markdown'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    // 前端只调自己的后端;开发期把 /api 代理到 FastAPI(铁律 1:key 只在后端)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
