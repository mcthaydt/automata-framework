import adapter from '@sveltejs/adapter-static'
import { SITE_ORIGIN } from './src/lib/site.js'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: true,
      strict: true,
    }),
    prerender: {
      origin: SITE_ORIGIN,
      handleHttpError: 'fail',
      // The agents' text files are linked from one another, not from a page, so the crawl names them here.
      entries: ['*', '/llms.txt', '/llms-guides.txt', '/llms-full.txt', '/llms-api.txt'],
    },
  },
}

export default config
