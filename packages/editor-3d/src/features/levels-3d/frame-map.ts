// Where each view of a level looks from (spec 10.3): the Plan over the whole level, the 3D view round it from the
// dollhouse's home angles, and Walk at the spawn. The controllers frame through this one function, so a level opens
// the same way in the editor's views however each was reached.
import type { Rect, Size } from '@automata/editor/kit/core'
import type { ViewState } from '../../shared/edit/view-store'
import {
  fitOrbit,
  type Orbit,
  type SpawnPoint,
  type WalkOptions,
  type WalkStart,
  walkStart,
} from '../../shared/geometry/camera-3d'
import { EMPTY_BOUNDS, type SectorMesh } from '../../shared/geometry/sector-mesh'
import type { GeometryLayer } from '../../shared/level-session/level-profile'
import { fitInto, fitPlan, levelBounds } from './plan/plan-viewport'

/** What a level is framed from: its geometry, where it spawns the player and what Walk's eye is like. */
export interface FrameInput {
  readonly layers: readonly GeometryLayer[]
  readonly spawn?: SpawnPoint | undefined
  readonly walk?: WalkOptions | undefined
}

/** A level with no mesh yet is framed as one with no rooms. */
const EMPTY_MESH: SectorMesh = { surfaces: [], bounds: EMPTY_BOUNDS }

/**
 * The plan's camera: the level centred and whole inside 24 px of the canvas, or of `usable`, the part of it the tools and
 * a sheet leave.
 */
export function frameMap(
  input: FrameInput,
  view: 'plan',
  canvas: Size,
  usable?: Rect | undefined,
): ViewState['camera']
/** The 3D view's orbit: round the middle of the level from the home angles, as near as shows every corner. */
export function frameMap(input: { readonly mesh: SectorMesh }, view: 'diorama', canvas: Size): Orbit
/** Walk's start: at the spawn, or in the first room (or at the origin) with a warning that says so. */
export function frameMap(input: FrameInput, view: 'walk', canvas: Size): WalkStart
export function frameMap(
  input: Partial<FrameInput> & { readonly mesh?: SectorMesh },
  view: 'plan' | 'diorama' | 'walk',
  canvas: Size,
  usable?: Rect | undefined,
): ViewState['camera'] | Orbit | WalkStart {
  switch (view) {
    case 'plan': {
      const bounds = levelBounds(input.layers ?? [])
      return usable === undefined ? fitPlan(bounds, canvas) : fitInto(bounds, usable, canvas)
    }
    case 'diorama':
      return fitOrbit((input.mesh ?? EMPTY_MESH).bounds, canvas)
    case 'walk':
      return walkStart(input.layers ?? [], input.spawn, input.walk)
  }
}
