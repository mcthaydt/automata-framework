// A prop that names a model: when the model is loaded the mesh draws, fitted to the blockout, and the blockout's generated
// parts do not; a prop that names none draws its blockout; a named model that is not loaded fails with its file's name. The
// blockout's pieces stay in the world either way, since they are the footprint, the height and the collider.
import { Container3D, FlatMaterial, type Mesh3D, PhongMaterial } from '@pixi/3d'
import { Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { updatePieces } from '#src/app/update-pieces.ts'
import { drawWorld } from '#src/app/world-view.ts'
import { createOccluders } from '#src/features/camera/occluders/occluders.ts'
import { buildWorld } from '#src/features/world/build.ts'
import { box } from '#src/features/world/mesh.ts'
import { part } from '#src/features/world/props/piece.ts'
import { registerPropGenerator } from '#src/features/world/props/prop-generator-registry.ts'
import type { AfSector2 } from '#src/shared/level/af-sector-2.schema.ts'
import { noPieceStates } from '#src/shared/level/piece-states.ts'
import { createSceneLight } from '#src/shared/render/light/scene-light.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'
import type { LoadedModel, ModelLibrary } from '#src/shared/render/model/load-models.ts'
import { modelGeometry } from '#src/shared/render/model/model-geometry.ts'
import { parseGlb } from '#src/shared/render/model/parse-glb.ts'
import { encodeGlb, fixtureBox } from '#src/testing/model/model-fixtures.ts'

const room = (id: string, x0: number) => ({
  id,
  floor: { z: 0 },
  ceiling: { z: 3 },
  light: 1,
  corners: [
    [x0, 0],
    [x0 + 6, 0],
    [x0 + 6, 6],
    [x0, 6],
  ] as [number, number][],
})
const level: AfSector2 = {
  format: 'af-sector/2',
  name: 't',
  sectors: [room('hall', 0), room('cell', 10)],
  props: [
    { id: 'chest', at: [2, 2], use: 'crate', model: 'models/chest.bin' },
    { id: 'plain', at: [4, 4], use: 'crate' },
    { id: 'far', at: [12, 2], use: 'crate', model: 'models/chest.bin' },
  ],
}
const LIB = {
  swatches: { oakFloor: {}, plasterWarm: {}, trimWhite: {}, crate: {} },
  props: { crate: { kind: 'box', swatch: 'crate', size: [1, 1, 1] } },
}
const world = buildWorld(level, LIB)

/** A library of one model, 2 m wide, 4 m tall and 2 m deep, with its origin at its middle (Node has no image decoder). */
function libraryWith(file: string): ModelLibrary {
  const parsed = parseGlb(encodeGlb(fixtureBox([-1, -2, -1], [1, 2, 1])), file)
  const model: LoadedModel = {
    mesh: parsed,
    geometry: modelGeometry(parsed),
    material: new PhongMaterial(),
    texture: Texture.WHITE,
  }
  return { get: (name) => (name === file ? model : undefined) }
}
const models = libraryWith('models/chest.bin')
const draw = (options: Parameters<typeof drawWorld>[2] = { props: world.props, models }) =>
  drawWorld({ parent: new Container3D(), colourOf: () => 0 }, world.pieces, options)
const piecesOf = (prop: string) => world.pieces.filter((piece) => piece.prop?.id === prop)

describe('drawWorld with models', () => {
  it('draws the model of a prop that names one, and not that prop’s blockout', () => {
    const view = draw()
    expect(view.mesh('model:chest')).toBeDefined()
    for (const piece of piecesOf('chest')) expect(view.mesh(piece.id), piece.id).toBeUndefined()
  })

  it('draws the blockout of a prop that names no model', () => {
    const view = draw()
    expect(view.mesh('model:plain')).toBeUndefined()
    for (const piece of piecesOf('plain')) expect(view.mesh(piece.id), piece.id).toBeDefined()
  })

  it('draws a level with no model, and no models, exactly as before: one mesh a piece', () => {
    const bare = buildWorld({ ...level, props: [{ id: 'plain', at: [4, 4], use: 'crate' }] }, LIB)
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, bare.pieces)
    expect(view.node.children).toHaveLength(bare.pieces.length)
  })

  it('fits the mesh inside the blockout, resting on its base: a 2 by 4 by 2 model in a 1 m box is 0.5 m wide and 1 m tall', () => {
    const mesh = draw().mesh('model:chest') as Mesh3D
    const positions = mesh.geometry.attributes.aPosition?.buffer.data as Float32Array
    const low: number[] = [Infinity, Infinity, Infinity]
    const high: number[] = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < positions.length; i += 3)
      for (const axis of [0, 1, 2]) {
        low[axis] = Math.min(low[axis] as number, positions[i + axis] as number)
        high[axis] = Math.max(high[axis] as number, positions[i + axis] as number)
      }
    const [lx, ly, lz] = low as [number, number, number]
    const [hx, hy, hz] = high as [number, number, number]
    const [blockout] = world.props
    // The box is 1 m each way about (2, 2): the model is as tall as it, and half as wide, centred on the footprint.
    expect(ly).toBeCloseTo(blockout?.min[1] as number, 5)
    expect(hy).toBeCloseTo(blockout?.max[1] as number, 5)
    expect(hx - lx).toBeCloseTo(0.5, 5)
    expect((lx + hx) / 2).toBeCloseTo(2, 5)
    expect((lz + hz) / 2).toBeCloseTo(2, 5)
  })

  it('draws it with the loaded model’s material, shared with every view of that model', () => {
    const view = draw()
    expect((view.mesh('model:chest') as Mesh3D).material).toBe(models.get('models/chest.bin')?.material)
    expect((view.mesh('model:far') as Mesh3D).material).toBe(models.get('models/chest.bin')?.material)
  })

  it('keeps the blockout’s pieces in the world, which are its footprint and its collider', () => {
    const view = draw()
    expect(view.pieces).toBe(world.pieces)
    expect(piecesOf('chest').length).toBeGreaterThan(0)
  })

  it('fails with the file’s name when a prop names a model the game did not load', () => {
    expect(() => draw({ props: world.props, models: libraryWith('models/other.bin') })).toThrow(
      /models\/chest\.bin/,
    )
    expect(() => draw({ props: world.props })).toThrow(/models\/chest\.bin/)
  })

  it('draws every blockout, and no model, when asked for the blockout view, loaded or not', () => {
    for (const options of [
      { props: world.props, models, blockout: true },
      { props: world.props, blockout: true },
    ]) {
      const view = draw(options)
      expect(view.mesh('model:chest')).toBeUndefined()
      expect(view.node.children).toHaveLength(world.pieces.length)
    }
  })

  it('hides a model with its room, and shows it with it', () => {
    const view = draw()
    view.showRooms(new Set(['cell']))
    const parentVisible = (mesh: Mesh3D): boolean => {
      for (
        let node = mesh as unknown as Container3D | null;
        node !== null;
        node = node.parent as Container3D | null
      )
        if (!node.visible) return false
      return true
    }
    expect(parentVisible(view.mesh('model:chest') as Mesh3D)).toBe(false)
    expect(parentVisible(view.mesh('model:far') as Mesh3D)).toBe(true)
  })

  it('moves and hides a model with its prop’s state, as it does the prop’s pieces', () => {
    const view = draw()
    const mesh = view.mesh('model:chest') as Mesh3D
    updatePieces(view, noPieceStates(), { ...noPieceStates(), props: { chest: { hidden: true } } })
    expect(mesh.visible).toBe(false)
    updatePieces(view, { ...noPieceStates(), props: { chest: { hidden: true } } }, noPieceStates())
    expect(mesh.visible).toBe(true)
    updatePieces(view, noPieceStates(), { ...noPieceStates(), props: { chest: { at: [3, 0, 2] } } })
    expect(mesh.position.x).toBeCloseTo(1, 5)
  })
})

// A frame as a generator draws one: a thin box with its back on the wall, marked as hung on it.
registerPropGenerator('test.hung-frame', () => ({
  pieces: [part(box([0, 0, 0.02], [0.6, 0.4, 0.04]), 'oakFloor', 'frame', { mount: 'wall' })],
}))

describe('a model on a wall', () => {
  const hung = buildWorld(
    {
      ...level,
      sectors: [room('hall', 0)],
      props: [
        { id: 'picture', at: [2, 0.01, 1.4], kind: 'test.hung-frame', angle: 90, model: 'models/chest.bin' },
      ],
    },
    LIB,
  )
  const eye = { x: 2, y: 3, z: -5 }
  const frame = {
    eye,
    look: { x: 2, y: 1, z: 2 },
    feet: { x: 2, y: 0, z: 2 },
    head: { x: 2, y: 1.6, z: 2 },
    seconds: 1,
    reduced: true,
  }

  it('hides with its wall when the wall is cut, as the prop’s own pieces would', () => {
    const parent = new Container3D()
    const occluders = createOccluders(parent)
    const view = drawWorld({ parent, occluders, colourOf: () => 0 }, hung.pieces, {
      props: hung.props,
      models,
    })
    const picture = view.mesh('model:picture') as Mesh3D
    expect(picture).toBeDefined()
    occluders.update(frame)
    expect((view.mesh('hall:wall:0.0.0') as Mesh3D).visible).toBe(false)
    expect(picture.visible).toBe(false)
  })
})

// A model in a lit room takes the room's baked light as a generated prop does: an unlit material on the model's own texture, its
// vertices carrying the light alone, so the screen shows texel x light. Before this a model drew as a plain Phong mesh, outside the
// room's light: 0.65 to 0.88 of the generated props beside it, cooler, with no pool under a desk lamp.
describe('a model in a lit room', () => {
  /** A cube model that fills a 1 m blockout exactly (the model is not stretched, so this is the shape the box has). */
  const cube = (file: string): ModelLibrary => {
    const parsed = parseGlb(encodeGlb(fixtureBox([-1, -1, -1], [1, 1, 1])), file)
    const model: LoadedModel = {
      mesh: parsed,
      geometry: modelGeometry(parsed),
      material: new PhongMaterial(),
      texture: Texture.WHITE,
    }
    return { get: (name) => (name === file ? model : undefined) }
  }
  // Two crates at the same height and depth, a metre either side of a lamp that hangs between them: the one names a model, the other
  // is generated, and the room lights them alike.
  const pair = buildWorld(
    {
      ...level,
      sectors: [room('hall', 0)],
      props: [
        { id: 'chest', at: [2, 3], use: 'crate', model: 'models/chest.bin' },
        { id: 'plain', at: [4, 3], use: 'crate' },
      ],
    },
    LIB,
  )
  const lit = () =>
    createSceneLight(
      sceneLightingSchema.parse({
        ambient: 0.25,
        colorSpace: 'srgb',
        lamps: [{ id: 'lamp', x: 3, y: 1.8, z: 3, color: 0xffd9a0, range: 6, strength: 2.6 }],
      }),
    )
  const drawLit = (
    options: Parameters<typeof drawWorld>[2] = { props: pair.props, models: cube('models/chest.bin') },
  ) => drawWorld({ parent: new Container3D(), colourOf: () => 0xffffff, light: lit() }, pair.pieces, options)
  /** The mean of a mesh's baked vertex light, over its three channels: with a white texture and a white swatch it is what the screen shows. */
  const shown = (mesh: Mesh3D): number => {
    const colours = mesh.geometry.attributes.aColor?.buffer.data as Float32Array
    let sum = 0
    let count = 0
    for (let i = 0; i < colours.length; i += 4) {
      sum += ((colours[i] as number) + (colours[i + 1] as number) + (colours[i + 2] as number)) / 3
      count++
    }
    return sum / count
  }
  /** The mean of a prop's generated pieces' light, weighted by their vertices. */
  const generated = (view: ReturnType<typeof drawLit>, prop: string): number => {
    const meshes = piecesOf(prop).map((piece) => view.mesh(piece.id) as Mesh3D)
    const weights = meshes.map((mesh) => mesh.geometry.vertexCount)
    return (
      meshes.reduce((sum, mesh, i) => sum + shown(mesh) * (weights[i] as number), 0) /
      weights.reduce((a, b) => a + b, 0)
    )
  }

  it('is an unlit mesh on the model’s own texture, with the room’s light in its vertices', () => {
    const view = drawLit()
    const mesh = view.mesh('model:chest') as Mesh3D
    expect(mesh.material).toBeInstanceOf(FlatMaterial)
    expect(mesh.material).not.toBe(cube('models/chest.bin').get('models/chest.bin')?.material)
    expect(mesh.material.vertexColors).toBe(true)
    expect((mesh.material as FlatMaterial).textures.baseColor).toBe(Texture.WHITE)
  })

  it('reads within 8 percent of a generated prop of the same albedo beside it, under the same lamp', () => {
    const view = drawLit()
    const model = shown(view.mesh('model:chest') as Mesh3D)
    const twin = generated(view, 'plain')
    expect(twin).toBeGreaterThan(0.3)
    expect(model / twin).toBeGreaterThan(0.92)
    expect(model / twin).toBeLessThan(1.08)
  })

  it('is lit by a lamp: lower the room and the model darkens with it', () => {
    const dim = (light: number) =>
      shown(
        drawWorld(
          { parent: new Container3D(), colourOf: () => 0xffffff, light: lit() },
          buildWorld(
            {
              ...level,
              sectors: [{ ...room('hall', 0), light }],
              props: [{ id: 'chest', at: [2, 3], use: 'crate', model: 'models/chest.bin' }],
            },
            LIB,
          ).pieces,
          {
            props: buildWorld(
              {
                ...level,
                sectors: [{ ...room('hall', 0), light }],
                props: [{ id: 'chest', at: [2, 3], use: 'crate', model: 'models/chest.bin' }],
              },
              LIB,
            ).props,
            models: cube('models/chest.bin'),
          },
        ).mesh('model:chest') as Mesh3D,
      )
    expect(dim(0)).toBeLessThan(dim(1))
  })

  it('keeps the model’s shared material when the room has no baked light', () => {
    const models = cube('models/chest.bin')
    const view = drawWorld({ parent: new Container3D(), colourOf: () => 0 }, pair.pieces, {
      props: pair.props,
      models,
    })
    expect((view.mesh('model:chest') as Mesh3D).material).toBe(models.get('models/chest.bin')?.material)
  })

  it('still hides with its wall when it hangs on one', () => {
    const hung = buildWorld(
      {
        ...level,
        sectors: [room('hall', 0)],
        props: [
          {
            id: 'picture',
            at: [2, 0.01, 1.4],
            kind: 'test.hung-frame',
            angle: 90,
            model: 'models/chest.bin',
          },
        ],
      },
      LIB,
    )
    const parent = new Container3D()
    const occluders = createOccluders(parent)
    const view = drawWorld({ parent, occluders, colourOf: () => 0, light: lit() }, hung.pieces, {
      props: hung.props,
      models: cube('models/chest.bin'),
    })
    const picture = view.mesh('model:picture') as Mesh3D
    expect(picture.material).toBeInstanceOf(FlatMaterial)
    occluders.update({
      eye: { x: 2, y: 3, z: -5 },
      look: { x: 2, y: 1, z: 2 },
      feet: { x: 2, y: 0, z: 2 },
      head: { x: 2, y: 1.6, z: 2 },
      seconds: 1,
      reduced: true,
    })
    expect(picture.visible).toBe(false)
  })
})
