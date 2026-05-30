import { useMemo } from 'react'
import { Empty, Spin } from 'antd'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import echarts from '@/shared/lib/echarts'
import type { KbGraph } from './api'

interface KbGraphProps {
  graph?: KbGraph
  loading?: boolean
  /** GraphRAG 检索命中的种子节点 id(高亮为红) */
  seeds?: Set<string>
  /** 图扩展邻居 id(高亮为橙) */
  expanded?: Set<string>
  /** 点击节点回调(查看详情) */
  onNodeClick?: (id: string) => void
}

const STANCE = '#1677ff'
const CONCEPT = '#13c2c2'
const SEED = '#f5222d'
const EXPAND = '#fa8c16'
const DIM = '#d9d9d9'

/**
 * 知识图谱力导向可视化:节点按 type 着色、按度数定大小;
 * 传入检索命中时,种子/扩展节点高亮、其余淡出——直观呈现自研 GraphRAG 的召回子图。
 */
export default function KbGraph({ graph, loading, seeds, expanded, onNodeClick }: KbGraphProps) {
  const onEvents = {
    click: (params: { dataType?: string; data?: { id?: string } }) => {
      if (params.dataType === 'node' && params.data?.id) onNodeClick?.(params.data.id)
    },
  }
  const option = useMemo<EChartsOption>(() => {
    const nodes = graph?.nodes ?? []
    const edges = graph?.edges ?? []
    const hasHighlight = (seeds?.size ?? 0) > 0 || (expanded?.size ?? 0) > 0

    const data = nodes.map((n) => {
      const isSeed = seeds?.has(n.id) ?? false
      const isExp = expanded?.has(n.id) ?? false
      const base = 8 + Math.min(n.degree, 12) * 2.4
      const color = n.type === 'stance' ? STANCE : CONCEPT
      const itemStyle = hasHighlight
        ? isSeed
          ? { color: SEED, borderColor: '#ffa39e', borderWidth: 2 }
          : isExp
            ? { color: EXPAND }
            : { color: DIM, opacity: 0.25 }
        : { color }
      return {
        id: n.id,
        name: n.title,
        value: n.degree,
        symbolSize: isSeed ? base + 8 : base,
        category: n.type === 'stance' ? 0 : 1,
        itemStyle,
        label: { show: isSeed || isExp || n.degree >= 7 },
      }
    })

    return {
      tooltip: {
        formatter: (params) => {
          const p = params as { dataType?: string; name?: string; value?: number }
          if (p.dataType === 'edge') return ''
          return `${p.name ?? ''}<br/>关联度 ${p.value ?? 0}`
        },
      },
      legend: [{ data: ['主张 stance', '概念 concept'], top: 4 }],
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          data,
          links: edges.map((e) => ({ source: e.source, target: e.target })),
          categories: [{ name: '主张 stance' }, { name: '概念 concept' }],
          force: { repulsion: 130, edgeLength: [40, 130], gravity: 0.08 },
          emphasis: { focus: 'adjacency', label: { show: true } },
          label: { position: 'right', fontSize: 10, color: '#555' },
          lineStyle: { color: 'source', opacity: 0.28, curveness: 0.12 },
          scaleLimit: { min: 0.4, max: 4 },
        },
      ],
    }
  }, [graph, seeds, expanded])

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Spin size="large" />
        <span className="text-gray-400">加载知识图谱…</span>
      </div>
    )
  }
  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty description="暂无图谱数据" />
      </div>
    )
  }
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height: '100%' }}
      notMerge
      onEvents={onEvents}
    />
  )
}
