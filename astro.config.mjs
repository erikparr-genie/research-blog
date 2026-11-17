import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

// Deployed to GitHub Pages as a project site.
export default defineConfig({
  site: 'https://erikparr-genie.github.io',
  base: '/research-blog',
  trailingSlash: 'always',
  markdown: {
    // The sources are lab notes: keep quotes, dashes and "--flags" exactly as written.
    processor: satteri({ features: { smartPunctuation: false } }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: false,
    },
  },
});
