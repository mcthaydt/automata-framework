import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

// `test:dist` names its test files by path, and the phase that moved tests into `tests/` left it pointing at
// `src/`: vitest found nothing, and release-checks.yml would have failed on the first nightly run.
const ROOT = join(import.meta.dirname, '../..')

it('test:dist names test files that exist', () => {
  const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
  const files = (scripts['test:dist'] ?? '').split(/\s+/).filter((word) => word.endsWith('.test.ts'))
  expect(files.length).toBeGreaterThan(0)
  expect(files.filter((file) => !existsSync(join(ROOT, file)))).toEqual([])
})
