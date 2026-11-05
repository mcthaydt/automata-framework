import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { ensureRepoGitleaks, GITLEAKS_VERSION } from '#src/gitleaks.ts'
import { KEY_RULES } from '../../../../packages/tools/src/shared/ship/prepare/secret-scan.ts'

// One secret rule list (QB.2c). ship's bundle scan reports each known key format under a gitleaks rule ID
// (`KEY_RULES`), and `pnpm secrets` runs the pinned gitleaks release with .gitleaks.toml, which extends gitleaks'
// default rules. gitleaks owns the IDs, so this test asks the pinned binary itself, with the repository's config:
// `--enable-rule <id>` runs only that rule, and gitleaks exits 1 with "Requested rule <id> not found in rules" when
// the loaded rule set has no rule by that name. There is no copy of gitleaks' rule list to keep in step with
// GITLEAKS_VERSION, and no network beyond ensureGitleaks' own cached, SHA-256-verified download.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const config = join(root, '.gitleaks.toml')

let binary = ''
// On a cold cache (every CI checkout starts with none) this downloads the pinned gitleaks release, which can take
// longer than vitest's 10 s hook default on a busy runner: the same 120 s as secret-scan.test.ts.
beforeAll(async () => {
  binary = await ensureRepoGitleaks(root)
}, 120_000)

/** Runs only `rule` over empty input: exit 0 ("no leaks found") when the rule exists. */
function enableOnly(rule: string): { status: number; output: string } {
  const result = spawnSync(
    binary,
    ['stdin', '--no-banner', '--no-color', '--config', config, '--enable-rule', rule],
    { input: '', encoding: 'utf8' },
  )
  // A binary that could not start (ETXTBSY, EACCES, ENOENT) has no exit status: fail on that error, so it is not
  // mistaken for gitleaks answering that a rule is missing.
  if (result.error !== undefined) throw result.error
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe(`the bundle scan's rule IDs are gitleaks ${GITLEAKS_VERSION}'s`, () => {
  it.each(KEY_RULES.map((rule) => rule.id))('%s is a gitleaks rule', (id) => {
    const result = enableOnly(id)
    expect(result.output).not.toContain('not found in rules')
    expect(result.status).toBe(0)
  })

  it('fails for an ID gitleaks does not have, so a renamed or invented ID cannot pass', () => {
    const result = enableOnly('not-a-gitleaks-rule')
    expect(result.status).toBe(1)
    expect(result.output).toContain('Requested rule not-a-gitleaks-rule not found in rules')
  })
})

// The test reads two files outside this workspace. Unless both are inputs of its turbo task, a change to
// KEY_RULES or .gitleaks.toml would replay the cached pass instead of running it again.
it("the test task's cache key covers KEY_RULES and .gitleaks.toml", () => {
  const turbo = JSON.parse(readFileSync(new URL('../../turbo.json', import.meta.url), 'utf8')) as {
    tasks: Record<string, { inputs?: string[] }>
  }
  for (const task of ['test', 'test:unit']) {
    expect(turbo.tasks[task]?.inputs).toEqual(
      expect.arrayContaining([
        '$TURBO_ROOT$/packages/ship/src/prepare/secret-scan.ts',
        '$TURBO_ROOT$/.gitleaks.toml',
      ]),
    )
  }
})
