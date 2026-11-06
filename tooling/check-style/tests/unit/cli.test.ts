import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const CLI = join(import.meta.dirname, '../../src/cli.ts')
const run = (dir: string) => spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8', cwd: dir })

function src(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-style-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

it('fails on a planted {@html} in a Svelte file, naming the file and rule', () => {
  const result = run(
    src({ 'status/Panel.svelte': '<p>{@html text}</p>\n', 'math.ts': 'export const x = 1\n' }),
  )
  expect(result.stdout).toContain('status/Panel.svelte:1  no-html')
  expect(result.stdout).toContain('check-style: 2 files, 1 findings')
  expect(result.status).toBe(1)
})

it('passes clean Svelte files and skips *.test.svelte and testing/ folders', () => {
  const result = run(
    src({
      'layout/Frame.svelte': '<div>{title}</div>\n',
      'layout/Frame.test.svelte': '<p>{@html text}</p>\n',
      'testing/Fixture.svelte': '<p>{@html text}</p>\n',
    }),
  )
  expect(result.stdout).toContain('check-style: 1 files, 0 findings')
  expect(result.status).toBe(0)
})

it('skips a tests/ folder, whatever its files are called (tests are exempt by folder)', () => {
  const result = run(
    src({
      'layout/Frame.svelte': '<div>{title}</div>\n',
      'tests/unit/Weird_Name.ts': 'export const x = 1\n',
      'tests/fixtures/Planted.svelte': '<p>{@html text}</p>\n',
    }),
  )
  expect(result.stdout).toContain('check-style: 1 files, 0 findings')
  expect(result.status).toBe(0)
})

it('applies the game-root rules to roots after --role-layout, and role-split', () => {
  const pkg = src({
    'components.ts': "import { defineComponent } from 'x'\nexport const A = defineComponent('a', {})\n",
  })
  const game = src({
    'components.ts': "import { defineComponent } from 'x'\nexport const A = defineComponent('a', {})\n",
    'systems.ts': "import { defineSystem } from 'x'\nexport const s = defineSystem({ name: 's' })\n",
    'systems/goal.ts': "import { defineSystem } from 'x'\nexport const g = defineSystem({ name: 'g' })\n",
  })
  const result = spawnSync(process.execPath, [CLI, pkg, '--role-layout', game], {
    encoding: 'utf8',
    cwd: game,
  })
  expect(result.stdout).toContain('role-suffix')
  expect(result.stdout).toContain('systems.ts  role-split')
  expect(result.stdout).toContain('check-style: 4 files, 2 findings')
  expect(result.status).toBe(1)
})

it('passes a clean game root', () => {
  const game = src({
    'components.ts': "import { defineComponent } from 'x'\nexport const A = defineComponent('a', {})\n",
    'main.ts': "import { defineGame } from 'x'\nexport const game = defineGame({})\n",
  })
  const result = spawnSync(process.execPath, [CLI, '--role-layout', game], { encoding: 'utf8', cwd: game })
  expect(result.stdout).toContain('check-style: 2 files, 0 findings')
  expect(result.status).toBe(0)
})

const runWith = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: dir })

it('reads only the comments under --comments-only: a config file is not named by role, a CSS comment is read', () => {
  const dir = src({
    'tool/vitest.config.ts': '// Chosen in M5-D6\nexport default {}\n',
    'tool/page.css': '/* task 6.4 cut this */\n',
    'tool/node_modules/dep/index.ts': '// M5-D6\n',
  })
  const result = runWith(dir, '--plan-comments', '--comments-only', dir)
  expect(result.stdout).toContain('tool/vitest.config.ts:1  plan-comment')
  expect(result.stdout).toContain('tool/page.css:1  plan-comment')
  expect(result.stdout).not.toContain('file-name')
  expect(result.stdout).not.toContain('node_modules')
  expect(result.status).toBe(1)
})
