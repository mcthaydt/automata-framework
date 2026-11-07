import type { PixiRendererOptions } from '@mcthaydt/automata'
import { endesga } from '../../shared/art/palette.ts'
import type { Room } from '../../shared/room.ts'
import { createScene } from './scene.ts'

/** Where Wick's hitbox is, in room pixels, and the sim tick it was drawn at. */
export interface WickAt {
  readonly x: number
  readonly y: number
  readonly tick: number
}

const NIGHT = Number.parseInt(endesga(15).slice(1), 16)

/**
 * The options `startGame` gives render-pixi for Emberwick: its scene on the stage, fed each step and drawn
 * each frame through the stage hooks. `onFrame` hears where Wick is after every frame
 * (the page's data attributes, which the browser journeys read).
 */
export function sceneRenderer(room: Room, onFrame: (at: WickAt) => void): PixiRendererOptions {
  return {
    backgroundColor: NIGHT,
    barColor: NIGHT,
    setup(stage) {
      const scene = createScene(stage.app.renderer, room)
      stage.world.addChild(scene.world)
      stage.ui.addChild(scene.overlay)
      let tick = 0
      return {
        apply(result) {
          tick = result.tick
          scene.apply(result)
        },
        draw() {
          scene.draw(performance.now())
          const at = scene.playerPixel()
          if (at !== null) onFrame({ ...at, tick })
        },
        reset() {
          tick = 0
          scene.reset()
        },
      }
    },
  }
}
