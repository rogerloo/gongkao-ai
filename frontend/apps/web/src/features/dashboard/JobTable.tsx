import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Descriptions, Drawer, Spin, Tag } from 'antd'
import { type DashFilters, getList, type JobRow } from './api'

const columns: ColumnDef<JobRow>[] = [
  { accessorKey: 'province', header: '省', size: 56 },
  { accessorKey: 'city', header: '市', size: 88 },
  { accessorKey: 'year', header: '年份', size: 56 },
  { accessorKey: 'unit', header: '单位', size: 220 },
  { accessorKey: 'position', header: '职位', size: 200 },
  { accessorKey: 'education', header: '学历', size: 130 },
  { accessorKey: 'apply_ratio', header: '报录比', size: 72 },
  { accessorKey: 'interview_score', header: '进面分', size: 72 },
  { accessorKey: 'headcount', header: '招录', size: 56 },
  { accessorKey: 'value_score', header: '性价比', size: 72 },
]

const ROW_H = 38

function valueColor(v: number | null): string {
  if (v == null) return 'default'
  if (v >= 70) return 'green'
  if (v >= 50) return 'gold'
  return 'default'
}

const DETAIL_FIELDS: { label: string; key: keyof JobRow; suffix?: string }[] = [
  { label: '省份', key: 'province' },
  { label: '地市', key: 'city' },
  { label: '年份', key: 'year' },
  { label: '单位', key: 'unit' },
  { label: '职位', key: 'position' },
  { label: '学历', key: 'education' },
  { label: '报录比', key: 'apply_ratio' },
  { label: '进面分', key: 'interview_score' },
  { label: '招录数', key: 'headcount', suffix: ' 人' },
]

/** 岗位明细虚拟表:一次加载上万行,TanStack Virtual 只渲染可视区(大数据 60fps)。 */
export default function JobTable({ filters }: { filters: DashFilters }) {
  const { data, isLoading } = useQuery({
    queryKey: ['job-list', filters],
    queryFn: () => getList(filters, 10000),
  })
  const rows = data?.items ?? []
  const [selected, setSelected] = useState<JobRow | null>(null)

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const tableRows = table.getRowModel().rows
  const totalWidth = table.getTotalSize()
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 text-xs text-gray-400">
        共 {data?.total ?? 0} 条,已加载 {rows.length} 条(虚拟滚动,仅渲染可视行)
      </div>
      {/* 单一滚动容器(X+Y 同一个)+ 表头 sticky 粘顶:避免外层/内层各一条横向滚动条 */}
      <div
        ref={parentRef}
        className="overflow-auto rounded border border-gray-200"
        style={{ height: 440 }}
      >
        <div style={{ width: totalWidth }}>
          {/* 表头:粘顶,随同一容器横向滚动,始终与数据列对齐 */}
          {table.getHeaderGroups().map((hg) => (
            <div
              key={hg.id}
              className="sticky top-0 z-10 flex border-b bg-gray-50 text-xs font-medium"
            >
              {hg.headers.map((h) => (
                <div key={h.id} className="shrink-0 px-2 py-2" style={{ width: h.getSize() }}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </div>
              ))}
            </div>
          ))}
          {/* 虚拟滚动体:行宽锁定为表宽,只靠外层容器横滑 */}
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = tableRows[vi.index]
              return (
                <div
                  key={row.id}
                  onClick={() => setSelected(row.original)}
                  className="absolute flex cursor-pointer border-b border-gray-100 text-xs hover:bg-blue-50"
                  style={{
                    transform: `translateY(${vi.start}px)`,
                    height: vi.size,
                    width: totalWidth,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="shrink-0 truncate px-2 py-2"
                      style={{ width: cell.column.getSize() }}
                      title={String(cell.getValue() ?? '')}
                    >
                      {String(cell.getValue() ?? '')}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Drawer
        title={selected ? `${selected.unit ?? ''} · ${selected.position ?? ''}` : '岗位明细'}
        size="large"
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <Descriptions column={1} size="small" bordered>
            {DETAIL_FIELDS.map((f) => {
              const v = selected[f.key]
              return (
                <Descriptions.Item key={f.key} label={f.label}>
                  {v ?? '—'}
                  {v != null ? (f.suffix ?? '') : ''}
                </Descriptions.Item>
              )
            })}
            <Descriptions.Item label="性价比综合分">
              <Tag color={valueColor(selected.value_score)}>{selected.value_score ?? '—'}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
