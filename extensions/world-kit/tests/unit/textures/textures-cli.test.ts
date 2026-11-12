// The command as a reader runs it: a real `node` with type stripping, not Vitest's transform. Vitest compiles TypeScript
// that plain Node refuses (a parameter property, an extensionless import), so `runTextures`'s own tests cannot see a CLI
// that dies while loading. `--out` with no folder is the cheapest path that loads the whole module graph.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const kit = fileURLToPath(new URL('../../../', import.meta.url))
const loader = fileURLToPath(
  new URL('../../../../../packages/3d/scripts/extensionless-ts.ts', import.meta.url),
)

describe('the textures command under plain Node', () => {
  it('loads, and refuses `--out` without a folder in words', () => {
    const run = spawnSync(process.execPath, ['--import', loader, 'src/app/textures-cli.ts', '--out'], {
      cwd: kit,
      encoding: 'utf8',
    })
    expect(run.stderr).toBe('--out needs a folder: --out library/tiles\n')
    expect(run.status).toBe(2)
  })
})
