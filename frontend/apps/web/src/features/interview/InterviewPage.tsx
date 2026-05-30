import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Card, Input, Space, Spin, Statistic, Tag } from 'antd'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import echarts from '@/shared/lib/echarts'
import { type ScoreResult, scoreInterview } from './api'

const SAMPLES = [
  "贵州'村BA'火爆出圈,你怎么看?",
  '谈谈你对年轻人"躺平"现象的看法',
  '你负责推进的工作被同事误解,你会怎么处理?',
]

function scoreColor(v: number): string {
  if (v >= 80) return '#52c41a'
  if (v >= 60) return '#fa8c16'
  return '#f5222d'
}

function dimColor(v: number): string {
  if (v >= 16) return 'green'
  if (v >= 12) return 'gold'
  return 'red'
}

function ResultPanel({ result }: { result: ScoreResult }) {
  const radarOption: EChartsOption = {
    radar: {
      indicator: result.dimensions.map((d) => ({ name: d.name, max: 20 })),
      radius: '62%',
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: result.dimensions.map((d) => d.score),
            name: '得分',
            areaStyle: { opacity: 0.25 },
            lineStyle: { color: '#1677ff' },
            itemStyle: { color: '#1677ff' },
          },
        ],
      },
    ],
  }

  return (
    <Card size="small" title="评分结果">
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-2">
        <div className="flex flex-col items-center justify-center">
          <Statistic
            title="总分"
            value={result.total}
            suffix="/ 100"
            styles={{ content: { color: scoreColor(result.total), fontSize: 44 } }}
          />
          <div className="mt-2 text-center text-sm text-gray-500">{result.summary}</div>
        </div>
        {result.dimensions.length > 0 && (
          <ReactEChartsCore
            echarts={echarts}
            option={radarOption}
            style={{ height: 260 }}
            notMerge
          />
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {result.dimensions.map((d) => (
          <div key={d.name} className="text-sm">
            <span className="font-medium">{d.name}</span>{' '}
            <Tag color={dimColor(d.score)}>{d.score} / 20</Tag>
            <div className="text-xs text-gray-500">{d.comment}</div>
          </div>
        ))}
      </div>

      {result.suggestions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-sm font-medium">💡 提分建议</div>
          <ul className="list-disc pl-5 text-sm text-gray-600">
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className="text-xs text-gray-400">评分依据(GraphRAG 召回):</span>
          {result.sources.map((s) => (
            <Tag key={s} className="!mr-0">
              {s}
            </Tag>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function InterviewPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const mut = useMutation({ mutationFn: () => scoreInterview(question, answer) })

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <Card size="small" title="面试模拟评分(依自研 GraphRAG 知识库 rubric)">
        <Space orientation="vertical" className="w-full" size="middle">
          <div>
            <div className="mb-1 text-xs text-gray-500">面试题</div>
            <Input.TextArea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              autoSize={{ minRows: 1, maxRows: 3 }}
              placeholder="输入或选择一道面试题"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {SAMPLES.map((q) => (
                <Tag key={q} className="cursor-pointer" onClick={() => setQuestion(q)}>
                  {q}
                </Tag>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">你的作答</div>
            <Input.TextArea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoSize={{ minRows: 6, maxRows: 14 }}
              placeholder="把你的口头作答写下来,AI 依知识库逐维度评分并给提分建议"
            />
          </div>
          <Button
            type="primary"
            loading={mut.isPending}
            disabled={!question.trim() || !answer.trim()}
            onClick={() => mut.mutate()}
          >
            开始评分
          </Button>
        </Space>
      </Card>

      {mut.isPending && (
        <div className="flex flex-col items-center gap-2 py-8">
          <Spin size="large" />
          <span className="text-gray-400">考官评分中(GraphRAG 检索 + 打分)…</span>
        </div>
      )}
      {mut.data && !mut.isPending && <ResultPanel result={mut.data} />}
    </div>
  )
}
