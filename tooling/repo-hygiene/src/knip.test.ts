import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// knip (QB spec §4.1, QB.1) runs in `pnpm check` over the whole workspace. This proves it fails on dead code:
// fixtures/knip is a two-file project whose `unusedHelper` export nothing imports.

const root = fileURLToPath(new URL('../../..', import.meta.url))
const fixture = fileURLToPath(new URL('../fixtures/knip', import.meta.url))

it('fails on an unused export and names it', { timeout: 60_000 }, () => {
  const result = spawnSync(join(root, 'node_modules/.bin/knip'), ['--no-progress', '--directory', fixture], {
    encoding: 'utf8',
  })
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(1)
  expect(result.stdout).toContain('Unused exports')
  expect(result.stdout).toContain('unusedHelper')
})
