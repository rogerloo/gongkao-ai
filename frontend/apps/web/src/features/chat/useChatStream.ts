import { useCallback, useRef, useState } from 'react'
import {
  type ChatMessage,
  type ChatMode,
  type ChatStreamEvent,
  type Source,
  streamChat,
} from '@/shared/lib/chatStream'
import { useConversations } from '@/stores/conversations'

const MODE_PATH: Record<ChatMode, string> = {
  chat: '/api/chat/stream',
  agent: '/api/chat/agent',
  coach: '/api/chat/coach',
}

// 稳定的空数组引用,避免 selector 每次返回新 [] 触发无谓重算
const EMPTY_MESSAGES: ChatMessage[] = []

interface ApiMessage {
  role: ChatMessage['role']
  content: string
}

export interface UseChatStream {
  messages: ChatMessage[]
  mode: ChatMode
  isStreaming: boolean
  error: string | null
  send: (text: string) => void
  retry: () => void
  stop: () => void
}

/** 当前会话的流式状态机:消息来自会话 store,流式增量回写 store(三模式 + 步骤/来源/用量 + 中断 + 重试)。 */
export function useChatStream(): UseChatStream {
  const messages = useConversations((s) => {
    const a = s.conversations.find((c) => c.id === s.activeId)
    return a?.messages ?? EMPTY_MESSAGES
  })
  const mode = useConversations((s) => {
    const a = s.conversations.find((c) => c.id === s.activeId)
    return a?.mode ?? 'chat'
  })
  const model = useConversations((s) => {
    const a = s.conversations.find((c) => c.id === s.activeId)
    return a?.model ?? 'auto'
  })
  const retrievalK = useConversations((s) => {
    const a = s.conversations.find((c) => c.id === s.activeId)
    return a?.retrievalK ?? 5
  })
  const ensureActive = useConversations((s) => s.ensureActive)
  const appendToActive = useConversations((s) => s.appendToActive)
  const patchActiveLast = useConversations((s) => s.patchActiveLast)

  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  // 发起一次流式(send/retry 共用);history 为发给后端的消息(末尾即本轮用户问)
  const runStream = useCallback(
    (history: ApiMessage[]) => {
      setError(null)
      setIsStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      const onEvent = (e: ChatStreamEvent) => {
        if (e.type === 'text-delta' && e.delta) {
          patchActiveLast((m) => ({ ...m, content: m.content + e.delta }))
        } else if (e.type === 'reasoning-delta' && e.delta) {
          patchActiveLast((m) => ({ ...m, reasoning: (m.reasoning ?? '') + e.delta }))
        } else if (e.type === 'tool-call') {
          patchActiveLast((m) => ({
            ...m,
            steps: [...(m.steps ?? []), { kind: 'tool-call', name: e.name ?? '', args: e.args }],
          }))
        } else if (e.type === 'tool-result') {
          patchActiveLast((m) => ({
            ...m,
            steps: [
              ...(m.steps ?? []),
              { kind: 'tool-result', name: e.name ?? '', summary: e.summary },
            ],
          }))
        } else if (e.type === 'sources') {
          patchActiveLast((m) => ({ ...m, sources: (e.items ?? []) as Source[] }))
        } else if (e.type === 'finish') {
          patchActiveLast((m) => ({ ...m, usage: e.usage ?? null, model: e.model }))
        }
      }

      void streamChat(
        MODE_PATH[mode],
        { messages: history, model, k: retrievalK },
        { signal: controller.signal, onEvent },
      )
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : '流式出错')
        })
        .finally(() => {
          setIsStreaming(false)
          abortRef.current = null
        })
    },
    [mode, model, retrievalK, patchActiveLast],
  )

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return
      ensureActive(mode)
      const history: ApiMessage[] = messages.map((m) => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: trimmed })
      appendToActive([
        { role: 'user', content: trimmed },
        { role: 'assistant', content: '' },
      ])
      runStream(history)
    },
    [messages, mode, isStreaming, ensureActive, appendToActive, runStream],
  )

  // 重试:重置最后一条(失败的)assistant 占位,用截至上一条用户问的历史重新流式
  const retry = useCallback(() => {
    if (isStreaming || messages.length < 2) return
    if (messages[messages.length - 1].role !== 'assistant') return
    const history: ApiMessage[] = messages
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }))
    patchActiveLast(() => ({ role: 'assistant', content: '' }))
    runStream(history)
  }, [messages, isStreaming, patchActiveLast, runStream])

  return { messages, mode, isStreaming, error, send, retry, stop }
}
