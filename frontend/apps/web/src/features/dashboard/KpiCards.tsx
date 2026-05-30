import { Card, Statistic } from 'antd'
import type { Kpi } from './api'

export default function KpiCards({ kpi }: { kpi: Kpi }) {
  const items: { title: string; value: number | string; suffix?: string }[] = [
    { title: '岗位总数', value: kpi.total_jobs },
    { title: '招录总数', value: kpi.total_headcount },
    { title: '平均报录比', value: kpi.avg_apply_ratio ?? '-', suffix: ': 1' },
    { title: '平均进面分', value: kpi.avg_interview_score ?? '-' },
    { title: '平均性价比', value: kpi.avg_value_score ?? '-' },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <Card key={it.title} size="small">
          <Statistic title={it.title} value={it.value} suffix={it.suffix} />
        </Card>
      ))}
    </div>
  )
}
