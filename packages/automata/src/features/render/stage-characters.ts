// What a game that dresses characters (Feel's squash, freeze and words) asks of the stage, in the characters' own terms.
// The 2D renderer answers over its delta consumer; a 3D renderer answers over its own and replaces this port when it
// mounts (`PixiStage.useCharacters`), so one game-side file serves both kinds.
import type { Container } from 'pixi.js'
import type { RenderDeltaConsumer } from './delta/render-delta-consumer.js'

/** The stage's port for characters, keyed by the sim's stable id of the character. */
export interface StageCharacters {
  /** Where a word above a character sits, in `stage.ui`'s coordinates, or `undefined` when it has no view. */
  point(ref: number): { readonly x: number; readonly y: number } | undefined
  /** Scales a character's view by `x` and `y` from the scale it rests at. */
  squash(ref: number, x: number, y: number): void
  /** Puts a squashed character's scale back. */
  rest(ref: number): void
  /** Holds these characters' poses until the next call. */
  hold(refs: ReadonlySet<number>): void
}

/** The 2D answer: a character's view is its container, and a word sits at the view's own position. */
export function characters2d(consumer: RenderDeltaConsumer, ui: Container): StageCharacters {
  // The scales squashed views had before the spring touched them, so `rest` puts them back exactly.
  const resting = new Map<number, { readonly x: number; readonly y: number }>()
  return {
    point(ref) {
      const view = consumer.viewOf(ref)
      if (view === undefined) return undefined
      const at = ui.toLocal(view.container.getGlobalPosition())
      return { x: at.x, y: at.y }
    },
    squash(ref, x, y) {
      const container = consumer.viewOf(ref)?.container
      if (container === undefined) return
      let base = resting.get(ref)
      if (base === undefined) {
        base = { x: container.scale.x, y: container.scale.y }
        resting.set(ref, base)
      }
      container.scale.set(base.x * x, base.y * y)
    },
    rest(ref) {
      const base = resting.get(ref)
      if (base === undefined) return
      consumer.viewOf(ref)?.container.scale.set(base.x, base.y)
      resting.delete(ref)
    },
    hold: (refs) => consumer.hold(refs),
  }
}
