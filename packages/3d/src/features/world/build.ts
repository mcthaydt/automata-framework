// The world builder: a `/2` level into renderer-free pieces. Each room gives its floor and ceiling, its hinged door;
// each wall segment (sectors.ts) gives its face, its trim and what it carries, or, where rooms share it, the steps of a
// portal. Nothing here throws on a level it cannot build: a degenerate room, a missing swatch and a portal to nowhere
// are `LevelProblem`s, and the rest of the level still draws. Changed: pieces name a surface, not a swatch id; a wall's
// opening (`door`, `window`) is cut out of its face; a room's holes are walled and left out of its floor; the shared
// stretch is found by geometry, as the builder did, and a wall's `next` must agree with it.

import type {
  AfSector2,
  AfSectorEntry2,
  AfWall2,
  Decor,
  Surface,
} from '../../shared/level/af-sector-2.schema.ts'
import type { Occlude } from '../../shared/level/occlude.ts'
import type { LevelProblem } from '../../shared/level/problem.ts'
import { type MeshData, merge } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import { decorPieces, doorPieces } from './decor.ts'
import { box } from './mesh.ts'
import { wallOfMounted } from './mounting.ts'
import { type PlacedProp, placeProps, type WorldLamp } from './place-props.ts'
import { onWall, planeMesh, wallQuad } from './plane-mesh.ts'
import { viewRoomProblems } from './room-draw.ts'
import { cornersOf, fill, heightAt, inward, isDegenerate, ringsOf, segments, type V2 } from './sectors.ts'
import { subdivide } from './subdivide.ts'
import { type TexPlace, texOf, tileName, wallFrame } from './surface.ts'
import { hasSwatch, type WorldLibrary } from './swatches.ts'
import { along2, corniceOf, lerp, type Opening, offset, roomOnLeft, trimOf, windowsOf } from './wall-parts.ts'

export type { WorldLibrary }

/** What a piece is a part of. Lamps are not pieces: they are `World.lamps`. */
export type WorldPart = 'floor' | 'ceiling' | 'wall' | 'decor' | 'prop'

/** A solid rectangle of a wall face: its plan line `a` to `b`, and the heights (metres from the world's floor) it spans. */
export interface WallFace {
  readonly a: V2
  readonly b: V2
  readonly lo: number
  readonly hi: number
}

/** One drawable thing: its mesh and the surface it is painted with, in the room it belongs to. */
export interface WorldPiece {
  /** `<room>:<role>` or `<room>:<role>:<place>`, stable for a given level. */
  readonly id: string
  /** The room's id. */
  readonly sector: string
  /** The room's shade, as the level states it (1 is normal, lower is darker): the light baked into the piece takes it. */
  readonly light: number
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
  /**
   * The wall piece a prop's part hangs on (a frame, a pinboard, a radiator, a vent): it carries that wall's `occlude` and
   * the occluder rule takes it out of the way with the wall, so the back of a thin box never draws as a flat slab.
   */
  readonly onWall?: string
  /**
   * The solid parts of a wall face, each a rectangle on the plan line between two heights (the face with its doorways and
   * windows cut out), so the light's occluders let light through an opening. A wall with none has one over its whole face.
   */
  readonly faces?: readonly WallFace[]
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

/** A placed prop in its room: `PlacedProp` with the room's id. */
export interface WorldProp extends Omit<PlacedProp, 'sector'> {
  readonly sector: string
}

export interface World {
  readonly pieces: WorldPiece[]
  /**
   * Every prop the library could build, with the blockout box its generated parts fill and the model it names. The
   * generated pieces stay in `pieces` whether or not a model replaces them on screen (`drawWorld`), so the footprint,
   * the height and the collider are the blockout's either way.
   */
  readonly props: WorldProp[]
  /** Every lamp: the level's own and the ones props carry, resolved against the lamp kit. */
  readonly lamps: WorldLamp[]
  readonly problems: LevelProblem[]
}

export interface WorldOptions {
  /** Windows are lit and shopfronts glow. Default: day. */
  readonly night?: boolean
  /** Lit windows show curtains, a plant, a figure. Default: yes. */
  readonly interiors?: boolean
  /**
   * The longest edge (metres) a piece that takes baked light is cut to, so the baked vertex light has a vertex wherever a
   * lamp's pool or a shadow's edge falls (the look's `seg`). A prop is cut too: a state that moves it has its light baked
   * again where it lands. A door and a swaying leaf keep the builder's own triangles: they move, so no light is baked
   * into them. 0 cuts nothing. Default 0.35.
   */
  readonly seg?: number
}

/** `WorldOptions.seg`'s default: the look profile's `seg`. */
const SEG = 0.35

// The first-person defaults the builder drew with when a wall or a plane named nothing.
const FLOOR = 'oakFloor'
const CEILING = 'plasterWarm'
const WALL = 'plasterWarm'

export function buildWorld(level: AfSector2, library: WorldLibrary, options: WorldOptions = {}): World {
  const night = options.night === true
  const interiors = options.interiors !== false
  const seg = options.seg ?? SEG
  const pieces: WorldPiece[] = []
  const problems: LevelProblem[] = []
  const told = new Set<string>()
  const tell = (key: string, problem: LevelProblem): void => {
    if (told.has(key)) return
    told.add(key)
    problems.push(problem)
  }

  // A level with no rooms draws nothing, and a level that failed to read comes here as exactly that (`readLevel` hands
  // back an empty level with its problems). Say so here, so the empty frame is never the only sign.
  if (level.sectors.length === 0)
    problems.push({
      path: ['sectors'],
      code: 'empty-level',
      message:
        'This level has no rooms, so nothing is drawn. If it was read from a file, look at the problems readLevel returned.',
      where: 'sectors',
    })

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
    extra: Pick<
      WorldPiece,
      'door' | 'line' | 'occlude' | 'faces' | 'sway' | 'phase' | 'noCast' | 'prop' | 'onWall'
    > = {},
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
      light: sector.light,
      part,
      mesh: extra.door === undefined && extra.sway === undefined ? subdivide(mesh, seg) : mesh,
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
    const spanOf = (u0: number, u1: number, low: number | null, high: number | null, out: number) => {
      const [a, b] = [offset(seg.a, n, out), offset(seg.b, n, out)]
      const at = (u: number): V2 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]
      const [fl0, fl1] = [lerp(fa, fb, u0), lerp(fa, fb, u1)]
      const [cl0, cl1] = [lerp(ca, cb, u0), lerp(ca, cb, u1)]
      return {
        pa: at(u0),
        pb: at(u1),
        atA: [low === null ? fl0 : fl0 + low, high === null ? cl0 : fl0 + high] as const,
        atB: [low === null ? fl1 : fl1 + low, high === null ? cl1 : fl1 + high] as const,
      }
    }
    const strip = (u0: number, u1: number, low: number | null, high: number | null, out = 0): MeshData => {
      const { pa, pb, atA, atB } = spanOf(u0, u1, low, high, out)
      return wallQuad(pa, pb, atA, atB, n)
    }
    /** The solid rectangle of the face a strip covers, for the light's occluders. */
    const solid = (u0: number, u1: number, low: number | null, high: number | null): WallFace => {
      const { pa, pb, atA, atB } = spanOf(u0, u1, low, high, 0)
      return { a: pa, b: pb, lo: (atA[0] + atB[0]) / 2, hi: (atA[1] + atB[1]) / 2 }
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
      const faces: WallFace[] = []
      const cover = (u0: number, u1: number, low: number | null, high: number | null): void => {
        face.push(strip(u0, u1, low, high))
        faces.push(solid(u0, u1, low, high))
      }
      let cursor = 0
      for (const o of openings) {
        if (o.u0 > cursor + 1e-6) cover(cursor, o.u0, null, null)
        cover(o.u0, o.u1, o.y1, null)
        if (o.y0 > 1e-6) cover(o.u0, o.u1, null, o.y0)
        cursor = Math.max(cursor, o.u1)
      }
      if (cursor < 1 - 1e-6) cover(cursor, 1, null, null)
      add(seg.sector, role('wall'), 'wall', merge(...face), surface, tex(surface), {
        line: roomOnLeft(seg, n),
        faces,
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
  for (const piece of placed.pieces) {
    const room = (level.sectors[piece.sector] as AfSectorEntry2).id
    const wall = piece.mount === undefined ? undefined : wallOfMounted(piece.mesh, room, pieces)
    add(piece.sector, `prop:${piece.role}`, 'prop', piece.mesh, piece.surface, piece.tex, {
      ...(wall === undefined ? {} : { onWall: wall.id }),
      ...(wall?.occlude === undefined ? {} : { occlude: wall.occlude }),
      ...(piece.sway === undefined ? {} : { sway: piece.sway }),
      ...(piece.phase === undefined ? {} : { phase: piece.phase }),
      ...(piece.noCast === true ? { noCast: true } : {}),
      ...(piece.prop === undefined ? {} : { prop: piece.prop }),
    })
  }
  // A camera view that names a room the level lacks: told here, so `automata check` says it and the rest still draws.
  problems.push(...viewRoomProblems(level))
  const props = placed.props.map((prop) => ({
    ...prop,
    sector: (level.sectors[prop.sector] as AfSectorEntry2).id,
  }))
  return { pieces, lamps: placed.lamps, props, problems }
}
