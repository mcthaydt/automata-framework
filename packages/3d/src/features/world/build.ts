// The world builder: a `/2` level into renderer-free pieces (spec 9). Each room gives its floor and ceiling, its
// hinged door; each wall segment (sectors.ts) gives its face, its trim and what it carries, or, where rooms share it,
// the steps of a portal. Nothing here throws on a level it cannot build: a degenerate room, a missing swatch and a
// portal to nowhere are `LevelProblem`s, and the rest of the level still draws.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/map.ts (`mapPieces`) and build.ts at
// 6d82a52, the first-person view only: the diorama's cut-away belongs to the editor (a level is built whole). Changed:
// pieces name a surface, not a swatch id; a wall's opening (`door`, `window`) is cut out of its face; a room's holes
// are walled and left out of its floor; the shared stretch is found by geometry, as the builder did, and a wall's
// `next` must agree with it.

import { createRng } from '@automata/sim'
import type {
  AfSector2,
  AfSectorEntry2,
  AfWall2,
  Band,
  Decor,
  Surface,
  WindowGrid,
} from '../../shared/level/af-sector-2.schema.ts'
import type { Occlude } from '../../shared/level/occlude.ts'
import type { LevelProblem } from '../../shared/level/problem.ts'
import type { PartialTrim } from '../../shared/level/sector.schema.ts'
import { type MeshData, merge } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import { decorPieces, doorPieces } from './decor.ts'
import { box } from './mesh.ts'
import { placeProps, type WorldLamp } from './place-props.ts'
import { onWall, planeMesh, wallQuad } from './plane-mesh.ts'
import {
  cornersOf,
  fill,
  heightAt,
  inward,
  isDegenerate,
  ringsOf,
  type Segment,
  segments,
  type V2,
} from './sectors.ts'
import { isSurfaceTex, type TexPlace, texOf, tileName, wallFrame } from './surface.ts'
import { hasSwatch, type WorldLibrary } from './swatches.ts'

export type { WorldLibrary }

/** What a piece is a part of. Lamps are not pieces: they are `World.lamps`. */
export type WorldPart = 'floor' | 'ceiling' | 'wall' | 'decor' | 'prop'

/** One drawable thing: its mesh and the surface it is painted with, in the room it belongs to. */
export interface WorldPiece {
  /** `<room>:<role>` or `<room>:<role>:<place>`, stable for a given level. */
  readonly id: string
  /** The room's id. */
  readonly sector: string
  readonly part: WorldPart
  readonly mesh: MeshData
  /** A swatch name, or a swatch with its placement. */
  readonly surface: Surface
  /** How its tile is placed, when the surface gives a placement. */
  readonly tex?: TexPlace
  /** A wall face's line: where it stands on the plan, `a` to `b` with the room on its left, for the occluder rule. */
  readonly line?: { readonly a: V2; readonly b: V2 }
  /** What the occluder rule does with a wall face (`/2`'s `occlude`); a wall that says nothing is cut. */
  readonly occlude?: Occlude
  /** A hinged door's pivot and its swing at fully open (degrees about y); the mesh is built shut. */
  readonly door?: { readonly hinge: V3; readonly swing: number }
  /** Sways in the wind: how far (metres) its top moves, and its phase (leaves, grass, a curtain). */
  readonly sway?: number
  readonly phase?: number
  /** Casts no shadow: a thin or glowing part. */
  readonly noCast?: boolean
  /** A prop's part: the prop's id and where its base stands (world x, up, z), for a state that moves the prop. */
  readonly prop?: { readonly id: string; readonly at: V3 }
}

export interface World {
  readonly pieces: WorldPiece[]
  /** Every lamp: the level's own and the ones props carry, resolved against the lamp kit. */
  readonly lamps: WorldLamp[]
  readonly problems: LevelProblem[]
}

export interface WorldOptions {
  /** Windows are lit and shopfronts glow. Default: day. */
  readonly night?: boolean
  /** Lit windows show curtains, a plant, a figure. Default: yes. */
  readonly interiors?: boolean
}

// The first-person defaults the builder drew with when a wall or a plane named nothing.
const FLOOR = 'oakFloor'
const CEILING = 'plasterWarm'
const WALL = 'plasterWarm'
const TRIM = 'trimWhite'

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u
const offset = (p: V2, n: V2, d: number): V2 => [p[0] + n[0] * d, p[1] + n[1] * d]

/** A wall's trim heights and surface, from `trim` (heights or a surface), the sector's trim and the wall's own. */
function trimOf(sector: AfSectorEntry2, wall: AfWall2): { surface: Surface; skirting: number; rail: number } {
  const trim = wall.trim
  const heights: PartialTrim | undefined =
    trim === undefined || typeof trim === 'string' || isSurfaceTex(trim) ? undefined : trim
  return {
    surface: trim !== undefined && heights === undefined ? (trim as Surface) : TRIM,
    skirting: wall.skirting ?? heights?.skirting ?? sector.trim?.skirting ?? 0,
    rail: wall.rail ?? heights?.rail ?? sector.trim?.rail ?? 0,
  }
}

/** An opening in a wall's face: along the segment (0 to 1) and up from the floor (metres). */
interface Opening {
  readonly u0: number
  readonly u1: number
  readonly y0: number
  readonly y1: number
  readonly kind: 'door' | 'window'
  readonly bars?: number
}

export function buildWorld(level: AfSector2, library: WorldLibrary, options: WorldOptions = {}): World {
  const night = options.night === true
  const interiors = options.interiors !== false
  const pieces: WorldPiece[] = []
  const problems: LevelProblem[] = []
  const told = new Set<string>()
  const tell = (key: string, problem: LevelProblem): void => {
    if (told.has(key)) return
    told.add(key)
    problems.push(problem)
  }

  // A room that asks to be dressed is drawn bare: filling a room is the world-kit extension's, and core never fills it
  // some other way. The field stays in the format, so the level is one file for every game.
  if (level.dress?.keep !== false)
    level.sectors.forEach((sector, si) => {
      if ((sector.dress ?? level.dress) === undefined) return
      problems.push({
        path: sector.dress === undefined ? ['dress'] : ['sectors', si, 'dress'],
        code: 'needs-extension',
        message:
          'This room asks to be furnished by the world kit, which this game doesn\'t have. Add @automata/world-kit, or remove "dress" from the room.',
        where: sector.id,
        name: 'world-kit',
      })
    })

  /** Adds a piece, saying so once if its swatch is not in the library. */
  const add = (
    si: number,
    id: string,
    part: WorldPart,
    mesh: MeshData,
    surface: Surface,
    tex?: TexPlace,
    extra: Pick<WorldPiece, 'door' | 'line' | 'occlude' | 'sway' | 'phase' | 'noCast' | 'prop'> = {},
  ): void => {
    const sector = level.sectors[si] as AfSectorEntry2
    const name = tileName(surface)
    if (!hasSwatch(library, name))
      tell(`swatch:${sector.id}:${name}`, {
        path: ['sectors', si],
        code: 'unknown-swatch',
        message: `room "${sector.id}" uses the swatch "${name}", which the library does not have`,
        where: sector.id,
        name,
      })
    pieces.push({
      id: `${sector.id}:${id}`,
      sector: sector.id,
      part,
      mesh,
      surface,
      ...(tex === undefined ? {} : { tex }),
      ...extra,
    })
  }

  // --- the shell of each room ---
  level.sectors.forEach((sector, si) => {
    if (isDegenerate(sector)) {
      tell(`degenerate:${si}`, {
        path: ['sectors', si],
        code: 'degenerate-sector',
        message: `room "${sector.id}" has no area (fewer than three corners, or all in a line), so it is left out`,
        where: sector.id,
      })
      return
    }
    const [outline, ...holes] = ringsOf(sector) as [V2[], ...V2[][]]
    const origin = outline[0] as V2
    const { points, triangles } = fill(outline, holes)
    const floor: Surface = sector.floor.surface ?? sector.floorTexture ?? FLOOR
    add(
      si,
      'floor',
      'floor',
      planeMesh(points, triangles, sector.floor, origin, false),
      floor,
      texOf(floor, 'plane'),
    )
    if (sector.ceiling.sky !== true) {
      const ceiling: Surface = sector.ceiling.surface ?? sector.ceilingTexture ?? CEILING
      add(
        si,
        'ceiling',
        'ceiling',
        planeMesh(points, triangles, sector.ceiling, origin, true),
        ceiling,
        texOf(ceiling, 'plane'),
      )
    }
    if (sector.door !== undefined)
      for (const piece of doorPieces(sector, outline, sector.door))
        add(si, piece.role, 'decor', piece.mesh, piece.material, undefined, {
          door: { hinge: piece.hinge, swing: piece.swing },
        })
  })

  // --- the walls: each segment of each room's edges ---
  const all = segments(level)
  const seen = new Map<string, number>()
  const neighbours = new Map<string, Set<string>>()
  for (const seg of all) {
    const key = `${seg.sector}.${seg.ring}.${seg.edge}`
    if (seg.next >= 0) {
      const set = neighbours.get(key) ?? new Set<string>()
      set.add((level.sectors[seg.next] as AfSectorEntry2).id)
      neighbours.set(key, set)
    }
  }
  // A wall that names a portal must name a room that shares it.
  level.sectors.forEach((sector, si) => {
    if (isDegenerate(sector)) return
    ringsOf(sector).forEach((_, ring) => {
      cornersOf(sector, ring).forEach((corner, edge) => {
        const next = corner[2]?.next
        if (next === undefined || neighbours.get(`${si}.${ring}.${edge}`)?.has(next) === true) return
        const known = level.sectors.some((other) => other.id === next)
        tell(`portal:${si}.${ring}.${edge}`, {
          path: ['sectors', si, ring === 0 ? 'corners' : 'holes', edge, 2, 'next'],
          code: 'portal-not-shared',
          message: known
            ? `the wall of "${sector.id}" is a portal to "${next}", but the two rooms share no wall there`
            : `the wall of "${sector.id}" is a portal to "${next}", and the level has no room by that name`,
          where: sector.id,
          name: next,
        })
      })
    })
  })

  for (const seg of all) {
    const sector = level.sectors[seg.sector] as AfSectorEntry2
    const stretch = seen.get(`${seg.sector}.${seg.ring}.${seg.edge}`) ?? 0
    seen.set(`${seg.sector}.${seg.ring}.${seg.edge}`, stretch + 1)
    const place = `${seg.ring}.${seg.edge}.${stretch}`
    const wall: AfWall2 = cornersOf(sector, seg.ring)[seg.edge]?.[2] ?? {}
    const n = inward(level, seg)
    const origin = (ringsOf(sector)[0] as V2[])[0] as V2
    const floorAt = (p: V2): number => heightAt(sector.floor, origin, p[0], p[1])
    const ceilingAt = (p: V2): number => heightAt(sector.ceiling, origin, p[0], p[1])
    const [fa, fb, ca, cb] = [floorAt(seg.a), floorAt(seg.b), ceilingAt(seg.a), ceilingAt(seg.b)]
    const length = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1])
    const surface: Surface = wall.surface ?? sector.wallTexture ?? WALL
    const trim = trimOf(sector, wall)
    // The wall's own frame: a tile placed on it starts at its start, seen from the room.
    const u: V2 = [n[1], -n[0]]
    const from = (seg.b[0] - seg.a[0]) * u[0] + (seg.b[1] - seg.a[1]) * u[1] > 0 ? seg.a : seg.b
    const frame = wallFrame(from, floorAt(from), n)
    const tex = (s: Surface | undefined): TexPlace | undefined => texOf(s, 'wall', frame)
    /** The wall from `u0` to `u1`, between `low` and `high` above the floor (the floor or the ceiling when `null`), a hair out. */
    const strip = (u0: number, u1: number, low: number | null, high: number | null, out = 0): MeshData => {
      const [a, b] = [offset(seg.a, n, out), offset(seg.b, n, out)]
      const at = (u: number): V2 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]
      const [pa, pb] = [at(u0), at(u1)]
      const [fl0, fl1] = [lerp(fa, fb, u0), lerp(fa, fb, u1)]
      const [cl0, cl1] = [lerp(ca, cb, u0), lerp(ca, cb, u1)]
      return wallQuad(
        pa,
        pb,
        [low === null ? fl0 : fl0 + low, high === null ? cl0 : fl0 + high],
        [low === null ? fl1 : fl1 + low, high === null ? cl1 : fl1 + high],
        n,
      )
    }
    const role = (name: string): string => `${name}:${place}`

    if (seg.next < 0) {
      if (wall.none === true) continue
      // Openings cut from the face: the edge's metres (`door.at`, `window.at`) from the edge's start, here from this segment's.
      const edgeLength = length / (seg.t1 - seg.t0)
      const openings: Opening[] = []
      const open = (
        at: number,
        width: number,
        y0: number,
        y1: number,
        kind: Opening['kind'],
        bars?: number,
      ): void => {
        const start = at - width / 2 - seg.t0 * edgeLength
        const [u0, u1] = [Math.max(0, start / length), Math.min(1, (start + width) / length)]
        if (u1 - u0 > 1e-6) openings.push({ u0, u1, y0, y1, kind, ...(bars === undefined ? {} : { bars }) })
      }
      if (wall.door !== undefined) open(wall.door.at, wall.door.width, 0, wall.door.height, 'door')
      if (wall.window !== undefined)
        open(wall.window.at, wall.window.width, wall.window.y0, wall.window.y1, 'window', wall.window.bars)
      openings.sort((p, q) => p.u0 - q.u0)
      const face: MeshData[] = []
      let cursor = 0
      for (const o of openings) {
        if (o.u0 > cursor + 1e-6) face.push(strip(cursor, o.u0, null, null))
        face.push(strip(o.u0, o.u1, o.y1, null))
        if (o.y0 > 1e-6) face.push(strip(o.u0, o.u1, null, o.y0))
        cursor = Math.max(cursor, o.u1)
      }
      if (cursor < 1 - 1e-6) face.push(strip(cursor, 1, null, null))
      add(seg.sector, role('wall'), 'wall', merge(...face), surface, tex(surface), {
        line: roomOnLeft(seg, n),
        ...(wall.occlude === undefined ? {} : { occlude: wall.occlude }),
      })

      // Panes and bars in a window's opening.
      for (const [i, o] of openings.entries()) {
        if (o.kind !== 'window') continue
        const pane = night ? 'glassNight' : 'glassDay'
        add(seg.sector, role(`pane${i}`), 'decor', strip(o.u0, o.u1, o.y0, o.y1, -0.06), pane)
        const bars = o.bars ?? 0
        for (let k = 1; k <= bars; k++) {
          const u = lerp(o.u0, o.u1, k / (bars + 1))
          const p = offset([lerp(seg.a[0], seg.b[0], u), lerp(seg.a[1], seg.b[1], u)], n, -0.05)
          add(
            seg.sector,
            role(`bar${i}.${k}`),
            'decor',
            onWall(box([0, o.y0, 0], [0.03, o.y1 - o.y0, 0.03]), p, lerp(fa, fb, u), n),
            trim.surface,
          )
        }
      }

      // What the wall carries, by where along it (the dominant axis, as the builder's maps wrote it).
      const horizontal = Math.abs(seg.b[0] - seg.a[0]) > Math.abs(seg.b[1] - seg.a[1])
      const axis = horizontal ? 0 : 1
      const along = (p: number): V2 => {
        const t = (p - seg.a[axis]) / (seg.b[axis] - seg.a[axis])
        return [lerp(seg.a[0], seg.b[0], t), lerp(seg.a[1], seg.b[1], t)]
      }
      const within = (p: number): boolean =>
        p >= Math.min(seg.a[axis], seg.b[axis]) - 1e-6 && p <= Math.max(seg.a[axis], seg.b[axis]) + 1e-6
      const decor: Decor[] = [...(wall.decor ?? [])]
      if (wall.windows !== undefined) decor.push(...windowsOf(wall.windows, seg, night, horizontal))
      const doors = [
        ...decor
          .filter((d) => d.kind === 'door' && within(d.pos))
          .map((d) => ({ pos: d.pos, width: d.width })),
        ...openings
          .filter((o) => o.kind === 'door')
          .map((o) => ({ pos: along2(seg, axis, (o.u0 + o.u1) / 2), width: (o.u1 - o.u0) * length })),
      ].sort((p, q) => p.pos - q.pos)

      if (trim.skirting > 0) {
        const dir = Math.sign(seg.b[axis] - seg.a[axis]) || 1
        const ordered = dir > 0 ? doors : [...doors].reverse()
        const runs: [V2, V2][] = []
        let start = seg.a
        for (const d of ordered) {
          runs.push([start, along(d.pos - dir * (d.width / 2 + 0.08))])
          start = along(d.pos + dir * (d.width / 2 + 0.08))
        }
        runs.push([start, seg.b])
        const meshes = runs
          .filter(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.02)
          .map(([p, q]) =>
            wallQuad(
              offset(p, n, 0.02),
              offset(q, n, 0.02),
              [fa, fa + trim.skirting],
              [fb, fb + trim.skirting],
              n,
            ),
          )
        if (meshes.length > 0)
          add(seg.sector, role('skirting'), 'wall', merge(...meshes), trim.surface, tex(trim.surface))
      }
      const band = (name: string, mesh: MeshData, surface: Surface): void =>
        add(seg.sector, role(name), 'wall', mesh, surface, tex(surface))
      if (wall.dado !== undefined) band('dado', strip(0, 1, 0, wall.dado.height, 0.006), wall.dado.surface)
      if (trim.rail > 0) band('rail', strip(0, 1, trim.rail, trim.rail + 0.06, 0.025), trim.surface)
      if (wall.cornice !== undefined)
        band('cornice', corniceOf(wall.cornice, seg, n, [ca, cb]), wall.cornice.surface)

      for (const d of decor) {
        if (!within(d.pos)) continue
        const o = along(d.pos)
        const base = heightAt(sector.floor, origin, o[0], o[1])
        for (const piece of decorPieces(d, night, tileName(trim.surface), interiors))
          add(
            seg.sector,
            `${piece.role}:${place}.${d.pos}`,
            'decor',
            onWall(piece.mesh, o, base, n),
            piece.material,
          )
      }
      continue
    }

    // A portal: the steps where the neighbour's floor is higher or its ceiling lower.
    const next = level.sectors[seg.next] as AfSectorEntry2
    const nextOrigin = (ringsOf(next)[0] as V2[])[0] as V2
    const [nfa, nfb] = [
      heightAt(next.floor, nextOrigin, ...seg.a),
      heightAt(next.floor, nextOrigin, ...seg.b),
    ]
    const [nca, ncb] = [
      heightAt(next.ceiling, nextOrigin, ...seg.a),
      heightAt(next.ceiling, nextOrigin, ...seg.b),
    ]
    if (nfa > fa + 1e-3 || nfb > fb + 1e-3) {
      const lower: Surface = wall.lower ?? surface
      add(
        seg.sector,
        role('lower'),
        'wall',
        wallQuad(seg.a, seg.b, [fa, Math.max(fa, nfa)], [fb, Math.max(fb, nfb)], n),
        lower,
        tex(lower),
      )
    }
    const skyBoth = sector.ceiling.sky === true && next.ceiling.sky === true
    // An indoor doorway gets a frame: two jambs and a head in the trim, standing proud of the wall on this side.
    if (sector.ceiling.sky !== true && next.ceiling.sky !== true && nca < ca - 1e-3 && length < 2.2) {
      const top = nca - fa
      const f = 0.07
      const mesh = merge(
        box([-f / 2, 0, 0.015], [f, top + f, 0.03]),
        box([length + f / 2, 0, 0.015], [f, top + f, 0.03]),
        box([length / 2, top, 0.015], [length + 2 * f, f, 0.03]),
      )
      add(
        seg.sector,
        role('doorway'),
        'wall',
        onWall(mesh, from, floorAt(from), n),
        trim.surface,
        tex(trim.surface),
      )
    }
    if (!skyBoth && (nca < ca - 1e-3 || ncb < cb - 1e-3)) {
      const upper: Surface = wall.upper ?? surface
      add(
        seg.sector,
        role('upper'),
        'wall',
        wallQuad(seg.a, seg.b, [Math.min(ca, nca), ca], [Math.min(cb, ncb), cb], n),
        upper,
        tex(upper),
      )
    }
  }

  // --- props and lamps ---
  const placed = placeProps(level, library, tell)
  for (const piece of placed.pieces)
    add(piece.sector, `prop:${piece.role}`, 'prop', piece.mesh, piece.surface, piece.tex, {
      ...(piece.sway === undefined ? {} : { sway: piece.sway }),
      ...(piece.phase === undefined ? {} : { phase: piece.phase }),
      ...(piece.noCast === true ? { noCast: true } : {}),
      ...(piece.prop === undefined ? {} : { prop: piece.prop }),
    })
  return { pieces, lamps: placed.lamps, problems }
}

/** The segment as the occluder rule reads a wall: from `a` to `b` with the room on the left. */
function roomOnLeft(seg: Segment, n: V2): { a: V2; b: V2 } {
  const left: V2 = [-(seg.b[1] - seg.a[1]), seg.b[0] - seg.a[0]]
  return left[0] * n[0] + left[1] * n[1] > 0 ? { a: seg.a, b: seg.b } : { a: seg.b, b: seg.a }
}

/** The coordinate along the dominant axis at `u` of the segment. */
const along2 = (seg: Segment, axis: 0 | 1, u: number): number => lerp(seg.a[axis], seg.b[axis], u)

/** The cornice: a band under the ceiling, in its own surface; it is not broken at doors and windows. */
function corniceOf(band: Band, seg: Segment, n: V2, ceilings: readonly [number, number]): MeshData {
  return wallQuad(
    offset(seg.a, n, 0.025),
    offset(seg.b, n, 0.025),
    [ceilings[0] - band.height, ceilings[0]],
    [ceilings[1] - band.height, ceilings[1]],
    n,
  )
}

/** A facade's grid of windows as decor, lit by a seeded share at night. */
function windowsOf(grid: WindowGrid, seg: Segment, night: boolean, horizontal: boolean): Decor[] {
  const rng = createRng(grid.seed ?? seg.sector * 31 + seg.edge)
  const out: Decor[] = []
  for (let row = 0; row < grid.rows; row++)
    for (let col = 0; col < grid.cols; col++) {
      const t = (col + 0.5) / grid.cols
      const pos = horizontal ? lerp(seg.a[0], seg.b[0], t) : lerp(seg.a[1], seg.b[1], t)
      const lit = night && rng.next() < (grid.lit ?? 0.5)
      out.push({
        kind: 'window',
        pos,
        width: grid.width,
        height: grid.height,
        sill: grid.from + row * (grid.height + grid.gap),
        lit,
        ...(grid.frame === undefined ? {} : { frame: grid.frame }),
        ...(lit && grid.glassLit !== undefined
          ? { glass: grid.glassLit }
          : grid.glass === undefined || lit
            ? {}
            : { glass: grid.glass }),
        seed: Math.floor(rng.next() * 1e6),
      })
    }
  return out
}
