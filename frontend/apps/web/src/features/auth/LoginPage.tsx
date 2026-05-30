import { useState } from 'react'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { DEFAULT_ROUTE } from '@/app/routes'

interface LoginForm {
  username: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? DEFAULT_ROUTE

  const onFinish = async (values: LoginForm) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登录成功')
      navigate(from, { replace: true })
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Card className="w-[400px] shadow-lg">
        <Typography.Title level={3} className="text-center">
          公考 AI 工作台
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="text-center">
          登录以进入中后台
        </Typography.Paragraph>
        <Form<LoginForm>
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            登录
          </Button>
        </Form>
        <div className="mt-4 text-xs text-gray-400">
          <div className="mb-1">演示账号(四级 RBAC):</div>
          <div>admin / admin123 — 管理员(全部菜单)</div>
          <div>analyst / analyst123 — 分析师(看板 + 对话)</div>
        </div>
      </Card>
    </div>
  )
}
