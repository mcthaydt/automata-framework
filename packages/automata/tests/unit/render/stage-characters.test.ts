import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import type { RenderDeltaConsumer } from '#src/features/render/delta/render-delta-consumer.ts'
import { characters2d } from '#src/features/render/stage-characters.ts'

// A character's picture is the stage's to move; the games that dress it (Feel's squash, freeze and words) ask the stage
// port instead of reaching into the 2D consumer, so a 3D renderer can answer the same questions.

function setup() {
  const ui = new Container()
  const world = new Container()
  ui.position.set(5, 7)
  const view = new Container()
  view.position.set(40, 60)
  world.addChild(view)
  const hold = vi.fn()
  const consumer = {
    viewOf: (ref: number) => (ref === 1 ? { container: view } : undefined),
    hold,
  } as unknown as RenderDeltaConsumer
  return { characters: characters2d(consumer, ui), view, hold, ui }
}

describe('characters2d', () => {
  it('puts a word at the view’s position in the ui layer, and nowhere for a character with no view', () => {
    const { characters, ui, view } = setup()
    const global = view.getGlobalPosition()
    const local = ui.toLocal(global)
    expect(characters.point(1)).toEqual({ x: local.x, y: local.y })
    expect(characters.point(2)).toBeUndefined()
  })

  it('squashes from the scale a character rests at, and rest puts it back exactly', () => {
    const { characters, view } = setup()
    view.scale.set(1.5, 2)
    characters.squash(1, 1.2, 0.8)
    expect([view.scale.x, view.scale.y]).toEqual([1.5 * 1.2, 2 * 0.8])
    // A second frame of the same squash starts from the resting scale, not the squashed one.
    characters.squash(1, 1.1, 0.9)
    expect([view.scale.x, view.scale.y]).toEqual([1.5 * 1.1, 2 * 0.9])
    characters.rest(1)
    expect([view.scale.x, view.scale.y]).toEqual([1.5, 2])
    // Resting a character that was never squashed changes nothing.
    characters.rest(1)
    expect([view.scale.x, view.scale.y]).toEqual([1.5, 2])
  })

  it('ignores a squash for a character with no view', () => {
    const { characters } = setup()
    expect(() => characters.squash(9, 2, 2)).not.toThrow()
  })

  it('holds the poses it is given until the next call', () => {
    const { characters, hold } = setup()
    const refs = new Set([1])
    characters.hold(refs)
    expect(hold).toHaveBeenCalledWith(refs)
  })
})
