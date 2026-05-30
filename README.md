# 公考 AI Agent 工作台

> 面向公考考生的全栈 AI 应用 —— **智能选岗 Agent**(Function Calling)+ **面试教练**(自研 GraphRAG)+ **AI 工程化中后台**(Prompt 配置中心 / 多模型路由 / 成本看板)。

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![Postgres](https://img.shields.io/badge/Postgres-pgvector-4169E1?logo=postgresql&logoColor=white)
![DeepSeek](https://img.shields.io/badge/LLM-DeepSeek%20%2F%20%E6%99%BA%E8%B0%B1-7C3AED)

> 🔗 **在线演示**:部署中 · 📄 [技术方案 PLAN.md](./PLAN.md) · 📦 [部署手册 DEPLOY.md](./DEPLOY.md) · 🖼 [更多截图](./docs/screenshots)
>
> 个人作品 · 数据已脱敏 · LLM key 仅在后端(前端只调自己的 API)

---

## 这是什么

一个 **B 端中后台风格的 AI 应用**:以 **38,648 条真实公考岗位数据** + 一个**面试方法论知识图谱**为底座,把"大模型"包装成三个对考生真正有用、且工程上可控的能力。

| 能力 | 一句话 | 关键技术 |
|---|---|---|
| 🤖 **智能选岗 Agent** | "我本科会计,想报贵州竞争小的岗位" → Agent 自己决定调哪个工具、怎么筛 | **Function Calling** 三工具(筛选 / 性价比算分 / 多岗对比),结果走确定性引擎 |
| 🧠 **面试教练** | 问任意公考面试方法论,基于知识图谱给针对性讲解,并**亮出检索到的原文** | **自研 GraphRAG**:向量召回 + 知识图谱反链图扩展 + 检索透明化 |
| 📊 **数据看板 + AI 工程化** | 3.8 万岗位的 BI 可视化 + 一套管 Prompt / 模型 / 成本的中后台 | ECharts 三级地图下钻、Prompt 版本管理、多模型路由、token 成本计量 |

**设计哲学**:LLM 负责"理解意图 / 生成讲解",**筛选 / 算分 / 排序这类要可信的环节全部交给确定性引擎**;模型输出一律当作不可信输入做裁剪与校验。AI 用在该用的地方,不让幻觉污染结果。

---

## 预览

<table>
  <tr>
    <td width="50%"><b>AI 对话 · SSE 流式 + Agent 状态时间线</b><br/><img src="./docs/screenshots/stage1-01-chat-stream.png" alt="对话流式"/></td>
    <td width="50%"><b>Agent 工具调用 / 多步任务可视化</b><br/><img src="./docs/screenshots/stage1-02-agent-timeline.png" alt="Agent 时间线"/></td>
  </tr>
  <tr>
    <td><b>选岗 Agent · 多岗位结构化对比(Function Calling)</b><br/><img src="./docs/screenshots/stage4-11-agent-compare.jpeg" alt="多岗对比"/></td>
    <td><b>面试教练 · GraphRAG 检索透明化(亮出原文)</b><br/><img src="./docs/screenshots/stage4-09-rag-transparency.jpeg" alt="RAG 透明化"/></td>
  </tr>
  <tr>
    <td><b>BI 数据看板 · KPI + 联动筛选</b><br/><img src="./docs/screenshots/stage2-01-dashboard.png" alt="数据看板"/></td>
    <td><b>三级地图下钻(全国 → 省 → 市州)</b><br/><img src="./docs/screenshots/stage2-02-map.png" alt="地图下钻"/></td>
  </tr>
  <tr>
    <td><b>知识图谱可视化(ECharts 力导向)</b><br/><img src="./docs/screenshots/stage4-02-kb-graph.jpeg" alt="知识图谱"/></td>
    <td><b>Prompt 配置中心 · Monaco + 版本 diff + Playground</b><br/><img src="./docs/screenshots/stage3-02-playground.jpeg" alt="Prompt Playground"/></td>
  </tr>
  <tr>
    <td><b>多模型路由 · 推理模型(R1)思考过程展示</b><br/><img src="./docs/screenshots/stage3-07-r1-thinking.jpeg" alt="推理过程"/></td>
    <td><b>token 用量 + 成本 + 延迟看板</b><br/><img src="./docs/screenshots/stage4-06-usage-trend.jpeg" alt="成本看板"/></td>
  </tr>
  <tr>
    <td><b>面试模拟评分</b><br/><img src="./docs/screenshots/stage4-12-interview-score.jpeg" alt="面试评分"/></td>
    <td><b>四级 RBAC · 越权 403</b><br/><img src="./docs/screenshots/stage0-03-rbac-403-analyst.png" alt="RBAC"/></td>
  </tr>
</table>

---

## 架构

```mermaid
flowchart LR
  U([考生 / 管理员]) --> FE

  subgraph FEW [前端 · React 19 SPA]
    FE["AntD v6 · Tailwind v4<br/>Zustand · TanStack Query<br/>ECharts · AI Elements"]
  end

  FE -- "REST /api · JWT Bearer" --> API
  API -. "SSE 流式 token" .-> FE

  subgraph BEW [后端 · FastAPI async]
    API[API 层 + 四级 RBAC]
    API --> AGENT["选岗 Agent<br/>Function Calling"]
    API --> COACH["面试教练<br/>自研 GraphRAG"]
    API --> ROUTER["多模型路由<br/>+ 用量/成本计量"]
  end

  AGENT --> PG[("Postgres<br/>+ pgvector")]
  COACH --> PG
  AGENT --> LLM{{"DeepSeek / 智谱"}}
  COACH --> LLM
  ROUTER --> LLM
  COACH --> EMB{{"SiliconFlow bge-m3<br/>Embedding"}}
```

- **前端只调自己的 `/api`**,LLM key 永不进前端(铁律)。
- **选岗 Agent**:LLM 通过 Function Calling 决定调用 `筛选岗位 / 计算性价比 / 对比岗位` 工具;真实筛选与算分由后端确定性函数执行,LLM 只编排与解读。
- **面试教练**:bge-m3 向量召回知识图谱节点 → 沿反向链接做图扩展 → 组装上下文 → LLM 生成,并把命中的原文片段回传前端透明展示。
- **多模型路由**:`deepseek-chat`(快)/ `deepseek-reasoner`(带推理过程)按场景切换,每次调用记 token 与成本。

---

## 技术栈

**前端** — TypeScript(strict)· React 19(+ React Compiler)· Vite 8 · Ant Design v6 · Tailwind v4 · AI Elements · Zustand · TanStack Query · React Router v7 · ECharts 6 · pnpm workspace(`apps/web` + `packages/ui`)

**后端** — FastAPI · SQLAlchemy 2(async)· Postgres + pgvector · OpenAI SDK(DeepSeek / 智谱 兼容)· SSE(sse-starlette)· PyJWT + bcrypt · pydantic-settings · uv

**工程化** — 四级 RBAC · JWT 双 token(access/refresh + 静默刷新)· Docker(三容器 compose)· GitHub Actions CI(lint / typecheck / test / E2E)· Vitest + RTL + Playwright + pytest

---

## 工程亮点

- **自研轻量 GraphRAG**,非朴素 RAG:向量召回 + 知识图谱反向链接图扩展 + **检索深度可调** + **原文片段透明化**(让"AI 凭什么这么说"可追溯)。
- **Agent 编排 + 状态机可视化**:Function Calling 三工具,前端实时展示"调用了什么工具 / 检索了什么 / 多步进度",而不是黑箱出答案。
- **把 Prompt 当工程资产**:配置中心用 Monaco 编辑、版本管理 + diff 回滚、Playground 试跑,当前版本可注入对话 system prompt。
- **多模型路由 + 成本可观测**:按场景切快模型 / 推理模型,推理过程独立展示;每次调用记 token、成本、延迟,汇成看板。
- **AI 场景的韧性与安全**:SSE 流式 + `AbortController` 中断 + 断线续传;模型输出当不可信输入(markdown XSS / 注入防御);全局 error boundary + toast + 流式中断恢复。
- **万级数据不卡**:构建期预聚合 + ECharts large 模式 + TanStack Virtual 虚拟滚动,3.8 万行明细 + 三级地图下钻流畅。

---

## 功能一览

<details>
<summary><b>AI 能力</b></summary>

- 选岗 Agent:Function Calling(筛选 / 性价比算分 / 多岗对比三工具)
- 面试教练:GraphRAG 检索 + 生成 + 原文透明化 + 检索深度调节
- 对话体验:流式输出、中断/重新生成、复制、重命名、会话搜索
- 多模型:`deepseek-chat` / `deepseek-reasoner`,推理过程展示
- 面试模拟评分
</details>

<details>
<summary><b>数据可视化</b></summary>

- KPI 卡组 + 联动筛选;趋势 / 分布 / 散点 / 排行 / 玫瑰图
- 三级地图下钻(全国 → 省 → 市州)
- 可拖拽看板;岗位明细抽屉;TanStack Virtual 虚拟明细表
- 知识图谱力导向可视化 + 节点详情抽屉
</details>

<details>
<summary><b>AI 工程化中后台</b></summary>

- Prompt 配置中心:Monaco 编辑 + 版本管理 + diff + Playground;Prompt↔对话联动
- 知识库管理:节点列表 + 检索测试
- token 用量 / 成本看板 + 用量趋势 + 延迟统计 + 调用明细流水
</details>

<details>
<summary><b>账户与权限</b></summary>

- 真 JWT 鉴权(login / refresh + 密码哈希);双 token + 拦截器静默刷新
- 四级 RBAC + 前端路由守卫 + 后端越权拦截
</details>

---

## 本地运行

> 前置:Docker · Node ≥ 22 + pnpm · Python + [uv](https://docs.astral.sh/uv/)

```bash
# 1) 起 Postgres(pgvector)
docker compose up -d db

# 2) 后端:装依赖 → 建库 + 灌数据 → 启动(:8000)
cd backend
uv sync
cp .env.example .env            # 填 DEEPSEEK_API_KEY 等(仅后端)
uv run python -m app.scripts.bootstrap     # 建表 + 种子用户 + 种子 Prompt
uv run python -m app.scripts.ingest_jobs   # 灌 3.8 万岗位
uv run python -m app.scripts.ingest_kb     # 建知识图谱 + 向量(需 SILICONFLOW_API_KEY)
uv run uvicorn app.main:app --reload

# 3) 前端(:5173,开发期 /api 代理到 :8000)
cd ../frontend
pnpm install
pnpm dev
```

整套也可一键起:`docker compose up --build`(db + FastAPI + nginx 前端,访问 http://localhost:5173)。

**环境变量**(后端 `.env`):`DATABASE_URL` · `DEEPSEEK_API_KEY` / `ZHIPU_API_KEY` / `SILICONFLOW_API_KEY` · `JWT_SECRET`(生产务必改)· `CORS_ORIGINS`。前后端分开托管时,前端构建期设 `VITE_API_BASE` 指向后端域名。

---

## 测试 & CI

```bash
cd frontend && pnpm test        # Vitest + RTL 单测;pnpm test:e2e 跑 Playwright
cd backend  && uv run pytest    # 后端 pytest
```

GitHub Actions(`.github/workflows/ci.yml`)在每次 push / PR 跑:前端 lint + 类型检查 + 构建、后端 ruff + pytest、Playwright E2E(mock API,不依赖真 LLM)。

---

## 路线图

四阶段全部完成(详见 [PLAN.md §12](./PLAN.md)),每阶段 = 一个可演示里程碑:

- **阶段 0** 基座:pnpm workspace + React19/Vite8/AntD v6 + RBAC 骨架 + FastAPI + Docker
- **阶段 1** AI 内核:选岗 Agent(Function Calling)、面试教练(GraphRAG)、SSE 流式对话、Agent 时间线
- **阶段 2** 数据看板:value_score 全量、ECharts 图表、三级地图下钻、可拖拽看板 + 虚拟表
- **阶段 3** AI 工程化:Prompt 配置中心、知识库管理、多模型路由、token 成本看板
- **阶段 4** 打磨:推理过程、知识图谱可视化、Prompt↔对话联动、RAG 透明化、多岗对比、面试评分、韧性与测试

---

## 文档

- 📄 完整技术方案(技术选型 / 架构 / DB schema / 代码骨架 / roadmap):[PLAN.md](./PLAN.md)
- 🖼 全部演示截图:[docs/screenshots/](./docs/screenshots)
