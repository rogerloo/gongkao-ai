import { useMemo, useState } from 'react'
import { SearchOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Card, Drawer, Empty, Input, Segmented, Space, Table, Tag, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { type KbNode, type KbSearchHit, getKbGraph, getKbNode, listKbNodes, searchKb } from './api'
import KbGraph from './KbGraph'

const TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '主张 stance', value: 'stance' },
  { label: '概念 concept', value: 'concept' },
]

const VIEW_OPTIONS = [
  { label: '🕸 图谱', value: 'graph' },
  { label: '📋 节点表', value: 'table' },
]

const columns: ColumnsType<KbNode> = [
  {
    title: '类型',
    dataIndex: 'type',
    width: 110,
    render: (t: string) => <Tag color={t === 'stance' ? 'blue' : 'cyan'}>{t}</Tag>,
  },
  { title: '标题', dataIndex: 'title', ellipsis: true },
  {
    title: '向量',
    dataIndex: 'has_embedding',
    width: 80,
    render: (v: boolean) => (v ? <Tag color="green">已向量</Tag> : <Tag>—</Tag>),
  },
  { title: '关联度', dataIndex: 'degree', width: 80 },
]

export default function KbPage() {
  const [view, setView] = useState('graph')
  const [type, setType] = useState('')
  const { data } = useQuery({
    queryKey: ['kb-nodes', type],
    queryFn: () => listKbNodes(type || undefined),
  })
  const { data: graph, isLoading: graphLoading } = useQuery({
    queryKey: ['kb-graph'],
    queryFn: getKbGraph,
  })
  const [query, setQuery] = useState('')
  const searchMut = useMutation({ mutationFn: (q: string) => searchKb(q) })

  const hits: KbSearchHit[] = searchMut.data?.items ?? []
  const seeds = hits.filter((h) => h.is_seed)
  const expanded = hits.filter((h) => !h.is_seed)
  const seedIds = useMemo(() => new Set(seeds.map((h) => h.id)), [seeds])
  const expandIds = useMemo(() => new Set(expanded.map((h) => h.id)), [expanded])

  const [nodeId, setNodeId] = useState<string | null>(null)
  const { data: nodeDetail } = useQuery({
    queryKey: ['kb-node', nodeId],
    queryFn: () => getKbNode(nodeId as string),
    enabled: !!nodeId,
  })

  return (
    <div className="flex h-full flex-col gap-3">
      <Card size="small" title="GraphRAG 检索测试">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入面试问题,测试向量召回 + 反向链接图扩展(命中将在图谱中高亮)"
            onPressEnter={() => query.trim() && searchMut.mutate(query)}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={searchMut.isPending}
            onClick={() => query.trim() && searchMut.mutate(query)}
          >
            检索
          </Button>
        </div>
        {hits.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <span className="text-xs text-gray-400">向量召回种子:</span>
            {seeds.map((h) => (
              <Tooltip key={h.id} title={`${h.type} · 相似度 ${h.score ?? '-'}`}>
                <Tag color={h.type === 'stance' ? 'blue' : 'cyan'} className="!mr-0">
                  {h.title}
                </Tag>
              </Tooltip>
            ))}
            {expanded.length > 0 && (
              <>
                <span className="ml-2 text-xs text-gray-400">图扩展:</span>
                {expanded.map((h) => (
                  <Tag key={h.id} className="!mr-0">
                    {h.title}
                  </Tag>
                ))}
              </>
            )}
          </div>
        )}
      </Card>

      <Card
        size="small"
        title={`知识图谱(stance ${data?.stances ?? 0} / concept ${data?.concepts ?? 0},共 ${data?.total ?? 0} 节点)`}
        className="min-h-0 flex-1"
        styles={{ body: { height: 'calc(100% - 39px)', padding: view === 'graph' ? 4 : 12 } }}
        extra={
          <Space>
            {view === 'table' && (
              <Segmented
                size="small"
                options={TYPE_OPTIONS}
                value={type}
                onChange={(v) => setType(v as string)}
              />
            )}
            <Segmented options={VIEW_OPTIONS} value={view} onChange={(v) => setView(v as string)} />
          </Space>
        }
      >
        {view === 'graph' ? (
          <KbGraph
            graph={graph}
            loading={graphLoading}
            seeds={seedIds}
            expanded={expandIds}
            onNodeClick={setNodeId}
          />
        ) : (
          <Table<KbNode>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data?.items ?? []}
            pagination={{ pageSize: 20, showSizeChanger: false }}
          />
        )}
      </Card>

      <Drawer
        title={nodeDetail?.title ?? '节点详情'}
        size="large"
        open={!!nodeId}
        onClose={() => setNodeId(null)}
      >
        {nodeDetail && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Tag color={nodeDetail.type === 'stance' ? 'blue' : 'cyan'}>{nodeDetail.type}</Tag>
              {nodeDetail.has_embedding ? <Tag color="green">已向量</Tag> : <Tag>未向量</Tag>}
            </div>
            <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded border border-gray-100 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
              {nodeDetail.body || '(无正文)'}
            </div>
            <div>
              <div className="mb-1 text-xs text-gray-400">
                邻居节点({nodeDetail.neighbors.length})· 点击跳转
              </div>
              {nodeDetail.neighbors.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {nodeDetail.neighbors.map((n) => (
                    <Tag
                      key={n.id}
                      color={n.type === 'stance' ? 'blue' : 'cyan'}
                      className="!mr-0 cursor-pointer"
                      onClick={() => setNodeId(n.id)}
                    >
                      {n.title}
                    </Tag>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无邻居" />
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
