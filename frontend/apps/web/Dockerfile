# 前端镜像 —— 多阶段:pnpm 构建静态产物 → nginx 托管(PLAN §11)
# 构建上下文为仓库根(pnpm workspace 需要根清单与 @gongkao/ui 包)
FROM node:22-slim AS build
RUN corepack enable
# 国内构建加速:corepack 取 pnpm + pnpm 装依赖都走淘宝 npmmirror(npmjs.org 国内超时)
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /repo
RUN echo 'registry=https://registry.npmmirror.com' > .npmrc

# 先复制清单,利用层缓存(仅清单变动才重装依赖)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/apps/web/package.json frontend/apps/web/
COPY frontend/packages frontend/packages
RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

# 复制源码并构建
COPY frontend frontend
RUN pnpm --filter web build

# 运行阶段:nginx 托管 SPA + 反代 /api
FROM nginx:alpine AS serve
COPY frontend/apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/apps/web/dist /usr/share/nginx/html
EXPOSE 80
