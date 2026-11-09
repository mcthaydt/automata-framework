// One drawing of a level, for the game and for the editor: the level is dressed, built into its world, lit (its lamps, its
// sun and its ambient baked into the pieces' vertex colours), and each piece takes the tiles of the views the level can
// take. Every view's tiles are made before the first frame, so a switch between the level's views never waits on one; a
// camera the level was not told of queues its tiles one at a time and the old tile stays up until the new one is made.

import { atan, tan } from '@automata/sim/math'
import type { View3D } from '@pixi/3d'
import type { Occluders } from '../features/camera/occluders/occluders.ts'
import type { Look } from '../features/look/look.schema.ts'
import type { ShaftLamp } from '../features/look/passes/shafts-effect.ts'
import { type TileScales, tileScales } from '../features/photo/tile-scales.ts'
import type { TileStore } from '../features/photo/tile-store.ts'
import { buildWorld } from '../features/world/build.ts'
import { dressLevel } from '../features/world/furnish/dress.ts'
import { swatchColour, type WorldLibrary } from '../features/world/swatches.ts'
import type { AfSector2, EmitterPlace } from '../shared/level/af-sector-2.schema.ts'
import { createSceneLight, type SceneLight } from '../shared/render/light/scene-light.ts'
import type { TimeOfDay } from '../shared/time-of-day/time-of-day.ts'
import { pieceTiles, tileRequests } from './level-tiles.ts'
import { isNight, worldLighting } from './world-lighting.ts'
import { drawWorld, type WorldView } from './world-view.ts'

/** A camera as the tiles see it: how far from what it looks at, and how far down. */
export interface TileCamera {
  readonly distance: number
  readonly tiltDeg: number
}

export interface DrawLevelInput {
  readonly level: AfSector2
  readonly library: WorldLibrary
  readonly look: Look
  readonly time: TimeOfDay
  readonly tiles: TileStore
  /** The camera the level is first seen from. */
  readonly camera: TileCamera
  /** Every view the level may take: their tiles are made before the first frame. */
  readonly views: readonly TileCamera[]
  readonly occluders?: Occluders | undefined
  /** The field: its short side in pixels. */
  readonly field: { readonly short: number }
}

export interface LevelView {
  readonly world: WorldView
  readonly light: SceneLight | undefined
  /** The level's spot lamps that show a shaft in the air: give them to the look's shafts pass. */
  readonly spots: readonly ShaftLamp[]
  /** The level's emitters: give each to the look's particle layer. */
  readonly emitters: readonly EmitterPlace[]
  /** Shows the level from `camera`: tiles it has are swapped in, the ones it lacks are queued and the old ones stay up. A camera at the pairs it has is a no-op. */
  setCamera(camera: TileCamera): void
  /** Takes up the tiles made since: call it after the store has made some. */
  refresh(): void
  dispose(): void
}

const RADIANS = Math.PI / 180

/** The lens's field of view along the view's short side (radians). */
function fovShort(view: View3D): number {
  const vertical = view.camera.fov * RADIANS
  const aspect = view.width / Math.max(1, view.height)
  return aspect >= 1 ? vertical : 2 * atan(tan(vertical / 2) * aspect)
}

const samePairs = (a: TileScales, b: TileScales): boolean =>
  [...a.floor, ...a.wall].every((v, i) => v === [...b.floor, ...b.wall][i])

/** Draws `input.level` under `view.root`. Resolves when every view's tiles are made. */
export async function drawLevel(view: View3D, input: DrawLevelInput): Promise<LevelView> {
  const { look, library, tiles, field } = input
  const level = dressLevel(input.level, library).level
  const world = buildWorld(level, library, { night: isNight(input.time) })
  const lighting = worldLighting({
    pieces: world.pieces,
    lamps: world.lamps,
    time: input.time,
    look,
    pitch: input.camera.tiltDeg * RADIANS,
  })
  const light = createSceneLight(lighting)
  const fov = fovShort(view)
  const scalesOf = (camera: TileCamera): TileScales => tileScales(camera, field.short, fov)
  let shown = scalesOf(input.camera)
  // Every view's pairs, made before the first frame.
  const all = [input.camera, ...input.views].map(scalesOf)
  await tiles.prewarm(tileRequests(world.pieces, level, library, all))
  const drawn = drawWorld(
    {
      parent: view.root,
      occluders: input.occluders,
      colourOf: (name) => swatchColour(library, name.split('#')[0] as string) ?? swatchColour(library, name),
      look,
      light,
      tiles: (piece) => pieceTiles(piece, level, library, shown, tiles),
    },
    world.pieces,
  )
  drawn.setFocus(input.camera.distance)

  const retile = (): void => drawn.retile((piece) => pieceTiles(piece, level, library, shown, tiles))
  const spots = world.lamps
    .filter((lamp) => lamp.shaft === true && lamp.aim !== undefined && lamp.cone !== undefined)
    .filter((lamp) => !lamp.dusk || isNight(input.time))
    .map(
      (lamp): ShaftLamp => ({
        at: lamp.at,
        aim: lamp.aim as ShaftLamp['aim'],
        cone: lamp.cone as number,
        range: lamp.range,
        color: lamp.color,
        strength: Math.min(1, lamp.level),
      }),
    )
  return {
    world: drawn,
    light,
    spots,
    emitters: level.emitters ?? [],
    setCamera(camera) {
      drawn.setFocus(camera.distance)
      const next = scalesOf(camera)
      if (samePairs(next, shown)) return
      shown = next
      for (const request of tileRequests(world.pieces, level, library, [next])) tiles.queue(request)
      retile()
    },
    refresh: retile,
    dispose() {
      drawn.dispose()
    },
  }
}
