import {
  BulbOutlined,
  CopyOutlined,
  ReloadOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Collapse, Space, Spin, Tag } from 'antd'
import { Streamdown } from 'streamdown'
import type { AgentStep, ChatMode, Source, TokenUsage } from '@/shared/lib/chatStream'
import { notifySuccess } from '@/shared/lib/notify'
import AgentTrace from './AgentTrace'

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  model?: string
  steps?: AgentStep[]
  sources?: Source[]
  usage?: TokenUsage | null
  streaming?: boolean
  mode?: ChatMode
  /** 仅最后一条助手消息且非流式时提供:重新生成 */
  onRegenerate?: () => void
}

const THINKING: Record<ChatMode, string> = {
  chat: '正在思考…',
  agent: 'Agent 规划中…',
  coach: '检索知识库中…',
}

const MODEL_LABEL: Record<string, string> = {
  'deepseek-reasoner': 'R1 · 深度推理',
  'deepseek-chat': 'V3 · 快速',
}

function modelLabel(m?: string): string | null {
  if (!m) return null
  return MODEL_LABEL[m] ?? m.replace(' (stub)', ' · 占位')
}

export default function MessageBubble({
  role,
  content,
  reasoning,
  model,
  steps,
  sources,
  usage,
  streaming,
  mode = 'chat',
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = role === 'user'
  const working = (steps?.length ?? 0) > 0 || (sources?.length ?? 0) > 0
  const hasReasoning = !!reasoning && reasoning.length > 0
  const reasoningOnly = hasReasoning && !content // 思考中、答案未出
  const showActions = !isUser && !!content && !streaming
  const handleCopy = () => {
    void navigator.clipboard.writeText(content).then(() => notifySuccess('已复制到剪贴板'))
  }
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        className={isUser ? '!bg-blue-500' : '!bg-emerald-500'}
      />
      <div className={isUser ? 'max-w-[80%]' : 'min-w-0 flex-1'}>
        {!isUser && <AgentTrace steps={steps} sources={sources} />}
        {!isUser && hasReasoning && (
          <Collapse
            ghost
            size="small"
            className="mb-1"
            defaultActiveKey={reasoningOnly ? ['r'] : []}
            items={[
              {
                key: 'r',
                label: (
                  <span className="text-xs text-gray-500">
                    <BulbOutlined className="mr-1" />
                    深度思考{streaming && reasoningOnly ? '中…' : `(${reasoning!.length} 字)`}
                  </span>
                ),
                children: (
                  <div className="max-h-64 overflow-auto whitespace-pre-wrap border-l-2 border-amber-200 pl-3 text-xs leading-relaxed text-gray-500">
                    {reasoning}
                  </div>
                ),
              },
            ]}
          />
        )}
        <div
          className={`rounded-lg px-4 py-2 ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : content ? (
            <Streamdown>{content}</Streamdown>
          ) : streaming ? (
            <span className="flex items-center gap-2 text-gray-400">
              <Spin size="small" />
              {reasoningOnly ? '深度推理中…' : working ? '生成回答中…' : THINKING[mode]}
            </span>
          ) : (
            <span className="text-gray-400">(无内容)</span>
          )}
        </div>
        {!isUser && (model || (usage && usage.total_tokens > 0)) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            {modelLabel(model) && (
              <Tag color="geekblue" className="!m-0">
                {modelLabel(model)}
              </Tag>
            )}
            {usage && usage.total_tokens > 0 && (
              <span>
                ↑{usage.prompt_tokens} ↓{usage.completion_tokens} · 共 {usage.total_tokens} tokens
              </span>
            )}
          </div>
        )}
        {showActions && (
          <Space size={4} className="mt-1">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy}>
              复制
            </Button>
            {onRegenerate && (
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={onRegenerate}>
                重新生成
              </Button>
            )}
          </Space>
        )}
      </div>
    </div>
  )
}
