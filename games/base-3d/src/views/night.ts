// The night scene (art direction spec §2, §4): Emberwick's moonlit ruin built under the 3D view from the room and its
// dressing. The sky, the ambient moonlight and the moon's direction; the ruined walls as textured bays through the
// occluder rule, the far wall an arch; mossy flagstone platforms over the channels' stone sides; lava that lights the
// channels; glowing mushrooms with their lights; additive halos, fireflies and moonlight shafts; grass and vines; and
// the backdrop. Presentation only (law 1). The embers, the goal and Wick's lantern come with their own views.
import { type Box3, type Occluders, type SceneFog, tiledCube } from '@mcthaydt/automata-render-pixi3d'
import {
  type Container3D,
  DirectionalLight,
  FlatMaterial,
  Mesh3D,
  ParticleContainer3D,
  PhongMaterial,
  PointLight,
  type View3D,
} from '@pixi/3d'
import type { Texture } from 'pixi.js'
import type { AreaSource } from '../systems/index.ts'
import { buildBackdrop } from './backdrop.ts'
import { type Card, dressingOf, LAVA_Y } from './dressing.ts'
import { type SceneWall, sceneOf } from './index.ts'
import { geometryOf, mushroomData } from './mushrooms.ts'
import { nightTextures } from './night-textures.ts'
import { colour } from './palette.ts'

/** The night's fog: clear for 9 m, full at 30 m, in the haze of Emberwick's middle sky band. */
export const FOG: SceneFog = { near: 9, far: 30, color: colour('skyMid') }

/** What the scene hook keeps of the night: one call a frame, with the page clock in seconds. */
export interface NightScene {
  update(seconds: number): void
}

/** Metres per repeat of the stone textures (32 px): a flagstone or brick about 0.7 m long. */
const TILE = 2
/** The pillars between bays and the far wall's height over its arch. */
const PILLAR = { width: 0.7, depth: 0.6, height: 3.2 } as const
const LINTEL = 0.5
/** The grass and vines, tinted to the moonlight they stand in (they are unlit cards). */
const MOONLIT = 0x7f9aa0

const textured = (texture: Texture): PhongMaterial =>
  new PhongMaterial({ baseColor: 0xffffff, baseColorTexture: texture, shininess: 4 })

/** A box of stone filling `bounds`, its texture repeating every `TILE` metres on each face. */
function stoneBox(bounds: Box3, material: PhongMaterial | FlatMaterial, tile = TILE): Mesh3D {
  const [min, max] = [bounds.min, bounds.max]
  const size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] }
  const mesh = new Mesh3D({ geometry: tiledCube(size, tile), material })
  mesh.scale.set(size.x, size.y, size.z)
  mesh.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
  return mesh
}

/** Particles of one texture under `parent`, all written once (grass, vines, shafts). */
function cards(
  parent: Container3D,
  label: string,
  texture: Texture,
  spots: readonly Card[],
  look: { tint: number; alpha: number; additive: boolean },
): ParticleContainer3D {
  const container = new ParticleContainer3D({
    label,
    texture,
    capacity: spots.length,
    billboard: 'cylindrical',
    ...(look.additive ? { blendMode: 'add' as const } : { alphaMode: 'mask' as const, alphaCutoff: 0.5 }),
  })
  spots.forEach((s, i) => {
    container.setParticleAt(i, s.x, s.y, s.z, s.size, 0, look.tint, look.alpha)
  })
  parent.addChild(container)
  return container
}

export function buildNight(view: View3D, occluders: Occluders, area: AreaSource): NightScene {
  const root = view.root as Container3D
  const dressing = dressingOf(area)
  const textures = nightTextures()

  // Sky and moonlight: the sky gradient behind everything, a dim cool fill, and the moon's light from the far end.
  view.background = { skyColor: colour('skyHigh'), groundColor: colour('skyLow') }
  view.environment = { skyColor: colour('ambient'), groundColor: colour('skyMid'), intensity: 0.6 }
  const moonlight = new DirectionalLight({ color: colour('moonlight'), intensity: 0.55 })
  moonlight.position.set(-6, 14, 40)
  moonlight.lookAt({ x: 0, y: 0, z: 10 })
  root.addChild(moonlight)

  // The platforms: mossy flagstones on top, bare stone down their sides to the lava.
  const floor = textured(textures.floor)
  const side = textured(textures.side)
  const wall = textured(textures.wall)
  for (const room of area.rooms) {
    const [x0, z0] = room.min
    const [x1, z1] = room.max
    root.addChild(stoneBox({ min: [x0, -0.2, z0], max: [x1, 0, z1] }, floor))
    root.addChild(stoneBox({ min: [x0, LAVA_Y - 0.5, z0], max: [x1, -0.2, z1] }, side))
  }
  // The channels: lava (unlit, unfogged: it is the light) between stone sides that carry the walls down to it.
  const lava = new FlatMaterial({ baseColorTexture: textures.lava, fog: false })
  for (const pit of area.pits ?? []) {
    const [x0, z0] = pit.min
    const [x1, z1] = pit.max
    root.addChild(stoneBox({ min: [x0, LAVA_Y - 0.1, z0], max: [x1, LAVA_Y, z1] }, lava, 1))
    for (const x of [x0 - 0.4, x1])
      root.addChild(stoneBox({ min: [x, LAVA_Y - 0.5, z0], max: [x + 0.4, 0, z1] }, side))
  }

  // The ruin: textured bays, a pillar at every bay's start (fading when it hides Wick), the near wall whole,
  // the far wall's two piers either side of the arch and the lintel over it.
  const surface = { texture: textures.wall, tile: TILE }
  const white = 0xffffff
  for (const bay of dressing.bays) occluders.wall({ ...bay, color: white, surface })
  dressing.bays.forEach((bay, i) => {
    const outward = bay.a.x > 0 ? 1 : -1
    const x = bay.a.x + outward * (PILLAR.width / 2 - 0.15)
    const bounds: Box3 = {
      min: [x - PILLAR.width / 2, 0, bay.a.z - PILLAR.depth / 2],
      max: [x + PILLAR.width / 2, PILLAR.height, bay.a.z + PILLAR.depth / 2],
    }
    const pillar = stoneBox(bounds, textured(textures.wall))
    root.addChild(pillar)
    occluders.prop(pillar, { bounds })
  })
  const { arch } = dressing
  const ends = endWalls(area)
  if (ends.near !== undefined) occluders.wall({ ...ends.near, height: 2.6, color: white, surface })
  if (ends.far !== undefined) {
    const { a, b } = ends.far
    const height = arch.height + LINTEL
    occluders.wall({ a, b: { x: arch.max, z: a.z }, height, color: white, surface })
    occluders.wall({ a: { x: arch.min, z: a.z }, b, height, color: white, surface })
    const bounds: Box3 = { min: [arch.min, arch.height, arch.z], max: [arch.max, height, arch.z + 0.5] }
    const lintel = stoneBox(bounds, textured(textures.wall))
    root.addChild(lintel)
    occluders.prop(lintel, { bounds })
  }
  // The goal ember's plinth.
  root.addChild(
    stoneBox(
      {
        min: [area.goal.x - 0.45, 0, area.goal.z - 0.45],
        max: [area.goal.x + 0.45, 0.35, area.goal.z + 0.45],
      },
      wall,
      1,
    ),
  )

  // Static lights, and the mushrooms that give them: three caps a cluster, glowing, on pale stems.
  for (const spot of dressing.lights) {
    const light = new PointLight({ color: colour(spot.colour), intensity: spot.intensity, range: spot.range })
    light.position.set(spot.x, spot.y, spot.z)
    root.addChild(light)
  }
  // Every cluster's caps in one mesh and every stem in another: two draws for the room's mushrooms.
  const { caps, stems } = mushroomData(dressing.mushrooms)
  const cap = new PhongMaterial({
    baseColor: colour('mushroom'),
    emissive: { color: colour('mushroom'), strength: 1.6 },
    doubleSided: true,
  })
  const stem = new PhongMaterial({
    baseColor: colour('moonlight'),
    emissive: { color: colour('moonlight'), strength: 0.6 },
    doubleSided: true,
  })
  root.addChild(
    new Mesh3D({ label: 'night:mushroom-caps', geometry: geometryOf(caps), material: cap }),
    new Mesh3D({ label: 'night:mushroom-stems', geometry: geometryOf(stems), material: stem }),
  )

  // Glow: a halo over each mushroom cluster and a row of heat over each channel (Emberwick's additive halo layer).
  const glows: (Card & { readonly colour: number; readonly alpha: number; readonly phase: number })[] = [
    ...dressing.mushrooms.map((m) => ({
      x: m.x,
      y: 0.35,
      z: m.z,
      size: 0.9,
      colour: colour('mushroom'),
      alpha: 0.8,
      phase: m.x + m.z,
    })),
    ...(area.pits ?? []).flatMap((pit) => {
      const row = []
      for (let x = pit.min[0] + 0.5; x < pit.max[0]; x += 1.5)
        row.push({
          x,
          y: LAVA_Y + 0.5,
          z: (pit.min[1] + pit.max[1]) / 2,
          size: 2.6,
          colour: colour('hot'),
          alpha: 0.5,
          phase: x * 1.3,
        })
      return row
    }),
  ]
  const halos = new ParticleContainer3D({
    label: 'night:halos',
    texture: textures.glow,
    capacity: glows.length,
    blendMode: 'add',
    billboard: 'spherical',
  })
  root.addChild(halos)

  // Fireflies over the platforms, drifting on the page clock.
  const extent = {
    x0: Math.min(...area.rooms.map((r) => r.min[0])),
    x1: Math.max(...area.rooms.map((r) => r.max[0])),
    z0: Math.min(...area.rooms.map((r) => r.min[1])),
    z1: Math.max(...area.rooms.map((r) => r.max[1])),
  }
  const fireflies = Array.from({ length: 22 }, (_, i) => ({
    x: extent.x0 + 1 + ((i * 3.7) % (extent.x1 - extent.x0 - 2)),
    y: 0.6 + ((i * 1.3) % 1.6),
    z: extent.z0 + 0.5 + ((i * 5.3) % (extent.z1 - extent.z0 - 1)),
    phase: i * 1.7,
  }))
  const motes = new ParticleContainer3D({
    label: 'night:motes',
    texture: textures.glow,
    capacity: fireflies.length,
    blendMode: 'add',
    billboard: 'spherical',
  })
  root.addChild(motes)

  cards(root, 'night:grass', textures.grass, dressing.grass, { tint: MOONLIT, alpha: 1, additive: false })
  cards(root, 'night:vines', textures.vine, dressing.vines, { tint: MOONLIT, alpha: 1, additive: false })
  cards(root, 'night:shafts', textures.shaft, dressing.shafts, {
    tint: colour('moonlight'),
    alpha: 0.3,
    additive: true,
  })
  buildBackdrop(root, dressing, textures)

  const firefly = colour('firefly')
  const update = (seconds: number): void => {
    glows.forEach((g, i) => {
      halos.setParticleAt(
        i,
        g.x,
        g.y,
        g.z,
        g.size * (1 + 0.08 * Math.sin(seconds * 3 + g.phase)),
        0,
        g.colour,
        g.alpha,
      )
    })
    fireflies.forEach((f, i) => {
      motes.setParticleAt(
        i,
        f.x + Math.sin(seconds * 0.6 + f.phase) * 0.5,
        f.y + Math.sin(seconds * 0.9 + f.phase * 1.3) * 0.25,
        f.z + Math.cos(seconds * 0.5 + f.phase) * 0.5,
        0.16,
        0,
        firefly,
        0.55 + 0.45 * Math.sin(seconds * 2.1 + f.phase),
      )
    })
  }
  update(0)
  return { update }
}

/** The area's end walls (those running along x), nearest first: the near one stands whole, the far one has the arch. */
function endWalls(area: AreaSource): {
  readonly near?: SceneWall | undefined
  readonly far?: SceneWall | undefined
} {
  const ends = sceneOf(area)
    .walls.filter((w) => w.a.z === w.b.z)
    .sort((p, q) => p.a.z - q.a.z)
  return { near: ends[0], far: ends.length > 1 ? ends.at(-1) : undefined }
}
