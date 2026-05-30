# gongkao-ai-copilot · 完整改造方案

> 公考 AI Agent 工作台 — 一个 **B 端中后台风格的全栈 AI 应用**。
>
> 本文档是**可执行蓝图**:5 路技术调研(2026-05 版本全核实)综合而成。技术选型按「能力覆盖 + 可演示性 + 学习成本」权衡,不是纯技术最优。
>
> 用法:按「§12 阶段 Roadmap」逐阶段执行,每阶段结束即一个可演示里程碑。

---

## 0. 一句话定位

**面向公考考生的全栈 AI 应用**:智能选岗 Agent(Function Calling 调真实算法)+ 面试教练(自研 GraphRAG 检索知识图谱)+ B 端数据看板,前端为主轴的中后台架构,后端覆盖全套 AI 工程。

**数据基底**(真实,非 demo):
- 38,648 条贵州/青海公考岗位数据(报录比/进面分/招录数/性价比综合分)
- 一个结构化面试知识图谱(43 stance + 54 concept,带 `[[反向链接]]`)

---

## 1. 能力覆盖一览

| 能力维度 | 实现 |
|---|---|
| TS/JS + React | React 19 + TS 5 全栈 |
| B 端中后台 | 整个应用就是中后台(布局/表格/表单/流程/看板) |
| 组件化/模块化/状态管理/数据流 | pnpm workspace + 三层状态分治 |
| Vite/Rollup 工程化 | Vite 8(Rolldown)+ 构建优化 |
| AI 对话界面 | AI 对话工作台(AI SDK v6 + AI Elements) |
| 任务流转 / Agent 状态展示 | Agent 状态机时间线可视化 |
| Prompt 配置 | Prompt 配置中心(Monaco + 版本 diff + Playground) |
| 数据可视化 / BI 看板 | ECharts 6 看板 + 三级地图下钻 + 可拖拽布局 |
| 权限管理 | 四级 RBAC + JWT 双 token |
| SSE / 流式输出 | SSE 流式 + 中断/续传 |
| 性能/稳定性/异常监控/安全/代码规范 | 见 §10 横切关注点 |
| 组件库/设计系统 | 自建 `packages/ui` 设计 token |
| 可视化搭建 | react-grid-layout 拖拽看板 + React Flow Agent 编排画布 |
| Node/Python 后端能力 | FastAPI 全套后端 |

---

## 2. 环境前置

| 工具 | 状态 | 说明 |
|---|---|---|
| Node | ✅ v24.15(需 ≥22) | React 19 / Vite 8 |
| pnpm | ✅ 11.0.8 | workspace |
| Python | ✅ 3.11.7 | FastAPI |
| **uv** | ⚠️ 待装 | `pip install uv` 或官方脚本;Python 包管理(2026 主流,比 pip 快 10-100x) |
| **Docker** | ⚠️ 待装 | 部署阶段需要(Docker Desktop / 或直接在 VPS 上装) |
| Git | ✅ 2.53 | — |

---

## 3. 最终技术栈锁定(2026-05 版本核实)

### 前端
| 维度 | 选型 | 版本 |
|---|---|---|
| 语言 | TypeScript | 5.x(strict) |
| 框架 | React + React Compiler | 19.2 / Compiler 1.0 |
| 构建 | Vite(Rolldown) | 8.0 |
| 仓库 | pnpm + workspace(`packages/ui` 拆组件库) | pnpm 11 |
| 组件库 | **AntD v6**(B 端骨架)+ **AI Elements**(对话区)+ 自建业务组件层 | AntD 6.x |
| CSS | Tailwind v4(AntD 关 preflight)+ CSS Modules(复杂组件) | 4.x |
| 客户端态 | Zustand | — |
| 服务端态 | TanStack Query | v5 |
| 路由 | React Router(library 模式) | v7 |
| 表单 | React Hook Form + Zod | RHF7 / Zod3 |
| 表格/虚拟化 | TanStack Table + TanStack Virtual | — |
| 拖拽/画布 | dnd-kit + react-grid-layout + React Flow | — |

### AI 交互层
| 维度 | 选型 |
|---|---|
| 流式协议/状态 | `ai@6` + `@ai-sdk/react`(`useChat`) |
| 对话/Agent UI | **AI Elements**(shadcn 拷贝模式:Conversation/Message/Reasoning/Tool/Task/Sources/Branch) |
| Markdown 流式 | **Streamdown** + Shiki(高亮)+ KaTeX(公式)+ remark-gfm |
| 底层证据 | 手搓一个 `fetch ReadableStream` SSE 解析 demo |
| Prompt IDE | Monaco editor + JSON Schema 表单 + 版本 diff + Playground |

### 数据可视化
| 维度 | 选型 |
|---|---|
| 图表 | **ECharts 6.1** + echarts-for-react |
| 看板布局 | react-grid-layout(拖拽/缩放/响应式) |
| 地图 | ECharts `registerMap` 三级下钻(全国→省→市州,DataV.GeoAtlas geojson) |
| 大数据 | 构建期预聚合 + Canvas `large` 模式 + LTTB 采样 + progressive |

### 后端(够用,不过度炫技)
| 维度 | 选型 |
|---|---|
| Web | FastAPI + Uvicorn + **sse-starlette**(流式) |
| 存储 | **Postgres + pgvector**(结构化岗位数据 + 向量,一库) |
| Embedding | **bge-m3 via SiliconFlow API**(免费) |
| RAG | **自研轻量 GraphRAG**(向量召回 + 反向链接图扩展) |
| LLM 编排 | **SDK 直连**(OpenAI 兼容协议),**不套 LangChain/LlamaIndex** |
| Agent | SDK 原生 Function Calling 包性价比算法 |
| 模型 | DeepSeek-V4(主)+ 智谱 GLM(月 100 万 token 免费兜底) |
| 工程化 | 多模型路由(if 分流)+ context cache + token 统计中间件 |
| Python 包管理 | uv |

### 横切 + 部署
| 维度 | 选型 |
|---|---|
| 权限 | 四级 RBAC(路由守卫/动态菜单/按钮级)+ JWT(access 内存 + refresh HttpOnly Cookie) |
| 性能 | 路由懒加载 + manualChunks + TanStack Virtual + React Compiler + Lighthouse 90+ |
| 稳定性 | ErrorBoundary(onUncaughtError)+ TanStack Query 重试 + 骨架屏 + AI 流式中断/续传 |
| 监控 | Sentry(前后端,免费 5000 err/月)+ 自建 sendBeacon 上报兜底 |
| 安全 | markdown XSS(Streamdown harden + DOMPurify)+ LLM key 后端代理 + prompt 注入防御(OWASP LLM Top1) |
| 规范 | ESLint 9 flat + Prettier + husky + lint-staged + commitlint + TS strict |
| 部署 | 前端 Cloudflare Pages + 后端 Docker → 香港/日本 VPS(免备案)+ Caddy 自动 HTTPS + GitHub Actions CI |

---

## 4. 系统架构

```
┌────────────────────────────────────────────────────────┐
│  前端 SPA(React 19 + Vite 8,Cloudflare Pages / VPS)    │
│                                                          │
│  AntD v6 中后台壳(布局/菜单/RBAC)                         │
│  ├─ AI 对话工作台   ← AI Elements + Streamdown + useChat │
│  ├─ 数据看板        ← ECharts 6 + react-grid-layout     │
│  ├─ Prompt 配置中心 ← Monaco + 版本管理                  │
│  ├─ 知识库管理      ← Embedding 状态 + 检索测试          │
│  └─ 权限管理        ← 角色/菜单/按钮                      │
│  状态:Zustand(client)+ TanStack Query(server)+ URL  │
└───────────────────────┬──────────────────────────────────┘
                        │ HTTPS + SSE(流式)
                        ↓
┌────────────────────────────────────────────────────────┐
│  FastAPI 后端(Docker,VPS)                               │
│  ├─ POST /api/chat/agent   选岗 Agent(Function Calling)│
│  ├─ POST /api/chat/coach   面试教练(GraphRAG)           │
│  ├─ GET  /api/chat/stream  SSE 流式输出                  │
│  ├─ /api/jobs/*            岗位查询/筛选/性价比(现有算法) │
│  ├─ /api/prompts/*         Prompt 模板 CRUD + 版本       │
│  ├─ /api/kb/*              知识库 Embedding 管理          │
│  └─ /api/auth/*            JWT 登录/刷新                  │
│  LLM 路由层:简单→DeepSeek-Flash / 复杂→DeepSeek-Pro + cache│
├────────────────────────────────────────────────────────┤
│  Postgres + pgvector                                     │
│  ├─ jobs                  38,648 条岗位(结构化)          │
│  ├─ kb_nodes              知识图谱节点(stance/concept)   │
│  ├─ kb_edges              反向链接邻接表                  │
│  ├─ kb_embeddings         向量(vector 列)               │
│  ├─ prompts / prompt_versions                            │
│  └─ users / roles                                        │
└────────────────────────────────────────────────────────┘
   外部:SiliconFlow(bge-m3 embedding)· DeepSeek/智谱(LLM)
```

---

## 5. Monorepo 目录结构

```
gongkao-ai/
├── PLAN.md                       # 本文档
├── README.md                     # 项目说明
├── docker-compose.yml            # app + postgres
├── .github/workflows/ci.yml      # GitHub Actions
│
├── frontend/                     # pnpm workspace
│   ├── pnpm-workspace.yaml
│   ├── package.json
│   ├── packages/
│   │   └── ui/                   # 自建组件库(设计 token + 业务组件)
│   │       ├── src/
│   │       │   ├── tokens/       # design tokens
│   │       │   ├── chat/         # 对话组件(基于 AI Elements 改造)
│   │       │   └── charts/       # 图表封装(基于 ECharts)
│   │       └── package.json
│   └── apps/
│       └── web/                  # 主应用
│           ├── src/
│           │   ├── app/          # 路由 + 布局壳 + RBAC
│           │   ├── features/
│           │   │   ├── chat/     # AI 对话工作台
│           │   │   ├── dashboard/# 数据看板
│           │   │   ├── prompts/  # Prompt 配置中心
│           │   │   ├── kb/       # 知识库管理
│           │   │   └── auth/     # 登录 + 权限
│           │   ├── shared/       # hooks / lib / api client
│           │   └── stores/       # Zustand
│           ├── vite.config.ts
│           └── package.json
│
├── backend/                      # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/                  # 路由
│   │   │   ├── chat.py           # agent + coach + stream
│   │   │   ├── jobs.py           # 岗位查询(现有算法移植)
│   │   │   ├── prompts.py
│   │   │   ├── kb.py
│   │   │   └── auth.py
│   │   ├── core/
│   │   │   ├── llm.py            # 多模型路由 + SDK 直连
│   │   │   ├── graphrag.py       # 自研 GraphRAG ★
│   │   │   ├── tools.py          # Function Calling tools
│   │   │   └── embedding.py      # bge-m3 via SiliconFlow
│   │   ├── db/                   # SQLAlchemy models + pgvector
│   │   └── middleware/           # token 统计 / 异常 / auth
│   ├── scripts/
│   │   ├── ingest_jobs.py        # 岗位数据入库
│   │   └── ingest_kb.py          # 知识图谱建图 + embedding ★
│   ├── pyproject.toml            # uv
│   └── Dockerfile
│
├── data/                         # 脱敏数据(演示用)
│   ├── jobs.sample.json          # 脱敏岗位数据
│   └── kb/                       # 知识图谱导出(从 wiki)
│
└── docs/                         # 设计文档 / 截图 / 架构图
```

---

## 6. 数据准备

### 6.1 岗位数据(38,648 条)
- 从现有工具 `data.public.json` 导出
- **脱敏**:删除任何考生姓名(原 ETL 已做),只保留岗位维度
- 入库:`scripts/ingest_jobs.py` → Postgres `jobs` 表
- 演示用可抽样 `jobs.sample.json`(全量太大不进 git,走 .gitignore + 部署时拉)

### 6.2 知识图谱(43 stance + 54 concept)
- 从结构化笔记(`stances` / `concepts` 的 `*.md`)导出
- 每个文件:frontmatter(类型/lineage)+ 正文 + `[[反向链接]]`
- `scripts/ingest_kb.py`:
  1. 解析 frontmatter + 正则抽 `[[...]]` → 建邻接表
  2. 每个节点正文 → bge-m3 embedding → 存 `kb_embeddings`
  3. 节点存 `kb_nodes`,链接存 `kb_edges`
- ⚠️ **脱敏**:知识图谱已脱敏(学员姓名→"某学员"),可直接用;作品里用通用化措辞,不强调具体机构品牌

---

## 7. 数据库 Schema(Postgres + pgvector)

```sql
-- 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 岗位(结构化 + 可向量化职位描述)
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  province TEXT, city TEXT, year INT,
  unit TEXT, position TEXT,
  education TEXT, major TEXT,
  apply_ratio NUMERIC,      -- 报录比
  interview_score NUMERIC,  -- 进面分
  headcount INT,            -- 招录数
  value_score NUMERIC,      -- 性价比综合分 0-100
  raw JSONB
);
CREATE INDEX idx_jobs_filter ON jobs(province, city, year, education);

-- 知识图谱节点
CREATE TABLE kb_nodes (
  id TEXT PRIMARY KEY,        -- 文件名 slug
  type TEXT,                  -- stance | concept
  title TEXT,
  body TEXT,
  meta JSONB                  -- frontmatter
);

-- 反向链接邻接表
CREATE TABLE kb_edges (
  src TEXT REFERENCES kb_nodes(id),
  dst TEXT REFERENCES kb_nodes(id),
  rel TEXT,                   -- used_by | related_to | lineage
  PRIMARY KEY (src, dst, rel)
);

-- 向量(bge-m3 = 1024 维)
CREATE TABLE kb_embeddings (
  node_id TEXT PRIMARY KEY REFERENCES kb_nodes(id),
  embedding vector(1024)
);
CREATE INDEX ON kb_embeddings USING hnsw (embedding vector_cosine_ops);

-- Prompt 模板 + 版本
CREATE TABLE prompts (id SERIAL PRIMARY KEY, name TEXT, current_version INT);
CREATE TABLE prompt_versions (
  id SERIAL PRIMARY KEY, prompt_id INT, version INT,
  system_prompt TEXT, variables JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

-- 用户 + 角色
CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE, pwd_hash TEXT, role TEXT);
```

---

## 8. 后端核心实现

### 8.1 自研轻量 GraphRAG（★ 最大亮点,~100 行）

`backend/app/core/graphrag.py`:
```python
async def graph_rag_retrieve(query: str, k: int = 5, hops: int = 1) -> list[Node]:
    # ① 向量召回种子节点
    q_emb = await embed(query)                      # bge-m3
    seeds = await db.fetch(
        "SELECT node_id FROM kb_embeddings "
        "ORDER BY embedding <=> $1 LIMIT $2", q_emb, k)

    # ② 沿反向链接图扩展 1-2 跳
    seed_ids = [s["node_id"] for s in seeds]
    neighbors = await db.fetch(
        "SELECT DISTINCT dst FROM kb_edges WHERE src = ANY($1) "
        "UNION SELECT DISTINCT src FROM kb_edges WHERE dst = ANY($1)",
        seed_ids)

    # ③ 组装上下文:种子(高权重)+ 邻居(补充),按图距离排序
    node_ids = seed_ids + [n["dst"] for n in neighbors]
    nodes = await fetch_nodes(node_ids, weight_by_distance=True)
    return nodes
```
**设计说明**:"向量召回解决'语义相似',图扩展解决'关联完整'—— 答某面试方法论时,自动带出它 `Used By` 的考点和 `related_to` 的概念。比纯向量 RAG 多了知识图谱的关联结构,且因为我的知识库本就是带反向链接的图谱,省掉了微软 GraphRAG 的 LLM 抽取步骤。"

### 8.2 选岗 Agent / Function Calling

`backend/app/core/tools.py`:
```python
TOOLS = [{
  "type": "function",
  "function": {
    "name": "filter_jobs",
    "description": "按条件筛选公考岗位",
    "parameters": {"type": "object", "properties": {
      "province": {"type": "string"}, "education": {"type": "string"},
      "major": {"type": "string"}, "min_value_score": {"type": "number"}
    }}
  }
}, {
  "type": "function",
  "function": {
    "name": "rank_by_value",
    "description": "按性价比综合分排序(报录比+招录数+进面分加权)",
    "parameters": {"type": "object", "properties": {
      "job_ids": {"type": "array", "items": {"type": "integer"}}
    }}
  }
}]

# LLM 返回 tool_calls → 解析 → 调用【现有的】纯 Python 算法 → role:tool 回填 → 二次生成
```
**设计说明**:"LLM 做意图理解,确定性的性价比算法用代码精确计算 —— 这是'LLM 理解 + 代码计算'的正确工程范式,而不是让 LLM 拍脑袋算分。"

### 8.3 多模型路由 + SSE 流式

`backend/app/core/llm.py`:
```python
def route_model(task: str) -> str:
    return "deepseek-chat" if task == "simple" else "deepseek-reasoner"

# SSE 流式(sse-starlette)
from sse_starlette.sse import EventSourceResponse
@router.post("/api/chat/stream")
async def stream(req):
    async def gen():
        async for chunk in llm_stream(req.messages, model=route_model(req.task)):
            yield {"data": chunk}
        yield {"data": "[DONE]"}
    return EventSourceResponse(gen())
```
+ token 统计中间件累计 usage 入库 → 看板展示 Token 用量与成本。

---

## 9. 前端核心实现要点

### 9.1 布局壳 + RBAC（四级）
- `<RequireAuth roles={[...]}>` 路由守卫,无权限 → 403
- 一份 `routes` 配置带 `meta.roles` → 动态生成 AntD 菜单(菜单与路由共用元数据)
- `usePermission('job:export')` hook + `<Can>` 组件按钮级
- JWT:access token 放内存(Zustand),refresh token 放 HttpOnly Cookie,刷新页静默 `/refresh`

### 9.2 AI 对话工作台（★ 核心）
- `useChat`(AI SDK v6)管单会话流式;Zustand 管会话列表/分支树
- AI Elements 组件:`Conversation` / `Message` / `Reasoning` / `Tool` / `Task` / `Sources` / `Branch`
- **Agent 状态可视化时间线**(对标 Claude/Cursor):
```
<AgentTimeline>
 ├ <ReasoningStep>      "正在思考"(流式灰字+shimmer,完成折叠)
 ├ <ToolCallCard state=>  工具调用卡(选岗 Function Calling)
 │    state: input-streaming → input-available → output-available|error
 ├ <RetrievalStep>      "正在检索知识"+ <Sources> 引用(GraphRAG 命中节点,可跳转)
 └ <TaskList>           多步任务清单(status: pending|in_progress|completed)
```
- Markdown:Streamdown(AST 层防流式闪烁 + O(n))+ Shiki + KaTeX
- 稳定性:AbortController 做"停止生成"+ 断线 last-event-id 续传

### 9.3 数据看板（★ 核心）
- ECharts 6 + echarts-for-react,react-grid-layout 可拖拽布局(存 localStorage)
- 8 个图表:
  1. 跨年趋势折线(dataZoom 缩放)
  2. 报录比分布直方图
  3. **性价比 × 进面分 四维散点**(点大小=招录数,颜色=学历,`large` 模式秀大数据)
  4. 省/市州竞争热力图
  5. **省级 choropleth 地图 → 市州下钻**(三级)
  6. TOP10 单位/职位排行(横向条形,点击下钻)
  7. 学历/招录结构玫瑰图
  8. KPI 数字卡组(总岗位/总招录/平均报录比/平均进面分)
- 大数据:构建期预聚合 → 图表只吃几百聚合点;明细表用 TanStack Table + Virtual
- 联动:`echarts.connect` + 顶部 Cascader/RangePicker 受控筛选

### 9.4 Prompt 配置中心
- Monaco editor 高亮 `{{变量}}` → 自动抽变量生成表单
- 版本管理:列表 + side-by-side diff + 一键回滚
- 右侧 Playground:跑当前版本看流式输出,可对比两版本

---

## 10. 横切关注点

| 项 | 做法 |
|---|---|
| **性能** | 路由懒加载(`React.lazy`)+ `manualChunks` 拆 vendor + `rollup-plugin-visualizer` 产物分析 + TanStack Virtual(38k 行虚拟滚动)+ React Compiler 自动 memo + Lighthouse 90+ 截图 |
| **稳定性** | `react-error-boundary` + `createRoot onUncaughtError` 全局兜底 + TanStack Query `retry` 指数退避 + Skeleton 骨架屏 + AI 流式 AbortController 中断/续传 |
| **异常监控** | Sentry(前端 + 后端 SDK,前后端 trace 串联)+ 自建 `sendBeacon` → `/api/log` 兜底 |
| **安全** | Streamdown harden + DOMPurify(markdown XSS)+ `rehype-sanitize` + urlTransform 拦 `javascript:` + **LLM key 只在后端**(前端只调自己后端)+ prompt 注入输入隔离/校验(OWASP LLM Top1)+ CSP 头 |
| **规范** | ESLint 9 flat config + typescript-eslint + Prettier + husky + lint-staged(0 警告才提交)+ commitlint(Conventional Commits)+ TS strict;`tsc --noEmit` 放 CI |

---

## 11. 部署 + CI

```yaml
# docker-compose.yml(单机两容器)
services:
  app:     # FastAPI + 静态前端(或前端单独 Cloudflare Pages)
    build: ./backend
    env_file: .env       # LLM keys 只在这里,不进前端
    depends_on: [db]
  db:
    image: pgvector/pgvector:pg17
    volumes: [pgdata:/var/lib/postgresql/data]
```
- **前端**:Cloudflare Pages(免费、CI 内置)或随后端一起 VPS
- **后端**:Docker → **香港/日本轻量 VPS**(阿里云轻量 ~24元/月 或 Vultr 东京)+ Caddy 自动 HTTPS + 自有域名(三域名之一)→ **免 ICP 备案、国内可访问**
- **CI**:GitHub Actions:push → lint + tsc + test → build → 镜像 → ssh 部署
- ⚠️ 不用 `pages.dev`/`vercel.app` 裸域(国内访问慢/被墙),用自有域名

---

## 12. 阶段 Roadmap（~4-5 周,每阶段 = 可演示里程碑）

### 阶段 0 · 基座 + 部署骨架（3-4 天）
- [ ] pnpm workspace + apps/web + packages/ui
- [ ] React 19 + Vite 8 + TS strict + Tailwind v4 + AntD v6
- [ ] React Router v7 布局壳(侧边栏 + 顶栏 + 路由)
- [ ] RBAC 骨架(登录页 + JWT 双 token + 路由守卫 + 动态菜单)
- [ ] ESLint 9 + Prettier + husky + lint-staged + commitlint
- [ ] FastAPI 骨架 + Postgres(pgvector)+ docker-compose + `/health`
- [ ] **部署公网(空壳上线,自有域名 + HTTPS)**
- ✅ **里程碑**:登录进中后台空壳,公网可访问。

### 阶段 1 · AI 对话工作台（★ 1-1.5 周）
- [ ] 数据入库:`ingest_jobs.py` + `ingest_kb.py`(建图 + embedding)
- [ ] 后端:sse-starlette 流式 + DeepSeek SDK 直连
- [ ] 选岗 Agent:Function Calling 包 `filter_jobs` + `rank_by_value`
- [ ] 面试教练:**自研 GraphRAG**(pgvector 召回 + 反向链接图扩展)
- [ ] 前端:AI Elements 对话 UI + Streamdown + Agent 状态时间线
- [ ] 手搓 SSE demo(懂底层证据)+ AbortController 中断
- ✅ **里程碑**:能对话选岗 + 面试答疑,Agent 步骤可视化。

### 阶段 2 · 数据看板（1 周）
- [ ] 构建期预聚合脚本(38k → 聚合 JSON)
- [ ] ECharts 6:8 个图表
- [ ] react-grid-layout 可拖拽看板
- [ ] 三级地图下钻(全国→省→市州)
- [ ] 筛选联动 + TanStack Table/Virtual 明细
- ✅ **里程碑**:可交互 BI 看板。

### 阶段 3 · Prompt 配置 + 知识库管理 + 多模型（4-5 天）
- [ ] Monaco Prompt IDE + 变量表单 + 版本 diff + Playground
- [ ] 知识库管理(节点列表 + Embedding 状态 + 检索测试)
- [ ] 多模型路由(if 分流)+ context cache + token 统计看板
- ✅ **里程碑**:Prompt 平台 + LLM 成本看板。

### 阶段 4 · 横切打磨 + 组件体系（4-5 天）
- [ ] Sentry 前后端 + 自建上报兜底
- [ ] 性能优化(虚拟化/懒加载/manualChunks)+ Lighthouse 90+
- [ ] 安全(markdown XSS + prompt 注入防御)
- [ ] `packages/ui` 抽出设计 token + 业务组件
- [ ] README 作品说明 + 架构图 + 演示 GIF
- ✅ **里程碑**:生产级完整应用。

---

## 13. 数据来源与合规

- **代码 100% 个人所有**,独立仓库,可开源
- **数据脱敏**:岗位数据源自政府公开信息(已删考生姓名);知识图谱学员姓名已抽象化
- **作品定位**:个人项目,通用化措辞,不强调具体机构品牌(与商业项目隔离)
