import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, ChatMode } from '@/shared/lib/chatStream'

export interface Conversation {
  id: string
  title: string
  mode: ChatMode
  /** 模型选择:auto | deepseek-chat | deepseek-reasoner */
  model: string
  /** 面试教练 GraphRAG 检索深度(种子数) */
  retrievalK: number
  messages: ChatMessage[]
  createdAt: number
}

interface ConversationsState {
  conversations: Conversation[]
  activeId: string | null
  createConversation: (mode?: ChatMode) => string
  ensureActive: (mode: ChatMode) => string
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  setActiveMode: (mode: ChatMode) => void
  setActiveModel: (model: string) => void
  setActiveRetrievalK: (k: number) => void
  renameConversation: (id: string, title: string) => void
  appendToActive: (msgs: ChatMessage[]) => void
  patchActiveLast: (fn: (m: ChatMessage) => ChatMessage) => void
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function titleFrom(messages: ChatMessage[], fallback: string): string {
  const u = messages.find((m) => m.role === 'user')
  return u ? u.content.slice(0, 18) : fallback
}

/** 会话管理(PLAN §9.2:Zustand 管会话列表),persist 到 localStorage。 */
export const useConversations = create<ConversationsState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,

      createConversation: (mode = 'chat') => {
        const id = genId()
        const conv: Conversation = {
          id,
          title: '新对话',
          mode,
          model: 'auto',
          retrievalK: 5,
          messages: [],
          createdAt: Date.now(),
        }
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: id }))
        return id
      },

      ensureActive: (mode) => {
        const { activeId, conversations } = get()
        if (activeId && conversations.some((c) => c.id === activeId)) return activeId
        return get().createConversation(mode)
      },

      selectConversation: (id) => set({ activeId: id }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || c.title } : c,
          ),
        })),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id)
          const activeId = s.activeId === id ? (conversations[0]?.id ?? null) : s.activeId
          return { conversations, activeId }
        }),

      setActiveMode: (mode) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === s.activeId ? { ...c, mode } : c)),
        })),

      setActiveModel: (model) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === s.activeId ? { ...c, model } : c)),
        })),

      setActiveRetrievalK: (retrievalK) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === s.activeId ? { ...c, retrievalK } : c,
          ),
        })),

      appendToActive: (msgs) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId) return c
            const messages = [...c.messages, ...msgs]
            const title = c.title === '新对话' ? titleFrom(messages, c.title) : c.title
            return { ...c, messages, title }
          }),
        })),

      patchActiveLast: (fn) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== s.activeId || c.messages.length === 0) return c
            const messages = [...c.messages]
            messages[messages.length - 1] = fn(messages[messages.length - 1])
            return { ...c, messages }
          }),
        })),
    }),
    { name: 'gongkao.conversations' },
  ),
)
