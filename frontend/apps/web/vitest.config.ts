import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// 测试用配置(独立于 vite.config:不引 tailwind,跳过 CSS 处理)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: ['./src/test/setup.ts'],
    // 仅跑 src 单测;e2e/ 下的 Playwright 用例由 playwright test 跑
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
