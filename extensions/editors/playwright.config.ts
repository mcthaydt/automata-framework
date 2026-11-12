import { defineJourneys, sizes } from '@automataframework/playwright-preset'
import { claimPort } from '../../packages/tools/src/shared/ship/ports/free-ports.ts'

// The sample page's journey (`pnpm test:e2e` here): the content editors page as the site's try-it page serves it, with
// no editor server behind it, so it opens the sample game held in memory. A phone and an iPad, Chromium.
const port = claimPort('editors-sample-page')

export default defineJourneys({
  testDir: 'tests/e2e',
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
