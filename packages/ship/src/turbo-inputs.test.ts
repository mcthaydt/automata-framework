import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const shipDir = join(root, 'packages/ship')

// workflows.test.ts reads files outside this package (the workflows, every workspace package.json, the root
// scripts). Turbo only hashes a package's own files by default, so a change to one of those replayed a cached
// pass instead of running the test (audit of #10: a new examples/*/package.json hid a real failure). Ask turbo
// itself which files it hashes, so the check follows turbo's own glob rules.
function hashedFiles(task: string): string[] {
  const dry = execFileSync(
    'pnpm',
    ['exec', 'turbo', 'run', task, '--filter=@mcthaydt/automata-ship', '--dry=json'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  const tasks = JSON.parse(dry).tasks as { taskId: string; inputs: Record<string, string> }[]
  const ship = tasks.find((entry) => entry.taskId === `@mcthaydt/automata-ship#${task}`)
  if (ship === undefined) throw new Error(`turbo planned no ${task} for ship`)
  // Turbo keys inputs relative to the package; compare them relative to the repo root.
  return Object.keys(ship.inputs).map((file) => relative(root, resolve(shipDir, file)))
}

describe.each(['test:unit', 'test'])("turbo's cache key for ship's %s", (task) => {
  it('covers the repository files the workflow tests read', { timeout: 30_000 }, () => {
    const files = hashedFiles(task)
    expect(files).toEqual(
      expect.arrayContaining([
        'packages/ship/src/workflows.test.ts',
        '.github/workflows/ci.yml',
        'package.json',
        'pnpm-workspace.yaml',
        'playwright.config.ts',
        'packages/sim/package.json',
        'packages/sim/vitest.config.ts',
        'games/placeholder/package.json',
        'games/emberwick/package.json',
        'games/emberwick/vitest.config.ts',
        'examples/ui/primitives/package.json',
        'games/placeholder/e2e/boot.e2e.ts',
      ]),
    )
  })
})
