#!/usr/bin/env bash
# 本机写完文章 → 一条命令发布：本地构建自检 → commit → push → Cloudflare Pages 自动构建
#
#   npm run ship                    # 提交信息自动生成
#   npm run ship -- "写了篇 xx"      # 自定义提交信息
#
# 前提：Cloudflare 上是「Git 集成」项目（当前为 blog-git，源 = raylic/blog 的 main）。
#       Direct Upload 项目不会响应 push，且无法事后改成 Git 集成，只能新建项目。
#       项目里看不到自动构建时，先查 README「发布」一节的排障条目。
set -euo pipefail

BLOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$BLOG_DIR/.." && pwd)"
cd "$BLOG_DIR"

# 1. 本地先构建一次：构建挂了就不要推上去，省得云上白跑一轮
echo "==> 本地构建（自检）"
npm run build

cd "$REPO_ROOT"

if [ ! -d .git ]; then
  echo "!! 这里还不是 git 仓库，先跑 git init 并接上远端" >&2
  exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
  echo "==> 没有改动，无需发布"
  exit 0
fi

MSG="${1:-写作更新 $(date '+%F %H:%M')}"
echo "==> 提交：$MSG"
git add -A
git commit -m "$MSG"
git push

echo "==> 已推送，Cloudflare Pages 正在自动构建（Dashboard → Workers & Pages → blog-git → Deployments）"
echo "    通常 1~2 分钟出结果；没动静先查项目 Settings → Build 里的 Git 集成是否还在"
