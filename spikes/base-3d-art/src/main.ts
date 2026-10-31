// The base-3d art spike (spikes/ is TDD-exempt): the free game's real room (its level file, through the game's own
// converter) dressed the way the art-direction spec proposes, to find what the vendored @pixi/3d core can do under the
// no-eval CSP and what it costs. Query flags switch each feature so its frame cost can be measured on its own:
//   ?moment=start|channel|goal|ember  where the camera looks (the game's 24 mm lens, 25° down, 5 m back)
//   ?lights=N      point lights kept (0 = none; default all)       ?halos=0   no additive glow cards
//   ?motes=0       no fireflies or sparks                           ?dress=0   no grass, vines or backdrop
//   ?tex=0         flat colours in place of the stone textures      ?fog=0     no fog
//   ?flat=1        the current look (flat grey room, hemisphere light), for the before/after
import '@mcthaydt/automata-render-pixi3d/no-eval'
import {
  Container3D,
  CubeGeometry,
  CylinderGeometry,
  DirectionalLight,
  FlatMaterial,
  Geometry3D,
  IcosahedronGeometry,
  Mesh3D,
  ParticleContainer3D,
  PhongMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  View3D,
} from '@pixi/3d'
import { Application, type Texture } from 'pixi.js'
import { ROOM } from '../../../games/base-3d/src/content/room.ts'
import {
  glowTexture,
  grassTexture,
  hex,
  lavaTexture,
  moonTexture,
  shaftTexture,
  silhouetteTexture,
  stoneTexture,
  vineTexture,
} from './textures.ts'

const params = new URLSearchParams(location.search)
const flag = (name: string, fallback: boolean): boolean =>
  params.has(name) ? params.get(name) !== '0' : fallback
const FLAT = flag('flat', false)
const HALOS = flag('halos', true) && !FLAT
const MOTES = flag('motes', true) && !FLAT
const DRESS = flag('dress', true) && !FLAT
const TEX = flag('tex', true) && !FLAT
const FOG = flag('fog', true)
const LIGHT_CAP = params.has('lights') ? Number(params.get('lights')) : 99
const MOMENT = params.get('moment') ?? 'start'
const WIDTH = Number(params.get('w') ?? 844)
const HEIGHT = Number(params.get('h') ?? 390)

// --- palette: Endesga 64 entries Emberwick names (render/scene.ts, render/backdrop.ts) ---
const C = {
  night: hex(15), // #0e071b, Emberwick's background and tree line
  skyTop: hex(52), // #03193f
  skyMid: hex(39), // #0c2e44
  skyLow: hex(38), // #134c4c, Emberwick's ground fog
  moonlight: hex(45), // #94fdff
  ambient: hex(11), // #657392
  mushroom: hex(43), // #00cdf9
  mushroomPale: hex(45),
  ember: hex(30), // #ffa214
  lantern: hex(31), // #ffc825
  firefly: hex(33), // #d3fc7e
  spark: hex(32), // #ffeb57
  lavaHot: hex(28), // #ff5000
  wickCloak: hex(41), // #0069aa
  wickDark: hex(40), // #00396d
  stone: hex(13),
  wall: hex(14),
  moss: hex(36),
  tower: hex(52),
}

// --- geometry helpers ---
type V3 = [number, number, number]

/** A box from `min` to `max` whose UVs are world metres over `tile`, so a texture repeats at a fixed size on every face. */
function worldBox(min: V3, max: V3, tile: number, faces = 'xXyYzZ'): Geometry3D {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const quad = (corners: V3[], n: V3, uv: (p: V3) => [number, number]): void => {
    const base = positions.length / 3
    for (const p of corners) {
      positions.push(...p)
      normals.push(...n)
      uvs.push(...uv(p))
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const [x0, y0, z0] = min
  const [x1, y1, z1] = max
  const t = (a: number): number => a / tile
  if (faces.includes('Y'))
    quad(
      [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
      [0, 1, 0],
      (p) => [t(p[0]), t(p[2])],
    )
  if (faces.includes('y'))
    quad(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      [0, -1, 0],
      (p) => [t(p[0]), t(p[2])],
    )
  if (faces.includes('Z'))
    quad(
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
      (p) => [t(p[0]), -t(p[1])],
    )
  if (faces.includes('z'))
    quad(
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
      (p) => [t(-p[0]), -t(p[1])],
    )
  if (faces.includes('X'))
    quad(
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
      (p) => [t(-p[2]), -t(p[1])],
    )
  if (faces.includes('x'))
    quad(
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
      (p) => [t(p[2]), -t(p[1])],
    )
  return new Geometry3D({
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  })
}

const lit = (texture: Texture | undefined, colour: number): PhongMaterial =>
  TEX && texture !== undefined
    ? new PhongMaterial({ baseColorTexture: texture, shininess: 4 })
    : new PhongMaterial({ baseColor: colour, shininess: 4 })

async function main(): Promise<void> {
  const app = new Application()
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    preference: (params.get('renderer') as 'webgl' | 'webgpu' | null) ?? 'webgl',
    background: C.night,
    antialias: false,
    resolution: 1,
  })
  document.body.appendChild(app.canvas)
  const view = new View3D({ width: WIDTH, height: HEIGHT, toneMapping: 'none' })
  app.stage.addChild(view)
  const root = view.root as Container3D
  const world = new Container3D()
  root.addChild(world)
  let draws = 0

  // --- sky and fog ---
  if (FLAT) {
    view.environment = { skyColor: 0xc7dcd0, groundColor: 0x8b9bb4 }
    if (FOG) view.fog = { type: 'linear', near: 5, far: 14, color: 0x2e222f }
  } else {
    view.background = { skyColor: C.skyTop, groundColor: C.skyLow }
    // Moonlight from above and ahead: a dim cool fill (the 2D light map's AMBIENT) plus the moon's direction.
    view.environment = { skyColor: C.ambient, groundColor: C.night, intensity: 0.2 }
    if (FOG) view.fog = { type: 'linear', near: 9, far: 30, color: C.skyMid }
    const moon = new DirectionalLight({ color: C.moonlight, intensity: 0.3 })
    moon.position.set(-6, 14, 40)
    moon.lookAt({ x: 0, y: 0, z: 10 })
    world.addChild(moon)
  }

  // --- the room: platforms as stone blocks down to the lava, ruined walls, the channels' lava ---
  const floorTex = TEX ? stoneTexture(0.35, 1) : undefined
  const sideTex = TEX ? stoneTexture(0, 2) : undefined
  const wallTex = TEX ? stoneTexture(0.04, 3, { stone: [12, 13], mortar: 15, light: 11 }) : undefined
  const lavaY = -0.7
  for (const room of ROOM.rooms) {
    const [x0, z0] = room.min
    const [x1, z1] = room.max
    if (FLAT) {
      world.addChild(
        new Mesh3D({
          geometry: worldBox([x0, -0.1, z0], [x1, 0, z1], 1),
          material: new PhongMaterial({ baseColor: 0x8b9bb4 }),
        }),
      )
      draws++
      continue
    }
    world.addChild(
      new Mesh3D({
        geometry: worldBox([x0, -0.2, z0], [x1, 0, z1], 2, 'Y'),
        material: lit(floorTex, C.stone),
      }),
    )
    world.addChild(
      new Mesh3D({
        geometry: worldBox([x0, lavaY - 0.5, z0], [x1, 0, z1], 2, 'zZ'),
        material: lit(sideTex, C.stone),
      }),
    )
    draws += 2
  }
  const wallMat = FLAT ? new PhongMaterial({ baseColor: 0x3a4466 }) : lit(wallTex, C.wall)
  // Side walls in 2 m bays of varying height (a ruin: the tops broken), pillars between bays.
  const heights = [2.6, 1.9, 2.3, 1.6, 2.5, 2.0, 1.7, 2.4, 2.2, 1.8, 2.6, 2.1, 1.9, 2.4]
  for (const side of [-1, 1]) {
    for (let bay = 0; bay < 14; bay++) {
      const h = FLAT ? 2.6 : (heights[(bay + (side > 0 ? 5 : 0)) % heights.length] as number)
      const z0 = bay * 2
      const xIn = side * 5
      const xOut = side * 5.4
      world.addChild(
        new Mesh3D({
          geometry: worldBox(
            [Math.min(xIn, xOut), FLAT ? 0 : lavaY - 0.5, z0],
            [Math.max(xIn, xOut), h, z0 + 2],
            2,
          ),
          material: wallMat,
        }),
      )
      draws++
      if (!FLAT && bay % 2 === 0) {
        const px = side * 5.1
        world.addChild(
          new Mesh3D({
            geometry: worldBox([px - 0.35, 0, z0 - 0.3], [px + 0.35, 3.2, z0 + 0.3], 2),
            material: wallMat,
          }),
        )
        draws++
      }
    }
  }
  // The far wall: an arch onto the night (two piers and a lintel), so the moon shows through it.
  if (FLAT) {
    world.addChild(new Mesh3D({ geometry: worldBox([-5.4, 0, 28], [5.4, 2.6, 28.4], 2), material: wallMat }))
    draws++
  } else {
    for (const [a, b] of [
      [-5.4, -1.6],
      [1.6, 5.4],
    ] as const) {
      world.addChild(new Mesh3D({ geometry: worldBox([a, 0, 28], [b, 3, 28.5], 2), material: wallMat }))
    }
    world.addChild(new Mesh3D({ geometry: worldBox([-1.6, 3, 28], [1.6, 3.5, 28.5], 2), material: wallMat }))
    draws += 3
  }
  // Lava in the channels: an unlit bright surface (it is the light), a lip of stone along each edge.
  const lavaTex = TEX ? lavaTexture() : undefined
  for (const pit of ROOM.pits ?? []) {
    const [x0, z0] = pit.min
    const [x1, z1] = pit.max
    const lava = new Mesh3D({
      geometry: worldBox([x0, lavaY - 0.1, z0], [x1, lavaY, z1], 1, 'Y'),
      material: FLAT
        ? new FlatMaterial({ baseColor: 0x7a2a12 })
        : new FlatMaterial(
            lavaTex ? { baseColorTexture: lavaTex, fog: false } : { baseColor: C.lavaHot, fog: false },
          ),
    })
    world.addChild(lava)
    draws++
  }

  // --- lights: every source in the 2D scene has one here ---
  type Source = {
    x: number
    y: number
    z: number
    colour: number
    range: number
    intensity: number
    halo: number
  }
  const sources: Source[] = []
  const mushrooms: V3[] = DRESS
    ? [
        [-4.6, 0, 0.6],
        [4.6, 0, 4.2],
        [-4.6, 0, 7.4],
        [4.5, 0, 11.6],
        [-4.6, 0, 15.6],
        [4.6, 0, 17.4],
        [-4.5, 0, 21.4],
        [4.6, 0, 24.6],
        [-2.2, 0, 27.6],
        [2.2, 0, 27.6],
      ]
    : []
  for (const [x, y, z] of mushrooms)
    sources.push({ x, y: y + 0.4, z, colour: C.mushroom, range: 3.2, intensity: 1.6, halo: 0.9 })
  for (const pit of ROOM.pits ?? [])
    for (const x of [-2.5, 2.5])
      sources.push({
        x,
        y: lavaY + 0.6,
        z: (pit.min[1] + pit.max[1]) / 2,
        colour: C.lavaHot,
        range: 4.5,
        intensity: 2.2,
        halo: 0,
      })
  const embers: V3[] = [
    [-3, 0, 3],
    [3, 0, 3],
    [-3, 0, 14],
    [3, 0, 14],
    [-3, 0, 26],
  ]
  for (const [x, , z] of embers)
    sources.push({ x, y: 0.6, z, colour: C.ember, range: 2.6, intensity: 1.4, halo: 1.1 })
  const goal: V3 = [0, 0, 26]
  sources.push({ x: goal[0], y: 1, z: goal[2], colour: C.lantern, range: 5, intensity: 2.2, halo: 2.4 })
  // Wick, standing where the moment puts him, and his lantern.
  const wickAt: Record<string, V3> = {
    start: [0, 0, 1.5],
    channel: [0.4, 0, 6.8],
    ember: [-2.4, 0, 13.2],
    goal: [0.6, 0, 24],
  }
  const wick = wickAt[MOMENT] ?? wickAt.start
  sources.push({
    x: wick[0] + 0.35,
    y: 0.9,
    z: wick[2] + 0.1,
    colour: C.lantern,
    range: 3.4,
    intensity: 1.5,
    halo: 0.7,
  })
  let lights = 0
  if (!FLAT)
    for (const s of sources.slice(0, LIGHT_CAP)) {
      const light = new PointLight({ color: s.colour, intensity: s.intensity, range: s.range })
      light.position.set(s.x, s.y, s.z)
      world.addChild(light)
      lights++
    }

  // --- things that give light: mushrooms, embers, the goal, Wick ---
  const glowMat = (colour: number, strength = 1.6): PhongMaterial =>
    new PhongMaterial({ baseColor: colour, emissive: { color: colour, strength } })
  const unit = new SphereGeometry({ radius: 0.5 })
  for (const [x, y, z] of mushrooms) {
    for (const [dx, dz, s] of [
      [0, 0, 1],
      [0.18, 0.12, 0.7],
      [-0.12, 0.16, 0.55],
    ] as const) {
      const stem = new Mesh3D({
        geometry: new CylinderGeometry({ radiusTop: 0.025, radiusBottom: 0.035, height: 0.22 * s }),
        material: glowMat(C.mushroomPale, 0.6),
      })
      stem.position.set(x + dx, y + 0.11 * s, z + dz)
      const cap = new Mesh3D({ geometry: unit, material: glowMat(C.mushroom) })
      cap.scale.set(0.2 * s, 0.09 * s, 0.2 * s)
      cap.position.set(x + dx, y + 0.22 * s, z + dz)
      world.addChild(stem, cap)
      draws += 2
    }
  }
  const emberGeo = new IcosahedronGeometry({ radius: 0.16 })
  for (const [x, , z] of embers) {
    const core = new Mesh3D({
      geometry: emberGeo,
      material: FLAT ? new FlatMaterial({ baseColor: 0xfb6b1d }) : glowMat(C.ember, 2),
    })
    core.position.set(x, 0.55, z)
    core.scale.set(1, 1.5, 1)
    world.addChild(core)
    draws++
  }
  const goalCore = new Mesh3D({
    geometry: new IcosahedronGeometry({ radius: 0.3 }),
    material: FLAT ? new FlatMaterial({ baseColor: 0xfee761 }) : glowMat(C.spark, 2.4),
  })
  goalCore.position.set(goal[0], 0.9, goal[2])
  goalCore.scale.set(1, 1.5, 1)
  world.addChild(goalCore)
  // A plinth under the goal ember.
  if (!FLAT) {
    world.addChild(
      new Mesh3D({ geometry: worldBox([-0.45, 0, 25.55], [0.45, 0.35, 26.45], 1), material: wallMat }),
    )
    draws++
  }
  draws++
  // Wick stand-in: Emberwick's hood and cloak in blue, dark face, gold lantern (the game uses its real figure).
  const wickNode = new Container3D()
  wickNode.position.set(...wick)
  const cloak = new Mesh3D({
    geometry: new CylinderGeometry({ radiusTop: 0.12, radiusBottom: 0.3, height: 0.8 }),
    material: new PhongMaterial({ baseColor: C.wickCloak }),
  })
  cloak.position.set(0, 0.4, 0)
  cloak.scale.set(1, 1, 0.8)
  const hood = new Mesh3D({ geometry: unit, material: new PhongMaterial({ baseColor: C.wickCloak }) })
  hood.scale.set(0.46, 0.5, 0.46)
  hood.position.set(0, 0.95, 0)
  const lantern = new Mesh3D({
    geometry: new CubeGeometry({ width: 0.12, height: 0.16, depth: 0.12 }),
    material: glowMat(C.lantern, 2.4),
  })
  lantern.position.set(0.35, 0.55, 0.1)
  wickNode.addChild(cloak, hood)
  if (!FLAT) wickNode.addChild(lantern)
  world.addChild(wickNode)
  draws += 3

  // --- additive glow cards (the 2D scene's halo layer): one particle container, one draw ---
  const glow = glowTexture()
  const glowCards: {
    x: number
    y: number
    z: number
    size: number
    colour: number
    alpha: number
    phase: number
  }[] = []
  if (HALOS) {
    for (const s of sources)
      if (s.halo > 0)
        glowCards.push({
          x: s.x,
          y: s.y,
          z: s.z,
          size: s.halo,
          colour: s.colour,
          alpha: 0.8,
          phase: s.x + s.z,
        })
    for (const pit of ROOM.pits ?? [])
      for (let x = -4.5; x <= 4.5; x += 1.5)
        glowCards.push({
          x,
          y: lavaY + 0.5,
          z: (pit.min[1] + pit.max[1]) / 2,
          size: 2.6,
          colour: C.lavaHot,
          alpha: 0.5,
          phase: x,
        })
    glowCards.push({ x: goal[0], y: 2.4, z: goal[2], size: 1.2, colour: C.spark, alpha: 0.5, phase: 0 })
  }
  const halos = new ParticleContainer3D({
    texture: glow,
    capacity: 128,
    blendMode: 'add',
    billboard: 'spherical',
  })
  glowCards.forEach((g, i) => void halos.setParticleAt(i, g.x, g.y, g.z, g.size, 0, g.colour, g.alpha))
  if (HALOS) {
    world.addChild(halos)
    draws++
  }

  // --- shafts, moon, stars, silhouettes ---
  if (DRESS) {
    const shafts = new ParticleContainer3D({
      texture: shaftTexture(),
      capacity: 16,
      blendMode: 'add',
      billboard: 'cylindrical',
    })
    ;[
      [-2.5, 2.4, 5, 5.5],
      [2.8, 2.4, 12.5, 6],
      [-1.5, 2.4, 19, 6],
      [2, 2.4, 24, 5],
    ].forEach(
      ([x, y, z, s], i) =>
        void shafts.setParticleAt(i, x as number, y as number, z as number, s as number, 0, C.moonlight, 0.3),
    )
    const sky = new ParticleContainer3D({
      texture: glow,
      capacity: 96,
      blendMode: 'add',
      billboard: 'spherical',
    })
    sky.setParticleAt(0, 0.6, -4.2, 59, 22, 0, C.moonlight, 0.3)
    let r = 7
    for (let i = 1; i < 70; i++) {
      r = (r * 48271) % 2147483647
      const sx = ((r % 1000) / 1000) * 120 - 60
      r = (r * 48271) % 2147483647
      const sy = 8 + ((r % 1000) / 1000) * 30
      sky.setParticleAt(i, sx, sy, 75, 0.35 + (i % 3) * 0.12, 0, i % 3 === 0 ? hex(9) : hex(10), 0.9)
    }
    // Two rows of silhouettes beyond the walls: ruined towers far (Emberwick's far layer), pines nearer (its near
    // layer). Each is a pair of crossed quads in one unfogged, alpha-masked mesh per layer (particles fog by blend mode).
    const cards = (spots: [number, number, number][], texture: Texture): Mesh3D => {
      const positions: number[] = []
      const uvs: number[] = []
      const normals: number[] = []
      const indices: number[] = []
      for (const [x, z, h] of spots) {
        const w = h / 2
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ] as const) {
          const b = positions.length / 3
          positions.push(
            x - (dx * w) / 2,
            0,
            z - (dz * w) / 2,
            x + (dx * w) / 2,
            0,
            z + (dz * w) / 2,
            x + (dx * w) / 2,
            h,
            z + (dz * w) / 2,
            x - (dx * w) / 2,
            h,
            z - (dz * w) / 2,
          )
          uvs.push(0, 1, 1, 1, 1, 0, 0, 0)
          normals.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1)
          indices.push(b, b + 1, b + 2, b, b + 2, b + 3)
        }
      }
      const geometry = new Geometry3D({
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices),
      })
      return new Mesh3D({
        geometry,
        material: new FlatMaterial({
          baseColorTexture: texture,
          baseColor: 0x6a6a7a,
          alphaMode: 'mask',
          alphaCutoff: 0.5,
          fog: false,
          doubleSided: true,
        }),
      })
    }
    const towers: [number, number, number][] = []
    for (let i = 0; i < 9; i++) towers.push([-26 + i * 6.5 + (i % 2) * 2, 52 + (i % 3) * 5, 14 + (i % 3) * 4])
    const pines: [number, number, number][] = []
    for (const side of [-1, 1])
      for (let z = -2; z < 44; z += 2.2) pines.push([side * (8 + ((z * 7) % 3)), z, 6 + ((z * 13) % 3)])
    for (let x = -16; x <= 16; x += 2.6) pines.push([x, 40 + ((x * 5) % 3), 7])
    const moonCard = new Mesh3D({
      geometry: new PlaneGeometry({ width: 9, height: 9 }),
      material: new FlatMaterial({
        baseColorTexture: moonTexture(),
        alphaMode: 'mask',
        alphaCutoff: 0.5,
        fog: false,
        doubleSided: true,
      }),
    })
    moonCard.position.set(0.6, -4.2, 60)
    const valley = cards(
      pines.filter(([, z]) => z > 30),
      silhouetteTexture(15, false),
    )
    valley.position.set(0, -7, 0)
    const towerRow = cards(towers, silhouetteTexture(52, true))
    towerRow.position.set(0, -9, 0)
    world.addChild(
      towerRow,
      moonCard,
      valley,
      cards(
        pines.filter(([, z]) => z <= 30),
        silhouetteTexture(15, false),
      ),
    )
    draws += 3
    world.addChild(sky, shafts)
    // Grass along every platform edge and at the wall feet; vines down the channel walls.
    const grass = new ParticleContainer3D({
      texture: grassTexture(),
      capacity: 512,
      billboard: 'cylindrical',
      alphaMode: 'mask',
      alphaCutoff: 0.5,
    })
    let gi = 0
    for (const room of ROOM.rooms) {
      const [x0, z0] = room.min
      const [x1, z1] = room.max
      for (let x = x0 + 0.3; x < x1; x += 0.55) {
        for (const z of [z0 + 0.12, z1 - 0.12])
          grass.setParticleAt(gi++, x + ((x * 31) % 0.2), 0.14, z, 0.3, 0, 0x7f9aa0, 1)
      }
      for (let z = z0 + 0.3; z < z1; z += 0.5)
        for (const x of [x0 + 0.15, x1 - 0.15])
          grass.setParticleAt(gi++, x, 0.16, z + ((z * 17) % 0.2), 0.34, 0, 0x7f9aa0, 1)
    }
    const vines = new ParticleContainer3D({
      texture: vineTexture(),
      capacity: 64,
      billboard: 'cylindrical',
      alphaMode: 'mask',
      alphaCutoff: 0.5,
    })
    let vi = 0
    for (const pit of ROOM.pits ?? [])
      for (let x = -4.4; x < 4.5; x += 1.3)
        for (const z of [pit.min[1] + 0.03, pit.max[1] - 0.03])
          vines.setParticleAt(vi++, x, -0.45, z, 0.9, 0, 0xffffff, 1)
    world.addChild(grass, vines)
    draws += 2
  }

  // --- fireflies and sparks: one container animated on the page clock ---
  const motes = new ParticleContainer3D({
    texture: glow,
    capacity: 64,
    blendMode: 'add',
    billboard: 'spherical',
  })
  const fireflies = Array.from({ length: 22 }, (_, i) => ({
    x: -4 + ((i * 3.7) % 8),
    y: 0.6 + ((i * 1.3) % 1.6),
    z: 0.5 + ((i * 5.3) % 27),
    phase: i * 1.7,
  }))
  if (MOTES) {
    world.addChild(motes)
    draws++
  }

  // --- camera: the game's lens and angle ---
  const focusOf: Record<string, V3> = {
    start: [0, 1, 1.5],
    channel: [0.4, 1, 6.8],
    ember: [-2.4, 1, 13.2],
    goal: [0.6, 1, 24],
  }
  const focus = focusOf[MOMENT] ?? focusOf.start
  const tilt = ((MOMENT === 'goal' ? 35 : 25) * Math.PI) / 180
  const distance = MOMENT === 'goal' ? 7 : 5
  view.camera.fov = (2 * Math.atan(12 / 24) * 180) / Math.PI
  view.camera.near = 0.1
  view.camera.far = 120
  view.camera.position.set(
    focus[0],
    focus[1] + distance * Math.sin(tilt),
    focus[2] - distance * Math.cos(tilt),
  )
  view.camera.lookAt({ x: focus[0], y: focus[1], z: focus[2] })

  const t0 = performance.now()
  const animate = (seconds: number): void => {
    if (MOTES) {
      fireflies.forEach((f, i) => {
        const a = 0.55 + 0.45 * Math.sin(seconds * 2.1 + f.phase)
        motes.setParticleAt(
          i,
          f.x + Math.sin(seconds * 0.6 + f.phase) * 0.5,
          f.y + Math.sin(seconds * 0.9 + f.phase * 1.3) * 0.25,
          f.z + Math.cos(seconds * 0.5 + f.phase) * 0.5,
          0.16,
          0,
          C.firefly,
          a,
        )
      })
      for (let i = 0; i < 16; i++) {
        const life = (seconds * 0.7 + i / 16) % 1
        motes.setParticleAt(
          22 + i,
          goal[0] + Math.sin(i * 2.4) * 0.3 * life,
          1 + life * 1.6,
          goal[2] + Math.cos(i * 2.4) * 0.3 * life,
          0.1,
          0,
          [C.spark, C.lantern, C.ember, C.lavaHot][i % 4] as number,
          1 - life,
        )
      }
    }
    if (HALOS)
      glowCards.forEach(
        (g, i) =>
          void halos.setParticleAt(
            i,
            g.x,
            g.y,
            g.z,
            g.size * (1 + 0.08 * Math.sin(seconds * 3 + g.phase)),
            0,
            g.colour,
            g.alpha,
          ),
      )
    goalCore.rotation.set(0, seconds * 1.5, 0)
  }
  animate(Number(params.get('t') ?? 1.3))
  app.ticker.stop()
  app.render()

  // Frame cost: render `frames` frames back to back, each finished on the GPU (a 1-pixel read stalls until it is),
  // and report the mean. On SwiftShader this is a rough relative guide only, never a phone number.
  const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl
  const pixel = new Uint8Array(4)
  const measure = (frames: number): number => {
    const start = performance.now()
    for (let i = 0; i < frames; i++) {
      animate(1.3 + i / 60)
      app.render()
      gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
    }
    return (performance.now() - start) / frames
  }
  animate(Number(params.get('t') ?? 1.3))
  app.render()
  Object.assign(window, {
    spike: {
      ready: true,
      lights,
      draws,
      bootMs: performance.now() - t0,
      measure,
      renderer: app.renderer.name,
    },
  })
  document.documentElement.dataset.ready = '1'
}

main().catch((error: unknown) => {
  document.documentElement.dataset.error = String(error instanceof Error ? error.stack : error)
  throw error
})
