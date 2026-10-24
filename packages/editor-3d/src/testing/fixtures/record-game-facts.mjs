// Records `game-facts.golden.json`: what The Last Light's own code answers about the three lists a level's game holds.
// `readLevelOptions` (editor/src/server/level-options.ts) reads the renderer's material keys, the lamp archetypes and
// the tone out of the game's source with the TypeScript parser; `lampIssues` (src/render/look.ts) and `colourDistance`
// say how a lamp sits against its archetype; `validateRoomPolicy` (src/render/room-visibility.ts) throws at the first
// fault of a room-visibility policy. Each is run over the cases of `game-fact-cases.json`, and what is kept is what a
// port must reproduce: the options themselves, each lamp's issues and distance, each policy's thrown message.
//
// One fact the game's own reader gets wrong at 92e6704: it finds the materials by looking for variable declarations
// that have an object literal, and `stage.ts` assigns `sectorMats` and `unlitMats` with `??=` after declaring them
// bare, so `readLevelOptions` answers `materials: null` (the levels editor then refuses every material edit). The
// golden keeps that answer as `reader.materials`, and takes the list for `options.materials` from the same two object
// literals read here, with the same parser.
//
// The game files import each other without file extensions, which Node's type stripping cannot resolve, so this works
// on a scratch copy (relative imports get `.ts`). `level-options.ts` needs a `typescript` with the compiler API, which the
// workspace's own (7.x, native) does not have: pass the directory of a 5.9 or 6.x package (the game's is 5.9.3; the
// calls it makes, `createSourceFile` and the node predicates, are the same in 6.x, and the golden would show a
// difference). `stage.ts` is only read as text; `room-visibility.ts` asks `../game/rooms` for `sectorAt`, which the validator never
// calls, so that module is a stub. It reads the checkout and writes nothing there. The checkout must be at 92e6704.
//
// Run with Node 22.18 or later, from `packages/editor-3d`:
//
//   node --experimental-strip-types src/testing/fixtures/record-game-facts.mjs <Last Light checkout at 92e6704> src/testing/fixtures/game-fact-cases.json src/testing/fixtures/game-facts.golden.json <typescript 5.9 or 6.x package directory>
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [checkout, casesFile, out, typescript] = process.argv.slice(2)
const COMMIT = '92e6704'
const head = execFileSync('git', ['-C', checkout, 'rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim()
if (head !== COMMIT) throw new Error(`the Last Light checkout is at ${head}, not ${COMMIT}`)

const scratch = mkdtempSync(join(tmpdir(), 'll-game-facts-'))
const withExtensions = (source) =>
  source
    .replace(/from '(\.{1,2}\/[^']*?)'/g, (whole, path) => (path.endsWith('.ts') ? whole : `from '${path}.ts'`))
    .replace(/import\('(\.{1,2}\/[^']*?)'\)/g, (whole, path) => (path.endsWith('.ts') ? whole : `import('${path}.ts')`))
const put = (path, text) => {
  mkdirSync(join(scratch, dirname(path)), { recursive: true })
  writeFileSync(join(scratch, path), text)
}
const copy = (path, transform = (text) => text) => put(path, transform(readFileSync(`${checkout}/${path}`, 'utf8')))

try {
  copy('editor/src/server/level-options.ts', withExtensions)
  copy('src/render/look.ts', withExtensions)
  copy('src/render/stage.ts')
  copy('src/render/room-visibility.ts', withExtensions)
  put('src/game/rooms.ts', 'export const sectorAt = () => undefined\n')
  put('package.json', '{"type":"module"}\n')
  mkdirSync(join(scratch, 'node_modules'), { recursive: true })
  symlinkSync(typescript, join(scratch, 'node_modules/typescript'), 'dir')

  const ts = createRequire(join(scratch, 'package.json'))('typescript')
  /** The keys of the renderer's two material tables (lit `sectorMats`, `unlitMats`): sorted, without repeats. */
  const stageMaterials = (path) => {
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const keys = []
    const visit = (node) => {
      const assigned =
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken &&
        ts.isIdentifier(node.left) &&
        ['sectorMats', 'unlitMats'].includes(node.left.text) &&
        ts.isObjectLiteralExpression(node.right)
      if (assigned)
        for (const property of node.right.properties)
          if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)))
            keys.push(property.name.text)
      ts.forEachChild(node, visit)
    }
    visit(source)
    return [...new Set(keys)].sort()
  }
  const load = (path) => import(pathToFileURL(join(scratch, path)).href)
  const { readLevelOptions, colourDistance } = await load('editor/src/server/level-options.ts')
  const { lampIssues } = await load('src/render/look.ts')
  const { validateRoomPolicy } = await load('src/render/room-visibility.ts')

  const reader = readLevelOptions(scratch)
  const options = { ...reader, materials: stageMaterials(join(scratch, 'src/render/stage.ts')) }
  const cases = JSON.parse(readFileSync(casesFile, 'utf8'))
  const lamps = cases.lamps.map(({ id, lamp }) => {
    const kind = options.lampKinds?.[lamp.kind]
    return { id, issues: lampIssues(lamp), distance: kind ? colourDistance(lamp.color, kind.color) : null }
  })
  const policies = cases.policies.map(({ id, policy, sectors, zones, masses }) => {
    try {
      validateRoomPolicy(policy, sectors.map((sector) => ({ id: sector })), zones, masses)
      return { id, thrown: null }
    } catch (error) {
      return { id, thrown: error.message }
    }
  })
  writeFileSync(out, `${JSON.stringify({ options, reader: { materials: reader.materials }, lamps, policies }, null, 1)}\n`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
