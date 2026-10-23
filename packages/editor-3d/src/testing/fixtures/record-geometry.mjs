// Records `geometry.golden.json`: The Last Light's own sector resolution and nav clearance (src/game/sectors.ts,
// level.ts, nav.ts) run over the four shipped blockouts, as `validate` binds them (`useMap`, `useLevel`). The input
// is the *expanded* data in `expand.golden.json`, so a mismatch later is the geometry's and never `expand`'s.
//
// Last Light's modules import each other without file extensions, which Node's type stripping cannot resolve, and
// pull in two generated clinic scene files. This script therefore works on a scratch copy of the three game files
// with `.ts` added to their relative imports and the two scene files stubbed (only the module-level `useMap` and
// `useLevel` calls the game makes at import need them). It reads the checkout and writes nothing there.
// Run with Node 22.18 or later:
//
//   node --experimental-strip-types src/testing/fixtures/record-geometry.mjs <Last Light checkout at 92e6704> src/testing/fixtures/expand.golden.json src/testing/fixtures/geometry.golden.json
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [checkout, expandGolden, out] = process.argv.slice(2)
const scratch = mkdtempSync(join(tmpdir(), 'll-geometry-'))

const withExtensions = (source) =>
  source.replace(/from '(\.{1,2}\/[^']*?)'/g, (whole, path) => (path.endsWith('.ts') ? whole : `from '${path}.ts'`))
const copy = (name) => {
  mkdirSync(join(scratch, 'src/game'), { recursive: true })
  writeFileSync(join(scratch, 'src/game', name), withExtensions(readFileSync(`${checkout}/src/game/${name}`, 'utf8')))
}
for (const name of ['sectors.ts', 'sector-format.ts', 'level.ts', 'nav.ts']) copy(name)
mkdirSync(join(scratch, 'src/scenes/clinic'), { recursive: true })
writeFileSync(join(scratch, 'package.json'), '{"type":"module"}\n')
writeFileSync(
  join(scratch, 'src/scenes/clinic/map.ts'),
  'export const CLINIC_MAP = { sectors: [], masses: [] }\nexport const SECTOR_DEFS = []\nexport const MASS_DEFS = []\n',
)
writeFileSync(
  join(scratch, 'src/scenes/clinic/level.ts'),
  [
    'export const CLINIC_LEVEL = { spawn: { x: 0, y: 0, z: 0, facing: 0 }, boxes: [], hotspots: [], lamps: [], nodes: {}, edges: [], patrol: [], bounce: [] }',
    'export const CURTAINS = {}',
    'export const FUSE_BOX = {}',
    'export const LEAK = {}',
    '',
  ].join('\n'),
)

try {
  const load = (file) => import(pathToFileURL(join(scratch, 'src/game', file)).href)
  const sectors = await load('sectors.ts')
  const level = await load('level.ts')
  const nav = await load('nav.ts')
  const expanded = JSON.parse(readFileSync(expandGolden, 'utf8'))

  const edgeOf = (e) => ({
    loop: e.loop,
    index: e.index,
    a: e.a,
    b: e.b,
    length: e.length,
    dir: e.dir,
    normal: e.normal,
    wall: e.wall,
    next: e.next ? e.next.id : null,
    u0: e.u0,
    thick: e.thick,
    cut: e.cut,
    trim: e.trim,
    prev: e.prev.index,
    succ: e.succ.index,
  })
  const at = (e) => ({ sector: e.sector.id, loop: e.loop, index: e.index })

  const golden = {}
  for (const name of ['clinic', 'clinic-dawn', 'bay', 'prologue']) {
    const x = expanded[`blockout-${name}`]
    sectors.useMap(x.sectors, x.masses)
    level.useLevel({
      spawn: x.spawn,
      boxes: x.boxes,
      hotspots: x.hotspots,
      lamps: x.lamps,
      nodes: x.nodes,
      edges: x.edges,
      patrol: x.patrol,
      bounce: x.bounce,
    })

    const map = {
      sectors: sectors.SECTORS.map(({ loops, ...rest }) => ({ ...rest, loops: loops.map((loop) => loop.map(edgeOf)) })),
      masses: sectors.MASSES,
      pieces: sectors.PIECES.map((p) => ({ ...at(p.edge), y0: p.y0, y1: p.y1, kind: p.kind })),
      colliders: sectors.COLLIDERS.map((c) => ({ ...at(c.edge), y0: c.y0, y1: c.y1 })),
      sightWalls: sectors.SIGHT_WALLS.map(at),
    }

    // `sectorAt` and `floorAt` on a 0.5 m grid over the plan's bounding box: the sector's index, or -1, and the floor.
    const points = sectors.SECTORS.flatMap((s) => s.points.flat())
    const [minX, maxX] = [Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x))]
    const [minZ, maxZ] = [Math.min(...points.map((p) => p.z)), Math.max(...points.map((p) => p.z))]
    const step = 0.5
    const grid = { step, x0: Math.floor(minX / step) * step, z0: Math.floor(minZ / step) * step, sector: [], floor: [] }
    for (let z = grid.z0; z <= maxZ + step; z += step) {
      const sectorRow = []
      const floorRow = []
      for (let px = grid.x0; px <= maxX + step; px += step) {
        const found = sectors.sectorAt({ x: px, z })
        sectorRow.push(found ? sectors.SECTORS.indexOf(found) : -1)
        floorRow.push(sectors.floorAt(px, z))
      }
      grid.sector.push(sectorRow)
      grid.floor.push(floorRow)
    }

    // The nav answers `validate` and the scene tests rely on, with every door open, with none, and walls only.
    const open = Object.fromEntries(
      [...x.boxes.filter((b) => b.kind === 'door').map((b) => b.id), ...x.edges.flatMap((e) => (e[2] ? [e[2]] : []))].map(
        (door) => [door, true],
      ),
    )
    const ids = Object.keys(x.nodes)
    const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]))
    const bits = (test) => pairs.map(([a, b]) => (test(x.nodes[a], x.nodes[b]) ? '1' : '0')).join('')
    const navAnswers = {
      nodes: ids,
      clearOpen: bits((a, b) => nav.clear(a, b, open, 0.3)),
      clearShut: bits((a, b) => nav.clear(a, b, {}, 0.3)),
      clearWalls: bits((a, b) => nav.clear(a, b, open, 0, true)),
      throughWall: bits((a, b) => nav.throughWall(a, b)),
      nearWall: ids.map((id) => (nav.nearAWall(x.nodes[id], 0.3) ? '1' : '0')).join(''),
      nearest: {
        spawn: nav.nearestNode(x.spawn, open),
        hotspots: Object.fromEntries(x.hotspots.map((h) => [h.id, nav.nearestNode(h, open)])),
        shut: nav.nearestNode(x.spawn, {}),
      },
    }
    // The golden is JSON, so it writes -0 as 0: round-trip before comparing.
    golden[`blockout-${name}`] = JSON.parse(JSON.stringify({ map, grid, nav: navAnswers }))
  }
  writeFileSync(out, `${JSON.stringify(golden)}\n`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
