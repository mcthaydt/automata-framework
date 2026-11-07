import type { RenderRow } from '@automata/sim'
import { Container3D, FlatMaterial, Mesh3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { createSceneLight } from '../light/scene-light.ts'
import { sceneLightingSchema } from '../light/scene-lighting.schema.ts'
import { emptyModels } from '../model/load-models.ts'
import { box } from './box-view.ts'

const row: RenderRow = { sid: 1, components: { crate: { x: 0, y: 0, z: 0 } } }

describe('box', () => {
  it('stands a box of the given size on its position, interpolated and turned by yaw', () => {
    const view = box({ width: 1, height: 2, depth: 0.5 }, { color: 0xf9c22b })(row, 'crate', emptyModels)
    if (view === undefined) throw new Error('no view')
    expect(view.container).toBeInstanceOf(Container3D)
    const mesh = view.container.children[0]
    expect(mesh).toBeInstanceOf(Mesh3D)
    // Its base sits on the entity's position: the cube is centred, so it is lifted by half its height.
    expect(mesh?.position.y).toBe(1)

    view.update?.({ crate: { x: 4, y: 0, z: 2, yaw: 1 } }, { crate: { x: 2, y: 0, z: 0, yaw: 0 } }, 0.5)
    expect([view.container.position.x, view.container.position.y, view.container.position.z]).toEqual([
      3, 0, 1,
    ])
    expect(view.container.rotation.y).toBeCloseTo(0.5)
  })

  it('shares one geometry and one material between the boxes of a factory', () => {
    const make = box({ width: 1, height: 1, depth: 1 }, { color: 0x249fde })
    const a = make(row, 'crate', emptyModels)?.container.children[0] as Mesh3D
    const b = make(row, 'crate', emptyModels)?.container.children[0] as Mesh3D
    expect(a.geometry).toBe(b.geometry)
    expect(a.material).toBe(b.material)
  })

  it('destroys its nodes but keeps the shared geometry for the other boxes', () => {
    const make = box({ width: 1, height: 1, depth: 1 }, { color: 0x249fde })
    const view = make(row, 'crate', emptyModels)
    const mesh = view?.container.children[0] as Mesh3D
    const geometry = mesh.geometry
    view?.destroy?.()
    expect(view?.container.destroyed).toBe(true)
    const next = make(row, 'crate', emptyModels)?.container.children[0] as Mesh3D | undefined
    expect(next?.geometry).toBe(geometry)
  })

  it("lit 'static': bakes the room's light into its own geometry once, at its first pose", () => {
    const light = createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.25,
        lamps: [{ id: 'lamp', x: 0, y: 2, z: 0, color: 0xffffff, strength: 2, range: 4 }],
      }),
    )
    const make = box({ width: 1, height: 1, depth: 1 }, { color: 0x808080, lit: 'static' })
    const near = make(row, 'crate', emptyModels, light)?.container.children[0] as Mesh3D
    const far = make({ sid: 2, components: { crate: { x: 20, y: 0, z: 0 } } }, 'crate', emptyModels, light)
      ?.container.children[0] as Mesh3D
    expect(near.geometry).not.toBe(far.geometry)
    expect(near.material.vertexColors).toBe(true)
    const brightest = (mesh: Mesh3D) =>
      Math.max(
        ...Array.from(mesh.geometry.attributes.aColor?.buffer.data ?? []).filter((_, i) => i % 4 !== 3),
      )
    expect(brightest(near)).toBeGreaterThan(0.5)
    expect(brightest(far)).toBeLessThan(0.3)
    light.setLevels({ lamp: 0 })
    expect(brightest(near)).toBeLessThan(0.3)
  })

  it("lit 'static': is subdivided every 25 cm or less, so vertex light has vertices to land on", () => {
    const plain = box({ width: 4, height: 1, depth: 2 }, { color: 1 })(row, 'crate', emptyModels)
    const lit = box({ width: 4, height: 1, depth: 2 }, { color: 1, lit: 'static' })(row, 'crate', emptyModels)
    const vertices = (view: typeof plain) =>
      (view?.container.children[0] as Mesh3D | undefined)?.geometry.vertexCount
    expect(vertices(plain)).toBe(24)
    // Top and bottom 16 × 8 cells, front and back 16 × 4, the sides 8 × 4: (17·9 + 17·5 + 9·5) · 2 vertices.
    expect(vertices(lit)).toBe((17 * 9 + 17 * 5 + 9 * 5) * 2)
  })

  it("lit 'static': a destroyed box leaves the light, so a lamp change no longer rebakes it", () => {
    const light = createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.25,
        lamps: [{ id: 'lamp', x: 0, y: 2, z: 0, color: 0xffffff, strength: 2, range: 4 }],
      }),
    )
    const view = box({ width: 1, height: 1, depth: 1 }, { color: 0x808080, lit: 'static' })(
      row,
      'crate',
      emptyModels,
      light,
    )
    view?.destroy?.()
    light.setLevels({ lamp: 0 })
    expect(light.rebakes).toBe(0)
  })

  it("lit 'moving': takes the scene light’s tint at its pose each frame, on its own flat material (M3R-D4)", () => {
    const light = createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.25,
        lamps: [{ id: 'lamp', x: 0, y: 2, z: 0, color: 0xffffff, strength: 2, range: 4 }],
      }),
    )
    const make = box({ width: 1, height: 1, depth: 1 }, { color: 0x808080, lit: 'moving' })
    const view = make(row, 'crate', emptyModels, light)
    const other = make(row, 'crate', emptyModels, light)
    if (view === undefined || other === undefined) throw new Error('no view')
    const material = (view.container.children[0] as Mesh3D).material
    expect(material).toBeInstanceOf(FlatMaterial)
    expect((other.container.children[0] as Mesh3D).material).not.toBe(material)

    view.update?.({ crate: { x: 10, y: 0, z: 0 } }, undefined, 1)
    // Out of the lamp's range: a quarter of 0x80 in linear light (0.2158 × 0.25), back in sRGB: 0x42.
    expect(material.baseColor).toBe(0x424242)
    view.update?.({ crate: { x: 0, y: 0, z: 0 } }, undefined, 1)
    expect(material.baseColor).toBeGreaterThan(0x424242)
    light.setLevels({ lamp: 0 })
    view.update?.({ crate: { x: 0, y: 0, z: 0 } }, undefined, 1)
    expect(material.baseColor).toBe(0x424242)
  })

  it('lit without a scene light is the plain shared box', () => {
    const make = box({ width: 1, height: 1, depth: 1 }, { color: 0x808080, lit: 'moving' })
    const a = make(row, 'crate', emptyModels)?.container.children[0] as Mesh3D
    const b = make(row, 'crate', emptyModels)?.container.children[0] as Mesh3D
    expect(a.material).toBe(b.material)
  })
})
