import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishablePackages } from '../../../release/src/publishable-packages.ts'

// The skills state facts about code; these tests read the facts from the code, so a new rule or a renamed example
// file fails here instead of leaving the skill wrong.

const REPO = resolve(import.meta.dirname, '../../../..')
const SKILLS = join(REPO, 'agents/automata/skills')
const read = (path: string) => readFileSync(join(REPO, path), 'utf8')

/** Every rule id `automata check` can report, from the checkers' sources (not a copied list). */
function checkRuleIds(): string[] {
  const ids = new Set<string>()
  // check-boundaries: the `Rule` union.
  const union =
    /export type Rule =([\s\S]*?)\n\n/.exec(read('packages/tools/src/features/boundaries/check.ts'))?.[1] ??
    ''
  for (const match of union.matchAll(/'([a-z-]+)'/g)) if (match[1] !== undefined) ids.add(match[1])
  // automata check's own steps: `rule: '…'` (also both arms of a conditional) and `report(node, '…'`.
  const dir = join(REPO, 'packages/tools/src/shared/check')
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.includes('.test.'))) {
    const source = readFileSync(join(dir, file), 'utf8')
    const forms = [/\brule: (?:[^?,\n]*\? )?'([a-z-]+)'(?: : '([a-z-]+)')?/g, /\breport\(node, '([a-z-]+)'/g]
    for (const form of forms) {
      for (const match of source.matchAll(form)) {
        for (const id of match.slice(1)) if (id !== undefined) ids.add(id)
      }
    }
  }
  return [...ids].sort()
}

describe('automata-verify', () => {
  const skill = readFileSync(join(SKILLS, 'automata-verify/SKILL.md'), 'utf8')

  it('finds the rules in the sources (the collector itself works)', () => {
    const ids = checkRuleIds()
    expect(ids).toEqual(
      expect.arrayContaining(['import', 'math-member', 'eval', 'csp-violation', 'tool-missing']),
    )
  })

  it.each(checkRuleIds())('documents rule `%s`', (id) => {
    expect(skill).toContain(`\`${id}\``)
  })

  it("documents typecheck's TS codes, the test rules and every step", () => {
    for (const text of [
      '`TS',
      '`test`',
      '`test-file`',
      'boundaries',
      'typecheck',
      'no-eval',
      'csp',
      '--json',
    ]) {
      expect(skill).toContain(text)
    }
  })
})

describe('automata-feature', () => {
  const skill = readFileSync(join(SKILLS, 'automata-feature/SKILL.md'), 'utf8')
  // The example is laid out as a new game is: the feature's code in src/features/, its test in tests/unit/.
  const files = [
    ...readdirSync(join(SKILLS, 'automata-feature/example/src/features/double-jump')).map(
      (file) => `src/features/double-jump/${file}`,
    ),
    ...readdirSync(join(SKILLS, 'automata-feature/example/tests/unit/double-jump')).map(
      (file) => `tests/unit/double-jump/${file}`,
    ),
  ].sort()

  it.each(files)('links the example file %s', (file) => {
    expect(skill).toContain(`(example/${file})`)
  })
})

describe('automata', () => {
  const skill = readFileSync(join(SKILLS, 'automata/SKILL.md'), 'utf8')

  it('routes to each other skill', () => {
    for (const other of ['automata-feature', 'automata-api', 'automata-verify'])
      expect(skill).toContain(other)
  })

  it('states the seven laws', () => {
    expect(skill.match(/^\d\. \*\*/gm)).toHaveLength(7)
  })
})

describe('automata-api', () => {
  const skill = readFileSync(join(SKILLS, 'automata-api/SKILL.md'), 'utf8')

  it('points to its reference file', () => {
    expect(skill).toContain('(reference/api.md)')
  })

  it('names the entry points the reference leaves out', () => {
    // The reference lists the typed entry points; an `exports` key without a `types` target (a stylesheet, the
    // build-picked target) is not in it, so the skill says so instead of letting "not listed" read as "not there".
    const untyped = publishablePackages(REPO).flatMap(({ manifest }) =>
      Object.entries(manifest.publishConfig?.exports ?? manifest.exports ?? {})
        .filter(([, entry]) => typeof entry !== 'object' || entry === null || !('types' in entry))
        .map(([key]) => `${manifest.name}${key.slice(1)}`),
    )
    expect(untyped).toContain('@automata/framework/target')
    expect(untyped).toContain('@automata/framework/theme.css')
    for (const entry of untyped) expect(skill).toContain(`\`${entry}\``)
  })
})
