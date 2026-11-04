import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** 文章 URL slug：post.id 带 .md 扩展名，这里统一去掉 */
export function slug(post: Post): string {
  return post.id.replace(/\.md$/, '');
}

/** 按日期倒序（新→旧） */
export function sortDesc(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );
}

/** 置顶优先（pinned 在前），组内再按日期倒序 */
export function sortPinnedFirst(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) =>
      Number(b.data.pinned) - Number(a.data.pinned) ||
      b.data.date.valueOf() - a.data.date.valueOf()
  );
}

/** 置顶文章（按日期倒序） */
export function pinnedPosts(posts: Post[]): Post[] {
  return sortDesc(posts.filter((p) => p.data.pinned));
}

export interface MonthGroup {
  year: number;
  month: number;
  label: string;
  posts: Post[];
}

/** 按「YYYY 年 M 月」分组，组内新→旧 */
export function groupByMonth(posts: Post[]): MonthGroup[] {
  const sorted = sortDesc(posts);
  const groups: MonthGroup[] = [];
  const map = new Map<string, MonthGroup>();
  for (const p of sorted) {
    const d = p.data.date;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${m}`;
    if (!map.has(key)) {
      const g = { year: y, month: m, label: `${y} 年 ${m} 月`, posts: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key)!.posts.push(p);
  }
  return groups;
}

/** 上一篇（比当前早）/ 下一篇（比当前晚），按日期 */
export function prevNext(
  posts: Post[],
  current: Post
): { prev: Post | null; next: Post | null } {
  const sorted = sortDesc(posts);
  const i = sorted.findIndex((p) => p.id === current.id);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: sorted[i + 1] ?? null,   // 更早的
    next: sorted[i - 1] ?? null,   // 更晚的
  };
}

/** 所有出现过的 tag → 文章数 */
export function tagCounts(posts: Post[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** 所有系列（series 字段），保持出现顺序 */
export function seriesList(posts: Post[]): { slug: string; posts: Post[] }[] {
  const map = new Map<string, Post[]>();
  for (const p of sortDesc(posts)) {
    const s = p.data.series;
    if (!s) continue;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(p);
  }
  return [...map.entries()].map(([slug, posts]) => ({ slug, posts }));
}
