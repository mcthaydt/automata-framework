// Surfaces: where a wall, a floor or a piece names a swatch, it may give a placement with it, as Build's Mapster32 does
// a wall's picnum: how often the tile repeats, how it is panned, where it starts (aligned to the wall, the world or the
// prop) and whether it is turned a quarter. A plain swatch name has no placement and tiles in the world. The surface
// types are the level schema's; the renderer maps a tile into a frame, so the builder does not need the source's
// `toLocal`.
import type { Surface, SurfaceTex } from '../../shared/level/af-sector-2.schema.ts'

/** A point or direction in world space. */
export type Vec3 = readonly [number, number, number]

export type { Surface, SurfaceTex }

/** Where a placement is taken from: the wall's own frame, the prop's, or none (the world's). */
export type SurfaceSite = 'wall' | 'plane' | 'object'

/** A frame a tile starts from: origin, and the frame's three axes (x along the wall, y up, z out of it). */
export interface TexFrame {
  readonly o: Vec3
  readonly x: Vec3
  readonly y: Vec3
  readonly z: Vec3
}

/** How a piece's tile is placed; none of it set means today's world mapping. */
export interface TexPlace {
  readonly frame?: TexFrame
  readonly repeat?: readonly [number, number]
  readonly pan?: readonly [number, number]
  readonly turn?: true
}

export function isSurfaceTex(surface: unknown): surface is SurfaceTex {
  return (
    surface !== null &&
    typeof surface === 'object' &&
    !Array.isArray(surface) &&
    typeof (surface as SurfaceTex).tile === 'string'
  )
}

/** The swatch a surface names. */
export const tileName = (surface: Surface): string => (typeof surface === 'string' ? surface : surface.tile)

const DEFAULT_ALIGN = { wall: 'wall', plane: 'world', object: 'object' } as const

/**
 * A surface's placement at a site, with the site's own frame (a wall's, a prop's): none for a string; for a
 * placement its `align` (by site: a wall to its frame, a floor or ceiling to the world, a prop to its own) picks the
 * frame, and its repeat, pan and turn are kept as given, only those it sets.
 */
export function texOf(
  surface: Surface | undefined,
  site: SurfaceSite,
  frame?: TexFrame,
): TexPlace | undefined {
  if (surface === undefined || typeof surface === 'string') return undefined
  const align = surface.align ?? DEFAULT_ALIGN[site]
  const aligned = site === 'plane' || align === 'world' ? undefined : frame
  return {
    ...(aligned === undefined ? {} : { frame: aligned }),
    ...(surface.repeat === undefined ? {} : { repeat: surface.repeat }),
    ...(surface.pan === undefined ? {} : { pan: surface.pan }),
    ...(surface.turn === true ? { turn: true as const } : {}),
  }
}

/**
 * A wall's frame: origin at its start `from` (level x, z) on the floor at height `floor`; x along the wall, left to
 * right seen from the room, `(n.z, −n.x)`; y up; z the inward normal `n`. World is `(x, height, z)`.
 */
export function wallFrame(
  from: readonly [number, number],
  floor: number,
  n: readonly [number, number],
): TexFrame {
  return { o: [from[0], floor, from[1]], x: [n[1], 0, -n[0]], y: [0, 1, 0], z: [n[0], 0, n[1]] }
}

/**
 * A prop's frame: placed at `at` (world), turned `turn` degrees about y as `rotateY` turns it, so x = (cos, 0, −sin),
 * y up and z = (sin, 0, cos).
 */
export function objectFrame(turn: number, at: Vec3): TexFrame {
  const a = (turn * Math.PI) / 180
  const [c, s] = [Math.cos(a), Math.sin(a)]
  return { o: at, x: [c, 0, -s], y: [0, 1, 0], z: [s, 0, c] }
}
