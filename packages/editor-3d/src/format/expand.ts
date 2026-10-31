// Extracted from The Last Light scripts/pipeline/blockout-format.ts (92e6704): the expansion of a blockout into
// the engine's own data (sectors with their walls, masses, boxes, hotspots, lamps, the nav graph and the zones).
// Pure data in, pure data out. The expanded sectors are what the plan, dollhouse and walk views draw, and what
// the checks measure. Last Light's `expand` tests come with it (expand.test.ts).
import type {
  Anchor,
  Blockout,
  BlockoutBox,
  BlockoutCorner,
  BlockoutHotspot,
  BlockoutLamp,
  NavEdge,
  On,
  Opening,
  Room,
  Spawn,
  Style,
  WallRef,
  ZoneSpec,
} from './blockout.schema'
import type { Corner, MassDef, Point, SectorDef, WallDef } from './sector.schema'

export type Box = Omit<BlockoutBox, 'role'>
export type Hotspot = Omit<BlockoutHotspot, 'on'>
export type Lamp = Omit<BlockoutLamp, 'on'>

/** The blockout as engine data, before code generation. */
export interface Expanded {
  readonly sectors: readonly SectorDef[]
  readonly masses: readonly MassDef[]
  readonly spawn: Spawn
  readonly boxes: readonly Box[]
  readonly hotspots: readonly Hotspot[]
  readonly lamps: readonly Lamp[]
  readonly bounce: readonly (readonly [number, number, number])[]
  readonly nodes: Readonly<Record<string, Point>>
  readonly edges: readonly NavEdge[]
  readonly patrol: readonly string[]
  readonly zones: readonly ZoneSpec[]
  readonly anchors: Readonly<Record<string, Anchor>>
}

/** Where an opening ended up: the wall axis, and each side's wall line with its inward direction. */
export interface OpeningLine {
  readonly axis: 'x' | 'z'
  readonly span: readonly [number, number]
  readonly from: { readonly at: number; readonly inward: number }
  readonly to: { readonly at: number; readonly inward: number }
}

/** The file cannot be expanded: an unknown name, or an opening no pair of facing walls covers. */
export class BlockoutError extends Error {}

type WallPresets = Readonly<Record<string, WallDef>>

const EPS = 1e-6
const near = (a: number, b: number) => Math.abs(a - b) < EPS

/** The corner at `index`, wrapping round the loop: the wall from the last corner runs to the first. */
function cornerAt(loop: readonly Corner[], index: number): Corner {
  const corner = loop[index % loop.length]
  if (corner === undefined) throw new BlockoutError('a loop of corners is empty')
  return corner
}

/** A wall as written, resolved: a string names a cutaway group, an object may start from a preset. */
export function wallOf(ref: WallRef | undefined, presets: WallPresets = {}): WallDef | undefined {
  if (ref === undefined) return undefined
  if (typeof ref === 'string') return { cut: ref }
  const { preset, ...rest } = ref
  if (preset === undefined) return { ...rest }
  const base = presets[preset]
  if (!base) throw new BlockoutError(`unknown wall preset ${preset}`)
  return { ...base, ...rest }
}

function resolveCorner([x, z, ref]: BlockoutCorner, presets: WallPresets): Corner {
  const wall = wallOf(ref, presets)
  return wall ? [x, z, wall] : [x, z]
}

/** `fields` with the look of the named style underneath them (the room's own fields win). */
function styled<T extends object>(
  fields: T,
  style: string | undefined,
  styles: Readonly<Record<string, Style>> = {},
) {
  if (style === undefined) return fields
  const look = styles[style]
  if (!look) throw new BlockoutError(`unknown style ${style}`)
  return { ...look, ...fields }
}

export function roomSector(room: Room, blockout: Pick<Blockout, 'styles' | 'walls'>): SectorDef {
  const { style, corners, holes, ...fields } = room
  const presets = blockout.walls ?? {}
  const sector: SectorDef = {
    ...styled(fields, style, blockout.styles),
    corners: corners.map((corner) => resolveCorner(corner, presets)),
  }
  if (holes) sector.holes = holes.map((hole) => hole.map((corner) => resolveCorner(corner, presets)))
  return sector
}

// ── Openings ──────────────────────────────────────────────────────────────

/** An axis-aligned solid edge of a sector: `axis` is the coordinate that varies along the wall, `at` the fixed one. */
interface Run {
  loop: Corner[]
  index: number
  axis: 'x' | 'z'
  at: number
  lo: number
  hi: number
  inward: number
}

function runs(sector: SectorDef): Run[] {
  const found: Run[] = []
  for (const loop of [sector.corners, ...(sector.holes ?? [])]) {
    const area =
      loop.reduce((sum, [x, z], i) => {
        const [x2, z2] = cornerAt(loop, i + 1)
        return sum + x * z2 - x2 * z
      }, 0) / 2
    // The inward normal of a counter-clockwise loop (x right, z up) is the direction rotated left; flip for clockwise.
    const sign = area > 0 ? 1 : -1
    loop.forEach(([x, z, wall], index) => {
      if (wall?.next) return
      const [x2, z2] = cornerAt(loop, index + 1)
      if (near(z, z2) && !near(x, x2)) {
        found.push({
          loop,
          index,
          axis: 'x',
          at: z,
          lo: Math.min(x, x2),
          hi: Math.max(x, x2),
          inward: Math.sign(x2 - x) * sign,
        })
      } else if (near(x, x2) && !near(z, z2)) {
        found.push({
          loop,
          index,
          axis: 'z',
          at: x,
          lo: Math.min(z, z2),
          hi: Math.max(z, z2),
          inward: -Math.sign(z2 - z) * sign,
        })
      }
    })
  }
  return found
}

/** Splits a loop's edge so [s0, s1] along it becomes a portal, keeping the edge's wall on the pieces either side. */
function split(run: Run, [s0, s1]: readonly [number, number], portal: WallDef) {
  const { loop, index, axis } = run
  const [x, z, wall] = cornerAt(loop, index)
  const [x2, z2] = cornerAt(loop, index + 1)
  const start = axis === 'x' ? x : z
  const end = axis === 'x' ? x2 : z2
  const [first, second] = end > start ? [s0, s1] : [s1, s0]
  const at = (s: number): [number, number] => (axis === 'x' ? [s, z] : [x, s])
  const replacement: Corner[] = []
  if (near(first, start)) replacement.push([x, z, portal])
  else replacement.push(wall ? [x, z, wall] : [x, z], [...at(first), portal])
  if (!near(second, end)) replacement.push(wall ? [...at(second), { ...wall }] : at(second))
  loop.splice(index, 1, ...replacement)
}

export function applyOpenings(
  sectors: readonly SectorDef[],
  blockout: Pick<Blockout, 'openings' | 'styles' | 'walls'>,
): { sectors: SectorDef[]; lines: Record<string, OpeningLine> } {
  const connectors: SectorDef[] = []
  const lines: Record<string, OpeningLine> = {}
  for (const opening of blockout.openings ?? []) {
    const from = sectors.find((sector) => sector.id === opening.from)
    const to = sectors.find((sector) => sector.id === opening.to)
    if (!from || !to)
      throw new BlockoutError(`opening ${opening.id}: unknown room ${from ? opening.to : opening.from}`)
    const span: readonly [number, number] = [Math.min(...opening.span), Math.max(...opening.span)]
    const [s0, s1] = span
    const pairs: { fromRun: Run; toRun: Run; gap: number }[] = []
    for (const fromRun of runs(from)) {
      for (const toRun of runs(to)) {
        const covers = (run: Run) => run.lo <= s0 + EPS && run.hi >= s1 - EPS
        if (fromRun.axis !== toRun.axis || !covers(fromRun) || !covers(toRun)) continue
        const gap = (toRun.at - fromRun.at) * -fromRun.inward
        // They face each other: `to` lies outside `from`'s wall, and `from` outside `to`'s, at most 0.5 m apart.
        if (gap < -EPS || gap > 0.5 + EPS || fromRun.inward !== -toRun.inward) continue
        pairs.push({ fromRun, toRun, gap: Math.max(0, gap) })
      }
    }
    const [pair] = pairs
    if (pairs.length !== 1 || !pair) {
      throw new BlockoutError(
        `opening ${opening.id}: ${pairs.length ? 'more than one' : 'no'} pair of facing axis-aligned walls of ${opening.from} and ${opening.to} covers ${s0}…${s1}`,
      )
    }
    const { fromRun, toRun, gap } = pair
    const direct = gap < EPS
    lines[opening.id] = {
      axis: fromRun.axis,
      span,
      from: { at: fromRun.at, inward: fromRun.inward },
      to: { at: toRun.at, inward: toRun.inward },
    }
    split(fromRun, span, { next: direct ? opening.to : opening.id })
    split(toRun, span, { next: direct ? opening.from : opening.id })
    if (!direct) connectors.push(connector(opening, span, from, to, fromRun, toRun, blockout))
  }
  return { sectors: [...sectors, ...connectors], lines }
}

/**
 * The sector that fills the gap between two facing walls. Its corners start at the north-west corner and go east
 * first, the order the clinic's doorway and the Bay's morDoor use.
 */
function connector(
  opening: Opening,
  [s0, s1]: readonly [number, number],
  from: SectorDef,
  to: SectorDef,
  fromRun: Run,
  toRun: Run,
  blockout: Pick<Blockout, 'styles' | 'walls'>,
): SectorDef {
  const side = wallOf(opening.side, blockout.walls ?? {})
  const lo = Math.min(fromRun.at, toRun.at)
  const hi = Math.max(fromRun.at, toRun.at)
  const roomAt = (coordinate: number) => (near(coordinate, fromRun.at) ? opening.from : opening.to)
  const sideCorner = (x: number, z: number): Corner => (side ? [x, z, { ...side }] : [x, z])
  const corners: Corner[] =
    fromRun.axis === 'x'
      ? [
          [s0, lo, { next: roomAt(lo) }],
          sideCorner(s1, lo),
          [s1, hi, { next: roomAt(hi) }],
          sideCorner(s0, hi),
        ]
      : [
          sideCorner(lo, s0),
          [hi, s0, { next: roomAt(hi) }],
          sideCorner(hi, s1),
          [lo, s1, { next: roomAt(lo) }],
        ]
  const base = {
    id: opening.id,
    zone: opening.zone ?? from.zone,
    floor: opening.floor ?? from.floor,
    ceiling: opening.ceiling ?? Math.min(from.ceiling, to.ceiling),
    light: opening.light ?? 1,
  }
  const open = opening.open === undefined ? {} : { open: opening.open }
  return { ...styled({ ...base, ...open }, opening.style, blockout.styles), corners }
}

// ── Nav derivation ────────────────────────────────────────────────────────

function insideLoop(point: Point, loop: readonly Corner[]) {
  let inside = false
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const [xi, zi] = cornerAt(loop, i)
    const [xj, zj] = cornerAt(loop, j)
    if (zi > point.z !== zj > point.z && point.x < ((xj - xi) * (point.z - zi)) / (zj - zi) + xi)
      inside = !inside
  }
  return inside
}

function distanceToSegment(point: Point, [ax, az]: Corner, [bx, bz]: Corner) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.z - az) * dz) / lengthSquared))
    : 0
  return Math.hypot(point.x - ax - dx * t, point.z - az - dz * t)
}

/** The point of a room farthest from its walls and clear of boxes, on a 5 cm grid (a pole of inaccessibility). */
function pole(sector: SectorDef, boxes: readonly Box[]): Point {
  const xs = sector.corners.map((corner) => corner[0])
  const zs = sector.corners.map((corner) => corner[1])
  const loops = [sector.corners, ...(sector.holes ?? [])]
  let best = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
  let bestDistance = -1
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.05) {
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 0.05) {
      const point = { x: Math.round(x * 100) / 100 + 0, z: Math.round(z * 100) / 100 + 0 }
      if (!insideLoop(point, sector.corners) || (sector.holes ?? []).some((hole) => insideLoop(point, hole)))
        continue
      let distance = Math.min(
        ...loops.flatMap((loop) =>
          loop.map((corner, i) => distanceToSegment(point, corner, cornerAt(loop, i + 1))),
        ),
      )
      for (const box of boxes) {
        distance = Math.min(
          distance,
          Math.max(Math.abs(point.x - box.x) - box.w / 2, Math.abs(point.z - box.z) - box.d / 2),
        )
      }
      if (distance > bestDistance + EPS) {
        bestDistance = distance
        best = point
      }
    }
  }
  return best
}

/** Nodes at each room's pole and 0.5 m out either side of each opening; edges room ↔ opening side, and across each opening. */
export function deriveNav(
  sectors: readonly SectorDef[],
  openings: readonly Opening[],
  lines: Readonly<Record<string, OpeningLine>>,
  boxes: readonly Box[],
): { nodes: Record<string, Point>; edges: NavEdge[] } {
  const nodes: Record<string, Point> = {}
  const edges: NavEdge[] = []
  for (const sector of sectors.filter((candidate) => !lines[candidate.id]))
    nodes[sector.id] = pole(sector, boxes)
  for (const opening of openings) {
    const line = lines[opening.id]
    if (!line) throw new BlockoutError(`opening ${opening.id} was never placed`)
    const middle = (line.span[0] + line.span[1]) / 2
    for (const [room, side] of [
      [opening.from, line.from],
      [opening.to, line.to],
    ] as const) {
      const at = side.at + 0.5 * side.inward
      nodes[`${opening.id}:${room}`] = line.axis === 'x' ? { x: middle, z: at } : { x: at, z: middle }
      edges.push([room, `${opening.id}:${room}`])
    }
    const sideNodes = [`${opening.id}:${opening.from}`, `${opening.id}:${opening.to}`] as const
    edges.push(opening.door ? [...sideNodes, opening.door] : [...sideNodes])
  }
  return { nodes, edges }
}

// ── The whole expansion ───────────────────────────────────────────────────

const withoutOn = <T extends { on?: On | undefined }>({ on: _on, ...rest }: T) => rest

export function expand(blockout: Blockout): Expanded {
  const rooms = blockout.rooms.map((room) => roomSector(room, blockout))
  const { sectors, lines } = applyOpenings(rooms, blockout)
  const boxes: Box[] = blockout.boxes.map(({ role: _role, ...box }) => box)
  const derived =
    blockout.nav.derive === false
      ? { nodes: {} as Record<string, Point>, edges: [] as NavEdge[] }
      : deriveNav(sectors, blockout.openings ?? [], lines, boxes)
  const isDropped = (edge: NavEdge) =>
    (blockout.nav.drop ?? []).some(
      ([p, q]) => (edge[0] === p && edge[1] === q) || (edge[0] === q && edge[1] === p),
    )
  const nodes: Record<string, Point> = { ...derived.nodes }
  for (const [id, node] of Object.entries(blockout.nav.nodes ?? {})) nodes[id] = withoutOn(node)
  return {
    sectors,
    masses: blockout.masses ?? [],
    spawn: blockout.spawn,
    boxes,
    hotspots: blockout.hotspots.map(withoutOn),
    lamps: blockout.lamps.map(withoutOn),
    bounce: blockout.bounce ?? [],
    nodes,
    edges: [...derived.edges.filter((edge) => !isDropped(edge)), ...(blockout.nav.edges ?? [])],
    patrol: blockout.nav.patrol ?? [],
    zones: blockout.zones,
    anchors: blockout.anchors ?? {},
  }
}
