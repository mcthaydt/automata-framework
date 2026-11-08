import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { editorListSchema } from '#src/shared/editor-list/editors.schema.ts'

// The example of spec §4.2, with its top-level keys written before the first table, where TOML reads them as
// the list's own (the draft printed `generated` and `never` after the last `[[gate]]`, inside that gate).
const SPEC_EXAMPLE = `
format = "af-editors/1"
scenes = "content/scenes/{scene}/"
generated = ["content/generated/**", "tests/generated/**"]
never = ["content/editors.toml", "package.json", ".github/**", ".claude/**", "**/gates.json"]

[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["content", "game-check"]

[[file]]
glob = "content/scenes/{scene}/puzzle.toml"
editor = "schematic"
modes = ["edit"]
gates = ["P-G1"]
checks = ["content", "puzzle-validate"]

[[check]]
id = "puzzle-validate"
run = ["automata", "pipe", "puzzle", "validate", "{scene}", "--json"]
when = "after"
joins = []
measure = false

[[check]]
id = "game-check"
run = ["automata", "check"]

[[gate]]
id = "P-G1"
name = "Puzzle design"
records = "docs/gates/**/gates.json"
`

const parsed = (toml: string) => editorListSchema.safeParse(parse(toml))

const ROW = `glob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\ngates = []\nchecks = []`

/** The key paths of every issue, for a list whose one file row is `row`. */
function issuePaths(row: string, rest = ''): (readonly PropertyKey[])[] {
  const result = parsed(`format = "af-editors/1"\n${rest}\n[[file]]\n${row}\n`)
  return result.success ? [] : result.error.issues.map((issue) => issue.path)
}

describe('editorListSchema (af-editors/1)', () => {
  it('knows one mode, edit: a row that still names the assistant’s mode is refused at that row’s modes', () => {
    expect(issuePaths(ROW.replace('["edit"]', '["edit", "ask"]'))).toContainEqual(['file', 0, 'modes', 1])
  })

  it('reads the spec example, with the defaults filled in', () => {
    const result = parsed(SPEC_EXAMPLE)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
    const list = result.data
    expect(list?.file.map((row) => row.editor)).toEqual(['tuner', 'schematic'])
    expect(list?.file[0]?.gates).toEqual([])
    expect(list?.check[1]).toEqual({
      id: 'game-check',
      run: ['automata', 'check'],
      when: 'after',
      joins: [],
      measure: false,
    })
    expect(list?.gate).toEqual([{ id: 'P-G1', name: 'Puzzle design', records: 'docs/gates/**/gates.json' }])
  })

  it('refuses top-level keys written after a table, which TOML puts inside that table', () => {
    const late = `${SPEC_EXAMPLE}\ngenerated = ["x/**"]\n`.replace(/^generated = .*$/m, '')
    const result = parsed(late)
    expect(result.error?.issues.map((issue) => [issue.path, issue.code])).toEqual([
      [['gate', 0], 'unrecognized_keys'],
    ])
  })

  it('fills the empty lists of a list with only its format', () => {
    expect(parsed('format = "af-editors/1"').data).toEqual({
      format: 'af-editors/1',
      file: [],
      check: [],
      gate: [],
      generated: [],
      never: [],
    })
  })

  it('refuses a file row without gates: silence never reads as "no gates" (EDS-D7, EDS-m)', () => {
    expect(issuePaths(ROW.replace('gates = []\n', ''))).toEqual([['file', 0, 'gates']])
  })

  it('refuses a file row without checks or modes', () => {
    expect(issuePaths(ROW.replace('checks = []', ''))).toEqual([['file', 0, 'checks']])
    expect(issuePaths(ROW.replace('modes = ["edit"]\n', ''))).toEqual([['file', 0, 'modes']])
  })

  it('refuses an unknown key, so a misspelt `gates` is never dropped', () => {
    expect(issuePaths(`${ROW}\ngate = ["P-G1"]`)).toEqual([['file', 0]])
    expect(issuePaths(ROW, 'scene = "content/scenes/{scene}/"')).toEqual([[]])
  })

  it('refuses no modes, an unknown mode and a repeated mode', () => {
    expect(issuePaths(ROW.replace('["edit"]', '[]'))).toEqual([['file', 0, 'modes']])
    expect(issuePaths(ROW.replace('["edit"]', '["literal"]'))).toEqual([['file', 0, 'modes', 0]])
    expect(issuePaths(ROW.replace('["edit"]', '["edit", "edit"]'))).toEqual([['file', 0, 'modes']])
  })

  it('refuses an empty editor id', () => {
    expect(issuePaths(ROW.replace('"tuner"', '""'))).toEqual([['file', 0, 'editor']])
  })

  it('keeps every glob inside the game root', () => {
    for (const glob of [
      '/etc/passwd',
      '../other/file.toml',
      'content/../package.json',
      '',
      'content//tuning.toml',
      'content/./tuning.toml',
      './content/tuning.toml',
      'content/',
      // TOML reads `\\` as one backslash.
      'content\\\\tuning.toml',
    ]) {
      expect(issuePaths(ROW.replace('content/tuning.toml', glob)), glob).toEqual([['file', 0, 'glob']])
    }
    expect(issuePaths(ROW, 'never = ["../x"]')).toEqual([['never', 0]])
    expect(issuePaths(ROW, 'generated = ["/x"]')).toEqual([['generated', 0]])
    expect(issuePaths(ROW, 'never = ["a//b"]')).toEqual([['never', 0]])
    expect(issuePaths(ROW, 'scenes = "content/scenes/{scene}/"')).toEqual([])
    expect(issuePaths(ROW, 'scenes = "content//{scene}/"')).toEqual([['scenes']])
  })

  it('allows `{scene}` once in a glob, and no other placeholder', () => {
    expect(issuePaths(ROW.replace('content/tuning.toml', 'content/{scene}/{scene}.toml'))).toEqual([
      ['file', 0, 'glob'],
    ])
    expect(issuePaths(ROW.replace('content/tuning.toml', 'content/{level}/a.toml'))).toEqual([
      ['file', 0, 'glob'],
    ])
    expect(issuePaths(ROW.replace('content/tuning.toml', 'content/{a,b}.toml'))).toEqual([
      ['file', 0, 'glob'],
    ])
  })

  it('refuses an empty `run`, an empty argument and a placeholder other than {scene} and {path}', () => {
    const check = (run: string) => `[[check]]\nid = "c"\nrun = ${run}\n`
    expect(issuePaths(ROW, check('[]'))).toEqual([['check', 0, 'run']])
    expect(issuePaths(ROW, check('["automata", ""]'))).toEqual([['check', 0, 'run', 1]])
    expect(issuePaths(ROW, check('["sh", "-c", "{cmd}"]'))).toEqual([['check', 0, 'run', 2]])
    expect(issuePaths(ROW, check('["automata", "pipe", "{scene}", "--file={path}"]'))).toEqual([])
  })

  it('refuses a `when` other than before and after', () => {
    expect(issuePaths(ROW, '[[check]]\nid = "c"\nrun = ["x"]\nwhen = "during"\n')).toEqual([
      ['check', 0, 'when'],
    ])
  })

  it('refuses a gate without a name or records', () => {
    expect(issuePaths(ROW, '[[gate]]\nid = "G1"\nrecords = "docs/**/gates.json"\n')).toEqual([
      ['gate', 0, 'name'],
    ])
    expect(issuePaths(ROW, '[[gate]]\nid = "G1"\nname = "Sheet"\n')).toEqual([['gate', 0, 'records']])
  })
})
