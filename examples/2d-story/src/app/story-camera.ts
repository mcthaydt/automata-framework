import { type Camera2d, createCamera2d, type PixiStage, type PixiStageHooks } from '@automata/framework'
import { LEVEL } from '../shared/level/level.ts'
import { debugHooks } from './debug.ts'

// The one camera of the story. The renderer makes its stage (and with it the container a camera moves) after the game is
// defined, so the cutscene stage is given `cutsceneCamera`, which forwards to the camera made when the stage exists
// (`storyCamera`, the renderer's `setup`) and does nothing before that. The level fits the view, so the camera stays framed on
// it; it is here for a cutscene to point.

let camera: Camera2d | undefined

export const cutsceneCamera: Camera2d = {
  target: (x, y) => camera?.target(x, y),
  shake: (amount) => camera?.shake(amount),
  update: (seconds) => camera?.update(seconds),
  get transform() {
    return camera?.transform ?? { x: 0, y: 0, scale: 1 }
  },
}

/**
 * The renderer's `setup`: makes the camera on the stage's world and moves it each display frame. A development build also
 * feeds the journeys' probe each step (app/debug.ts).
 */
export function storyCamera(stage: PixiStage): PixiStageHooks {
  camera = createCamera2d(stage.world, {
    view: { width: LEVEL.width, height: LEVEL.height },
    bounds: { x: 0, y: 0, width: LEVEL.width, height: LEVEL.height },
  })
  camera.target(LEVEL.width / 2, LEVEL.height / 2)
  return { ...debugHooks(), draw: (frame) => camera?.update(frame.frameMs / 1000) }
}
