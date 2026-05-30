// 设计 token —— 阶段 4 扩展为完整设计系统(颜色/间距/圆角/阴影)
// 现在先放最小集合,供 web 应用与未来业务组件共享。
export const tokens = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  radius: 8,
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
} as const

export type Tokens = typeof tokens
