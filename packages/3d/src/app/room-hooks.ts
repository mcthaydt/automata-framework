// The room hooks: each frame they read which camera view is active, where the player stands, whether a peek leans toward a
// room and whether a cutscene is running, ask the room model (`createRoomDraw`) what to draw, and tell the world. A game
// returns them from its `scene` hook beside `drawWorld`'s view:
//
//   scene: (view, stage, occluders, light, models, camera) => {
//     const world = drawWorld(…, built.pieces)
//     return roomHooks({ level, world, view: () => camera?.active(), player: () => where(), peek: () => spot(), cutscene: () => playing() })
//   }
//
// Presentation only (law 1): they read what the sim says and write only mesh flags.

import type { FrameInfo, PixiStageHooks } from '@automata/framework'
import { createRoomDraw } from '../features/world/room-draw.ts'
import type { AfSector2 } from '../shared/level/af-sector-2.schema.ts'
import type { Point } from '../shared/level/sector.schema.ts'
import type { WorldView } from './world-view.ts'

export interface RoomHooksOptions {
  readonly level: AfSector2
  readonly world: Pick<WorldView, 'showRooms'>
  /** The active camera view's id (`camera?.active()`); none draws every room. */
  readonly view: () => string | undefined
  /** Where the player stands, in metres on the plan; their room is always drawn. */
  readonly player: () => Point | undefined
  /** The spot a peek leans toward, past the doorway, while one holds; none otherwise. */
  readonly peek?: (() => Point | undefined) | undefined
  /** Whether a cutscene is running: it draws every room. */
  readonly cutscene?: (() => boolean) | undefined
}

export function roomHooks(options: RoomHooksOptions): PixiStageHooks {
  const model = createRoomDraw(options.level)
  return {
    draw: (frame: FrameInfo) => {
      const drawn = model.update({
        view: options.view(),
        at: options.player(),
        peek: options.peek?.(),
        cutscene: options.cutscene?.() === true,
        dt: frame.frameMs / 1000,
      })
      options.world.showRooms(drawn.sectors)
    },
    reset: () => model.reset(),
  }
}
