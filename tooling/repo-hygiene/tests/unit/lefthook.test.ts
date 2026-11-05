import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// The pre-commit hook runs the unit tests of the packages a commit touches. On a 4-core agent container, tests such
// as `compile-messages` and `examples.parity` take longer than vitest's 5 s default, so the hook blocked a commit
// while `pnpm check` passed. The hook has to pass the budget the root `test:unit` script does.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const read = (path: string): string => readFileSync(join(root, path), 'utf8')

it("the pre-commit unit tests get the root test:unit script's timeout, after `--` so it reaches vitest", () => {
  const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts
  const budget = /--testTimeout=\d+/.exec(scripts['test:unit'] ?? '')?.[0]
  expect(budget, 'the root test:unit script passes a --testTimeout').toBeDefined()

  const hook = /2_affected-unit-tests:\s*\n\s*run:\s*(.+)/.exec(read('lefthook.yml'))?.[1]
  expect(hook, 'lefthook.yml has a 2_affected-unit-tests command').toBeDefined()
  expect(hook).toMatch(new RegExp(` -- ${budget}$`))
})
