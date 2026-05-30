import { useState } from 'react'
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { Button, Input } from 'antd'
import { useConversations } from '@/stores/conversations'

/** 左侧会话栏:新建 / 搜索 / 切换 / 重命名 / 删除(持久化到 localStorage)。 */
export default function ConversationList() {
  const conversations = useConversations((s) => s.conversations)
  const activeId = useConversations((s) => s.activeId)
  const create = useConversations((s) => s.createConversation)
  const select = useConversations((s) => s.selectConversation)
  const remove = useConversations((s) => s.deleteConversation)
  const rename = useConversations((s) => s.renameConversation)

  const [filter, setFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const shown = conversations.filter((c) =>
    c.title.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  const startEdit = (id: string, title: string) => {
    setEditingId(id)
    setDraft(title)
  }
  const commitEdit = (id: string) => {
    rename(id, draft)
    setEditingId(null)
  }

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-gray-200 pr-2">
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        block
        className="mb-2"
        onClick={() => create('chat')}
      >
        新对话
      </Button>
      <Input.Search
        placeholder="搜索对话"
        allowClear
        size="small"
        className="mb-2"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="flex-1 overflow-auto">
        {shown.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-gray-400">
            {conversations.length === 0 ? '暂无对话' : '无匹配对话'}
          </div>
        ) : (
          shown.map((c) => (
            <div
              key={c.id}
              onClick={() => editingId !== c.id && select(c.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                c.id === activeId ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <MessageOutlined className="shrink-0" />
              {editingId === c.id ? (
                <Input
                  size="small"
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onPressEnter={() => commitEdit(c.id)}
                  onBlur={() => commitEdit(c.id)}
                  className="flex-1"
                />
              ) : (
                <span className="flex-1 truncate">{c.title}</span>
              )}
              {editingId === c.id ? (
                <CheckOutlined
                  className="shrink-0 text-emerald-500"
                  onClick={(e) => {
                    e.stopPropagation()
                    commitEdit(c.id)
                  }}
                />
              ) : (
                <>
                  <EditOutlined
                    className="shrink-0 text-gray-300 opacity-0 hover:!text-blue-500 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(c.id, c.title)
                    }}
                  />
                  <DeleteOutlined
                    className="shrink-0 text-gray-300 opacity-0 hover:!text-red-500 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(c.id)
                    }}
                  />
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
