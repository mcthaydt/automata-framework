// What the base scenes name, and nothing else: twenty-one swatches (a step of one of DUEL's ramps each, flat in colour: the
// photo textures and patterns the builder cut its tiles from are the world-kit extension's) and six prop presets. A game
// that wants a different look copies these into its own `world-swatch` and `world-prop` content; the scenes build from
// this library alone.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/library/{swatches,props}.json at
// 6d82a52: the swatches the two base scenes and their props use, with `ramp` as DUEL's name and `step` its `base`, and
// the presets `prim.box`, `prim.table`, `prim.cylinder`, `lamp.pendant`, `streetLamp` and `tree.round`.

import type { WorldProp } from '../content/world-prop.schema.ts'
import type { WorldSwatch } from '../content/world-swatch.schema.ts'
import type { WorldLibrary } from '../swatches.ts'

const swatches: Readonly<Record<string, WorldSwatch>> = {
  baseFloor: { ramp: 'grey', step: 3 },
  baseCeiling: { ramp: 'grey', step: 6 },
  baseWall: { ramp: 'grey', step: 5 },
  trimWhite: { ramp: 'sand', step: 6 },
  glassNight: { ramp: 'navy', step: 2, noCast: true },
  glassDay: { ramp: 'sky', step: 5, noCast: true },
  doorWood: { ramp: 'mud', step: 4 },
  baseGround: { ramp: 'grey', step: 4 },
  baseFacade: { ramp: 'grey', step: 4 },
  trimDark: { ramp: 'violet', step: 2 },
  baseRoad: { ramp: 'grey', step: 2 },
  baseKerb: { ramp: 'grey', step: 4 },
  baseSkyline: { ramp: 'dusk', step: 3 },
  basePrim: { ramp: 'grey', step: 4 },
  brass: { ramp: 'amber', step: 5 },
  bulbWarm: { ramp: 'ember', step: 7, emit: true },
  cordBlack: { ramp: 'violet', step: 1 },
  poleTeal: { ramp: 'teal', step: 2 },
  lampHead: { ramp: 'violet', step: 2 },
  bark: { ramp: 'mud', step: 2 },
  leafGreen: { ramp: 'moss', step: 4 },
}

const props: Readonly<Record<string, WorldProp>> = {
  'prim.box': { kind: 'box', size: [0.6, 0.6, 0.6], swatch: 'basePrim' },
  'prim.table': { kind: 'table', size: [1.2, 0.74, 0.7], top: 'basePrim', legs: 'basePrim' },
  'prim.cylinder': { kind: 'bin', radius: 0.3, height: 0.9, mat: 'basePrim', lid: 'basePrim' },
  'lamp.pendant': {
    kind: 'lamp',
    variant: 'pendant',
    shade: 'brass',
    bulb: 'bulbWarm',
    light: { kind: 'pendant', aim: [0, -1, 0], cone: 82 },
  },
  streetLamp: {
    kind: 'streetLamp',
    height: 4.2,
    pole: 'poleTeal',
    head: 'lampHead',
    glass: 'bulbWarm',
    light: { kind: 'sodium', shaft: true, aim: [0, -1, 0.15], cone: 72 },
  },
  'tree.round': { kind: 'tree', height: 5.2, trunk: 'bark', leaves: 'leafGreen' },
}

/** The library the base scenes build from. */
export const baseLibrary: WorldLibrary = { swatches, props }
