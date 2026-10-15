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
    },
  },
}

export default config
