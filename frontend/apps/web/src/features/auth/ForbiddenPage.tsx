import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { DEFAULT_ROUTE } from '@/app/routes'

export default function ForbiddenPage() {
  const navigate = useNavigate()
  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉,你没有权限访问此页面"
      extra={
        <Button type="primary" onClick={() => navigate(DEFAULT_ROUTE)}>
          返回看板
        </Button>
      }
    />
  )
}
