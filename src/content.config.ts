import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const media = z.array(
  z.object({
    src: z.string(),
    kind: z.enum(['video', 'image']),
    caption: z.string(),
    poster: z.string().optional(),
  }),
);

const base = {
  title: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  run: z.string().optional(),
  summary: z.string().default(''),
  media: media.default([]),
};

export const collections = {
  briefs: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/briefs' }),
    schema: z.object({ ...base, related: z.array(z.string()).default([]) }),
  }),
  experiments: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/experiments' }),
    schema: z.object({ ...base, method: z.string().optional() }),
  }),
};
