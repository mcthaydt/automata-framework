import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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
    for (const other of ['automata-feature', 'automata-api', 'automata-verify', 'automata-content'])
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
})

/** The `content/…*` globs the 2D and story templates list in their `editors.toml` files (the 3D game is left out). */
function templateGlobs(): Set<string> {
  const create = join(REPO, 'packages/tools/src/shared/create-game')
  const globs = new Set<string>()
  for (const file of ['template-content/editors.toml', 'template-story-content/editors-story.toml']) {
    for (const match of readFileSync(join(create, file), 'utf8').matchAll(/^glob = "([^"]+)"/gm))
      if (match[1] !== undefined) globs.add(match[1])
  }
  return globs
}

/** Whether a package of the workspace exports `name` from one of its entry files (a private package has no api.md row). */
function exportedByAPackage(name: string): boolean {
  for (const folder of ['packages', 'extensions']) {
    for (const entry of readdirSync(join(REPO, folder), { withFileTypes: true })) {
      const entries = join(REPO, folder, entry.name, 'src/entries')
      if (!entry.isDirectory() || !existsSync(entries)) continue
      for (const file of readdirSync(entries).filter((each) => each.endsWith('.ts'))) {
        if (new RegExp(`\\b${name}\\b`).test(readFileSync(join(entries, file), 'utf8'))) return true
      }
    }
  }
  return false
}

describe('automata-content', () => {
  const skill = readFileSync(join(SKILLS, 'automata-content/SKILL.md'), 'utf8')
  const api = readFileSync(join(SKILLS, 'automata-api/reference/api.md'), 'utf8')

  it.each(['Levels', 'Characters', 'Tuner', 'Feel', 'Audio', 'Writer', 'Sequence', 'Schematic'])(
    'has a row for %s',
    (editor) => {
      expect(skill).toMatch(new RegExp(`^\\| ${editor}\\b`, 'm'))
    },
  )

  it('names only calls the framework exports', () => {
    const calls = [...skill.matchAll(/`([A-Za-z]+)\(/g)].map((match) => match[1] ?? '')
    expect(calls).toEqual(expect.arrayContaining(['entitiesOf', 'levelScene', 'pictureView']))
    for (const name of new Set(calls)) {
      expect(api.includes(`#### \`${name}\``) || exportedByAPackage(name), name).toBe(true)
    }
  })

  it('names only content paths a template lists for an editor', () => {
    const listed = templateGlobs()
    const named = [...skill.matchAll(/`(content\/[^`\s]*\*[^`\s]*)`/g)].map((match) => match[1] ?? '')
    expect(named.length).toBeGreaterThan(0)
    for (const glob of new Set(named)) expect(listed, glob).toContain(glob)
  })

  it('has no 3D text (the mirror is public before 3D is)', () => {
    expect(skill).not.toMatch(/\b3D\b|af-sector|\bfigures?\b/)
  })

  it('says an extension’s events show up in Feel and Audio by themselves', () => {
    expect(skill).toMatch(/appear in Feel and Audio by themselves/)
  })

  it('places the coin in the level file in its example', () => {
    const example = readFileSync(join(SKILLS, 'automata-content/example/coin.md'), 'utf8')
    expect(example).toContain('content/levels/start.af2d.json')
    expect(example).not.toMatch(/\b3D\b|af-sector/)
  })
})

describe('automata-editor', () => {
  const skill = readFileSync(join(SKILLS, 'automata-editor/SKILL.md'), 'utf8')

  it('no longer says the editor is for 2D levels only', () => {
    expect(skill).not.toContain('2D level editor')
  })

  it('names every editor a new game lists, and Play and Publish', () => {
    for (const words of [
      'Levels',
      'Characters',
      'Tuner',
      'Feel',
      'Audio',
      'Writer',
      'Sequence',
      'Schematic',
      'Play',
      'Publish',
    ])
      expect(skill, words).toContain(words)
  })
})
