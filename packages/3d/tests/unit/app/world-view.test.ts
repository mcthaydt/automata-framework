// The world on `@pixi/3d`: a mesh for each piece, the swatch's colour on it, and the occluder rule on walls and ceilings.
import { Container3D, FlatMaterial, type Mesh3D, PhongMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { drawWorld, sceneLamps } from '#src/app/world-view.ts'
import { createOccluders } from '#src/features/camera/occluders/occluders.ts'
import { ladderOf } from '#src/features/world/albedo/ladder.ts'
import { buildWorld, type WorldPiece } from '#src/features/world/build.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import { createSceneLight } from '#src/shared/render/light/scene-light.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import { toLinear } from '#src/shared/render/light/vertex-light.ts'

const LIB = { swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {} } }
const level: AfSector2 = {
  format: 'af-sector/2',
  name: 't',
  sectors: [
    {
      id: 'a',
      floor: { z: 0 },
      ceiling: { z: 3 },
      light: 1,
      corners: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
    },
  ],
}
const colours: Record<string, number> = { oakFloor: 0x8690b2, plasterWarm: 0x3a4568 }
const { pieces } = buildWorld(level, LIB)

describe('drawWorld', () => {
  it('adds a mesh for each piece under one node, in the swatch’s colour', () => {
    const parent = new Container3D()
    const view = drawWorld({ parent, colourOf: (name) => colours[name] }, pieces)
    expect(view.node.parent).toBe(parent)
    expect(view.node.children).toHaveLength(pieces.length)
    const floor = view.mesh('a:floor') as Mesh3D
    expect((floor.material as PhongMaterial).baseColor).toBe(0x8690b2)
  })
  it('draws a swatch it does not know in the fallback colour', () => {
    const view = drawWorld(
      { parent: new Container3D(), colourOf: () => undefined, fallback: 0x123456 },
      pieces,
    )
    expect(((view.mesh('a:floor') as Mesh3D).material as PhongMaterial).baseColor).toBe(0x123456)
  })
  it('bakes a light into the pieces that stay put, and leaves a door a lit mesh that can swing', () => {
    const withDoor = buildWorld(
      { ...level, sectors: level.sectors.map((s) => ({ ...s, door: {} })) },
      LIB,
    ).pieces
    const light = createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.2,
        lamps: [{ id: 'l', x: 2, y: 2, z: 2, color: 0xffffff, range: 6 }],
      }),
    )
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0x808080, light }, withDoor)
    const floor = view.mesh('a:floor') as Mesh3D
    expect(floor.material.vertexColors).toBe(true)
    expect(floor.material).not.toBeInstanceOf(PhongMaterial)
    const door = withDoor.find((p) => p.door !== undefined)
    expect(door).toBeDefined()
    const hung = view.mesh(door?.id as string) as Mesh3D
    expect(hung.material.vertexColors).toBe(false)
    expect(hung.material).toBeInstanceOf(PhongMaterial)
  })
  it('bakes each piece’s room shade and its swatch colour into the light', () => {
    const light = createSceneLight(sceneLightingSchema.parse({ ambient: 0.4, colorSpace: 'srgb' }))
    const dark = { ...level, sectors: level.sectors.map((s) => ({ ...s, light: 0 })) }
    const draw = (lv: AfSector2) => {
      const view = drawWorld(
        { parent: new Container3D(), colourOf: () => 0xffffff, light },
        buildWorld(lv, LIB).pieces,
      )
      const colours = (view.mesh('a:floor') as Mesh3D).geometry.attributes.aColor?.buffer.data as Float32Array
      return colours[0] as number
    }
    // A white swatch under an sRGB light of 0.4 is a linear 0.4 over 1; a room one step darker (light 0) takes 0.85 of it.
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    expect(draw(level)).toBeCloseTo(lin(0.4), 5)
    expect(draw(dark)).toBeCloseTo(lin(0.4 * 0.85), 5)
  })
  it('gives each mesh the geometry of its piece', () => {
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, pieces)
    const floor = pieces.find((p) => p.id === 'a:floor')
    const mesh = view.mesh('a:floor') as Mesh3D
    expect(mesh.geometry.vertexCount).toBe((floor?.mesh.positions.length as number) / 3)
  })
  it('registers the walls with the occluder rule and hides the ceiling', () => {
    const parent = new Container3D()
    const occluders = createOccluders(parent)
    const view = drawWorld({ parent, occluders, colourOf: () => 0 }, pieces)
    const eye = { x: 2, y: 3, z: 9 }
    const frame = {
      eye,
      look: { x: 2, y: 1, z: 2 },
      feet: { x: 2, y: 0, z: 2 },
      head: { x: 2, y: 1.6, z: 2 },
      seconds: 1,
      reduced: true,
    }
    occluders.update(frame)
    // The ceiling is never drawn; the south wall stands between the eye and the player, so it is cut.
    expect((view.mesh('a:ceiling') as Mesh3D).visible).toBe(false)
    expect((view.mesh('a:wall:0.2.0') as Mesh3D).visible).toBe(false)
    // The north wall faces the eye from behind the player; it stays.
    expect((view.mesh('a:wall:0.0.0') as Mesh3D).visible).toBe(true)
    expect((view.mesh('a:floor') as Mesh3D).visible).toBe(true)
  })
  it('takes the meshes down on dispose', () => {
    const parent = new Container3D()
    const view = drawWorld({ parent, colourOf: () => 0 }, pieces)
    view.dispose()
    expect(parent.children).toHaveLength(0)
  })

  it('lays a swatch’s tile on a piece: its uvs, the texture, and no flat colour; light bakes without the albedo', () => {
    const tile = {
      width: 2,
      height: 2,
      texels: [2, 2] as [number, number],
      seed: 0,
      rgba: new Uint8Array(16).fill(255),
    }
    const parent = new Container3D()
    const view = drawWorld(
      {
        parent,
        colourOf: (name) => colours[name],
        tiles: (name) => (name === 'oakFloor' ? tile : undefined),
      },
      pieces,
    )
    const floor = view.mesh('a:floor') as Mesh3D
    expect((floor.material as PhongMaterial).textures.baseColor).toBeDefined()
    expect((floor.material as PhongMaterial).baseColor).toBe(0xffffff)
    expect(floor.geometry.attributes.aUV).toBeDefined()
    // a swatch with no tile keeps its colour
    expect(
      ((view.mesh('a:wall:0') ?? view.node.children[1]) as Mesh3D).geometry.attributes.aUV,
    ).toBeUndefined()
  })
})

describe('sceneLamps', () => {
  const lamps = buildWorld(
    {
      ...level,
      lamps: [
        { id: 'in', kind: 'bulb', at: [1, 2, 2.5] },
        { id: 'street', kind: 'sodium', at: [3, 3, 4] },
      ],
    },
    LIB,
  ).lamps

  it('gives each lamp its place, colour, reach and level for the scene light', () => {
    expect(sceneLamps(lamps)[0]).toEqual({
      id: 'in',
      x: 1,
      y: 2.5,
      z: 2,
      color: 0xffce7f,
      strength: 1,
      range: 4.75,
      level: 1,
    })
  })

  it('burns a lamp at the level its state says, in the colour its state gives', () => {
    const lit = sceneLamps(lamps, true, { in: { level: 0.5, color: 0x112233 } })
    expect(lit[0]).toMatchObject({ id: 'in', level: 0.5, color: 0x112233 })
    // A lamp with no state, and a lamp put out, are as asked.
    expect(lit[1]).toMatchObject({ id: 'street', level: 1, color: lamps[1]?.color })
    expect(sceneLamps(lamps, true, { in: { level: 0 } })[0]?.level).toBe(0)
  })

  it('leaves out a street lamp by day, which only a night lights', () => {
    expect(sceneLamps(lamps, true).map((lamp) => lamp.id)).toEqual(['in', 'street'])
    expect(sceneLamps(lamps, false).map((lamp) => lamp.id)).toEqual(['in'])
  })
})

// A glowing swatch is drawn at its own step whatever the light, and dims with the lamp of the prop it belongs to.
describe('drawWorld: glow', () => {
  const quad = {
    positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
  const bulb: WorldPiece = {
    id: 'lamp:bulb',
    sector: 'a',
    light: 1,
    part: 'prop',
    mesh: quad,
    surface: 'bulbWarm',
    prop: { id: 'lamp', at: [0, 0, 0] },
  }
  const ember = ladderOf({ ramp: 'ember', step: 7 })
  const glow = (name: string) => (name === 'bulbWarm' ? { ramp: 'ember' as const, step: 7 } : undefined)
  const room = () =>
    createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0,
        colorSpace: 'srgb',
        lamps: [{ id: 'lamp.light0', x: 5, y: 5, z: 5, color: 0xffffff, range: 6 }],
      }),
    )
  const first = (mesh: Mesh3D) => {
    const data = mesh.geometry.attributes.aColor?.buffer.data as Float32Array
    return [data[0], data[1], data[2]]
  }
  const linear = (rgb: number) =>
    [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255].map((c) => Math.fround(toLinear(c / 255)))

  it('draws an unlit glow in its own step, with no light to take', () => {
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0, glow }, [bulb])
    const material = (view.mesh('lamp:bulb') as Mesh3D).material as FlatMaterial
    expect(material).toBeInstanceOf(FlatMaterial)
    expect(material.baseColor).toBe(ember.steps[7])
  })

  it('bakes a glow at its own step in a room the lamps do not reach, even on a piece that moves', () => {
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0, glow, light: room() }, [bulb])
    const mesh = view.mesh('lamp:bulb') as Mesh3D
    expect(mesh.material.vertexColors).toBe(true)
    expect(first(mesh)).toEqual(linear(ember.steps[7] as number))
  })

  it('draws a lit window’s glass as the room behind it, a texture whatever the light', () => {
    const { prop: _lamp, ...bare } = bulb
    const pane: WorldPiece = { ...bare, id: 'a:glass', part: 'decor', surface: 'windowLit' }
    const lit = (name: string) =>
      name === 'windowLit' ? { ramp: 'flame' as const, step: 6, interior: true } : undefined
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0, glow: lit, light: room() }, [pane])
    const mesh = view.mesh('a:glass') as Mesh3D
    expect(mesh.geometry.attributes.aUV).toBeDefined()
    expect((mesh.material as FlatMaterial).textures.baseColor).toBeDefined()
    expect(mesh.material.vertexColors).toBe(false)
  })

  it('dims with the lamp of its prop when the lamp’s level changes', () => {
    const light = room()
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0, glow, light }, [bulb])
    light.setLevels({ 'lamp.light0': 0.5 })
    expect(first(view.mesh('lamp:bulb') as Mesh3D)).toEqual(linear(ember.steps[5] as number))
  })
})

// A prop that stays put takes the room's baked light as scenery does; one a state moves has its light taken again where it
// lands, and a swaying leaf keeps its own material.
describe('drawWorld: props', () => {
  const quad = {
    positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2, 0, 2, 3],
  }
  const crate: WorldPiece = {
    id: 'crate:body',
    sector: 'a',
    light: 1,
    part: 'prop',
    mesh: quad,
    surface: 'wood',
    prop: { id: 'crate', at: [0, 0, 0] },
  }
  const light = () =>
    createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.1,
        colorSpace: 'srgb',
        lamps: [{ id: 'lamp', x: 0.5, y: 0.5, z: 2, color: 0xffffff, range: 6 }],
        boxes: [{ id: 'crate:body', x: 0.5, y: 0, z: 0, width: 1, height: 1, depth: 0.2 }],
      }),
    )
  const first = (mesh: Mesh3D) =>
    ((mesh.geometry.attributes.aColor?.buffer.data ?? []) as Float32Array)[0] as number

  it('bakes a prop’s light into its vertex colours, on a flat material', () => {
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0xffffff, light: light() }, [crate])
    const mesh = view.mesh('crate:body') as Mesh3D
    expect(mesh.material).toBeInstanceOf(FlatMaterial)
    expect(mesh.material.vertexColors).toBe(true)
  })
  it('leaves a swaying leaf on its own material, which light cannot be baked into', () => {
    const leaf: WorldPiece = { ...crate, id: 'tree:leaves', sway: 0.1, phase: 0 }
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0xffffff, light: light() }, [leaf])
    expect((view.mesh('tree:leaves') as Mesh3D).material.vertexColors).toBe(false)
  })
  it('does not shade a prop with its own box', () => {
    const near = light()
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0xffffff, light: near }, [crate])
    // The lamp is in front of the face: lit, not in the shadow of the prop’s own box.
    expect(first(view.mesh('crate:body') as Mesh3D)).toBeGreaterThan(0.2)
  })
  it('takes the light again where a moved prop now stands', () => {
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0xffffff, light: light() }, [crate])
    const mesh = view.mesh('crate:body') as Mesh3D
    const before = first(mesh)
    mesh.position.set(0, 0, -30)
    view.relight('crate:body')
    // Thirty metres behind the lamp's reach: the ambient alone.
    expect(first(mesh)).toBeLessThan(before)
  })
})
