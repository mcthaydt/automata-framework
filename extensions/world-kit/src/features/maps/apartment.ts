// The apartment: a corridor with rooms off both sides, each through a doorway sector (a wall with a lintel over it, and a
// step where a room sits higher), a sloped ramp at the corridor's end up to a landing; each room asks to be dressed by its
// kind (bedroom, study, lounge, store: a purpose kit each, `furnish/`), with windows on its outer wall.
//
// Ported from the world generator this kit grew out of. Changed: the
// seeded stream is AF's, so a seed makes a different apartment than the builder's, the same every run.
import { at } from '@automata/3d/props-kit'
import type { MapPlan, MapSector, MapSprite } from './map-plan.ts'
import { pick, round, seeded } from './plan-helpers.ts'

const KINDS: Record<string, string> = {
  bedroom: 'bedroom',
  study: 'office',
  lounge: 'livingRoom',
  store: 'storeroom',
}
const WALLS = [
  'wallpaperSage',
  'wallpaperDamask',
  'plasterWarm',
  'panelOak',
  'brickRed',
  'concreteWall',
  'tileBath',
  'brickFlemish',
]
const FLOORS = ['oakFloor', 'pineFloor', 'checkerFloor', 'carpetRed', 'tileKitchen']
const DOORS = ['doorWood', 'doorRed', 'doorTeal', 'doorOchre', 'doorWhite']

/** The apartment a seed makes. */
export function apartment(seed = 1): MapPlan {
  const r = seeded(seed * 7919 + 1),
    sectors: MapSector[] = [],
    sprites: MapSprite[] = []
  let firstDoor: [number, number] = [1, -0.8]
  const cw = 1.6,
    ch = 2.5,
    rooms = 3 + Math.floor(r() * 2)
  // Rooms along the corridor, north then south, each its own width.
  let xn = 0,
    xs = 0
  const kinds = Object.keys(KINDS)
  for (let i = 0; i < rooms * 2; i++) {
    const north = i % 2 === 0,
      w = round(3.2 + r() * 1.6),
      d = round(3.2 + r() * 1.0),
      x0 = north ? xn : xs,
      x1 = x0 + w
    if (north) xn = x1 + 0.4
    else xs = x1 + 0.4
    const y0 = north ? -cw / 2 - 0.16 - d : cw / 2 + 0.16,
      y1 = north ? -cw / 2 - 0.16 : cw / 2 + 0.16 + d
    const step = r() < 0.3 ? 0.2 : 0,
      kind = at(kinds, i % kinds.length),
      wall = pick(r, WALLS),
      floor = pick(r, FLOORS)
    const outer = north ? '0' : '2',
      ceilZ = round(2.6 + r() * 0.5),
      ceiling = r() < 0.3 ? 'beamCeiling' : 'ceiling'
    // The room keeps its own floor, wall and ceiling, and its doorway matches them: the kit adds the rest (dress.surfaces
    // overrides the kit's part by part).
    sectors.push({
      id: `room${i}`,
      dress: { as: KINDS[kind] as string, seed: seed * 31 + i, surfaces: { floor, wall, ceiling } },
      rect: [x0, north ? round(y0) : y0, x1, north ? y1 : round(y1)],
      floor: { z: step, swatch: floor },
      ceil: { z: ceilZ, swatch: ceiling },
      shade: r() < 0.25 ? 1 : 0,
      wall: {
        swatch: wall,
        skirting: 0.1,
        trim: 'trimWhite',
        ...(wall.startsWith('wallpaper') || wall === 'plasterWarm' ? { rail: 0.9 } : {}),
      },
      walls: {
        [outer]: {
          decor: [
            {
              kind: 'window',
              pos: x1 - w * 0.3,
              width: 1.1,
              height: 1.1,
              sill: 0.95,
              glass: 'glassNight',
              lit: false,
            },
          ],
        },
      },
    })
    // The doorway: a short sector in the wall's thickness, its lintel lower than both ceilings.
    const dx = round(x0 + 0.7 + r() * (w - 1.8)),
      dy0 = north ? -cw / 2 - 0.16 : cw / 2,
      dy1 = dy0 + 0.16
    // Its door: hinged, swinging into the room, in a painted colour, opening as a first-person camera comes near; in the
    // diorama every other one stands open.
    sectors.push({
      id: `door${i}`,
      rect: [dx - 0.45, round(dy0, 0.01), dx + 0.45, round(dy1, 0.01)],
      floor: { z: step, swatch: floor },
      ceil: { z: 2.1, swatch: 'trimWhite' },
      wall: { swatch: 'trimWhite', upper: wall, lower: 'trimWhite' },
      door: {
        near: 1.6,
        speed: 0.7,
        into: north ? -1 : 1,
        hinge: r() < 0.5 ? 'start' : 'end',
        swatch: pick(r, DOORS),
        shown: i % 2 ? 1 : 0,
      },
    })
    if (i === 0) firstDoor = [dx, dy0]
  }
  // The corridor, then a ramp up to a landing.
  const cx1 = Math.max(xn, xs) - 0.4
  // The corridor in colour blocks: a painted dado under its rail, a runner down its middle, pictures between the doors,
  // plants at its ends.
  const dado = pick(r, ['dadoGreen', 'dadoBlue', 'dadoOxblood'])
  sectors.push({
    id: 'corridor',
    rect: [-0.4, -cw / 2, cx1, cw / 2],
    floor: { z: 0, swatch: 'oakFloor' },
    ceil: { z: ch, swatch: 'ceiling' },
    shade: 1,
    wall: {
      swatch: 'plasterWarm',
      skirting: 0.1,
      trim: 'trimWhite',
      rail: 0.9,
      dado: { swatch: dado, height: 0.9 },
    },
  })
  sprites.push({ use: 'runner', at: [(cx1 - 0.4) / 2, 0], with: { size: [cx1 - 1.2, 0.72] } })
  const doorsAt = sectors
    .filter((s) => s.id.startsWith('door'))
    .map((s) => ((s.rect?.[0] ?? 0) + (s.rect?.[2] ?? 0)) / 2)
  for (let x = 1.2; x < cx1 - 0.6; x += 1.9)
    for (const north of [true, false]) {
      if (doorsAt.some((d) => Math.abs(d - x) < 0.9) || r() < 0.35) continue
      sprites.push({
        use: pick(r, ['picture.sea', 'picture.sun']),
        at: [x, north ? -cw / 2 + 0.01 : cw / 2 - 0.01, 1.35],
        angle: north ? 90 : 270,
        diorama: false,
      })
    }
  sprites.push(
    { use: 'plant.fronds', at: [-0.1, -0.55], with: { seed: seed + 3, height: 1.0 } },
    { use: 'plant.pot', at: [cx1 - 0.3, 0.55], with: { seed: seed + 4 } },
  )
  sectors.push({
    id: 'ramp',
    rect: [cx1, -cw / 2, cx1 + 2.4, cw / 2],
    floor: { z: 0, swatch: 'oakFloor', slope: [0.25, 0] },
    ceil: { z: ch + 0.6, swatch: 'ceiling' },
    shade: 1,
    wall: { swatch: 'plasterWarm', trim: 'trimWhite' },
  })
  sectors.push({
    id: 'landing',
    rect: [cx1 + 2.4, -cw / 2 - 0.6, cx1 + 4.2, cw / 2 + 0.6],
    floor: { z: 0.6, swatch: 'pineFloor' },
    ceil: { z: ch + 0.9, swatch: 'ceiling' },
    shade: 0,
    wall: { swatch: 'brickRed', trim: 'trimWhite' },
    walls: {
      '1': {
        decor: [
          { kind: 'window', pos: 0, width: 1.0, height: 1.4, sill: 0.8, glass: 'glassNight', lit: false },
        ],
      },
    },
  })
  sprites.push({ use: 'plant.fronds', at: [cx1 + 3.7, -0.9] }, { use: 'lamp.floor', at: [cx1 + 3.8, 1.0] })
  sprites.push(
    { who: 'base-f', at: [3.0, 0.3], to: [cx1 - 0.5, 0.2], angle: 0 },
    { who: 'base-m', at: [cx1 + 3.1, 0.2], angle: 180 },
  )
  const width = cx1 + 4.6
  return {
    id: `apartment@${seed}`,
    name: `A generated apartment (seed ${seed})`,
    time: 'lampLit',
    grime: 0.8,
    grade: 'warmNight',
    visibility: 6,
    sectors,
    sprites,
    seed,
    lamps: [
      { at: [cx1 * 0.25, 0, 2.2], kind: 'bulb' },
      { at: [cx1 * 0.75, 0, 2.2], kind: 'bulb' },
    ],
    views: {
      diorama: { w: Math.ceil((width * 73.85) / 8) * 8, h: 520, pitch: 18, at: [width / 2 - 0.4, 0.9, 0] },
      topdown: { w: Math.ceil((width * 73.85) / 8) * 8, h: 760, pitch: 55, at: [width / 2 - 0.4, 0, 0] },
      fp: { at: [0.2, 0], angle: 0, eye: 1.6 },
    },
    paths: {
      door: [
        [-0.2, 0.3],
        [firstDoor[0] - 1.2, 0.3],
        [firstDoor[0], 0.1],
        [firstDoor[0], -1.4],
        [firstDoor[0] + 0.3, -2.4],
      ],
      walk: [
        [0.0, 0.1],
        [cx1 * 0.35, -0.2],
        [cx1 * 0.6, 0.2],
        [cx1 - 0.3, 0],
        [cx1 + 1.6, 0],
        [cx1 + 2.2, -0.2],
      ],
    },
  }
}
