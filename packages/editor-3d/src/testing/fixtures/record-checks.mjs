// Records `checks.golden.json`: The Last Light's own `validate` (scripts/pipeline/blockout-lib.ts) run over the four
// shipped blockouts and over every case of `check-cases.json`, a corpus of edits that each provoke one of the
// sentences `validate` can write. What is kept is what a port must reproduce: each result's id, whether it passed and
// its detail. `zone-cameras` is left out: it is a stub in Last Light that never fails (the game owns it).
//
// `validate` binds the game's engine modules by dynamic import and reads the scene's `puzzle.ts`. Those modules import
// each other without file extensions, which Node's type stripping cannot resolve, and the game files pull in generated
// scene files, so this script works on a scratch copy: relative imports get `.ts`, the two clinic scene files and each
// scene's `story.ts` are stubbed (only a constant the puzzle reads, which no hotspot id depends on), the four
// `puzzle.ts` are copied as they are, and `src/render/look.ts` is empty (`validate` only asks that it exist, to allow
// a lamp kind: a fact about the game repo, not about a document). It reads the checkout and writes nothing there.
//
// Each case records the sha256 of the edited blockout's JSON, so the test that applies the same edits can prove it
// built the same document. Run with Node 22.18 or later:
//
//   node --experimental-strip-types src/testing/fixtures/record-checks.mjs <Last Light checkout at 92e6704> src/testing/fixtures/check-cases.json src/testing/fixtures src/testing/fixtures/checks.golden.json
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [checkout, casesFile, fixtures, out] = process.argv.slice(2)
const scratch = mkdtempSync(join(tmpdir(), 'll-checks-'))
const SCENES = { 'blockout-clinic': 'clinic', 'blockout-clinic-dawn': 'clinic-dawn', 'blockout-bay': 'bay', 'blockout-prologue': 'prologue' }

const withExtensions = (source) =>
  source
    .replace(/from '(\.{1,2}\/[^']*?)'/g, (whole, path) => (path.endsWith('.ts') ? whole : `from '${path}.ts'`))
    .replace(/import\('(\.{1,2}\/[^']*?)'\)/g, (whole, path) => (path.endsWith('.ts') ? whole : `import('${path}.ts')`))
const copy = (path) => {
  mkdirSync(join(scratch, dirname(path)), { recursive: true })
  writeFileSync(join(scratch, path), withExtensions(readFileSync(`${checkout}/${path}`, 'utf8')))
}
const put = (path, text) => {
  mkdirSync(join(scratch, dirname(path)), { recursive: true })
  writeFileSync(join(scratch, path), text)
}
for (const file of ['scripts/pipeline/blockout-lib.ts', 'scripts/pipeline/blockout-format.ts'].concat(
  ['sectors', 'sector-format', 'level', 'nav'].map((name) => `src/game/${name}.ts`),
))
  copy(file)
put('package.json', '{"type":"module"}\n')
put('src/render/look.ts', '')
put('src/scenes/clinic/map.ts', 'export const CLINIC_MAP = { sectors: [], masses: [] }\nexport const SECTOR_DEFS = []\nexport const MASS_DEFS = []\n')
put(
  'src/scenes/clinic/level.ts',
  [
    'export const CLINIC_LEVEL = { spawn: { x: 0, y: 0, z: 0, facing: 0 }, boxes: [], hotspots: [], lamps: [], nodes: {}, edges: [], patrol: [], bounce: [] }',
    'export const CURTAINS = {}',
    'export const FUSE_BOX = {}',
    'export const LEAK = {}',
    '',
  ].join('\n'),
)
for (const scene of Object.values(SCENES)) {
  copy(`src/scenes/${scene}/puzzle.ts`)
  put(`src/scenes/${scene}/story.ts`, "export const CODE = '0000'\n")
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const clone = (value) => JSON.parse(JSON.stringify(value))

/** The edits of a case: `set` a value at a path, `push` onto the array there, `delete` an array element or a key. */
function edit(document, edits) {
  for (const { op, path, value } of edits) {
    const parent = path.slice(0, -1).reduce((node, step) => node[step], document)
    const last = path.at(-1)
    if (op === 'set') parent[last] = clone(value)
    else if (op === 'push') (parent[last] ??= []).push(clone(value))
    else if (op === 'delete') (Array.isArray(parent) ? parent.splice(last, 1) : delete parent[last])
    else throw new Error(`unknown edit ${op}`)
  }
  return document
}

try {
  const { validate } = await import(pathToFileURL(join(scratch, 'scripts/pipeline/blockout-lib.ts')).href)
  // What the golden keeps of a result: the id without its prefix, and what a port has to reproduce.
  const kept = (results) =>
    results
      .filter((result) => result.id !== 'blockout:zone-cameras')
      .map(({ id, ok, detail }) => ({ id: id.replace(/^blockout:/, ''), ok, detail }))

  const blockouts = {}
  const documents = {}
  for (const [name, scene] of Object.entries(SCENES)) {
    documents[name] = JSON.parse(readFileSync(`${fixtures}/${name}.json`, 'utf8'))
    // `validate` reads the scene's own puzzle, as the game does.
    const results = kept(await validate(clone(documents[name])))

    // The puzzle's hotspot ids, which `validate` does not export: read from the copied `puzzle.ts` with the rule it
    // applies to it. The count it prints for the shipped blockout must be the length of this list.
    const module = await import(pathToFileURL(join(scratch, `src/scenes/${scene}/puzzle.ts`)).href)
    const def = Object.values(module).find((v) => v && typeof v === 'object' && 'actions' in v && 'fallback' in v)
    const special = new Set(['combine', 'floor', 'code', '*'])
    const puzzle = [...new Set([...def.actions.map((a) => a.at), ...Object.keys(def.fallback)].filter((id) => !special.has(id)))]
    const counted = results.find((result) => result.id === 'puzzle-hotspots')
    if (counted?.detail !== `${puzzle.length} placed`)
      throw new Error(`${name}: validate says "${counted?.detail}" of a puzzle with ${puzzle.length} hotspots`)
    blockouts[name] = { puzzle, results }
  }

  const cases = {}
  for (const spec of JSON.parse(readFileSync(casesFile, 'utf8'))) {
    const document = edit(clone(documents[spec.base]), spec.edits)
    const puzzle = 'puzzle' in spec ? spec.puzzle : blockouts[spec.base].puzzle
    const recorded = { sha256: sha256(JSON.stringify(document)), puzzle }
    try {
      recorded.results = kept(await validate(clone(document), { puzzle }))
    } catch (error) {
      // Last Light's own `validate` can fail to answer (a nav edge to a node that does not exist makes its
      // reachability search read an undefined point): the golden says so, and a port is held to answering.
      recorded.threw = `${error.name}: ${error.message}`
    }
    cases[spec.id] = recorded
  }
  writeFileSync(out, `${JSON.stringify({ blockouts, cases })}\n`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
