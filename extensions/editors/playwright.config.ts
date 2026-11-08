import { defineJourneys, sizes } from '@automata/playwright-preset'
import { browserSafePort } from '../../packages/tools/src/shared/ship/ports/browser-safe-port.ts'
import { portsFor } from '../../packages/tools/src/shared/ship/ports/ports-for.ts'

// The sample page's journey (`pnpm test:e2e:sample` here): the content editors page as the site's try-it page serves it, with
// no editor server behind it, so it opens the sample game held in memory. A phone and an iPad, Chromium.
const port = browserSafePort(portsFor(new URL('../..', import.meta.url).pathname, process.env).preview + 1100)

export default defineJourneys({
  testDir: 'tests/e2e',
  // The served journeys have their own config (playwright.journeys.config.ts) and start their own servers.
  testIgnore: 'journeys/**',
  projects: [
    { name: 'editors-phone', use: { ...sizes.phone, browserName: 'chromium' } },
    { name: 'editors-ipad', use: { ...sizes.ipad, browserName: 'chromium' } },
  ],
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `pnpm exec vite --strictPort --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/suite.html`,
    reuseExistingServer: process.env.CI === undefined,
  },
})
