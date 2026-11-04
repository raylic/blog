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

约定：**后台只在本机，构建在云上**。`npm run admin` 写文章 → `npm run ship` 推仓 → Cloudflare Pages 自动构建并上线。

```bash
npm run ship                    # 本地构建自检 → commit → push
npm run ship -- "写了篇 xx"      # 自定提交信息
```

`scripts/ship.sh` 会先跑一次 `npm run build`：本地构建失败就直接退出，不往云上推（白跑一轮 CI 很费时间）。

### Pages 项目的四个参数（一次配好，之后不用动）

| 字段 | 值 |
| --- | --- |
| Root directory | `blog` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | `NODE_VERSION` = `22`（仓里也有 `blog/.nvmrc`，事两边一致）|

`dist/` 已进 `.gitignore`，产物只存在于云上；`blog/public/uploads/` 是后台贴的图，属于内容，**必须提交**（`.gitignore` 里写了注释防误删）。

### 一次性接入（需要账号，得你亲手做）

1. 把仓推到 GitHub（现在仓里还没 `git init`，见下）：
   ```bash
   cd /Users/wu/code/homepage
   git init -b main && git add -A && git commit -m "init"
   git remote add origin git@github.com:<你>/<repo>.git && git push -u origin main
   ```
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → 选那个仓
3. 按上表填四个参数，**Deploy**（首次构建会跑完整 `npm i` + build）
4. 项目 → **Custom domains** → 绑定 `raylic.work`
5. 域名在阿里云注册但无解析记录：Pages 会给出 CNAME 引导（`raylic.work` → `<项目>.pages.dev`），在阿里云加 DNS 记录后自动签发证书；Cloudflare 侧的域名激活需要先在 Cloudflare 加站点（走一遍引导即可）

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
