import rss from '@astrojs/rss';
import { SITE, allPosts, url, TYPE_LABEL } from '../site';

export async function GET(context) {
  const posts = await allPosts();
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: new URL(url(''), context.site).href,
    items: posts.map((p) => ({
      title: p.title,
      pubDate: p.date,
      description: p.summary,
      link: new URL(url(p.path), context.site).href,
      categories: [TYPE_LABEL[p.type], ...p.tags],
    })),
  });
}
