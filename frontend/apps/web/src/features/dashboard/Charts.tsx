import type { ReactNode } from 'react'
import { HolderOutlined } from '@ant-design/icons'
import { Card } from 'antd'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import echarts from '@/shared/lib/echarts'
import type { JobStats, ScatterPoint } from './api'

const FILL = { height: '100%' as const }

/** 卡片填满 rgl 网格单元;标题左侧为拖拽手柄(.drag-handle),仅手柄可拖动,不挡图表交互。 */
function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card
      size="small"
      className="h-full"
      styles={{ body: { height: 'calc(100% - 39px)', padding: 8 } }}
      title={
        <span className="flex items-center gap-2">
          <HolderOutlined className="drag-handle cursor-move text-gray-400" />
          <span className="text-sm">{title}</span>
        </span>
      }
    >
      {children}
    </Card>
  )
}

export function TrendChart({ data }: { data: JobStats['by_year'] }) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['岗位数', '招录数'], right: 0 },
    grid: { left: 48, right: 16, top: 32, bottom: 48 },
    xAxis: { type: 'category', data: data.map((d) => `${d.year}`) },
    yAxis: { type: 'value' },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 8 }],
    series: [
      { name: '岗位数', type: 'line', smooth: true, areaStyle: {}, data: data.map((d) => d.jobs) },
      { name: '招录数', type: 'line', smooth: true, data: data.map((d) => d.headcount) },
    ],
  }
  return <ReactEChartsCore echarts={echarts} option={option} style={FILL} notMerge />
}

export function RatioHistChart({ data }: { data: JobStats['ratio_hist'] }) {
  const option: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 16, top: 16, bottom: 40 },
    xAxis: { type: 'category', data: data.map((d) => d.bucket), name: '报录比' },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: data.map((d) => d.count), itemStyle: { color: '#1677ff' } }],
  }
  return <ReactEChartsCore echarts={echarts} option={option} style={FILL} notMerge />
}

export function EducationChart({ data }: { data: JobStats['by_education'] }) {
  const option: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        roseType: 'area',
        radius: [16, 110],
        center: ['50%', '52%'],
        itemStyle: { borderRadius: 4 },
        label: { fontSize: 11 },
        data: data.map((d) => ({ name: d.education, value: d.jobs })),
      },
    ],
  }
  return <ReactEChartsCore echarts={echarts} option={option} style={FILL} notMerge />
}

export function TopUnitsChart({ data }: { data: JobStats['top_units'] }) {
  const sorted = [...data].sort((a, b) => a.jobs - b.jobs)
  const option: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 160, right: 24, top: 8, bottom: 24 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.unit),
      axisLabel: { width: 150, overflow: 'truncate', fontSize: 11 },
    },
    series: [{ type: 'bar', data: sorted.map((d) => d.jobs), itemStyle: { color: '#13c2c2' } }],
  }
  return <ReactEChartsCore echarts={echarts} option={option} style={FILL} notMerge />
}

const EDU_GROUPS = ['本科', '大专', '研究生', '其他'] as const
const EDU_COLORS: Record<string, string> = {
  本科: '#1677ff',
  大专: '#52c41a',
  研究生: '#722ed1',
  其他: '#bfbfbf',
}

function eduGroup(e: string): string {
  if (e.includes('研究生') || e.includes('硕士') || e.includes('博士')) return '研究生'
  if (e.includes('本科')) return '本科'
  if (e.includes('大专') || e.includes('专科')) return '大专'
  return '其他'
}

export function ScatterChart({ points }: { points: ScatterPoint[] }) {
  const series = EDU_GROUPS.map((g) => ({
    name: g,
    type: 'scatter' as const,
    large: true,
    largeThreshold: 500,
    symbolSize: (d: number[]) => Math.min(22, 4 + Math.sqrt(d[2])),
    itemStyle: { color: EDU_COLORS[g], opacity: 0.55 },
    data: points
      .filter((p) => eduGroup(p.education) === g)
      .map((p) => [p.interview_score, p.value_score, p.headcount]),
  }))
  const option: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '进面分 {@[0]} · 性价比 {@[1]} · 招录 {@[2]} 人' },
    legend: { data: [...EDU_GROUPS], right: 0 },
    grid: { left: 48, right: 16, top: 32, bottom: 40 },
    xAxis: { type: 'value', name: '进面分', scale: true },
    yAxis: { type: 'value', name: '性价比分' },
    series,
  }
  return <ReactEChartsCore echarts={echarts} option={option} style={FILL} notMerge />
}

export { ChartCard }
