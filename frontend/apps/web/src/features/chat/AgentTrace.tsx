import {
  CheckCircleOutlined,
  FileSearchOutlined,
  ReadOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Collapse, Tag, Tooltip } from 'antd'
import type { AgentStep, Source } from '@/shared/lib/chatStream'

interface AgentTraceProps {
  steps?: AgentStep[]
  sources?: Source[]
}

/** Agent 执行可视化:工具调用时间线(选岗)+ GraphRAG 检索来源(面试教练)。 */
export default function AgentTrace({ steps, sources }: AgentTraceProps) {
  const stepList = steps ?? []
  const seeds = sources?.filter((s) => s.is_seed) ?? []
  const expanded = sources?.filter((s) => !s.is_seed) ?? []
  // 实际喂给模型的前若干条原文(种子在前),体现 RAG 可解释
  const withSnippet = (sources ?? []).filter((s) => s.snippet).slice(0, 8)
  if (stepList.length === 0 && seeds.length === 0) return null

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      {stepList.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
          {stepList.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 py-0.5">
              {s.kind === 'tool-call' ? (
                <>
                  <ToolOutlined className="text-blue-500" />
                  <span className="text-gray-600">
                    调用 <code className="text-gray-800">{s.name}</code>
                  </span>
                  {s.args && (
                    <span className="truncate text-gray-400">{JSON.stringify(s.args)}</span>
                  )}
                </>
              ) : (
                <>
                  <CheckCircleOutlined className="text-green-500" />
                  <span className="text-gray-600">{s.summary}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {seeds.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <FileSearchOutlined className="text-purple-500" />
            <span className="text-xs text-gray-400">GraphRAG 命中:</span>
            {seeds.map((s) => (
              <Tooltip key={s.id} title={`${s.type} · 相似度 ${s.score ?? '-'}`}>
                <Tag color={s.type === 'stance' ? 'blue' : 'cyan'} className="!mr-0">
                  {s.title}
                </Tag>
              </Tooltip>
            ))}
            {expanded.length > 0 && (
              <Tooltip title="沿反向链接图扩展的关联节点">
                <Tag className="!mr-0">+{expanded.length} 图扩展</Tag>
              </Tooltip>
            )}
          </div>
          {withSnippet.length > 0 && (
            <Collapse
              ghost
              size="small"
              items={[
                {
                  key: 'src',
                  label: (
                    <span className="text-xs text-gray-400">
                      <ReadOutlined className="mr-1" />
                      查看检索到的原文({withSnippet.length})
                    </span>
                  ),
                  children: (
                    <div className="flex flex-col gap-2">
                      {withSnippet.map((s) => (
                        <div key={s.id} className="border-l-2 border-purple-200 pl-2 text-xs">
                          <div className="flex flex-wrap items-center gap-1">
                            <Tag color={s.type === 'stance' ? 'blue' : 'cyan'} className="!mr-0">
                              {s.title}
                            </Tag>
                            {s.is_seed ? (
                              <span className="text-purple-500">种子</span>
                            ) : (
                              <span className="text-gray-400">图扩展</span>
                            )}
                            {s.score != null && (
                              <span className="text-gray-400">相似度 {s.score}</span>
                            )}
                          </div>
                          <div className="mt-0.5 leading-relaxed text-gray-500">{s.snippet}</div>
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  )
}
