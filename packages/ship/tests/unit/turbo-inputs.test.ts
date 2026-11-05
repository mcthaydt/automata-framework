import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const shipDir = join(root, 'packages/ship')

// workflows.test.ts reads files outside this package (the workflows, every workspace package.json, the root
// scripts). Turbo only hashes a package's own files by default, so a change to one of those replayed a cached
// pass instead of running the test (audit of #10: a new examples/*/package.json hid a real failure). Ask turbo
// itself which files it hashes, so the check follows turbo's own glob rules.
//
// One dry run plans both tasks. It spawns pnpm and turbo, which hashes the workspace: well under a second on an
// idle machine, but more than 30 s on the shared af-linux runner while the rest of the unit suite runs beside
// it. So the dry run gets its own budget in beforeAll, sized for that runner, and the tests only read its plan.
const TASKS = ['test:unit', 'test'] as const
const DRY_RUN_BUDGET_MS = 120_000

function hashedFilesByTask(): Map<string, string[]> {
  const dry = execFileSync(
    'pnpm',
    ['exec', 'turbo', 'run', ...TASKS, '--filter=@mcthaydt/automata-ship', '--dry=json'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  const planned = JSON.parse(dry).tasks as { taskId: string; inputs: Record<string, string> }[]
  const byTask = new Map<string, string[]>()
  for (const task of TASKS) {
    const ship = planned.find((entry) => entry.taskId === `@mcthaydt/automata-ship#${task}`)
    if (ship === undefined) throw new Error(`turbo planned no ${task} for ship`)
    // Turbo keys inputs relative to the package; compare them relative to the repo root.
    byTask.set(
      task,
      Object.keys(ship.inputs).map((file) => relative(root, resolve(shipDir, file))),
    )
  }
  return byTask
}

let hashed = new Map<string, string[]>()
beforeAll(() => {
  hashed = hashedFilesByTask()
}, DRY_RUN_BUDGET_MS)

describe.each(TASKS)("turbo's cache key for ship's %s", (task) => {
  it('covers the repository files the workflow tests read', () => {
    const files = hashed.get(task)
    expect(files).toEqual(
      expect.arrayContaining([
        'packages/ship/tests/unit/workflows.test.ts',
        '.github/workflows/ci.yml',
        'package.json',
        'pnpm-workspace.yaml',
        'games/emberwick/playwright.config.ts',
        'examples/playwright.config.ts',
        'packages/sim/package.json',
        'packages/sim/vitest.config.ts',
        'games/emberwick/package.json',
        'games/emberwick/vitest.config.ts',
        'examples/ui/primitives/package.json',
      ]),
    )
  })
})
