import { describe, expect, it, vi } from 'vitest'
import { type ChatStreamEvent, streamChat } from './chatStream'

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f))
      controller.close()
    },
  })
}

describe('streamChat 手搓 SSE 解析', () => {
  it('解析 text-delta + finish,遇 [DONE] 停止(含 CRLF 归一化)', async () => {
    const frames = [
      'data: {"type":"text-delta","delta":"你"}\n\n',
      'data: {"type":"text-delta","delta":"好"}\r\n\r\n', // CRLF 帧分隔
      'data: {"type":"finish","model":"deepseek-chat","usage":null}\n\n',
      'data: [DONE]\n\n',
      'data: {"type":"text-delta","delta":"AFTER"}\n\n', // [DONE] 后应忽略
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream(frames),
    }) as unknown as typeof fetch

    const events: ChatStreamEvent[] = []
    await streamChat('/api/chat/stream', { messages: [] }, { onEvent: (e) => events.push(e) })

    expect(events.map((e) => e.type)).toEqual(['text-delta', 'text-delta', 'finish'])
    expect(events[0].delta).toBe('你')
    expect(events[1].delta).toBe('好')
  })

  it('非 2xx 响应抛错', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, body: null }) as unknown as typeof fetch
    await expect(streamChat('/x', { messages: [] }, { onEvent: () => {} })).rejects.toThrow(
      /HTTP 500/,
    )
  })
})
