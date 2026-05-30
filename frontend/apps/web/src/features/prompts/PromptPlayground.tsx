import { useState } from 'react'
import { Button, Input } from 'antd'
import { Streamdown } from 'streamdown'
import { streamChat } from '@/shared/lib/chatStream'
import { extractVars, renderPrompt } from './vars'

/** Playground:变量代入当前提示词作 system,跑 /chat/stream 看流式输出。 */
export default function PromptPlayground({ systemPrompt }: { systemPrompt: string }) {
  const vars = extractVars(systemPrompt)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [out, setOut] = useState('')
  const [running, setRunning] = useState(false)

  const run = () => {
    if (!msg.trim() || running) return
    const system = renderPrompt(systemPrompt, vals)
    setOut('')
    setRunning(true)
    void streamChat(
      '/api/chat/stream',
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: msg },
        ],
      },
      {
        onEvent: (e) => {
          if (e.type === 'text-delta' && e.delta) setOut((o) => o + e.delta)
        },
      },
    ).finally(() => setRunning(false))
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-sm font-medium text-gray-600">Playground</div>
      {vars.map((v) => (
        <Input
          key={v}
          addonBefore={v}
          size="small"
          placeholder={`变量 ${v} 的值`}
          value={vals[v] ?? ''}
          onChange={(e) => setVals((s) => ({ ...s, [v]: e.target.value }))}
        />
      ))}
      <Input.TextArea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="测试输入(用户消息)"
        autoSize={{ minRows: 2, maxRows: 4 }}
      />
      <Button type="primary" size="small" loading={running} onClick={run}>
        运行当前提示词
      </Button>
      <div className="min-h-0 flex-1 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 text-sm">
        {out ? (
          <Streamdown>{out}</Streamdown>
        ) : (
          <span className="text-gray-400">输出将显示在这里</span>
        )}
      </div>
    </div>
  )
}
