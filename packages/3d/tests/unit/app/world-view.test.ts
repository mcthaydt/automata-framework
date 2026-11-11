// The world on `@pixi/3d`: a mesh for each piece, the swatch's colour on it, and the occluder rule on walls and ceilings.
import { Container3D, type Mesh3D, PhongMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { drawWorld, sceneLamps } from '#src/app/world-view.ts'
import { createOccluders } from '#src/features/camera/occluders/occluders.ts'
import { buildWorld } from '#src/features/world/build.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import { createSceneLight } from '#src/shared/render/light/scene-light.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'

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
