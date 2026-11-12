import type { RenderDeltaConsumer } from '@automata/framework'
import { Container } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { characters3d } from '#src/app/characters-3d.ts'

// In a 3D game a character is not a flat picture on the stage: a word above it is the screen point of its head, and a
// squash scales its model. Feel asks the stage; this answers over the 3D views, without a renderer or a GPU.

interface Fake {
  position: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number; set(x: number, y: number, z: number): void }
  getGlobalPosition(): { x: number; y: number; z: number }
}
const model = (x: number, y: number, z: number): Fake => {
  const fake: Fake = {
    position: { x, y, z },
    scale: {
      x: 1,
      y: 1,
      z: 1,
      set(sx, sy, sz) {
        fake.scale.x = sx
        fake.scale.y = sy
        fake.scale.z = sz
      },
    },
    getGlobalPosition: () => fake.position,
  }
  return fake
}

function setup(project: (p: { x: number; y: number; z: number }) => { x: number; y: number } | null) {
  const ui = new Container()
  ui.position.set(10, 20)
  const body = model(1, 0, 2)
  const hold = vi.fn()
  const consumer = {
    viewOf: (ref: number) => (ref === 3 ? { container: body } : undefined),
    hold,
  } as unknown as RenderDeltaConsumer<never>
  const asked: { x: number; y: number; z: number }[] = []
  const view = {
    worldToScreen: (position: { x: number; y: number; z: number }) => {
      asked.push({ ...position })
      return project(position)
    },
  }
  return { characters: characters3d(consumer, view as never, ui, 1.5), body, hold, asked, ui }
}

describe('characters3d', () => {
  it('puts a word at the screen point of the character’s head, in the ui layer’s own coordinates', () => {
    const { characters, asked } = setup(() => ({ x: 110, y: 220 }))
    // The ui layer sits at (10, 20) in the global frame, so a global (110, 220) is (100, 200) inside it.
    expect(characters.point(3)).toEqual({ x: 100, y: 200 })
    expect(asked).toEqual([{ x: 1, y: 1.5, z: 2 }])
  })

  it('has no point for a character behind the camera, or one with no view', () => {
    expect(setup(() => null).characters.point(3)).toBeUndefined()
    expect(setup(() => ({ x: 0, y: 0 })).characters.point(9)).toBeUndefined()
  })

  it('squashes the model from the scale it rests at, widening both ground axes, and rest puts it back', () => {
    const { characters, body } = setup(() => null)
    body.scale.set(2, 2, 2)
    characters.squash(3, 1.25, 0.8)
    expect([body.scale.x, body.scale.y, body.scale.z]).toEqual([2.5, 1.6, 2.5])
    characters.squash(3, 1.5, 0.5)
    expect([body.scale.x, body.scale.y, body.scale.z]).toEqual([3, 1, 3])
    characters.rest(3)
    expect([body.scale.x, body.scale.y, body.scale.z]).toEqual([2, 2, 2])
    characters.squash(9, 2, 2)
    characters.rest(9)
  })

  it('holds the poses it is given', () => {
    const { characters, hold } = setup(() => null)
    const refs = new Set([3])
    characters.hold(refs)
    expect(hold).toHaveBeenCalledWith(refs)
  })
})
