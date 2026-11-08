// The 3D renderer's answer to the stage's port for characters (`StageCharacters`): a word above a character sits at the
// screen point of its head, a squash scales its model, and a hit-stop holds its pose. It replaces the 2D answer when the
// renderer mounts, so Feel's one file serves both kinds.
import type { RenderDeltaConsumer, StageCharacters } from '@automata/framework'
import type { Container3D, View3D } from '@pixi/3d'
import type { Container } from 'pixi.js'
import { PLAYER_HEIGHT } from '../features/camera/camera-driver.ts'

export function characters3d(
  consumer: RenderDeltaConsumer<Container3D>,
  view: Pick<View3D, 'worldToScreen'>,
  ui: Container,
  height: number = PLAYER_HEIGHT,
): StageCharacters {
  // The scales squashed models had before the spring touched them, so `rest` puts them back exactly.
  const resting = new Map<number, { readonly x: number; readonly y: number; readonly z: number }>()
  return {
    point(ref) {
      const model = consumer.viewOf(ref)?.container
      if (model === undefined) return undefined
      const { x, y, z } = model.getGlobalPosition()
      const screen = view.worldToScreen({ x, y: y + height, z })
      if (screen === null) return undefined
      const at = ui.toLocal(screen)
      return { x: at.x, y: at.y }
    },
    squash(ref, x, y) {
      const model = consumer.viewOf(ref)?.container
      if (model === undefined) return
      let base = resting.get(ref)
      if (base === undefined) {
        base = { x: model.scale.x, y: model.scale.y, z: model.scale.z }
        resting.set(ref, base)
      }
      // The spring widens or narrows the body on the ground, so both ground axes follow its x (up is y).
      model.scale.set(base.x * x, base.y * y, base.z * x)
    },
    rest(ref) {
      const base = resting.get(ref)
      if (base === undefined) return
      consumer.viewOf(ref)?.container.scale.set(base.x, base.y, base.z)
      resting.delete(ref)
    },
    hold: (refs) => consumer.hold(refs),
  }
}
