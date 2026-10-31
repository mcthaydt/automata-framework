// One-off converter (M6 spec §4.9): the adventure source's four scenes' puzzles, TypeScript objects, become `puzzle`
// TOML fixtures. Each gains `hotspots`, the scene's hotspot positions on the plan (P6-D4). Run once against a checkout
// of the source; it prints the commit it read, which the framework's provenance file records. Not shipped:
//   node --import ./scripts/register-ts.mjs scripts/convert-adventure-puzzles.ts <source checkout>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify } from 'smol-toml'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: convert-adventure-puzzles.ts <source checkout>')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const load = async (path: string) => import(pathToFileURL(join(source, path)).href)

for (const scene of ['prologue', 'clinic', 'clinic-dawn', 'bay']) {
  const { PUZZLE } = await load(`src/scenes/${scene}/puzzle.ts`)
  const { HOTSPOTS } = await load(`src/scenes/${scene}/level.ts`)
  const hotspots = Object.fromEntries(
    (HOTSPOTS as { id: string; x: number; z: number }[]).map((h) => [h.id, { x: h.x, z: h.z }]),
  )
  const header = `# The adventure source's ${scene} puzzle (provenance: the framework's docs/provenance/sources.md), converted once\n# by packages/puzzle/scripts/convert-adventure-puzzles.ts. Do not edit.\n`
  const out = join(import.meta.dirname, '../src/testing/fixtures', `${scene}.puzzle.toml`)
  writeFileSync(out, header + stringify({ ...PUZZLE, hotspots }))
  console.log(`${scene}: ${PUZZLE.actions.length} actions, ${Object.keys(hotspots).length} hotspots`)
}
console.log(`converted at ${commit}`)
