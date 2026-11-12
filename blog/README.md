# raylic.work

Astro 5 + pagefind 的静态博客。构建产物是纯 HTML，没有服务端运行时。

## 写文章（网页后台）

```bash
npm run admin        # 起 dev 服务器并直接打开 http://localhost:4321/keystatic
```

- 后台是 **Keystatic 的 local 模式**：保存时直接写 `src/content/posts/*.md`，不经过 GitHub、不需要登录。
- 保存只改本地文件，**不等于发布**：要跑 `npm run ship`（见「发布」）。
- **只在 dev 里存在**：`astro.config.mjs` 里是 `integrations: isDev ? [react(), keystatic()] : []`，`npm run build` 的产物里没有 `/keystatic`，也不含那套 React 运行时。
- 字段：标题 / 文件名（= URL，中文标题要手输拼音）/ 摘要 / 日期 / 标签 / 系列 / 置顶★ / 草稿。
- 正文里贴的图会落到 `public/uploads/`，正文写成 `![](/uploads/xxx.png)`。这些图要提交进 git。
- 已知副作用：在后台保存会把 frontmatter 重写成 Keystatic 的规范格式（`tags: [a, b]` → 块状列表，列表符号 `-` → `*`，并补全 `pinned`/`draft`），markdown 语义不变。

## 手动写（不打开后台）

新建 `src/content/posts/<slug>.md`：

```yaml
---
title: 标题
description: 一句话摘要
date: 2026-10-20
tags: [Astro, 工程]
series: 建站        # 可选
pinned: false
draft: false
---
```

`date` 决定月份分组、排序和上一篇/下一篇；`draft: true` 的文件全站不出现。

## 预览 / 构建

```bash
npm run dev          # http://localhost:4321 ，热更新；dev 下搜索不可用
npm run build        # astro build + pagefind 索引 → dist/
npm run preview      # 预览构建产物（搜索可用）
```

搜索的索引是 pagefind 在 build 时扫 `dist/` 生成的，所以 **dev 下搜索框只会显示「构建后可用」**。

## 发布（Cloudflare Pages，push 即发布）

对应项目：**`blog-git`**（Workers & Pages 列表里那个），自定义域 `blog.raylic.work`。

约定：**后台只在本机，构建在云上**。`npm run admin` 写文章 → `npm run ship` 推仓 → Cloudflare Pages 自动构建并上线。

> **建项目时必须选 Connect to Git，不能用 Direct Upload。**
> Direct Upload 项目根本不响应 `git push`（它只能靠 `wrangler pages deploy` 手动传 `dist`），而且 Cloudflare 不支持事后把它改成 Git 集成，只能新建项目。旧的 `blog` 项目就是 Direct Upload，已由 `blog-git` 取代，留作历史备份。

```bash
npm run ship                    # 本地构建自检 → commit → push
npm run ship -- "写了篇 xx"      # 自定提交信息
```

`scripts/ship.sh` 会先跑一次 `npm run build`：本地构建失败就直接退出，不往云上推（白跑一轮 CI 很费时间）。

### Pages 项目的构建参数（已配好，改之前想清楚）

| 字段 | 值 |
| --- | --- |
| Project name | `blog-git` |
| Git repository | `raylic/blog`，Production branch `main` |
| Root directory | `blog` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | `NODE_VERSION` = `22`（仓里也有 `blog/.nvmrc`，让两边一致）|

`dist/` 已进 `.gitignore`，产物只存在于云上；`blog/public/uploads/` 是后台贴的图，属于内容，**必须提交**（`.gitignore` 里写了注释防误删）。

### 接入记录（已完成，留作排障依据）

当初的坑，一次性写清楚：

1. **第一次就把项目建成了 Direct Upload**，于是 `git push` 从来没有触发过任何构建；本地 `npm run ship` 一直打印「正在自动构建」，其实线上根本没变。这个状态只能靠新建项目脱困。
2. 新建 Git 集成项目（`blog-git`）时，GitHub App 的授权需要浏览器里走一遍；授权之后建项目、配参数、首次部署都可以走 API。
3. **域名一次只能挂在单个 Pages 项目上**，所以要按这个顺序迁移：新项目先构建成功并在 `<项目>.pages.dev` 上验过 → 旧项目移除自定义域 → 新项目添加自定义域。
4. 从旧项目移除自定义域时，Cloudflare 会**连带删掉那条 CNAME**；从 Dashboard/API 往新项目加域名时不会自动重建，得手动补一条 `blog.raylic.work → blog-git-64l.pages.dev`（proxied）。缺这条会停在 `pending / CNAME record not set`，站点直接 522。

> 搜索（pagefind）的索引在 `npm run build` 里生成，所以走这条链路每次发布都自动重建，不需要额外接 CI。

### 还没定的事

- 仓里根目录那几个旧页面（`index.html` / `works.html` / `palette.html` / `df.html` / `data/`）在 `blog` 以外，**Pages 不会发布它们**（Root directory 是 `blog`）。要一并上线的话得单独接（ Workers 静态资产 / 另一个 Pages 项目），要废弃就从仓里剔掉。
- 后台无鉴权，**不会**被发布上线（`astro.config.mjs` 里 `isDev` 控制），所以不需要登录体系。

## 结构

```
src/
  content/posts/     文章 markdown
  layouts/           Base（页面骨架/页脚）、List（列表页）、Post（文章页）
  components/        Header / SearchBox / Nav / PostCard
  pages/             index、archive、about、posts/[slug]、tags/、series/
  styles/global.css  所有设计数值都是这里的 CSS 变量
  lib/               posts.ts（分组/排序/上下篇）、toc.ts（目录）
keystatic.config.ts  本机后台的字段定义
```
