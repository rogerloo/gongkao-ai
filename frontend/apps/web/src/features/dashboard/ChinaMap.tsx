import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Spin } from 'antd'
import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import echarts from '@/shared/lib/echarts'
import { getMap } from './api'

interface GeoJson {
  features: { properties: { name: string } }[]
}

// 只有这两省有数据,支持下钻;adcode 取自 DataV.GeoAtlas
const PROVINCE_ADCODE: Record<string, string> = { 贵州: '520000', 青海: '630000' }

// geojson 自托管于 public/geo/(同源),规避第三方 CDN(DataV)对生产域名防盗链导致的 403
async function fetchGeo(adcode: string): Promise<GeoJson> {
  const res = await fetch(`${import.meta.env.BASE_URL}geo/${adcode}_full.json`)
  if (!res.ok) throw new Error('geojson 加载失败')
  return (await res.json()) as GeoJson
}

function norm(s: string): string {
  return s.replace(/(省|市|特别行政区|自治区|自治州|地区|盟)$/g, '')
}

export default function ChinaMap() {
  const [province, setProvince] = useState<string | null>(null) // null = 全国
  const adcode = province ? PROVINCE_ADCODE[province] : '100000'
  const mapName = province ?? 'china'

  const { data: geo } = useQuery({
    queryKey: ['geo', adcode],
    queryFn: () => fetchGeo(adcode),
    staleTime: Infinity,
  })
  const { data: mapData } = useQuery({
    queryKey: ['job-map', province],
    queryFn: () => getMap({ province: province ?? undefined }),
  })

  const [registered, setRegistered] = useState(false)
  useEffect(() => {
    if (!geo) return
    echarts.registerMap(mapName, geo as unknown as Parameters<typeof echarts.registerMap>[1])
    setRegistered(true)
  }, [geo, mapName])

  if (!geo || !mapData || !registered) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    )
  }

  const items = mapData.items
  const data = geo.features.map((f) => {
    const gname = f.properties.name
    const hit = items.find((it) => gname.startsWith(it.name) || norm(gname) === norm(it.name))
    return { name: gname, value: hit?.jobs ?? 0 }
  })
  const max = Math.max(1, ...data.map((d) => d.value))

  const option: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 个岗位' },
    visualMap: {
      min: 0,
      max,
      left: 8,
      bottom: 8,
      calculable: true,
      inRange: { color: ['#e6f4ff', '#69b1ff', '#0958d9'] },
    },
    series: [
      {
        type: 'map',
        map: mapName,
        roam: false,
        label: { show: province != null, fontSize: 10 },
        emphasis: { label: { show: true }, itemStyle: { areaColor: '#faad14' } },
        data,
      },
    ],
  }

  const onEvents = {
    click: (p: { name?: string }) => {
      if (province || !p.name) return
      const short = norm(p.name)
      if (PROVINCE_ADCODE[short]) setProvince(short)
    },
  }

  return (
    <div className="flex h-full flex-col">
      {province && (
        <Button size="small" className="mb-1 self-start" onClick={() => setProvince(null)}>
          ← 返回全国
        </Button>
      )}
      <div className="min-h-0 flex-1">
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: '100%' }}
          notMerge
          onEvents={onEvents}
        />
      </div>
    </div>
  )
}
