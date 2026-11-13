import { Container3D, type Mesh3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { drawLightPatches } from '#src/features/look/light-patch-view.ts'

// A patch drawn: one quad a hair above the floor for each patch, added to what is under it and lit by nothing, shown while a room
// it names is drawn. `light-patch.test.ts` has the geometry and the texels; these are the meshes in the scene.

const window = [0, 0] as const
const hall = { id: 'hall-moon', window, centre: [0, 3] as const, width: 1.4, length: 4.6, rooms: ['hall'] }
const everywhere = { id: 'always', window, centre: [4, 0] as const, width: 1, length: 2 }

describe('drawLightPatches', () => {
  it('adds one mesh for each patch, and none for none', () => {
    const empty = new Container3D()
    drawLightPatches(empty, [])
    expect(empty.children).toHaveLength(0)
    const parent = new Container3D()
    drawLightPatches(parent, [hall, everywhere])
    expect(parent.children).toHaveLength(2)
  })

  it('draws a quad that adds to the picture, takes no light and no fog, and casts no shadow', () => {
    const parent = new Container3D()
    drawLightPatches(parent, [hall])
    const mesh = parent.children[0] as Mesh3D
    expect(mesh.castShadow).toBe(false)
    expect(mesh.material?.state.blendMode).toBe('add')
    expect(mesh.material?.doubleSided).toBe(true)
    expect(mesh.geometry.positions).toHaveLength(12)
    // It lies a hair above the floor, so the floor's own depth does not fight it.
    for (let i = 1; i < 12; i += 3) expect(mesh.geometry.positions[i] as number).toBeGreaterThan(0)
  })

  it('shows a patch only while a room it names is drawn, and every patch for no set of rooms', () => {
    const parent = new Container3D()
    const patches = drawLightPatches(parent, [hall, everywhere])
    const [named, always] = parent.children as Mesh3D[]
    patches.showRooms(new Set(['corridor']))
    expect([named?.visible, always?.visible]).toEqual([false, true])
    patches.showRooms(new Set(['hall']))
    expect([named?.visible, always?.visible]).toEqual([true, true])
    patches.showRooms(undefined)
    expect([named?.visible, always?.visible]).toEqual([true, true])
  })

  it('lets its meshes go', () => {
    const parent = new Container3D()
    const patches = drawLightPatches(parent, [hall])
    const mesh = parent.children[0] as Mesh3D
    patches.destroy()
    expect(mesh.destroyed).toBe(true)
  })
})
