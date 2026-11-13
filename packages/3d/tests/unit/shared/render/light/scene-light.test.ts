import { Container3D, CubeGeometry, FlatMaterial, Geometry3D, Mesh3D, PlaneGeometry } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { createSceneLight } from '#src/shared/render/light/scene-light.ts'
import { sceneLightingSchema } from '#src/shared/render/light/scene-lighting.schema.ts'

// Two lamps 20 m apart, each with its own ranges: nothing one lights, the other reaches.
const lighting = sceneLightingSchema.parse({
  ambient: 0.2,
  lamps: [
    { id: 'west', x: -10, y: 2, z: 0, color: 0xffcc80, strength: 2, range: 5 },
    { id: 'east', x: 10, y: 2, z: 0, color: 0x80c0ff, strength: 2, range: 5 },
  ],
})

/**
 * A baked vertex colour as the screen shows it. `@pixi/3d` 0.1.0-beta.3 reads a vertex colour as linear light and the view
 * encodes it with a 2.2 gamma, so the buffer holds the shown value raised to 2.2 (vertex-bake.ts `engineColours`).
 */
const shown = (buffered: number): number => buffered ** (1 / 2.2)

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
    expect(brightest(lit)).toBeGreaterThan(0.5 ** 2.2)
    // The ambient 0.2, as the buffer holds it for beta.3: the shown value raised to 2.2 (the engine reads a vertex colour as linear
    // light and encodes it), so the screen shows 0.2, as beta.2 did.
    expect(
      colours(dark)
        .filter((_, i) => i % 4 !== 3)
        .every((v) => Math.abs(v - 0.2 ** 2.2) < 1e-6),
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

  it('composes a rotated and scaled parent: the same tile, turned and halved, lands where a direct one does', () => {
    const light = createSceneLight(lighting)
    // A parent turned a quarter about y and scaled 2×, holding a tile at local (0, 0, 5) scaled ½: in the world the
    // tile sits at (10, 0, 0) under the east lamp, at its own size, turned a quarter.
    const parent = new Container3D()
    parent.rotation.set(0, Math.PI / 2, 0)
    parent.scale.set(2, 2, 2)
    const nested = floorAt(0, 5)
    nested.scale.set(0.5, 0.5, 0.5)
    parent.addChild(nested)
    light.bake(nested)
    // The 3 × 3 grid of a centred square tile is the same set of points after a quarter turn.
    const direct = floorAt(10, 0)
    light.bake(direct)
    expect(brightest(nested)).toBeGreaterThan(0.5)
    // Same lamp, same place, same 2 m tile: the same light, vertex for vertex, as a set.
    const sorted = (mesh: Mesh3D) => [...colours(mesh)].map((v) => v.toFixed(4)).sort()
    expect(sorted(nested)).toEqual(sorted(direct))
  })
})

describe('createSceneLight release', () => {
  it('destroys the baked copy’s own buffers and stops rebaking it', () => {
    const light = createSceneLight(lighting)
    const mesh = floorAt(-10, 0)
    light.bake(mesh)
    const buffers = Object.values(mesh.geometry.attributes).map((attribute) => attribute.buffer)
    expect(buffers.length).toBeGreaterThanOrEqual(4)
    light.release(mesh)
    for (const buffer of buffers) expect((buffer as unknown as { destroyed: boolean }).destroyed).toBe(true)
    light.setLevels({ west: 0 })
    expect(light.rebakes).toBe(0)
  })
})

describe('createSceneLight reading geometry', () => {
  it('refuses an interleaved geometry, naming the attribute, rather than reading the wrong floats', () => {
    const light = createSceneLight(lighting)
    const geometry = new Geometry3D({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
      interleave: true,
      quantizeNormals: false,
    })
    const mesh = new Mesh3D({ geometry, material: new FlatMaterial({}) })
    expect(() => light.bake(mesh)).toThrow(/positions.*interleaved/)
  })
})

describe('createSceneLight tint', () => {
  it('writes into the caller’s array when given one (no allocation per frame), with the same values', () => {
    const light = createSceneLight(lighting)
    const out: [number, number, number] = [0, 0, 0]
    const written = light.tint(-10, 1, 1, undefined, out)
    expect(written).toBe(out)
    expect(out).toEqual(light.tint(-10, 1, 1))
    expect(light.tint(-10, 1, 1, [1, 0, 0], out)).toEqual(light.tint(-10, 1, 1, [1, 0, 0]))
  })

  it('bakes a room’s shade and the mesh’s own colour into an sRGB light', () => {
    const look = sceneLightingSchema.parse({ ambient: 0.4, colorSpace: 'srgb' })
    const light = createSceneLight(look)
    const plain = floorAt(0, 0)
    const dim = floorAt(0, 0)
    const toned = floorAt(0, 0)
    light.bake(plain)
    light.bake(dim, { shadeSteps: 1 })
    light.bake(toned, { albedo: 0x808080 })
    expect(shown(colours(plain)[0] as number)).toBeCloseTo(0.4, 6)
    expect(shown(colours(dim)[0] as number)).toBeCloseTo(0.4 * 0.85, 6)
    // 0x80 in sRGB is 0.502; × 0.4 is 0.2008 on screen.
    expect(shown(colours(toned)[0] as number)).toBeCloseTo((0x80 / 255) * 0.4, 5)
  })
})

describe('createSceneLight vertex colours', () => {
  // `@pixi/3d` 0.1.0-beta.3 reads a vertex colour as linear light and the view encodes it, so the buffer holds the screen's value
  // raised to 2.2 (vertex-bake.ts `engineColours`). `groundLuma` reports what the screen shows, so it does not.
  const srgb = sceneLightingSchema.parse({ ambient: 0.5, colorSpace: 'srgb', lamps: [] })

  it('holds a mid grey in half light as linear light, which the view encodes back to 64', () => {
    const light = createSceneLight(srgb)
    const floor = floorAt(0, 0)
    light.bake(floor, { albedo: 0x808080 })
    const written = colours(floor)[0] as number
    expect(written).toBeCloseTo(((0x80 / 255) * 0.5) ** 2.2, 5)
    expect(255 * written ** (1 / 2.2)).toBeCloseTo(64, 0)
  })

  it('writes the same colours when the mesh is baked again where it stands', () => {
    const light = createSceneLight(srgb)
    const floor = floorAt(0, 0)
    light.bake(floor, { albedo: 0x808080 })
    const first = colours(floor)
    light.rebake(floor)
    expect([...colours(floor)]).toEqual([...first])
  })

  it('still reports the colour the screen shows, light times albedo, from groundLuma', () => {
    const light = createSceneLight(srgb)
    const floor = floorAt(0, 0)
    light.bake(floor, { albedo: 0x808080 })
    expect(light.groundLuma(0, 0)).toBeCloseTo((0x80 / 255) * 0.5, 4)
  })
})

describe('createSceneLight groundLuma', () => {
  const lit = sceneLightingSchema.parse({
    ambient: 0.3,
    colorSpace: 'srgb',
    lamps: [{ id: 'lamp', x: 0, y: 2, z: 0, color: 0xffffff, strength: 1.5, range: 6 }],
  })
  /** The luma of the baked colour at vertex `i` of `mesh`, as the screen shows it. */
  const lumaOfVertex = (mesh: Mesh3D, i: number): number => {
    const c = colours(mesh)
    return (
      0.2126 * shown(c[i * 4] ?? 0) + 0.7152 * shown(c[i * 4 + 1] ?? 0) + 0.0722 * shown(c[i * 4 + 2] ?? 0)
    )
  }

  it('is the floor’s shown colour at the point: what a vertex of the baked floor shows there (light times its albedo)', () => {
    const light = createSceneLight(lit)
    const floor = floorAt(0, 0)
    light.bake(floor, { albedo: 0x808080 })
    // The 2 × 2 plane has a vertex at its centre, under the lamp: the vertex colour is the floor's shown colour there.
    const centre = Array.from({ length: floor.geometry.vertexCount }, (_, i) => i).find((i) => {
      const p = floor.geometry.attributes.aPosition?.buffer.data
      return p !== undefined && p[i * 3] === 0 && p[i * 3 + 1] === 0
    }) as number
    const shown = lumaOfVertex(floor, centre)
    expect(shown).toBeGreaterThan(0.2)
    expect(light.groundLuma(0, 0)).toBeCloseTo(shown, 5)
  })

  it('takes the floor’s own albedo: the same light on a darker floor reads darker', () => {
    const light = createSceneLight(lit)
    light.bake(floorAt(0, 0), { albedo: 0xffffff })
    const bright = light.groundLuma(0, 0) as number
    const dark = createSceneLight(lit)
    dark.bake(floorAt(0, 0), { albedo: 0x404040 })
    expect(dark.groundLuma(0, 0) as number).toBeCloseTo(bright * (0x40 / 0xff), 3)
  })

  it('follows the lamps’ levels as the floor does', () => {
    const light = createSceneLight(lit)
    light.bake(floorAt(0, 0), { albedo: 0xffffff })
    const on = light.groundLuma(0, 0) as number
    light.setLevels({ lamp: 0 })
    expect(light.groundLuma(0, 0) as number).toBeLessThan(on)
    expect(light.groundLuma(0, 0)).toBeCloseTo(0.3, 5)
  })

  it('is undefined where no baked floor lies under the point', () => {
    const light = createSceneLight(lit)
    expect(light.groundLuma(0, 0)).toBeUndefined()
    light.bake(floorAt(0, 0), { albedo: 0xffffff })
    expect(light.groundLuma(0, 0)).toBeDefined()
    expect(light.groundLuma(5, 5)).toBeUndefined()
  })

  it('takes the floor the point stands on: the higher of two, at or under the height asked for', () => {
    const light = createSceneLight(lit)
    const upstairs = floorAt(0, 0)
    upstairs.position.y = 3
    light.bake(floorAt(0, 0), { albedo: 0xffffff })
    light.bake(upstairs, { albedo: 0x000000 })
    // With no height the highest floor counts; asked for a point at 0.5 m, the one underfoot.
    expect(light.groundLuma(0, 0)).toBeCloseTo(0, 5)
    expect(light.groundLuma(0, 0, 0.5) as number).toBeGreaterThan(0.2)
  })
})
