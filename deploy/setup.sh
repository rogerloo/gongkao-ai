#!/usr/bin/env bash
# 单机部署一键脚本。在全新 Ubuntu ECS 上、已 clone 仓库后运行:
#   cd deploy
#   cp .env.prod.example .env && vim .env     # 填好域名/密码/JWT/LLM key
#   bash setup.sh
# 起服务后,按 ../DEPLOY.md「4. 导入数据」把岗位/知识图谱灌进去(全新部署的库是空的)。
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] || { echo "✗ 缺 deploy/.env —— 先 cp .env.prod.example .env 并填好再跑"; exit 1; }

# 2G 小内存机器(如阿里云轻量 2 GiB)构建前端(vite/echarts/antd)易 OOM。
# 内存 < 3G 且没 swap → 自动加 4G swapfile 兜底(幂等)。
mem_mb="$(free -m | awk '/^Mem:/{print $2}')"
if [ "${mem_mb:-0}" -lt 3000 ] && [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
  echo "→ 内存 ${mem_mb}M < 3G 且无 swap,创建 4G swapfile(防构建 OOM)..."
  sudo fallocate -l 4G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "→ 安装 Docker(阿里云源;get.docker.com 国内常被重置)..."
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  echo "⚠ 镜像加速请配 /etc/docker/daemon.json(用你阿里云账号专属 mirror),否则拉基础镜像会慢/失败。"
fi

echo "→ 构建并启动(db + FastAPI + 前端 + Caddy)..."
docker compose -f docker-compose.prod.yml up -d --build

echo
echo "✓ 服务已启动。Caddy 正在为你的域名申请 HTTPS 证书(首次约 30~60s)。"
echo "  下一步【必做】初始化数据库 —— 二选一,详见 ../DEPLOY.md「4. 导入数据」:"
echo "    A. 有本地 dump → 恢复(推荐:连同已算好的向量一起带过来,省 embedding 费用)"
echo "    B. 全新灌库   → bootstrap(建表+种子) + ingest(岗位/知识图谱)"
