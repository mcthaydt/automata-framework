// The street block, at night: a road, two pavements a kerb higher, a row of facades of seeded widths and styles with windows
// and shopfronts, and shops you can walk into through their doorways (dressed as storerooms); street lamps, cars, bins.
//
// Ported from the world generator this kit grew out of. Changed: the
// seeded stream is AF's, so a seed makes a different block than the builder's, the same every run.
import { at } from '@automata/3d/props-kit'
import type { MapPlan, MapSector, MapSprite } from './map-plan.ts'
import { pick, round, seeded } from './plan-helpers.ts'

const FLOORS = ['oakFloor', 'pineFloor', 'checkerFloor', 'carpetRed', 'tileKitchen']

const FACADES = [
  { swatch: 'brickRed', trim: 'trimWhite', awning: 'awningRed' },
  { swatch: 'stucco', trim: 'trimDark', awning: 'awningTeal' },
  { swatch: 'sidingBlue', trim: 'trimWhite', awning: 'awningRed' },
  { swatch: 'brickDark', trim: 'trimDark', awning: 'awningTeal' },
  { swatch: 'brickFlemish', trim: 'trimWhite', awning: 'awningTeal' },
  { swatch: 'concreteWall', trim: 'trimDark', awning: 'awningRed' },
  { swatch: 'corrugated', trim: 'trimDark', awning: 'awningRed' },
  { swatch: 'metalPanel', trim: 'trimDark', awning: 'awningTeal' },
] as const

/** The street block a seed makes. */
export function block(seed = 1): MapPlan {
  const r = seeded(seed * 104729 + 3),
    sectors: MapSector[] = [],
    sprites: MapSprite[] = []
  const L = 30,
    X0 = -L / 2,
    X1 = L / 2
  // The facades along the north pavement: seeded widths, each a vertex on the pavement's north edge.
  const xs = [X0]
  while (at(xs, xs.length - 1) < X1 - 5) xs.push(round(Math.min(X1, at(xs, xs.length - 1) + 5 + r() * 3)))
  xs[xs.length - 1] = X1
  const north = [
    ...xs.map((x) => [x, -2.8] as [number, number]),
    [X1, -1.0] as [number, number],
    [X0, -1.0] as [number, number],
  ]
  const walls: NonNullable<MapSector['walls']> = {}
  for (let i = 0; i < xs.length - 1; i++) {
    const f = pick(r, FACADES),
      a = at(xs, i),
      b = at(xs, i + 1),
      mid = (a + b) / 2
    walls[String(i)] = {
      swatch: f.swatch,
      trim: f.trim,
      windows: {
        from: 3.7,
        rows: 2,
        cols: Math.max(2, Math.round((b - a) / 2)),
        width: 1.0,
        height: 1.4,
        gap: 1.3,
        lit: 0.35 + r() * 0.3,
        seed: Math.floor(r() * 1e5),
      },
      decor: [
        {
          kind: 'shop',
          pos: mid - 0.8,
          width: Math.min(3.2, (b - a) * 0.45),
          height: 1.9,
          sill: 0.5,
          awning: r() < 0.6 ? f.awning : undefined,
        },
        r() < 0.35
          ? {
              kind: 'sign',
              pos: mid - 0.8,
              width: 2,
              sill: 3.05,
              neon: pick(r, ['neonPink', 'neonCyan', 'neonYellow']),
              swatch: 'trimDark',
              seed: Math.floor(r() * 1e4),
            }
          : {
              kind: 'sign',
              pos: mid - 0.8,
              width: 2,
              sill: 3.05,
              swatch: pick(r, ['signCream', 'signBlue', 'posterInkRed']),
              seed: Math.floor(r() * 1e4),
            },
      ],
    }
    // Every other building has a shop you can walk into, through a doorway sector at its door.
    if (i % 2 === 1) {
      const dx = round(Math.min(b - 0.9, mid + 1.4))
      sectors.push({
        id: `doorway${i}`,
        rect: [dx - 0.5, -3.0, dx + 0.5, -2.8],
        floor: { z: 0.15, swatch: 'sidewalk' },
        ceil: { z: 2.4, swatch: 'trimDark' },
        shade: 1,
        wall: { swatch: f.swatch, upper: f.swatch },
      })
      const floor = pick(r, FLOORS)
      sectors.push({
        id: `shop${i}`,
        dress: { as: 'storeroom', seed: seed * 17 + i, surfaces: { floor } },
        rect: [round(a + 0.3), -6.5, round(b - 0.3), -3.0],
        floor: { z: 0.15, swatch: floor },
        ceil: { z: 3.0, swatch: 'ceiling' },
        wall: { swatch: 'plasterWarm', skirting: 0.1, trim: 'trimDark' },
      })
    } else
      walls[String(i)]?.decor?.push({
        kind: 'door',
        pos: round(Math.min(b - 0.9, mid + 1.4)),
        width: 1.0,
        height: 2.15,
      })
  }
  sectors.push({
    id: 'north',
    verts: north,
    floor: { z: 0.15, swatch: 'sidewalk' },
    ceil: { z: 9, sky: true },
    wall: { swatch: 'stucco', lower: 'sidewalk', trim: 'trimDark' },
    walls,
  })
  sectors.push({
    id: 'street',
    rect: [X0, -1.0, X1, 2.6],
    floor: { z: 0, swatch: 'asphalt' },
    ceil: { z: 9, sky: true },
    // Open to the sky and at both ends: no wall of its own, only the kerb step beside each pavement.
    wall: { none: true, lower: 'sidewalk' },
  })
  sectors.push({
    id: 'south',
    rect: [X0, 2.6, X1, 4.6],
    floor: { z: 0.15, swatch: 'sidewalk' },
    ceil: { z: 9, sky: true },
    wall: { swatch: 'brickRed', lower: 'sidewalk', trim: 'trimWhite' },
    walls: {
      '2': { windows: { from: 0.9, rows: 3, cols: 14, width: 1.0, height: 1.3, gap: 1.5, lit: 0.4, seed } },
    },
  })
  for (let x = X0 + 3; x < X1 - 2; x += 7)
    sprites.push({
      use: 'streetLamp',
      at: [x, -1.5, 0.15],
      angle: 90,
      with: {
        light: {
          kind: 'sodium',
          ...(r() < 0.3 ? { flicker: 0.8, rate: 4 } : {}),
          aim: [0, -1, 0.15],
          cone: 72,
          shaft: true,
        },
      },
    })
  for (let i = 0; i < 2; i++) sprites.push({ use: 'manhole', at: [round(X0 + 6 + i * 11 + r() * 3), 0.2] })
  for (let x = X0 + 2; x < X1 - 2; x += 3)
    sprites.push({
      kind: 'block',
      at: [x, 0.8, 0],
      with: { size: [1.4, 0.004, 0.12], mat: 'roadPaint', round: 0 },
    })
  // Cars in slots along the kerbs (a car's nose is its +x: angle 90 runs it east, 270 west).
  for (let i = 0; i < 3; i++) {
    const north = r() < 0.5
    sprites.push({
      use: pick(r, ['car', 'car.teal']),
      at: [round(X0 + 5 + i * 9 + r() * 3), north ? -0.1 : 1.7],
      angle: north ? 270 : 90,
    })
  }
  for (let i = 0; i < 4; i++)
    sprites.push({
      use: pick(r, ['bin', 'crate', 'bench']),
      at: [round(X0 + 2 + r() * (L - 4)), -2.3, 0.15],
      angle: 90,
    })
  // Machinery and plates: AC units up the facades, a vending machine and a generator on the pavement, street plates.
  for (let i = 0; i < xs.length - 1; i++)
    if (r() < 0.6)
      sprites.push({
        use: 'ac.unit',
        at: [
          round(at(xs, i) + 0.8 + r() * (at(xs, i + 1) - at(xs, i) - 1.6)),
          -2.8 + 0.18,
          3.25 + Math.floor(r() * 2) * 2.7,
        ],
        angle: 90,
      })
  sprites.push(
    { use: pick(r, ['vending', 'vending.blue']), at: [round(X0 + 6 + r() * 6), -2.4, 0.15], angle: 90 },
    { use: 'generator', at: [round(X1 - 8 + r() * 3), -2.25, 0.15], angle: 90 },
  )
  sprites.push(
    { use: 'plate.street', at: [X0 + 1.2, -1.2, 0.15], angle: 90, with: { seed: seed * 7 } },
    { use: 'plate.street', at: [X1 - 1.2, 2.9, 0.15], angle: 90, with: { seed: seed * 7 + 1 } },
  )
  sprites.push(
    { who: 'base-m', at: [-6, 4.1], to: [8, 4.1], angle: 0 },
    { who: 'base-f', at: [2.5, 1.0], angle: 90 },
  )
  return {
    id: `block@${seed}`,
    name: `A generated street block (seed ${seed})`,
    grime: 1.4,
    grade: 'sodium',
    time: { preset: 'night', rain: { density: 5, color: '#8690b2', splash: '#c7d6ff' } },
    visibility: 9,
    sectors,
    sprites,
    seed,
    horizon: [
      { kind: 'city', swatch: '#23324d', height: 0.22, seed: seed + 4 },
      { kind: 'city', swatch: '#28335d', height: 0.12, seed: seed + 9 },
    ],
    views: {
      diorama: { w: 960, h: 540, pitch: 18, at: [0, 2.45, 0] },
      topdown: { w: 960, h: 760, pitch: 55, at: [0, 0.5, -1] },
      fp: { at: [-12, 3.2], angle: 0, eye: 1.6 },
    },
    paths: {
      walk: [
        [-12, 3.2],
        [-6, 3.2],
        [0, 3.1],
        [5, 3.3],
        [10, 3.3],
      ],
    },
  }
}
