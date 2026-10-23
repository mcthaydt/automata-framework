import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

// `automata check` runs `automata-check-boundaries src/sim` in a game folder, with no flags. A game that uses an
// extension must pass that run when the extension declares its sim entries (P5-D2).
const cli = join(import.meta.dirname, 'cli.ts')

function run(importSource: string): { status: number | null; stdout: string } {
  const game = mkdtempSync(join(tmpdir(), 'af-boundaries-cli-'))
  try {
    const installed = join(game, 'node_modules/@x/ext')
    mkdirSync(installed, { recursive: true })
    writeFileSync(
      join(installed, 'package.json'),
      JSON.stringify({ name: '@x/ext', automata: { simEntries: ['./2d'] } }),
    )
    mkdirSync(join(game, 'src/sim'), { recursive: true })
    writeFileSync(join(game, 'src/sim/a.ts'), `import { x } from '${importSource}'\nexport const y = x\n`)
    const result = spawnSync(process.execPath, [cli, 'src/sim'], { cwd: game, encoding: 'utf8' })
    return { status: result.status, stdout: result.stdout }
  } finally {
    rmSync(game, { recursive: true, force: true })
  }
}

it('passes a game sim that imports a declared extension entry, with no flags', () => {
  expect(run('@x/ext/2d')).toMatchObject({ status: 0 })
})

it('fails a game sim that imports an entry the extension did not declare', () => {
  const result = run('@x/ext/3d')
  expect(result.status).toBe(1)
  expect(result.stdout).toContain('@x/ext declares only ./2d for a sim')
})
