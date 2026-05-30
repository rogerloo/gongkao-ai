import { beforeEach, describe, expect, it } from 'vitest'
import { useConversations } from './conversations'

beforeEach(() => {
  useConversations.setState({ conversations: [], activeId: null })
  localStorage.clear()
})

describe('conversations store', () => {
  it('创建会话并设为激活,默认 model=auto', () => {
    const id = useConversations.getState().createConversation('agent')
    const s = useConversations.getState()
    expect(s.activeId).toBe(id)
    expect(s.conversations[0].mode).toBe('agent')
    expect(s.conversations[0].model).toBe('auto')
  })

  it('追加消息并从首条用户消息派生标题', () => {
    useConversations.getState().createConversation('chat')
    useConversations.getState().appendToActive([
      { role: 'user', content: '帮我推荐性价比高的岗位' },
      { role: 'assistant', content: '' },
    ])
    const c = useConversations.getState().conversations[0]
    expect(c.messages).toHaveLength(2)
    expect(c.title).toBe('帮我推荐性价比高的岗位'.slice(0, 18))
  })

  it('patchActiveLast 更新最后一条消息', () => {
    useConversations.getState().createConversation('chat')
    useConversations.getState().appendToActive([{ role: 'assistant', content: '' }])
    useConversations.getState().patchActiveLast((m) => ({ ...m, content: m.content + 'hi' }))
    expect(useConversations.getState().conversations[0].messages.at(-1)?.content).toBe('hi')
  })

  it('setActiveModel 切换当前会话模型', () => {
    useConversations.getState().createConversation('chat')
    useConversations.getState().setActiveModel('deepseek-reasoner')
    expect(useConversations.getState().conversations[0].model).toBe('deepseek-reasoner')
  })

  it('deleteConversation 后激活切到剩余会话', () => {
    const a = useConversations.getState().createConversation('chat')
    const b = useConversations.getState().createConversation('chat')
    expect(useConversations.getState().activeId).toBe(b)
    useConversations.getState().deleteConversation(b)
    expect(useConversations.getState().activeId).toBe(a)
  })
})
