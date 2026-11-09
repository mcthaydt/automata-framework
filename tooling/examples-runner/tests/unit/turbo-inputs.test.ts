import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const runnerDir = join(root, 'tooling/examples-runner')

// The catalog test reads docs/02 (which tasks are ticked), every file under examples/ and each package's `exports`;
// the golden replays import every example, and so the game, sim, runtime and render-pixi sources. Turbo hashes only
// this package's own files by default, so a change to any of those replayed a cached pass (found on #51: CI failed
// on `Pending: DX.2b` after #39 merged while the cached local `pnpm check` passed). Ask turbo itself which files it
// hashes, so the check follows turbo's own glob rules. The dry run spawns pnpm and turbo, so it gets its own budget,
// as ship's equivalent does.
const TASKS = ['test:unit', 'test'] as const
const DRY_RUN_BUDGET_MS = 120_000

function hashedFilesByTask(): Map<string, string[]> {
  const dry = execFileSync(
    'pnpm',
    ['exec', 'turbo', 'run', ...TASKS, '--filter=@automataframework/examples-runner', '--dry=json'],
    { cwd: root, encoding: 'utf8' },
  )
  const planned = JSON.parse(dry).tasks as { taskId: string; inputs: Record<string, string> }[]
  const byTask = new Map<string, string[]>()
  for (const task of TASKS) {
    const runner = planned.find((entry) => entry.taskId === `@automataframework/examples-runner#${task}`)
    if (runner === undefined) throw new Error(`turbo planned no ${task} for the examples runner`)
    // Turbo keys inputs relative to the package; compare them relative to the repo root.
    byTask.set(
      task,
      Object.keys(runner.inputs).map((file) => relative(root, resolve(runnerDir, file))),
    )
  }
  return byTask
}

let hashed = new Map<string, string[]>()
beforeAll(() => {
  hashed = hashedFilesByTask()
}, DRY_RUN_BUDGET_MS)

describe.each(TASKS)("turbo's cache key for the examples runner's %s", (task) => {
  it('covers the delivery plan, the examples and their goldens', () => {
    expect(hashed.get(task)).toEqual(
      expect.arrayContaining([
        'docs/archive/02-master-delivery-plan.md',
        'examples/2d/core/core-basic-window.ts',
        'examples/2d/__goldens__/core-input-keys.replay',
      ]),
    )
  })

  it("covers the packages' manifests and the sources an example runs, but not their tests", () => {
    const files = hashed.get(task) ?? []
    expect(files).toEqual(
      expect.arrayContaining(['packages/automata/package.json', 'packages/automata/src/app/define-game.ts']),
    )
    expect(files).not.toContain('packages/automata/tests/unit/app/define-game.test.ts')
  })
})
