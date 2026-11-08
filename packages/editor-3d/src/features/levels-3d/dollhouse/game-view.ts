// The room in the game's look (Levels 3D spec 10.3), drawn by the game's own code: core's `drawWorld` makes a mesh for each
// piece in the swatch's colour with the stepped-light material, the hemisphere the game lights its room with is lit by the
// time of day (`lightByTime`), and the view's passes are the look's, so the DUEL snap leaves nothing but palette colours.
// One `View3D` for the renderer; a new scene (an edit) takes the old meshes down and draws the new ones, and the camera
// moves without touching them.
import '@automata/3d/no-eval'
import {
  createLookPasses,
  DEFAULT_LOOK,
  drawWorld,
  type LookPasses,
  lightByTime,
  lightHemisphere,
  timeOfDay,
  type WorldView,
} from '@automata/3d'
import { View3D } from '@pixi/3d'
import { forward } from '../../../shared/geometry/camera-3d'
import type { GameFrame } from './dollhouse-paint'
import type { GameScene } from './game-scene'

export interface GameView {
  readonly view: View3D
  /** Draws `frame`: the meshes of its scene (made again only for a new scene), the light of its time, its camera. */
  show(frame: GameFrame): void
  resize(size: { readonly w: number; readonly h: number }): void
  /** The colour behind the room: the game's dark sky, lit by the time. */
  backdrop(scene: GameScene): number
  destroy(): void
}

/** The game's day sky, which the hemisphere above the room gives the light. */
const SKY = 0xcdd2da
/** What shows behind the room where the game has fog: the colour the fogged walls meet. */
const BACKDROP = 0x31222a
const DEGREES = 180 / Math.PI

export function createGameView(size: { readonly w: number; readonly h: number }): GameView {
  const view = new View3D({ width: size.w, height: size.h, toneMapping: 'none' })
  const passes: LookPasses = createLookPasses(DEFAULT_LOOK, timeOfDay('day'))
  view.passes = [...passes.list]
  let drawn: { readonly scene: GameScene; readonly world: WorldView } | undefined

  function draw(scene: GameScene): WorldView {
    if (drawn?.scene === scene) return drawn.world
    drawn?.world.dispose()
    const world = drawWorld({ parent: view.root, colourOf: scene.colourOf, look: DEFAULT_LOOK }, scene.pieces)
    drawn = { scene, world }
    return world
  }

  return {
    view,
    show({ scene, camera, indoors }) {
      const world = draw(scene)
      // The ceilings are the roof of the dollhouse, which is lifted to look in; Walk is under it.
      for (const piece of world.pieces)
        if (piece.part === 'ceiling') {
          const mesh = world.mesh(piece.id)
          if (mesh !== undefined) mesh.visible = indoors
        }
      view.environment = lightHemisphere(SKY, scene.ground, scene.time)
      const [x, y, z] = camera.eye
      const ahead = forward(camera)
      view.camera.fov = camera.fov * DEGREES
      view.camera.position.set(x, y, z)
      view.camera.lookAt({ x: x + ahead[0], y: y + ahead[1], z: z + ahead[2] })
    },
    resize(next) {
      view.width = next.w
      view.height = next.h
    },
    backdrop: (scene) => lightByTime(BACKDROP, scene.time),
    destroy() {
      drawn?.world.dispose()
      drawn = undefined
      for (const pass of passes.list) pass.destroy()
      view.destroy({ children: true })
    },
  }
}
