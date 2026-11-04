import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import { keystaticI18n } from './dev/keystatic-i18n.mjs';

// 后台（/keystatic）只在 dev 里挂载：local 模式写本地文件，
// 生产构建是纯静态站，不需要也不想带这套 React 运行时。
const isDev = process.argv.includes('dev');

// https://astro.build/config
export default defineConfig({
  site: 'https://raylic.work',
  output: 'static',
  integrations: isDev ? [react(), keystatic()] : [],
  // keystatic 后台中文化（dev-only，构建产物里不带），见 dev/keystatic-i18n.mjs
  vite: { plugins: isDev ? [keystaticI18n()] : [] },
  markdown: {
    shikiConfig: {
      theme: 'min-dark',
      wrap: true,
    },
  },
});
