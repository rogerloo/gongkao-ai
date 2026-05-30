import { Component, type ReactNode } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** 渲染错误兜底:防止单页崩溃导致整个工作台白屏。 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="页面出错了"
          subTitle={this.state.error.message || '渲染时发生未预期错误'}
          extra={
            <Button
              type="primary"
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
            >
              刷新重试
            </Button>
          }
        />
      )
    }
    return this.props.children
  }
}
