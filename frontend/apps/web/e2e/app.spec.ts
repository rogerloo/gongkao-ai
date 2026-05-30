import { type Page, expect, test } from '@playwright/test'

const tokens = (role: string) => ({
  access_token: 'test-access',
  refresh_token: 'test-refresh',
  user: { username: role, role },
})

const STATS = {
  kpi: {
    total_jobs: 12345,
    total_headcount: 6789,
    avg_apply_ratio: 50,
    avg_interview_score: 68,
    avg_value_score: 55,
  },
  by_year: [{ year: 2024, jobs: 100, headcount: 50 }],
  ratio_hist: [{ bucket: '0-5', count: 10 }],
  by_education: [{ education: '本科', jobs: 80, headcount: 40 }],
  by_province: [{ province: '贵州', jobs: 100, headcount: 50, avg_ratio: 50 }],
  top_units: [{ unit: '某单位', jobs: 5, headcount: 3 }],
}

async function stubApi(page: Page, role = 'admin') {
  await page.route('**/api/auth/login', (r) => r.fulfill({ json: tokens(role) }))
  await page.route('**/api/auth/refresh', (r) => r.fulfill({ json: tokens(role) }))
  await page.route('**/api/auth/me', (r) => r.fulfill({ json: { username: role, role } }))
  await page.route('**/api/jobs/stats**', (r) => r.fulfill({ json: STATS }))
  await page.route('**/api/jobs/filters**', (r) =>
    r.fulfill({ json: { provinces: [], years: [2024] } }),
  )
  await page.route('**/api/jobs/scatter**', (r) => r.fulfill({ json: [] }))
  await page.route('**/api/jobs/map**', (r) =>
    r.fulfill({ json: { level: 'province', items: [] } }),
  )
  await page.route('**/api/jobs/list**', (r) => r.fulfill({ json: { total: 0, items: [] } }))
  await page.route('**/geo.datav.aliyun.com/**', (r) =>
    r.fulfill({ json: { type: 'FeatureCollection', features: [] } }),
  )
}

test('登录后进入数据看板,KPI 正常渲染', async ({ page }) => {
  await stubApi(page, 'admin')
  await page.goto('/login')
  await page.getByRole('button', { name: '登 录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('岗位总数')).toBeVisible()
  await expect(page.getByText('12,345')).toBeVisible()
})

test('analyst 角色:菜单受限 + 直访受限页跳 403', async ({ page }) => {
  await stubApi(page, 'analyst')
  await page.goto('/login')
  await page.getByRole('button', { name: '登 录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  // 受限菜单(Prompt/知识库/用量)对 analyst 不可见
  await expect(page.getByRole('menuitem', { name: /Prompt 配置中心/ })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: /知识库管理/ })).toHaveCount(0)
  // 直访受限页 → 403
  await page.goto('/usage')
  await expect(page.getByText('403')).toBeVisible()
})
