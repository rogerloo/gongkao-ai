import { useQuery } from '@tanstack/react-query'
import { Button, Cascader, Select, Space } from 'antd'
import { type DashFilters, getFilters } from './api'

const EDUCATION_OPTS = [
  { value: '本科', label: '本科' },
  { value: '大专', label: '大专' },
  { value: '研究生', label: '研究生' },
]

interface FilterBarProps {
  filters: DashFilters
  onChange: (f: DashFilters) => void
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const { data } = useQuery({ queryKey: ['job-filters'], queryFn: getFilters, staleTime: Infinity })

  const cascaderOptions = (data?.provinces ?? []).map((p) => ({
    value: p.province,
    label: p.province,
    children: p.cities.map((c) => ({ value: c, label: c })),
  }))

  const regionValue = filters.province
    ? filters.city
      ? [filters.province, filters.city]
      : [filters.province]
    : []

  return (
    <Space wrap>
      <Cascader
        options={cascaderOptions}
        value={regionValue}
        changeOnSelect
        allowClear
        placeholder="省 / 市"
        style={{ width: 200 }}
        onChange={(v) =>
          onChange({
            ...filters,
            province: (v?.[0] as string) ?? undefined,
            city: (v?.[1] as string) ?? undefined,
          })
        }
      />
      <Select
        placeholder="年份"
        allowClear
        style={{ width: 110 }}
        value={filters.year}
        options={(data?.years ?? []).map((y) => ({ value: y, label: `${y} 年` }))}
        onChange={(y) => onChange({ ...filters, year: y })}
      />
      <Select
        placeholder="学历"
        allowClear
        style={{ width: 120 }}
        value={filters.education}
        options={EDUCATION_OPTS}
        onChange={(e) => onChange({ ...filters, education: e })}
      />
      <Button onClick={() => onChange({})}>重置</Button>
    </Space>
  )
}
