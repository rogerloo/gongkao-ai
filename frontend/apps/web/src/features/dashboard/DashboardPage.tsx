import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Skeleton } from 'antd'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { type DashFilters, getScatter, getStats } from './api'
import {
  ChartCard,
  EducationChart,
  RatioHistChart,
  ScatterChart,
  TopUnitsChart,
  TrendChart,
} from './Charts'
import ChinaMap from './ChinaMap'
import FilterBar from './FilterBar'
import JobTable from './JobTable'
import KpiCards from './KpiCards'

const LAYOUT_KEY = 'gongkao.dashLayouts'
const DEFAULT_LAYOUT: Layout = [
  { i: 'trend', x: 0, y: 0, w: 12, h: 5 },
  { i: 'ratio', x: 0, y: 5, w: 6, h: 5 },
  { i: 'education', x: 6, y: 5, w: 6, h: 5 },
  { i: 'map', x: 0, y: 10, w: 6, h: 6 },
  { i: 'scatter', x: 6, y: 10, w: 6, h: 6 },
  { i: 'topunits', x: 0, y: 16, w: 12, h: 5 },
]

const ResponsiveGridLayout = WidthProvider(Responsive)
const COLS = { lg: 12, md: 12, sm: 6, xs: 4, xxs: 2 }
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }

function loadLayouts(): ResponsiveLayouts {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    return raw ? (JSON.parse(raw) as ResponsiveLayouts) : { lg: DEFAULT_LAYOUT }
  } catch {
    return { lg: DEFAULT_LAYOUT }
  }
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashFilters>({})
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(loadLayouts)
  const { data: stats, isLoading } = useQuery({
    queryKey: ['job-stats', filters],
    queryFn: () => getStats(filters),
  })
  const { data: scatter } = useQuery({
    queryKey: ['job-scatter', filters],
    queryFn: () => getScatter(filters),
  })

  const fireResize = () => window.dispatchEvent(new Event('resize'))
  const onLayoutChange = (_current: Layout, all: ResponsiveLayouts) => {
    setLayouts(all)
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(all))
    fireResize()
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <FilterBar filters={filters} onChange={setFilters} />
      {isLoading || !stats ? (
        <div className="flex-1 overflow-auto pb-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} size="small">
                <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
              </Card>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} size="small">
                <Skeleton active paragraph={{ rows: 5 }} />
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto pb-4">
          <KpiCards kpi={stats.kpi} />
          <ResponsiveGridLayout
            className="mt-1"
            layouts={layouts}
            cols={COLS}
            breakpoints={BREAKPOINTS}
            rowHeight={64}
            margin={[16, 16]}
            draggableHandle=".drag-handle"
            onLayoutChange={onLayoutChange}
            onResize={fireResize}
            isBounded
          >
            <div key="trend">
              <ChartCard title="跨年招录趋势">
                <TrendChart data={stats.by_year} />
              </ChartCard>
            </div>
            <div key="ratio">
              <ChartCard title="报录比分布">
                <RatioHistChart data={stats.ratio_hist} />
              </ChartCard>
            </div>
            <div key="education">
              <ChartCard title="学历结构">
                <EducationChart data={stats.by_education} />
              </ChartCard>
            </div>
            <div key="map">
              <ChartCard title="岗位地理分布(点击贵州/青海下钻)">
                <ChinaMap />
              </ChartCard>
            </div>
            <div key="scatter">
              <ChartCard title="性价比 × 进面分(点大小=招录,色=学历)">
                <ScatterChart points={scatter ?? []} />
              </ChartCard>
            </div>
            <div key="topunits">
              <ChartCard title="TOP10 招录单位">
                <TopUnitsChart data={stats.top_units} />
              </ChartCard>
            </div>
          </ResponsiveGridLayout>
          <Card size="small" title="岗位明细(虚拟滚动)" className="mt-4">
            <JobTable filters={filters} />
          </Card>
        </div>
      )}
    </div>
  )
}
