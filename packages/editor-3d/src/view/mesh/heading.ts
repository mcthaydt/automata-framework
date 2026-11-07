// The heading of the camera a level is played from (ED3D.4c, the 3D direction spec §4.2, M3R-D9 and D11). The game turns its
// camera freely, per pixel, and keeps the heading as an integer in turn units, 65,536 to a turn: 0 looks toward +z (south on
// the plan) and a heading grows toward +x (east), the direction being `(sin h, cos h)` in `(x, z)`. The editor's own camera
// states a heading as a compass bearing (0 looks north, a quarter turn east; camera-3d.ts), which is a half turn minus the
// heading. The conversions are whole-unit arithmetic first and one multiplication last, so every unit round-trips exactly.
// The turn itself (`TURN_UNITS`, `wrapHeading`, `turnHeading`, `degToHeading`) is @automata/3d's `camera-view`, its one
// owner (M3 spec §4.2, amended 2026-10-30); what stays here is the editor camera's compass and its own drag.

import { TURN_UNITS, wrapHeading } from '@automata/3d/camera-view'
import type { Size } from '@automata/editor/kit/core'
import { roundJsonNumber } from '@automata/editor/kit/documents'
import { type Camera3D, fitOrbit, type Orbit, orbitCamera } from './camera-3d'
import { surfaceVisibility } from './mesh-pick'
import type { SectorMesh, Vec3 } from './sector-mesh'

const HALF_TURN = TURN_UNITS / 2
const RADIANS_PER_UNIT = (2 * Math.PI) / TURN_UNITS
const DEGREES_PER_UNIT = 360 / TURN_UNITS

/** The game's default turn speed: 1,440 pixels of drag are a full turn. */
export const DEGREES_PER_PIXEL = 0.25

/** What a drag of `pixels` turns the camera by, in whole units: the sign is the direction, and a drag may be more than a turn. */
export const dragTurn = (pixels: number, degPerPixel: number = DEGREES_PER_PIXEL): number =>
  Math.round((pixels * degPerPixel) / DEGREES_PER_UNIT)

/** The editor camera's compass bearing, in radians inside one turn, of a heading. */
export const headingToYaw = (units: number): number => wrapHeading(HALF_TURN - units) * RADIANS_PER_UNIT

/** The heading, to the nearest unit, whose bearing is `yaw` radians, in any turn. */
export const yawToHeading = (yaw: number): number =>
  wrapHeading(HALF_TURN - Math.round(yaw / RADIANS_PER_UNIT))

/** A heading as the `yawDeg` a room carries: the same turn in degrees, to the four decimals a file holds. */
export const headingToDeg = (units: number): number => roundJsonNumber(wrapHeading(units) * DEGREES_PER_UNIT)

export interface WallsSeen {
  /** The walls the eye is behind, which the game takes away. */
  readonly cut: readonly string[]
  /** The walls that say `fade` where they would be cut, which the game draws faintly. */
  readonly faded: readonly string[]
}

/**
 * Which walls an eye cuts or fades, each named once by its selection (a wall that is several surfaces, a door in it, is one);
 * a wall with no selection (a connector sector's) is named by the one surface it is. The editor has no player, so "cut" is what
 * `surfaceVisibility` says of a wall from this eye. Floors and ceilings are never cut.
 */
export function wallsSeenFrom(mesh: SectorMesh, eye: Vec3): WallsSeen {
  const [cut, faded] = [new Set<string>(), new Set<string>()]
  for (const [index, surface] of mesh.surfaces.entries()) {
    if (surface.role === 'floor' || surface.role === 'ceiling') continue
    const seen = surfaceVisibility(surface, eye)
    if (seen === 'shown') continue
    ;(seen === 'cut' ? cut : faded).add(surface.selection ?? `surface#${index}`)
  }
  return { cut: [...cut], faded: [...faded] }
}

export interface HeadingView {
  /** The heading in whole units. */
  readonly heading: number
  /** The orbit that frames the whole level from this heading. */
  readonly orbit: Orbit
  readonly camera: Camera3D
  /** How many walls this heading takes away. */
  readonly wallsCut: number
  /** How many walls this heading draws faintly. */
  readonly wallsFaded: number
}

export interface HeadingOptions {
  readonly pitch?: number | undefined
  /** The margin kept from the edge of the canvas, in pixels. */
  readonly padding?: number | undefined
}

/** The dollhouse framed on the whole level, looking along a heading, with what that heading does to the walls. */
export function headingView(
  mesh: SectorMesh,
  size: Size,
  units: number,
  options: HeadingOptions = {},
): HeadingView {
  const heading = wrapHeading(units)
  const orbit = fitOrbit(mesh.bounds, size, {
    yaw: headingToYaw(heading),
    pitch: options.pitch,
    padding: options.padding,
  })
  const camera = orbitCamera(orbit)
  const { cut, faded } = wallsSeenFrom(mesh, camera.eye)
  return { heading, orbit, camera, wallsCut: cut.length, wallsFaded: faded.length }
}

export interface SweepOptions extends HeadingOptions {
  /** The heading of the first view, in units; 0 (looking south) when not given. */
  readonly from?: number | undefined
}

/**
 * The level seen from headings all the way round, a step of `stepDeg` degrees apart (the spec's D3-g and D3-h sweep, 15 by
 * default: 24 views). The step must divide a turn. A view's heading is the whole unit nearest its place in the turn, so views
 * are 2,730 or 2,731 units apart at 15 degrees, and the 45 degree ones are exact.
 */
export function headingSweep(
  mesh: SectorMesh,
  size: Size,
  stepDeg = 15,
  options: SweepOptions = {},
): HeadingView[] {
  const count = 360 / stepDeg
  if (!(count >= 1 && Number.isInteger(count)))
    throw new Error(`a step of ${stepDeg} degrees does not divide a turn`)
  const first = options.from ?? 0
  return Array.from({ length: count }, (_, k) =>
    headingView(mesh, size, first + Math.round((k * TURN_UNITS) / count), options),
  )
}
