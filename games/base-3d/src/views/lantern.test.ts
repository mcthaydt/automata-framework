// Wick's lantern (art direction spec §2, §3.4): Emberwick's Wick carries a warm light; here it rides in the hero
// view's container, so it follows him and turns with him, and the wrapped view still updates and is destroyed as before.
import type { View3dFactory } from '@mcthaydt/automata-render-pixi3d'
import { Container3D, FlatMaterial, Mesh3D, ParticleContainer3D, PointLight } from '@pixi/3d'
import { describe, expect, it, vi } from 'vitest'
import { LANTERN, withLantern } from './lantern.ts'
import { colour } from './palette.ts'

const row = { sid: 1, components: {} }

describe('withLantern', () => {
  it('adds the lantern and its halo to the figure’s container, and no real-time light (the night is baked)', () => {
    const container = new Container3D()
    const inner: View3dFactory = () => ({ container })
    const view = withLantern(inner, () => 0)(row, 'hero', undefined as never, undefined)
    expect(view?.container).toBe(container)
    expect(container.children.filter((c) => c instanceof PointLight)).toHaveLength(0)
    const lantern = container.children.find(
      (c): c is Mesh3D => c instanceof Mesh3D && !(c instanceof ParticleContainer3D),
    )
    expect(lantern?.material).toBeInstanceOf(FlatMaterial)
    expect(lantern?.position.y).toBeCloseTo(LANTERN.y)
    expect(container.children.length).toBe(2)
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
