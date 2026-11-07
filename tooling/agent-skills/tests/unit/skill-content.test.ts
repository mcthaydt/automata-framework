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

  describe("the framework's own repository", () => {
    // `automata check` runs the boundaries checker with `--game` only, so a game never meets these rules; they guard
    // the framework's packages (they need `--features`, `--platform-imports`, `--forbid` or `--browser`).
    const REPOSITORY_ONLY_RULES = [
      'feature-import',
      'shared-import',
      'app-import',
      'entries-import',
      'entries-logic',
      'testing-import',
      'alias-in-src',
      'browser-import',
      'forbidden-import',
      'platform-import',
    ]
    const HEADING = "## Only in the framework's own repository"

    it('are real rules that the game check never passes', () => {
      expect(checkRuleIds()).toEqual(expect.arrayContaining(REPOSITORY_ONLY_RULES))
      const steps = read('packages/tools/src/shared/check/check-steps.ts')
      expect(steps).toContain("[cli, '--game', 'src']")
      for (const flag of ['--features', '--platform-imports', '--forbid', '--browser'])
        expect(steps).not.toContain(flag)
    })

    it('are listed under their own heading, and not before it', () => {
      const heading = skill.indexOf(HEADING)
      expect(heading).toBeGreaterThan(-1)
      expect(skill.slice(heading)).toContain('`automata check` never reports these on a game')
      for (const id of REPOSITORY_ONLY_RULES) {
        expect(skill.slice(heading), id).toContain(`\`${id}\``)
        expect(skill.slice(0, heading), id).not.toContain(`\`${id}\``)
      }
    })
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

describe('automata', () => {
  const skill = readFileSync(join(SKILLS, 'automata/SKILL.md'), 'utf8')

  it('says how to ship', () => {
    // The targets and the commands are the tools', read from them: `pnpm build:<target>` and `prepare:<target>` are
    // the scripts create-game writes, `automata ship` is the command they run.
    const targets = /DIST_TARGETS = \[([^\]]*)\]/.exec(
      read('packages/tools/src/shared/create-game/create-game-targets.ts'),
    )?.[1]
    const names = [...(targets ?? '').matchAll(/'([a-z]+)'/g)].map((match) => match[1] ?? '')
    expect(names).toEqual(['web', 'itch', 'ruken', 'tauri'])
    for (const text of [
      'pnpm build:',
      'automata ship prepare',
      'automata ship publish',
      ...names.map((n) => `\`${n}\``),
    ])
      expect(skill, text).toContain(text)
    expect(skill).toContain('docs/guides/publish-to-')
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
    // An entry point is left out when the reference has no section for it: a stylesheet, the build-picked target,
    // and a side-effect import such as `no-eval` (its declaration exports nothing, so `api-index` writes no section).
    // The list is read from the published `exports` maps and the reference itself, so a new one cannot slip by.
    const reference = read('agents/automata/skills/automata-api/reference/api.md')
    const leftOut = publishablePackages(REPO).flatMap(({ manifest }) =>
      Object.keys(manifest.publishConfig?.exports ?? manifest.exports ?? {})
        .map((key) => `${manifest.name}${key.slice(1)}`)
        .filter((entry) => !reference.includes(`from '${entry}'`)),
    )
    expect(leftOut).toEqual(
      expect.arrayContaining([
        '@automata/framework/target',
        '@automata/framework/theme.css',
        '@automata/framework/no-eval',
      ]),
    )
    for (const entry of leftOut) expect(skill).toContain(`\`${entry}\``)
  })

  it('does not call a left-out entry point something a game never imports', () => {
    // `no-eval` is left out of the reference, but every game imports it first (the verify skill says so).
    expect(skill).toMatch(/`@automata\/framework\/no-eval`[^.]*import/)
  })
})

describe('automata-editor', () => {
  const skill = readFileSync(join(SKILLS, 'automata-editor/SKILL.md'), 'utf8')
  // `USAGE` is private to editor-command.ts, so its text is read the way `checkRuleIds` reads the Rule union.
  const usage =
    /const USAGE = `([\s\S]*?)`/.exec(read('packages/tools/src/features/editor/editor-command.ts'))?.[1] ?? ''

  it('documents every editor flag but 3d', () => {
    const flags = [...new Set(usage.match(/--[a-z][a-z-]*/g) ?? [])]
    expect(flags).toEqual(
      expect.arrayContaining(['--app', '--app-dir', '--game-url', '--lan', '--token', '--port']),
    )
    for (const flag of flags) expect(skill, flag).toContain(flag)
    expect(skill).toContain('2d|suite')
    expect(skill).not.toMatch(/\b3d\b/i)
  })

  it('explains the Tuner', () => {
    for (const text of ['Tuner', 'pnpm dev', '--game-url', 'http://localhost:5173'])
      expect(skill).toContain(text)
  })

  it("names the 2D editor's views", () => {
    const folders = readdirSync(join(REPO, 'packages/editor/src/features'))
    for (const [text, folder] of [
      ['Map', 'map'],
      ['Tiles', 'tiles'],
      ['Add tiles', 'tiles'],
      ['Characters', 'characters'],
    ] as const) {
      expect(skill).toContain(text)
      expect(folders).toContain(folder)
    }
  })

  it('has no unreachable symptom', () => {
    // The command never listens beyond the loopback without a token (--lan makes one), so no one meets that message.
    expect(skill).not.toContain('listening beyond the loopback')
  })
})

describe('what a sim file may import', () => {
  // One list, read from the checker: the names inside `IMPORT_ALLOWED`'s `new Set([ … ])`, without the comments.
  const source = read('packages/tools/src/features/boundaries/sim-rules.ts')
  const block = /export const IMPORT_ALLOWED[^=]*= new Set\(\[([\s\S]*?)\]\)/.exec(source)?.[1] ?? ''
  const allowed = [...block.replace(/\/\/.*$/gm, '').matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '')

  it('finds the allowed imports in the checker (the reader itself works)', () => {
    expect(allowed).toEqual(expect.arrayContaining(['koota', 'zod', '@automata/sim', '@automata/sim/hash']))
  })

  it.each(['automata', 'automata-verify'])('%s lists every import a sim file may make', (name) => {
    const skill = readFileSync(join(SKILLS, name, 'SKILL.md'), 'utf8')
    for (const importName of allowed) {
      // `@automata/sim/hash` and `/math` are written beside `@automata/sim` as `/hash` and `/math`.
      const written = importName.startsWith('@automata/sim/')
        ? `\`${importName.slice('@automata/sim'.length)}\``
        : `\`${importName}\``
      expect(skill, importName).toContain(written)
    }
    expect(skill).toContain('simEntries')
  })
})
