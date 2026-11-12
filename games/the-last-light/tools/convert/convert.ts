// The converter: runs once, in task 11 of the plan, and is kept as a record. It starts from October's fixtures (content,
// not code), makes the prologue's level and walking graph from the blockout fixture, joins each line's words to its
// record, puts the cutscenes on marks and rewrites the creature's calls. Without `--write` it prints the report only.
//
//   node tools/convert/convert.ts [--reference <checkout>] [--write] [--force]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { restageCutscenes } from './cutscenes.ts'
import { convertLevel } from './level.ts'
import { joinWords, type OldDelivery } from './lines.ts'
import { convertNav } from './nav.ts'
import type { PlacedModel } from './props-table.ts'
import { readReference } from './reference.ts'
import { type Converted, joined, reportTable } from './report.ts'
import { rewriteCalls } from './systems.ts'

/** Where Ada stands for each cutscene that starts on a mark: the spawn, and the spot beside the bed (audit 29). */
export const MARKS = {
  opening: { x: 0.6, z: 3.6 },
  lightsOut: { x: -2.9, z: 0.7 },
  rest: { x: -2.9, z: 0.7 },
} as const

/** The files of October's fixtures, relative to the repository root. */
const FIXTURES = {
  blockout: 'packages/editor/src/shared/kit/documents/testing/fixtures/blockout-prologue.json',
  lines: 'extensions/narrative/src/testing/fixtures/prologue.lines.toml',
  locale: 'extensions/narrative/src/testing/fixtures/prologue.locale.toml',
  cutscenes: 'extensions/cutscenes/src/testing/fixtures/prologue.cutscenes.toml',
  systems: 'extensions/systems/src/testing/fixtures/prologue.systems.toml',
  puzzle: 'extensions/puzzle/src/testing/fixtures/prologue.puzzle.toml',
  storylets: 'extensions/narrative/src/testing/fixtures/prologue.storylets.toml',
  beats: 'extensions/narrative/src/testing/fixtures/prologue.beats.toml',
  help: 'extensions/narrative/src/testing/fixtures/prologue.help.toml',
  canon: 'extensions/narrative/src/testing/fixtures/canon.toml',
} as const

/** Content copied as it is but for its header (the fixtures' "Do not edit" is replaced). */
const COPIED: Readonly<Record<string, { from: keyof typeof FIXTURES; to: string; what: string }>> = {
  puzzle: {
    from: 'puzzle',
    to: 'content/puzzles/prologue.toml',
    what: 'the puzzle: its facts, items and actions',
  },
  storylets: { from: 'storylets', to: 'content/storylets/prologue.toml', what: 'the storylets deck' },
  beats: { from: 'beats', to: 'content/beats/prologue.toml', what: 'the story beats' },
  help: { from: 'help', to: 'content/help/prologue.toml', what: 'the hint ladders' },
  canon: { from: 'canon', to: 'content/canon/canon.toml', what: 'the canon' },
}

/** `text` with its first comment line (the fixture's "converted once … Do not edit") replaced by one saying where it is from. */
function withOwnHeader(text: string, what: string): string {
  const body = text.replace(/^#[^\n]*\n/, '')
  return `# The prologue's ${what}. It was converted once from the game's prologue at 92e6704 (through October's fixture),\n# and this file is now the source: edit it by hand and in the editors.\n${body}`
}

/** Every file of the conversion and what it could not express. `reference` is a checkout of the old repository. */
export function convert(options: { readonly fixtures: string; readonly reference?: string }): Converted {
  const read = (name: keyof typeof FIXTURES) => readFileSync(join(options.fixtures, FIXTURES[name]), 'utf8')
  const blockout = JSON.parse(read('blockout')) as unknown
  const old = options.reference === undefined ? undefined : readReference(options.reference)
  const models: readonly PlacedModel[] = old?.models ?? []
  const delivery: OldDelivery | undefined = old?.delivery
  const copies = Object.values(COPIED).map(
    (copy): Converted => ({ files: { [copy.to]: withOwnHeader(read(copy.from), copy.what) }, report: [] }),
  )
  return joined(
    convertLevel(blockout, models),
    convertNav(blockout),
    joinWords(read('lines'), read('locale'), delivery),
    restageCutscenes(read('cutscenes'), MARKS),
    rewriteCalls(read('systems')),
    ...copies,
  )
}

function main(): void {
  const args = process.argv.slice(2)
  const flag = (name: string) => args.includes(name)
  const given = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const here = dirname(fileURLToPath(import.meta.url))
  const game = resolve(here, '../..')
  const fixtures = resolve(game, '../..')
  const reference = given('--reference')
  const result = convert({ fixtures, ...(reference === undefined ? {} : { reference }) })
  console.log(reportTable(result.report))
  if (!flag('--write')) return
  const present =
    existsSync(join(game, 'content/levels')) &&
    readdirSync(join(game, 'content/levels')).some((f) => f.startsWith('prologue'))
  if (present && !flag('--force'))
    throw new Error('The game already has the prologue’s content. Pass --force to write it again.')
  for (const [path, text] of Object.entries(result.files)) {
    mkdirSync(dirname(join(game, path)), { recursive: true })
    writeFileSync(join(game, path), text)
  }
  console.log(`\nWrote ${Object.keys(result.files).length} files.`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
