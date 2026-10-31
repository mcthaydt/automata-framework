// One-off converter (M6 spec §4.9): the adventure source's clinic map, a TypeScript object, becomes the `sector-map`
// TOML fixture, and the source's own resolution of it becomes the JSON that SC-a compares `resolveMap` with. Run once
// against a checkout of the source; the commit it read is printed and recorded in the framework's provenance file.
// Not shipped and not run in CI:
//   node --import ./scripts/register-ts.mjs scripts/convert-adventure-map.ts <source checkout>
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { stringify } from 'smol-toml'

const source = process.argv[2]
if (source === undefined) throw new Error('usage: convert-adventure-map.ts <source checkout>')
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

interface SourceEdge {
  sector: { id: string }
  loop: number
  index: number
  a: { x: number; z: number }
  b: { x: number; z: number }
  length: number
  next?: { id: string }
  cut: string
  thick: number
  u0: number
}
interface SourceSector {
  id: string
  loops: SourceEdge[][]
  points: { x: number; z: number }[][]
}
interface SourceModule {
  CLINIC_MAP: unknown
  SECTORS: SourceSector[]
  MASSES: unknown[]
  COLLIDERS: { edge: SourceEdge; y0: number; y1: number }[]
}

const sectors = (await import(pathToFileURL(join(source, 'src/game/sectors.ts')).href)) as SourceModule
const { CLINIC_MAP } = (await import(pathToFileURL(join(source, 'src/scenes/clinic/map.ts')).href)) as {
  CLINIC_MAP: unknown
}

const edge = (e: SourceEdge) => ({
  loop: e.loop,
  index: e.index,
  a: e.a,
  b: e.b,
  length: e.length,
  next: e.next?.id ?? null,
  cut: e.cut,
  thick: e.thick,
  u0: e.u0,
})
const resolved = {
  sourceCommit: commit,
  sectors: sectors.SECTORS.map((s) => ({
    id: s.id,
    points: s.points,
    loops: s.loops.map((loop) => loop.map(edge)),
  })),
  masses: sectors.MASSES,
  colliders: sectors.COLLIDERS.map((c) => ({
    sector: c.edge.sector.id,
    loop: c.edge.loop,
    index: c.edge.index,
    y0: c.y0,
    y1: c.y1,
  })),
}

const out = join(import.meta.dirname, '../src/testing/fixtures')
const header = `# The clinic map of the adventure source (provenance: the framework's docs/provenance/sources.md), converted once\n# by packages/sectors/scripts/convert-adventure-map.ts. Do not edit: it is SC-a's input.\n`
writeFileSync(join(out, 'clinic.sector-map.toml'), header + stringify(CLINIC_MAP as Record<string, unknown>))
writeFileSync(join(out, 'clinic.resolved.json'), `${JSON.stringify(resolved, null, 2)}\n`)
console.log(`converted the clinic map at ${commit}`)
