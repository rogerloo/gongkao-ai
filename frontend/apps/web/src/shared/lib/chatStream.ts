import { refreshAccessToken, useAuthStore } from '@/stores/auth'

export type ChatMode = 'chat' | 'agent' | 'coach'

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** DeepSeek-R1 思维链(reasoning_content),折叠展示 */
  reasoning?: string
  /** 实际生效的模型(finish 事件回报) */
  model?: string
  steps?: AgentStep[]
  sources?: Source[]
  usage?: TokenUsage | null
}

/** Agent 执行步骤(选岗 Agent 的工具调用时间线) */
export interface AgentStep {
  kind: 'tool-call' | 'tool-result'
  name: string
  args?: Record<string, unknown>
  summary?: string
}

/** GraphRAG 检索命中的知识节点 */
export interface Source {
  id: string
  title: string
  type: string
  is_seed: boolean
  score: number | null
  /** 知识原文片段(RAG 可解释:展示真正喂给模型的依据) */
  snippet?: string
}

export interface ChatStreamEvent {
  type: string // text-delta | finish | tool-call | tool-result | sources
  delta?: string
  model?: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null
  name?: string
  args?: Record<string, unknown>
  summary?: string
  items?: Source[]
  [k: string]: unknown
}

export interface StreamChatOptions {
  signal?: AbortSignal
  onEvent: (event: ChatStreamEvent) => void
}

/**
 * 手搓 SSE 解析(PLAN §3 底层证据):
 * fetch ReadableStream → TextDecoder 增量解码 → 按 SSE 帧(\n\n,归一化 CRLF)切分 →
 * 取每帧 `data:` 行,[DONE] 结束,其余按 JSON 事件回调。不依赖 EventSource(它不支持 POST)。
 */
export async function streamChat(
  path: string,
  body: { messages: ChatMessage[]; task?: string; model?: string; k?: number },
  opts: StreamChatOptions,
): Promise<void> {
  // SSE 走原生 fetch(EventSource 不支持 POST),手动附带 access token
  const doFetch = (token: string | null) =>
    fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })

  let res = await doFetch(useAuthStore.getState().accessToken)
  // access 过期 → 静默刷新后重试一次(与 axios 拦截器一致)
  if (res.status === 401) {
    const token = await refreshAccessToken()
    if (token) res = await doFetch(token)
  }
  if (!res.ok || !res.body) {
    throw new Error(`流式请求失败:HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    let sep = buffer.indexOf('\n\n')
    while (sep !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'))
      if (dataLine) {
        const data = dataLine.slice(5).trim()
        if (data === '[DONE]') return
        try {
          opts.onEvent(JSON.parse(data) as ChatStreamEvent)
        } catch {
          // 忽略非 JSON 帧(注释 / 心跳)
        }
      }
      sep = buffer.indexOf('\n\n')
    }
  }
}
