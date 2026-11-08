import { defineJourneys, sizes } from '@automata/playwright-preset'
import { editorPort, gamePort, gameUrl } from './tests/e2e/origins.ts'

// The 3D story's served journey: Schematic edits the guard's files through the editors `automata editor` serves, and the
// game from its dev server plays them. `pnpm test:e2e` here, run by the 3D workflow (.github/workflows/3d.yml), never by the
// 2D gate. A phone and an iPad, one worker: every size edits the same three files and puts them back.

const reuse = process.env.CI === undefined

export default defineJourneys({
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  projects: [
    { name: 'story-3d-phone', testDir: 'tests/e2e', use: { ...sizes.phone, browserName: 'chromium' } },
    { name: 'story-3d-ipad', testDir: 'tests/e2e', use: { ...sizes.ipad, browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: `pnpm exec vite --configLoader runner --strictPort --port ${gamePort}`,
      url: gameUrl,
      reuseExistingServer: reuse,
    },
    {
      // The editors' page, built from the repository, serving this folder and naming the game beside it.
      command: `pnpm --filter @automata/editors build && pnpm exec automata editor . --app suite --app-dir ../../extensions/editors/dist/suite --port ${editorPort} --game-url ${gameUrl}`,
      url: `http://127.0.0.1:${editorPort}/`,
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
  ],
})
