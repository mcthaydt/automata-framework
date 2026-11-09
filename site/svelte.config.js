import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { SITE_ORIGIN } from './src/shared/site.js'

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      precompress: true,
      strict: true,
    }),
    // Addresses start at the root: the page for a missing address is served at any depth, and a relative `../_app/` link
    // would look for its stylesheet under the missing address.
    paths: { relative: false },
    prerender: {
      origin: SITE_ORIGIN,
      // The crawler does not serve a static folder's index.html, so the link to the try-it editor (static/editor/app/,
      // copied in by scripts/build-demos.ts) reads as a 404 here; scripts/check-site.ts checks that it resolves.
      handleHttpError: ({ path, message }) => {
        if (path === '/editor/app/') return
        throw new Error(message)
      },
      // The agents' text files are linked from one another, not from a page, so the crawl names them here.
      entries: ['*', '/not-found', '/llms.txt', '/llms-guides.txt', '/llms-full.txt', '/llms-api.txt'],
    },
  },
}

export default config
