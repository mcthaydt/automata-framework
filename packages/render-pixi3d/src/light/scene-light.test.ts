import { Container3D, CubeGeometry, FlatMaterial, Mesh3D, PlaneGeometry } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { createSceneLight } from './scene-light.js'
import { sceneLightingSchema } from './scene-lighting.schema.js'

// Two lamps 20 m apart, each with its own ranges: nothing one lights, the other reaches.
const lighting = sceneLightingSchema.parse({
  ambient: 0.2,
  lamps: [
    { id: 'west', x: -10, y: 2, z: 0, color: 0xffcc80, strength: 2, range: 5 },
    { id: 'east', x: 10, y: 2, z: 0, color: 0x80c0ff, strength: 2, range: 5 },
  ],
})

function colourBuffer(mesh: Mesh3D) {
  const attribute = mesh.geometry.attributes.aColor
  if (attribute === undefined) throw new Error('the mesh has no vertex colours')
  return attribute.buffer
}
const colours = (mesh: Mesh3D): Float32Array => (colourBuffer(mesh).data as Float32Array).slice()
/** The brightest colour channel of any vertex (alpha left out). */
const brightest = (mesh: Mesh3D): number => Math.max(...colours(mesh).filter((_, i) => i % 4 !== 3))
const updates = (mesh: Mesh3D): number => (colourBuffer(mesh) as unknown as { _updateID: number })._updateID

/** A floor tile at (x, 0, z): a plane laid flat, as a static scenery mesh. */
function floorAt(x: number, z: number): Mesh3D {
  const mesh = new Mesh3D({
    geometry: new PlaneGeometry({ width: 2, height: 2, widthSegments: 2, heightSegments: 2 }),
    material: new FlatMaterial({ baseColor: 0xc7dcd0 }),
  })
  mesh.position.set(x, 0, z)
  mesh.rotation.set(-Math.PI / 2, 0, 0)
  return mesh
}

describe('createSceneLight', () => {
  it('bakes a static mesh: a dynamic copy of its geometry with a colour per vertex, and vertex colours on', () => {
    const light = createSceneLight(lighting)
    const source = new CubeGeometry({ width: 1, height: 1, depth: 1, heightSegments: 3 })
    const count = source.vertexCount
    const mesh = new Mesh3D({ geometry: source, material: new FlatMaterial({ baseColor: 0xffffff }) })
    mesh.position.set(-10, 0.5, 1)
    light.bake(mesh)
    expect(mesh.geometry).not.toBe(source)
    // The source is left alone: another mesh may share it.
    expect(source.attributes.aPosition?.buffer.data.length).toBe(count * 3)
    expect(mesh.geometry.vertexCount).toBe(count)
    expect(colours(mesh).length).toBe(count * 4)
    expect(new Set(colours(mesh)).size).toBeGreaterThan(4)
    expect(mesh.material.vertexColors).toBe(true)
  })

  it('reads the mesh’s own placement: a floor tile under a lamp is brighter than one far from both', () => {
    const light = createSceneLight(lighting)
    const lit = floorAt(-10, 0)
    const dark = floorAt(0, 0)
    light.bake(lit)
    light.bake(dark)
    expect(brightest(lit)).toBeGreaterThan(0.5)
    expect(
      colours(dark)
        .filter((_, i) => i % 4 !== 3)
        .every((v) => Math.abs(v - 0.2) < 1e-6),
    ).toBe(true)
  })

  it('uploads nothing when the levels did not change', () => {
    const light = createSceneLight(lighting)
    const mesh = floorAt(-10, 0)
    light.bake(mesh)
    const before = updates(mesh)
    light.setLevels({ west: 1 })
    light.setLevels({})
    expect(updates(mesh)).toBe(before)
    expect(light.rebakes).toBe(0)
  })

  it('D3-e: switching a lamp off darkens the static meshes and characters in its range, and only those', () => {
    const light = createSceneLight(lighting)
    const westFloor = floorAt(-10, 0)
    const eastFloor = floorAt(10, 0)
    light.bake(westFloor)
    light.bake(eastFloor)
    const westBefore = colours(westFloor)
    const eastBefore = colours(eastFloor)
    const eastUpdates = updates(eastFloor)
    const westCharacter = light.tint(-10, 1, 1)
    const eastCharacter = light.tint(10, 1, 1)

    light.setLevels({ west: 0 })

    const westAfter = colours(westFloor)
    expect(westAfter.every((v, i) => v <= (westBefore[i] ?? 0))).toBe(true)
    expect(westAfter.some((v, i) => v < (westBefore[i] ?? 0))).toBe(true)
    expect(light.tint(-10, 1, 1)[0]).toBeLessThan(westCharacter[0])
    // The east lamp's floor was not rebaked at all, and the east character is lit as before.
    expect(colours(eastFloor)).toEqual(eastBefore)
    expect(updates(eastFloor)).toBe(eastUpdates)
    expect(light.tint(10, 1, 1)).toEqual(eastCharacter)
    expect(light.rebakes).toBe(1)
    expect(light.level('west')).toBe(0)
    expect(light.level('east')).toBe(1)

    // Back on: the west floor is as it was.
    light.setLevels({})
    expect(colours(westFloor)).toEqual(westBefore)
  })

  it('reads float and quantised normals alike', () => {
    const light = createSceneLight(lighting)
    const floatNormals = floorAt(-10, 0)
    const quantised = new Mesh3D({
      geometry: new PlaneGeometry({
        width: 2,
        height: 2,
        widthSegments: 2,
        heightSegments: 2,
        quantizeNormals: false,
      }),
      material: new FlatMaterial({}),
    })
    quantised.position.set(-10, 0, 0)
    quantised.rotation.set(-Math.PI / 2, 0, 0)
    light.bake(floatNormals)
    light.bake(quantised)
    const a = colours(floatNormals)
    const b = colours(quantised)
    expect(a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 1e-3)).toBe(true)
  })
})

describe('createSceneLight placement', () => {
  it('places a mesh by its parents’ transforms too: a tile inside a container moved under the lamp is lit', () => {
    const light = createSceneLight(lighting)
    const node = new Container3D()
    node.position.set(-10, 0, 0)
    const tile = floorAt(0, 0)
    node.addChild(tile)
    light.bake(tile)
    expect(brightest(tile)).toBeGreaterThan(0.5)
  })
})
