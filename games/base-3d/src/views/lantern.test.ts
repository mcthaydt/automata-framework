// Wick's lantern (art direction spec §2, §3.4): Emberwick's Wick carries a warm light; here it rides in the hero
// view's container, so it follows him and turns with him, and the wrapped view still updates and is destroyed as before.
import type { View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Container3D, PointLight } from '@pixi/3d'
import { describe, expect, it, vi } from 'vitest'
import { LANTERN, withLantern } from './lantern.ts'
import { colour } from './palette.ts'

const row = { sid: 1, components: {} }

describe('withLantern', () => {
  it('adds a warm light, a lantern, its halo and a cool rim light to the figure’s container', () => {
    const container = new Container3D()
    const inner: View3dFactory = () => ({ container })
    const view = withLantern(inner, () => 0)(row, 'hero', undefined as never, undefined)
    expect(view?.container).toBe(container)
    const lights = container.children.filter((c): c is PointLight => c instanceof PointLight)
    expect(lights).toHaveLength(2)
    const [lamp, rim] = lights
    expect(lamp?.range).toBe(LANTERN.range)
    expect(lamp?.position.y).toBeGreaterThan(0.3)
    // A cool light over his hood (the 2D sprite's cyan rim), so Wick reads against the dark from behind.
    expect(rim?.position.y).toBeGreaterThan(1.5)
    expect(rim?.color.toNumber()).toBe(colour('moonlight'))
    expect(container.children.length).toBe(4)
    expect(colour('lantern')).toBe(0xffc825)
  })

  it('passes updates and destruction through to the figure', () => {
    const update = vi.fn()
    const destroy = vi.fn()
    const inner: View3dFactory = () => ({ container: new Container3D(), update, destroy })
    const view = withLantern(inner, () => 1)(row, 'hero', undefined as never, undefined)
    view?.update?.({}, undefined, 0.5)
    expect(update).toHaveBeenCalledWith({}, undefined, 0.5)
    view?.destroy?.()
    expect(destroy).toHaveBeenCalled()
  })

  it('draws nothing when the figure draws nothing, and keeps the factory’s models', () => {
    const inner = Object.assign((() => undefined) as View3dFactory, { models: ['a.glb'] })
    const wrapped = withLantern(inner, () => 0)
    expect(wrapped(row, 'hero', undefined as never, undefined)).toBeUndefined()
    expect(wrapped.models).toEqual(['a.glb'])
  })
})
