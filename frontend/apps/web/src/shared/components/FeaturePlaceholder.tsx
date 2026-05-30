import { Empty, Typography } from 'antd'

interface FeaturePlaceholderProps {
  title: string
  description: string
  phase: string
}

/** 各功能页阶段 0 占位卡片;后续阶段逐个替换为真实功能 */
export default function FeaturePlaceholder({ title, description, phase }: FeaturePlaceholderProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-16">
      <Empty description={false} />
      <Typography.Title level={3} className="!mb-0">
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="max-w-md text-center">
        {description}
      </Typography.Paragraph>
      <Typography.Text type="secondary">规划于 {phase}</Typography.Text>
    </div>
  )
}
