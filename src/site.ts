import { getCollection } from 'astro:content';

export const SITE = {
  title: 'AI Video Research Notes',
  author: 'Erik Parr',
  description:
    'An ongoing, partly agent-run research log on blockout-driven AI video (Unity blockout to ComfyUI video models) and agent-directed shot production.',
  about:
    'An ongoing, partly agent-run research log on blockout-driven AI video (Unity blockout → ComfyUI video models) and agent-directed shot production. Briefs are written by a scheduled research agent and lightly edited for publication.',
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
/** Site-absolute URL for a path like "briefs/2026-11-17/" or "media/x.mp4". */
export const url = (p = '') => `${BASE}/${p.replace(/^\//, '')}`;

export type PostType = 'brief' | 'experiment';
export const TYPE_LABEL: Record<PostType, string> = { brief: 'Run brief', experiment: 'Experiment' };

export interface Post {
  type: PostType;
  slug: string;
  path: string;
  title: string;
  date: Date;
  tags: string[];
  summary: string;
  mediaCount: number;
}

export async function allPosts(): Promise<Post[]> {
  const briefs = (await getCollection('briefs')).map((e) => ({ e, type: 'brief' as const, dir: 'briefs' }));
  const exps = (await getCollection('experiments')).map((e) => ({ e, type: 'experiment' as const, dir: 'experiments' }));
  return [...briefs, ...exps]
    .map(({ e, type, dir }) => ({
      type,
      slug: e.id,
      path: `${dir}/${e.id}/`,
      title: e.data.title,
      date: e.data.date,
      tags: e.data.tags,
      summary: e.data.summary,
      mediaCount: e.data.media.length,
    }))
    .sort(
      (a, b) =>
        b.date.getTime() - a.date.getTime() ||
        (a.type === b.type ? b.slug.localeCompare(a.slug) : a.type === 'brief' ? -1 : 1),
    );
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
