import { useQuery } from '@tanstack/react-query'
import { Card, Empty, Skeleton, Statistic, Table } from 'antd'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import echarts from '@/shared/lib/echarts'
import { type UsagePoint, getUsage, getUsageTimeseries } from './api'

function trendOption(ts: UsagePoint[]): EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const arr = params as { dataIndex: number }[]
        const p = ts[arr[0]?.dataIndex ?? 0]
        if (!p) return ''
        return `${p.endpoint ?? '-'} · ${p.model ?? '-'}<br/>tokens ${p.tokens}<br/>延迟 ${p.latency_ms}ms`
      },
    },
    legend: { data: ['tokens', '延迟(ms)'], top: 0 },
    grid: { left: 48, right: 52, top: 30, bottom: 28 },
    xAxis: { type: 'category', data: ts.map((_, i) => `#${i + 1}`) },
    yAxis: [
      { type: 'value', name: 'tokens' },
      { type: 'value', name: 'ms', position: 'right' },
    ],
    series: [
      {
        name: 'tokens',
        type: 'bar',
        yAxisIndex: 0,
        data: ts.map((p) => p.tokens),
        itemStyle: { color: '#1677ff' },
      },
      {
        name: '延迟(ms)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: ts.map((p) => p.latency_ms),
        itemStyle: { color: '#fa8c16' },
      },
    ],
  }
}

export default function UsagePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['llm-usage'],
    queryFn: getUsage,
    refetchInterval: 5000,
  })
  const { data: ts } = useQuery({
    queryKey: ['llm-usage-ts'],
    queryFn: getUsageTimeseries,
    refetchInterval: 5000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} size="small">
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
            </Card>
          ))}
        </div>
        <Card size="small" title="调用趋势">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    )
  }

  const kpis: { title: string; value: number; precision?: number; suffix?: string }[] = [
    { title: '总请求数', value: data.requests },
    { title: '总 tokens', value: data.total_tokens },
    { title: '输入 tokens', value: data.prompt_tokens },
    { title: '输出 tokens', value: data.completion_tokens },
    { title: '平均延迟', value: data.avg_latency_ms, suffix: ' ms' },
    { title: '估算成本(¥)', value: data.est_cost_cny, precision: 4 },
  ]

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.title} size="small">
            <Statistic title={k.title} value={k.value} precision={k.precision} suffix={k.suffix} />
          </Card>
        ))}
      </div>

      <Card size="small" title="调用趋势(tokens 柱 / 延迟线,最近 50 次)">
        {ts && ts.length > 0 ? (
          <ReactEChartsCore
            echarts={echarts}
            option={trendOption(ts)}
            style={{ height: 260 }}
            notMerge
          />
        ) : (
          <Empty description="暂无调用" />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card size="small" title="按端点">
          {data.by_endpoint.length > 0 ? (
            <Table
              rowKey="endpoint"
              size="small"
              pagination={false}
              dataSource={data.by_endpoint}
              columns={[
                { title: '端点', dataIndex: 'endpoint' },
                { title: '请求', dataIndex: 'requests', width: 80 },
                { title: 'tokens', dataIndex: 'tokens', width: 100 },
              ]}
            />
          ) : (
            <Empty description="暂无调用" />
          )}
        </Card>
        <Card size="small" title="按模型">
          {data.by_model.length > 0 ? (
            <Table
              rowKey="model"
              size="small"
              pagination={false}
              dataSource={data.by_model}
              columns={[
                { title: '模型', dataIndex: 'model' },
                { title: '请求', dataIndex: 'requests', width: 80 },
                { title: 'tokens', dataIndex: 'tokens', width: 100 },
              ]}
            />
          ) : (
            <Empty description="暂无调用" />
          )}
        </Card>
      </div>
      <Card size="small" title="最近调用明细">
        {ts && ts.length > 0 ? (
          <Table
            rowKey={(r) => `${r.t}-${r.endpoint}`}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            dataSource={[...ts].reverse()}
            columns={[
              {
                title: '时间',
                dataIndex: 't',
                render: (t: string) => t?.slice(5, 19).replace('T', ' '),
              },
              { title: '端点', dataIndex: 'endpoint', width: 90 },
              { title: '模型', dataIndex: 'model' },
              { title: 'tokens', dataIndex: 'tokens', width: 90 },
              { title: '延迟(ms)', dataIndex: 'latency_ms', width: 100 },
            ]}
          />
        ) : (
          <Empty description="暂无调用" />
        )}
      </Card>

      <div className="text-xs text-gray-400">
        每 5 秒自动刷新;延迟为端到端流式耗时;成本粗估(混合 ¥2/百万 token)。
      </div>
    </div>
  )
}
