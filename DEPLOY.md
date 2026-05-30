# 部署手册 —— 单机 ECS/VPS + Caddy 自动 HTTPS

把「公考 AI Agent 工作台」部署到一台云服务器,用自有域名 + HTTPS 对外。
配置文件都在 [`deploy/`](./deploy)。LLM key 仅在后端 `.env`,绝不进前端、绝不入库。

## 1. 拓扑

```
公网 ──HTTPS──> Caddy(:443 自动签证书)
                  └─ reverse_proxy ─> web(nginx)
                                       ├─ /         静态 SPA(React 构建产物)
                                       └─ /api/*  ─> app(FastAPI :8000)
                                                       └─> db(Postgres + pgvector)
```

一台机器、一个域名、同源:前端和 `/api` 同域,无跨域问题。只有 Caddy 对公网开 80/443,db/app/web 都只在内网。

## 2. 前置准备

- **一台云服务器**:Ubuntu 22.04。阿里云 **ECS 或轻量应用服务器**都行。**2 GiB 内存可用** —— 运行只占 ~0.5G,但构建前端较吃内存,`setup.sh` 会在 <3G 且无 swap 时**自动加 4G swap** 兜底(或本地构建好镜像再传)。40 GiB 盘足够。
- **开端口**:放行 `22`(SSH)、`80`、`443`。**轻量应用服务器**在控制台左侧「**防火墙**」加规则(不是 ECS 的安全组);两者都另需在系统层(本配置用 Docker,无需额外 iptables)。
- **域名**:加一条 **A 记录**指向服务器公网 IP(建议用你已备案域名的子域,如 `app.gongye-edu.cn`)。
- **备案(国内服务器必读)**:国内 ECS 必须用**已备案**域名才能正常对外。子域一般沿用主域备案、无需新备;但若该域名当初不是在阿里云做的接入备案,可能要做一次「接入备案」。拿不准 → 先用平台 IP 自测,或改用海外 VPS(免备案,但国内访问慢)。

## 3. 部署步骤

```bash
# —— 在服务器上 ——
# 1) 装 git 并拉代码(代码已推到 GitHub 的 main 分支 —— 见 README/本文末「发布到 GitHub」)
sudo apt-get update && sudo apt-get install -y git
git clone <你的 GitHub 仓库地址> gongkao-ai
cd gongkao-ai

# 2) 配置环境变量
cd deploy
cp .env.prod.example .env
vim .env        # 填:DOMAIN、POSTGRES_PASSWORD、DATABASE_URL(同一密码)、
                #     JWT_SECRET(openssl rand -hex 32)、CORS_ORIGINS、DEEPSEEK_API_KEY 等

# 3) 一键起服务(装 Docker + 构建 + 启动)
bash setup.sh
```

`setup.sh` 跑完,4 个容器(db / app / web / caddy)起来,Caddy 自动为 `DOMAIN` 申请证书(首次 30~60s)。**此时库还是空的 —— 继续第 4 节灌数据。**

## 4. 导入数据(必做,二选一)

应用启动**不会**自动建表(`lifespan` 是空的),需手动初始化。岗位/知识图谱的**源数据在你本地**(`data.public.json` + obsidian wiki),不在仓库里,所以:

### 路径 A —— 从本地库 dump 恢复(✅ 推荐)

你本地已经灌好了库(3.8 万岗位 + 知识图谱 + **已算好的向量**)。直接整库搬过去,省得在服务器上重算 embedding(省 SiliconFlow 费用 + 不需要 key)。

```bash
# (1) 本地:导出(dev 的 db 容器正跑着 docker compose up -d db)
docker compose exec -T db pg_dump -U gongkao -Fc gongkao > gongkao.dump

# (2) 本地:传到服务器
scp gongkao.dump root@<服务器IP>:~/

# (3) 服务器:在 deploy/ 目录,载入 .env 变量后恢复
cd ~/gongkao-ai/deploy && set -a && source .env && set +a
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker compose -f docker-compose.prod.yml cp ~/gongkao.dump db:/tmp/gongkao.dump
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists /tmp/gongkao.dump
```

> 登录用的种子用户(admin/editor/user)在本地 `bootstrap` 时已建,会随 dump 一起带过来,直接用本地那套账号登录。

### 路径 B —— 全新灌库(没有本地库时)

```bash
cd ~/gongkao-ai/deploy
# 建表 + 种子用户 + 种子 Prompt
docker compose -f docker-compose.prod.yml exec -T app python -m app.scripts.bootstrap
# 灌岗位:先把源 JSON 传上来再喂给容器
#   本地: scp data.public.json root@<服务器IP>:~/
docker compose -f docker-compose.prod.yml cp ~/data.public.json app:/tmp/data.public.json
docker compose -f docker-compose.prod.yml exec -T app python -m app.scripts.ingest_jobs /tmp/data.public.json
# 灌知识图谱(需 SILICONFLOW_API_KEY,会实时调 embedding):把 wiki 的 md 目录传上来再 ingest_kb
```

## 5. 验证

```bash
# 容器健康
docker compose -f docker-compose.prod.yml ps
# 后端探活(容器内)
docker compose -f docker-compose.prod.yml exec -T app python -c "import urllib.request;print(urllib.request.urlopen('http://localhost:8000/health').read())"
```

浏览器打开 `https://你的域名`:证书是绿锁、能登录、选岗/对话/看板都通,即成功。**部署完把这个链接回填到 [README.md](./README.md) 的「在线演示」。**

## 6. 更新与运维

```bash
cd ~/gongkao-ai && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build   # 滚动重建
docker compose -f docker-compose.prod.yml logs -f app                  # 看后端日志
# 备份数据库(定期)
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > backup-$(date +%F).dump
```

## 7. 常见坑

| 现象                 | 原因 / 解法                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 证书签不下来         | 域名 A 记录没生效 / 安全组没放行 80(LE HTTP-01 校验走 80)。`docker compose logs caddy` 看详情。别频繁重建删 `caddy_data`,会触发 LE 限流。 |
| 登录后接口 401/CORS  | `.env` 的 `CORS_ORIGINS` 没填成你的真实域名;或 `JWT_SECRET` 改了导致旧 token 失效(正常,重登即可)。                                        |
| 后端起不来连不上库   | `DATABASE_URL` 里的密码和 `POSTGRES_PASSWORD` 不一致;host 必须是 `db`(compose 服务名)。                                                   |
| 对话不流式、整段才出 | 反代缓冲没关。本配置 Caddy `flush_interval -1` + nginx `proxy_buffering off` 已处理;若自己改过反代注意保留。                              |
| 内存不够             | 路径 A(dump 恢复)不需要在服务器跑 embedding,2G 够;路径 B 的 `ingest_kb` 调 embedding,建议 ≥4G 或本地灌好再 dump。                         |

---

> 想零运维 / 免备案?也可前端上 Cloudflare Pages、后端上 Render/Fly + Neon(Postgres 自带 pgvector),前端构建期设 `VITE_API_BASE` 指向后端域名、后端 `CORS_ORIGINS` 放行前端域名即可。代价是国内访问偏慢。

## 附:发布代码到 GitHub(服务器拉代码的前置)

本地仓库默认没有远程,服务器没法 clone。先推一份到 GitHub:

```bash
# 在本地仓库根目录
# 1) 在 github.com 新建空仓库(不要勾 README/.gitignore,免冲突),拿到地址
# 2) 关联远程并把当前分支推成 main(GitHub 默认分支 = main,链接干净)
git remote add origin https://github.com/<你的用户名>/gongkao-ai.git
git push -u origin HEAD:main
```

> 安全:LLM key 等只在 `.env`(已 gitignore,从未入库),仓库里没有任何密钥,可放心公开。不放心就建私有仓库,服务器 clone 时用 PAT/部署密钥即可。
