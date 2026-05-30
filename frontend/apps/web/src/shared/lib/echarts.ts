// 按需注册的 echarts 实例(替代整包 import 'echarts',显著减小体积)。
// 各图表组件改用 echarts-for-react/lib/core + 此实例。
import * as echarts from 'echarts/core'
import {
  BarChart,
  GraphChart,
  LineChart,
  MapChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  // 图表
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  MapChart,
  GraphChart,
  RadarChart,
  // 组件
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  TitleComponent,
  // 渲染器
  CanvasRenderer,
])

export default echarts
