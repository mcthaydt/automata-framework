// One-off converter (M6 spec §4.9): the adventure source's clinic nav graph (`NODES`, `EDGES` in its level) becomes
// `nav-graph` TOML, and the clinic's boxes (furniture, doors, exits) a test fixture for the game-side `Blocked` the
// route tests use (boxes are the game's, not nav's). Run once against a checkout of the source; it prints the commit
// it read, which the framework's provenance file records. Not shipped:
//   node --import ./scripts/register-ts.mjs scripts/convert-adventure-nav.ts <source checkout>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify } from 'smol-toml'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: convert-adventure-nav.ts <source checkout>')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const level = await import(pathToFileURL(join(source, 'src/game/level.ts')).href)
const header = (what: string) =>
  `# The adventure source's clinic ${what} (provenance: the framework's docs/provenance/sources.md), converted once\n# by packages/nav/scripts/convert-adventure-nav.ts. Do not edit.\n`
const out = (name: string) => join(import.meta.dirname, '../src/testing/fixtures', name)

const nodes = level.NODES as Record<string, { x: number; z: number }>
const edges = level.EDGES as [string, string, string?][]
const graph = {
  nodes: Object.fromEntries(
    Object.keys(nodes)
      .sort()
      .map((id) => [id, { x: nodes[id]?.x, z: nodes[id]?.z }]),
  ),
  edges: edges.map((e) => (e[2] === undefined ? [e[0], e[1]] : [e[0], e[1], e[2]])),
}
writeFileSync(out('clinic.nav-graph.toml'), header('nav graph') + stringify(graph))
const boxes = (level.BOXES as { id: string; x: number; z: number; w: number; d: number; kind: string }[]).map(
  ({ id, x, z, w, d, kind }) => ({ id, x, z, w, d, kind }),
)
writeFileSync(out('clinic.boxes.toml'), header('boxes') + stringify({ boxes }))
console.log(`clinic: ${Object.keys(nodes).length} nodes, ${edges.length} edges, ${boxes.length} boxes`)
console.log(`converted at ${commit}`)
