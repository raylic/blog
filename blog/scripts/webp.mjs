#!/usr/bin/env node
// public/uploads/ 里的 png/jpg → WebP（quality 80），改写文章引用，再删原图。
//
// 规则：
// - 引用匹配「裸文件名」和「URL 编码」两种形态（markdown 里 ![](/uploads/.../x.png)
//   常见的是编码形态，只换扩展名，编码其余部分不动）
// - 只有转换成功、且仓库文本里确实引用到该图，才删原图；
//   没有引用的孤儿文件只警告、不删（避免误伤没走 markdown 引用的图）
// - 幂等：.webp 已存在则跳过转换；重复跑不会重复改
//
// 已挂进 npm run build（发布前自动跑），也可单独：npm run webp
import { readdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UPLOADS = join(ROOT, 'public', 'uploads');
const SRC = join(ROOT, 'src');
const QUALITY = 80;
const TO_WEBP = new Set(['.png', '.jpg', '.jpeg']);

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const ext = (p) => p.slice(p.lastIndexOf('.')).toLowerCase();

const srcFiles = (await walk(UPLOADS)).filter((p) => TO_WEBP.has(ext(p)));
const textFiles = (await walk(SRC)).filter((p) =>
  /\.(md|mdx|astro|html|css|ts|js|mjs|json)$/.test(p),
);

// 文本文件读一次缓存，最后统一写回
const contents = new Map();
for (const p of textFiles) contents.set(p, await readFile(p, 'utf8'));
const allText = () => [...contents.values()].join('\n');

// 某张图在文本里的引用形态：uploads/<目录名>/<文件名>（裸 + URL 编码）
function refVariants(p) {
  const dirName = basename(dirname(p));
  const base = basename(p);
  return [`uploads/${dirName}/${base}`, `uploads/${dirName}/${encodeURIComponent(base)}`];
}

let converted = 0;
let removed = 0;
const touched = new Set();

for (const p of srcFiles) {
  const rel = p.slice(ROOT.length + 1);
  const variants = refVariants(p);
  const isReferenced = variants.some((v) => allText().includes(v));

  // 1) 转换（已有 .webp 则跳过）
  const dest = p.slice(0, -ext(p).length) + '.webp';
  let destExists = true;
  try {
    await access(dest);
  } catch {
    destExists = false;
  }
  if (!destExists) {
    await sharp(p).webp({ quality: QUALITY }).toFile(dest);
    converted++;
    console.log(`  转换 ${rel} -> ${basename(dest)}`);
  }

  // 2) 没被引用的孤儿文件：不删原图，只提醒
  if (!isReferenced) {
    console.log(`!! 未被 src 引用，保留原图未动：${rel}`);
    continue;
  }

  // 3) 改写引用（只换扩展名）
  for (const [file, text] of contents) {
    let next = text;
    for (const v of variants) {
      next = next.split(v).join(v.slice(0, v.lastIndexOf('.')) + '.webp');
    }
    if (next !== text) {
      contents.set(file, next);
      touched.add(file);
    }
  }

  // 4) 删原图
  await rm(p);
  removed++;
  console.log(`  删除 ${rel}`);
}

for (const file of touched) await writeFile(file, contents.get(file));

console.log(
  srcFiles.length === 0
    ? 'webp: uploads 里没有需要转的 png/jpg'
    : `webp: 转 ${converted} 张，删原图 ${removed} 张，更新引用 ${touched.size} 个文件 (quality ${QUALITY})`,
);
