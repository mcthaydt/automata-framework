import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const CLI = join(import.meta.dirname, 'cli.ts')
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
