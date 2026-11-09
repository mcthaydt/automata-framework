import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const CLI = join(import.meta.dirname, '../../src/cli.ts')
const lines = (count: number, line = 'a { color: red; }'): string => `${Array(count).fill(line).join('\n')}\n`

function root(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'check-style-css-'))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

it('a .css file over 600 lines is a style error', () => {
  const dir = root({ 'styles/big.css': lines(601) })
  const result = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8', cwd: dir })
  expect(result.stdout).toContain('styles/big.css  file-length')
  expect(result.status).toBe(1)
})

it('a comments-only root file over 600 lines is a style error', () => {
  const dir = root({
    'scripts/big.ts': lines(601, 'export const x = 1'),
    'scripts/ok.ts': 'export const y = 2\n',
  })
  const result = spawnSync(process.execPath, [CLI, '--comments-only', dir], { encoding: 'utf8', cwd: dir })
  expect(result.stdout).toContain('scripts/big.ts  file-length')
  expect(result.stdout).not.toContain('ok.ts')
  expect(result.status).toBe(1)
})

it('a .css file of exactly 600 lines passes', () => {
  const dir = root({ 'styles/ok.css': lines(600) })
  const result = spawnSync(process.execPath, [CLI, dir], { encoding: 'utf8', cwd: dir })
  expect(result.status).toBe(0)
})
