import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The phone layouts of the suite and of each 1.0 editor (plan EDS.10 step 1, editor suite spec §10, §12): a real-browser
// layout test must exist for the shell with no editor and for each editor open in it, and each must run at every one of the
// kit's eight sizes (`describe.each(SIZES)`), in the three engines the `layout` project names. This is the gap guard: a new
// 1.0 editor with no layout file, or a file that stops using the full size list, fails here, not in review.

const SRC = join(import.meta.dirname, '..')
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8')

const LAYOUT_FILES: Record<string, string> = {
  'the shell with no editor': 'shell/suite.layout.test.ts',
  'the edit flow': 'shell/suite-edit.layout.test.ts',
  'Ship and Review': 'shell/suite-ship.layout.test.ts',
  Tuner: 'editors/tuner/ui/tuner.layout.test.ts',
  Studio: 'editors/studio/ui/studio.layout.test.ts',
  'Levels 2D and Levels 3D': 'shell/suite-levels.layout.test.ts',
}

describe('layout coverage', () => {
  it.each(Object.entries(LAYOUT_FILES))('%s has a layout test at every size', (_name, file) => {
    expect(read(file)).toMatch(/describe\.each\(SIZES\)/)
  })

  it('runs the layout project in Chromium, WebKit and Firefox', () => {
    const config = readFileSync(join(SRC, '../vitest.config.ts'), 'utf8')
    expect(config).toMatch(
      /instances: \[\{ browser: 'chromium' \}, \{ browser: 'webkit' \}, \{ browser: 'firefox' \}\]/,
    )
  })

  it('has a tab for every editor the 1.0 launch ships', () => {
    const main = read('main.ts')
    for (const id of ['createTuner', 'createStudio', 'createLevels2d', 'createLevels3d'])
      expect(main, `${id} is registered`).toContain(id)
  })
})
