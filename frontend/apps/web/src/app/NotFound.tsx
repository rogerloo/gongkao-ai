import { Button, Result } from 'antd'
import { useNavigate } from 'react-router'
import { DEFAULT_ROUTE } from './routes'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Result
      status="404"
      title="404"
      subTitle="页面不存在"
      extra={
        <Button type="primary" onClick={() => navigate(DEFAULT_ROUTE)}>
          返回看板
        </Button>
      }
    />
  )
}
