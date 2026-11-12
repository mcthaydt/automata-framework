// Props and lamps in a level: each prop place becomes its generator's pieces standing in the room it is in, and its
// lights; each lamp of the level becomes a lamp of the kit. A fault (a preset the library lacks, a lamp of no kind) is a
// problem, and the rest of the level still draws. A place's `angle` is degrees clockwise from east (90 faces south), so
// the turn about y is `90 − angle`.
import type {
  AfSector2,
  AfSectorEntry2,
  LampPlace,
  PropFit,
  PropPlace,
} from '../../shared/level/af-sector-2.schema.ts'
import type { LevelProblem } from '../../shared/level/problem.ts'
import type { MeshData } from '../../shared/math/geometry.ts'
import type { V3 } from '../../shared/math/math.ts'
import { propLampId } from './albedo/glow.ts'
import { lampFault, type ResolvedLamp, resolveLamp } from './lamp-kit.ts'
import { rotateY } from './plane-mesh.ts'
import type { PropPiece } from './props/piece.ts'
import { isFault, resolveProp } from './props/resolve.ts'
import { heightAt, ringsOf, standsIn, type V2 } from './sectors.ts'
import { objectFrame, type Surface, type TexPlace, texOf } from './surface.ts'
import type { WorldLibrary } from './swatches.ts'

/** One prop part standing in a room, ready to become a world piece. */
export interface PlacedPiece {
  /** Index of the room it stands in. */
  readonly sector: number
  /** `<prop id>.<n>.<label>`: stable for a given level. */
  readonly role: string
  readonly mesh: MeshData
  readonly surface: Surface
  readonly tex?: TexPlace
  readonly sway?: number
  readonly phase?: number
  readonly noCast?: boolean
  /** The prop it belongs to and where its base stands, for a state that moves the prop. */
  readonly prop?: { readonly id: string; readonly at: V3 }
}

/** A lamp in the world: its kind's colour, reach and peak resolved, `at` in world space (x, up, z). */
export interface WorldLamp extends ResolvedLamp {
  readonly id: string
  readonly kind: string
  readonly at: V3
  readonly aim?: V3 | undefined
  readonly cone?: number | undefined
  readonly flicker?: number | undefined
  readonly rate?: number | undefined
  readonly seed?: number | undefined
  readonly shaft?: boolean | undefined
  readonly flame?: boolean | undefined
  /** The prop it hangs on: that prop's glowing parts dim with it. */
  readonly prop?: string | undefined
}

/**
 * A prop as placed: its base point, the turn that placed it (degrees about up) and the box its generated parts fill, which is
 * the prop's blockout. The blockout owns the footprint and the height whether or not a model replaces it on screen.
 */
export interface PlacedProp {
  readonly id: string
  /** The index of the room it stands in. */
  readonly sector: number
  readonly at: V3
  readonly turn: number
  readonly min: V3
  readonly max: V3
  /** The model file that replaces the blockout on screen, and how it sits (`PropPlace.model`, `PropPlace.fit`). */
  readonly model?: string
  readonly fit?: PropFit
}

export interface Placed {
  readonly pieces: PlacedPiece[]
  readonly lamps: WorldLamp[]
  readonly props: PlacedProp[]
}

type Tell = (key: string, problem: LevelProblem) => void

/** The index of the room a point stands in, else the nearest room by its corners. */
function roomAt(level: AfSector2, x: number, z: number): number {
  const inRoom = level.sectors.findIndex((sector) => standsIn(sector, x, z))
  if (inRoom >= 0) return inRoom
  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  level.sectors.forEach((sector, index) => {
    for (const [cx, cz] of ringsOf(sector)[0] ?? []) {
      const distance = Math.hypot(cx - x, cz - z)
      if (distance < bestDistance) [best, bestDistance] = [index, distance]
    }
  })
  return best
}

/** The floor's height under `(x, z)` in the room. */
function floorUnder(sector: AfSectorEntry2, x: number, z: number): number {
  const origin = (ringsOf(sector)[0] as V2[])[0] as V2
  return heightAt(sector.floor, origin, x, z)
}

/** A point in a prop's space turned `turn` degrees about y and moved to `at`. */
function toWorld(point: V3, turn: number, at: V3): V3 {
  const c = Math.cos((turn * Math.PI) / 180)
  const s = Math.sin((turn * Math.PI) / 180)
  return [c * point[0] + s * point[2] + at[0], point[1] + at[1], -s * point[0] + c * point[2] + at[2]]
}

/** A direction in a prop's space turned `turn` degrees about y. */
const directionToWorld = (v: V3, turn: number): V3 => toWorld(v, turn, [0, 0, 0])

function lampOf(
  id: string,
  place: Omit<LampPlace, 'id' | 'at'>,
  at: V3,
  prop: string | undefined,
  turn: number,
): WorldLamp {
  return {
    ...resolveLamp(place),
    id,
    kind: place.kind,
    at,
    aim: place.aim === undefined ? undefined : directionToWorld(place.aim as unknown as V3, turn),
    cone: place.cone,
    flicker: place.flicker,
    rate: place.rate,
    seed: place.seed,
    shaft: place.shaft,
    flame: place.flame,
    prop,
  }
}

/** The props and the lamps of the level. */
export function placeProps(level: AfSector2, library: WorldLibrary, tell: Tell): Placed {
  const pieces: PlacedPiece[] = []
  const lamps: WorldLamp[] = []
  const props: PlacedProp[] = []
  if (level.sectors.length === 0) return { pieces, lamps, props }

  level.props?.forEach((place: PropPlace, index) => {
    const resolved = resolveProp(place, library)
    if (isFault(resolved)) {
      tell(`prop:${place.id}`, {
        path: ['props', index],
        code: resolved.code,
        message:
          resolved.code === 'unknown-prop'
            ? `prop "${place.id}" uses the preset "${resolved.name}", which the library does not have`
            : `prop "${place.id}" names the kind "${resolved.name}", which is not a prop kind`,
        where: place.id,
        name: resolved.name,
      })
      return
    }
    const [x, z] = place.at as [number, number]
    const si = roomAt(level, x, z)
    const room = level.sectors[si] as AfSectorEntry2
    const y = place.at[2] ?? floorUnder(room, x, z)
    const turn = 90 - (place.angle ?? 90)
    const at: V3 = [x, y, z]
    const frame = objectFrame(turn, at)
    const built = resolved.generator(resolved.params)
    const low: V3 = [Infinity, Infinity, Infinity]
    const high: V3 = [-Infinity, -Infinity, -Infinity]
    built.pieces.forEach((piece: PropPiece, n) => {
      const surface: Surface = resolved.placements[piece.swatch] ?? piece.swatch
      const mesh = rotateY(piece.mesh, turn, at)
      for (let i = 0; i < mesh.positions.length; i += 3)
        for (const axis of [0, 1, 2] as const) {
          low[axis] = Math.min(low[axis], mesh.positions[i + axis] as number)
          high[axis] = Math.max(high[axis], mesh.positions[i + axis] as number)
        }
      pieces.push({
        sector: si,
        role: `${place.id}.${n}.${piece.label}`,
        mesh,
        surface,
        ...(texOf(surface, 'object', frame) === undefined
          ? {}
          : { tex: texOf(surface, 'object', frame) as TexPlace }),
        ...(piece.sway === undefined ? {} : { sway: piece.sway }),
        ...(piece.phase === undefined ? {} : { phase: piece.phase }),
        ...(piece.noCast === true ? { noCast: true } : {}),
        prop: { id: place.id, at },
      })
    })
    if (built.pieces.length > 0)
      props.push({
        id: place.id,
        sector: si,
        at,
        turn,
        min: low,
        max: high,
        ...(place.model === undefined ? {} : { model: place.model }),
        ...(place.fit === undefined ? {} : { fit: place.fit }),
      })
    built.lights?.forEach((light, n) => {
      const fault = lampFault(light)
      if (fault !== undefined) {
        tell(`lamp:${place.id}.${n}`, {
          path: ['props', index],
          code: fault.code,
          message: `prop "${place.id}": ${fault.message}`,
          where: place.id,
          name: light.kind,
        })
        return
      }
      lamps.push(lampOf(propLampId(place.id, n), light, toWorld(light.at, turn, at), place.id, turn))
    })
  })

  level.lamps?.forEach((place, index) => {
    const fault = lampFault(place)
    if (fault !== undefined) {
      tell(`lamp:${place.id}`, {
        path: ['lamps', index],
        code: fault.code,
        message: `lamp "${place.id}": ${fault.message}`,
        where: place.id,
        name: place.kind,
      })
      return
    }
    const [x, z, height = 0] = place.at as [number, number, number?]
    lamps.push(lampOf(place.id, place, [x, height, z], undefined, 0))
  })
  return { pieces, lamps, props }
}
