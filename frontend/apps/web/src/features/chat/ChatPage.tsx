import { useEffect, useRef, useState } from 'react'
import { SendOutlined, StopOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Segmented, Select, Space, Tooltip, Typography } from 'antd'
import type { ChatMode } from '@/shared/lib/chatStream'
import { useConversations } from '@/stores/conversations'
import { getActivePrompts, getModels } from './api'
import ConversationList from './ConversationList'
import MessageBubble from './MessageBubble'
import { useChatStream } from './useChatStream'

const MODE_OPTIONS = [
  { label: '普通对话', value: 'chat' },
  { label: '选岗 Agent', value: 'agent' },
  { label: '面试教练', value: 'coach' },
]

const SUGGESTIONS: Record<ChatMode, string[]> = {
  chat: ['用一句话介绍你能帮公考考生做什么', '公务员考试一般包含哪些环节?'],
  agent: [
    '帮我在贵州找 2023 年本科、招录至少 2 人的岗位,挑性价比最高的 3 个',
    '青海有哪些报录比低的大专可报岗位?',
  ],
  coach: ['面试时遇到完全不会答的陌生题怎么办?', '怎么回答"为什么报考公务员"?'],
}

export default function ChatPage() {
  const { messages, mode, isStreaming, error, send, retry, stop } = useChatStream()
  const setActiveMode = useConversations((s) => s.setActiveMode)
  const setActiveModel = useConversations((s) => s.setActiveModel)
  const setActiveRetrievalK = useConversations((s) => s.setActiveRetrievalK)
  const ensureActive = useConversations((s) => s.ensureActive)
  const activeId = useConversations((s) => s.activeId)
  const model = useConversations((s) => {
    const a = s.conversations.find((c) => c.id === s.activeId)
    return a?.model ?? 'auto'
  })
  const retrievalK = useConversations((s) => {
    const a = s.conversations.find((c) => c.id === s.activeId)
    return a?.retrievalK ?? 5
  })
  const { data: models } = useQuery({ queryKey: ['chat-models'], queryFn: getModels })
  const { data: activePrompts } = useQuery({
    queryKey: ['chat-active-prompts'],
    queryFn: getActivePrompts,
  })
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 选岗 Agent 走 Function Calling,固定 V3(reasoner 不支持工具)
  const modelLocked = mode === 'agent'
  const modelOptions = (models ?? []).map((m) => ({ value: m.id, label: m.label, title: m.desc }))

  useEffect(() => {
    ensureActive('chat')
  }, [ensureActive])

  // 切换会话时中断当前流式
  useEffect(() => {
    stop()
  }, [activeId, stop])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const onSend = (text?: string) => {
    const value = (text ?? input).trim()
    if (!value || isStreaming) return
    send(value)
    setInput('')
  }

  return (
    <div className="flex h-full gap-3">
      <ConversationList />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented
            options={MODE_OPTIONS}
            value={mode}
            onChange={(v) => setActiveMode(v as ChatMode)}
            disabled={isStreaming}
          />
          <Tooltip
            title={modelLocked ? '选岗 Agent 走 Function Calling,固定 DeepSeek-V3' : undefined}
          >
            <Select
              size="small"
              className="min-w-44"
              value={modelLocked ? 'deepseek-chat' : model}
              onChange={setActiveModel}
              disabled={isStreaming || modelLocked}
              options={modelOptions}
              popupMatchSelectWidth={false}
            />
          </Tooltip>
          {mode === 'coach' && (
            <Tooltip title="GraphRAG 向量召回的种子数:越大召回越广、上下文越多">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                检索深度
                <Select
                  size="small"
                  value={retrievalK}
                  onChange={setActiveRetrievalK}
                  disabled={isStreaming}
                  options={[3, 5, 8, 10].map((n) => ({ value: n, label: String(n) }))}
                  style={{ width: 64 }}
                />
              </span>
            </Tooltip>
          )}
        </div>

        {(mode === 'agent' || mode === 'coach') && activePrompts?.[mode]?.version != null && (
          <div className="mb-2 text-xs text-gray-400">
            🔗 生效 Prompt:{activePrompts[mode].name} v{activePrompts[mode].version}
            <span className="ml-1">(在 Prompt 配置中心编辑并设为当前版本即时生效)</span>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 pt-16 text-center">
              <Typography.Title level={4}>AI 对话工作台</Typography.Title>
              <Typography.Paragraph type="secondary" className="!mb-1">
                选岗 Agent(Function Calling)+ 面试教练(自研 GraphRAG)。试试:
              </Typography.Paragraph>
              <Space orientation="vertical" className="w-full max-w-xl">
                {SUGGESTIONS[mode].map((s) => (
                  <Button key={s} block onClick={() => onSend(s)}>
                    {s}
                  </Button>
                ))}
              </Space>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4 py-4">
              {messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  role={m.role}
                  content={m.content}
                  reasoning={m.reasoning}
                  model={m.model}
                  steps={m.steps}
                  sources={m.sources}
                  usage={m.usage}
                  streaming={isStreaming && i === messages.length - 1}
                  mode={mode}
                  onRegenerate={
                    !isStreaming && m.role === 'assistant' && i === messages.length - 1
                      ? retry
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 py-1">
            <Typography.Text type="danger">{error}</Typography.Text>
            <Button size="small" onClick={retry} disabled={isStreaming}>
              重试
            </Button>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl pt-2">
          <Space.Compact className="w-full">
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入消息,Enter 发送 / Shift+Enter 换行"
              autoSize={{ minRows: 1, maxRows: 5 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button danger icon={<StopOutlined />} onClick={stop}>
                停止
              </Button>
            ) : (
              <Button type="primary" icon={<SendOutlined />} onClick={() => onSend()}>
                发送
              </Button>
            )}
          </Space.Compact>
        </div>
      </div>
    </div>
  )
}
