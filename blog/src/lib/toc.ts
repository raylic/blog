export interface TocItem {
  level: 2 | 3;
  text: string;
  slug: string;
}

/**
 * 从渲染后的正文 HTML 里抽出 h2 / h3，生成目录。
 * Astro 默认给 heading 加 id（markdown.headingId），这里直接读 id。
 */
export function extractToc(html: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /<h([23])[^>]*?id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = Number(m[1]) as 2 | 3;
    // 去掉内部标签，只留纯文本
    const text = m[3].replace(/<[^>]+>/g, '').trim();
    if (text) {
      items.push({ level, text, slug: m[2] });
    }
  }
  return items;
}
