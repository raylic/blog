import { config, fields, collection } from '@keystatic/core';

// 本机后台：local 模式，保存时直接写 src/content/posts/*.md
// 只在 dev 里挂载（见 astro.config.mjs），生产构建不包含 /keystatic 路由
export default config({
  storage: { kind: 'local' },
  ui: {
    brand: { name: 'raylic.work' },
  },
  collections: {
    posts: collection({
      label: '文章',
      slugField: 'title',
      path: 'src/content/posts/*',
      entryLayout: 'content',
      format: { contentField: 'content' },
      columns: ['title', 'date'],
      schema: {
        title: fields.slug({
          name: { label: '标题' },
          slug: { label: '文件名（= URL）', description: '中文标题不会自动生成，需要手输，例如 jing-tai-zhan' },
        }),
        description: fields.text({
          label: '摘要',
          multiline: true,
          description: '列表里标题下面那行灰字，可留空',
        }),
        date: fields.date({
          label: '日期',
          defaultValue: { kind: 'today' },
          validation: { isRequired: true },
        }),
        tags: fields.array(fields.text({ label: '标签名' }), {
          label: '标签',
          itemLabel: (props) => props.value || '标签',
        }),
        series: fields.text({ label: '系列', description: '可选，填了会进 /series/<系列>/' }),
        pinned: fields.checkbox({ label: '置顶（标题后加 ★）' }),
        draft: fields.checkbox({ label: '草稿（不发布）' }),
        content: fields.mdx({
          label: '正文',
          extension: 'md',
          options: {
            // 编辑器里贴的图会落到 public/uploads/，正文里写成 /uploads/xxx.png
            image: { directory: 'public/uploads', publicPath: '/uploads' },
          },
        }),
      },
    }),
  },
});
