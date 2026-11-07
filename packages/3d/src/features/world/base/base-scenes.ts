// The base interior and exterior: two plain places every look change is judged on, as `af-sector/2` levels (converted once
// written out here, not generated at run time). The interior is a
// room with a window, a doorway and a corridor stub, a table, a box and a bin, a pendant lamp, lit at `lampLit`; the
// exterior is a pavement before a building face (a door and two windows), a road a kerb lower, a street lamp and a tree,
// under open sky with a city on the horizon, at `day`. Both cast the base pair (`man` and `woman`, figures/base) and
// both name only what `baseLibrary` has, so they build from core alone. The builder's dressed variants (a waiting room,
// a street) are the world-kit extension's. Map space: x east, z south.
import type { AfSector2 } from '../../../shared/level/af-sector-2.schema.ts'

const interior: AfSector2 = {
  format: 'af-sector/2',
  name: 'base-interior',
  title: 'Base interior: a plain room, a doorway and a corridor stub',
  sectors: [
    {
      id: 'room',
      floor: {
        z: 0,
        surface: 'baseFloor',
      },
      ceiling: {
        z: 2.7,
        surface: 'baseCeiling',
      },
      light: 1,
      corners: [
        [
          -3,
          -2.5,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
        [
          3,
          -2.5,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
            decor: [
              {
                kind: 'window',
                pos: 0,
                width: 1.2,
                height: 1.2,
                sill: 0.9,
                glass: 'glassNight',
                lit: false,
              },
            ],
          },
        ],
        [
          3,
          2.5,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
        [
          -3,
          2.5,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
      ],
    },
    {
      id: 'doorway',
      floor: {
        z: 0,
        surface: 'baseFloor',
      },
      ceiling: {
        z: 2.1,
        surface: 'trimWhite',
      },
      light: 1,
      corners: [
        [
          -0.45,
          -2.66,
          {
            surface: 'trimWhite',
            upper: 'baseWall',
            lower: 'trimWhite',
          },
        ],
        [
          0.45,
          -2.66,
          {
            surface: 'trimWhite',
            upper: 'baseWall',
            lower: 'trimWhite',
          },
        ],
        [
          0.45,
          -2.5,
          {
            surface: 'trimWhite',
            upper: 'baseWall',
            lower: 'trimWhite',
          },
        ],
        [
          -0.45,
          -2.5,
          {
            surface: 'trimWhite',
            upper: 'baseWall',
            lower: 'trimWhite',
          },
        ],
      ],
    },
    {
      id: 'stub',
      floor: {
        z: 0,
        surface: 'baseFloor',
      },
      ceiling: {
        z: 2.7,
        surface: 'baseCeiling',
      },
      light: 1,
      corners: [
        [
          -0.6,
          -4.16,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
        [
          0.6,
          -4.16,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
        [
          0.6,
          -2.66,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
        [
          -0.6,
          -2.66,
          {
            surface: 'baseWall',
            trim: 'trimWhite',
            skirting: 0.1,
          },
        ],
      ],
    },
  ],
  props: [
    {
      id: 'prop0',
      use: 'lamp.pendant',
      at: [0, 0],
      with: {
        height: 2.25,
        ceiling: 2.7,
      },
    },
    {
      id: 'prop1',
      use: 'prim.box',
      at: [-1.8, -1.2],
      angle: 90,
    },
    {
      id: 'prop2',
      use: 'prim.table',
      at: [1.3, -1],
      angle: 90,
    },
    {
      id: 'prop3',
      use: 'prim.cylinder',
      at: [-1.7, 1.2],
    },
  ],
  cast: [
    {
      id: 'cast4',
      who: 'man',
      at: [-0.5, 0.7],
      angle: 90,
    },
    {
      id: 'cast5',
      who: 'woman',
      at: [0.6, 0.9],
      angle: 90,
    },
  ],
  time: 'lampLit',
  views: {
    diorama: {
      w: 512,
      h: 320,
      pitch: 18,
      at: [0, 1, -0.6],
    },
    fp: {
      at: [0, 2],
      angle: 270,
      eye: 1.6,
    },
  },
  paths: {
    walk: [
      [0, 2],
      [0, -1.5],
      [0, -3.4],
    ],
  },
  grime: 0,
  reads: {
    hot: true,
  },
}

const exterior: AfSector2 = {
  format: 'af-sector/2',
  name: 'base-exterior',
  title: 'Base exterior: a pavement before a building face, a road a curb lower',
  sectors: [
    {
      id: 'pavement',
      floor: {
        z: 0.12,
        surface: 'baseGround',
      },
      ceiling: {
        z: 9,
        sky: true,
      },
      light: 1,
      corners: [
        [
          -8,
          -3,
          {
            surface: 'baseFacade',
            trim: 'trimDark',
            none: false,
            decor: [
              {
                kind: 'door',
                pos: -2,
                width: 1,
                height: 2.15,
              },
              {
                kind: 'window',
                pos: 1.5,
                width: 1.2,
                height: 1.3,
                sill: 0.9,
              },
              {
                kind: 'window',
                pos: 4.5,
                width: 1.2,
                height: 1.3,
                sill: 0.9,
              },
            ],
          },
        ],
        [
          8,
          -3,
          {
            none: true,
          },
        ],
        [
          8,
          0,
          {
            none: true,
          },
        ],
        [
          -8,
          0,
          {
            none: true,
          },
        ],
      ],
    },
    {
      id: 'road',
      floor: {
        z: 0,
        surface: 'baseRoad',
      },
      ceiling: {
        z: 9,
        sky: true,
      },
      light: 1,
      corners: [
        [
          -8,
          0,
          {
            lower: 'baseKerb',
            none: true,
          },
        ],
        [
          8,
          0,
          {
            lower: 'baseKerb',
            none: true,
          },
        ],
        [
          8,
          4,
          {
            lower: 'baseKerb',
            none: true,
          },
        ],
        [
          -8,
          4,
          {
            lower: 'baseKerb',
            none: true,
          },
        ],
      ],
    },
  ],
  props: [
    {
      id: 'prop0',
      use: 'streetLamp',
      at: [-4, -0.4, 0.12],
      angle: 90,
    },
    {
      id: 'prop1',
      use: 'tree.round',
      at: [5, -1.6, 0.12],
    },
  ],
  cast: [
    {
      id: 'cast2',
      who: 'man',
      at: [-1, -1.2],
      angle: 90,
    },
    {
      id: 'cast3',
      who: 'woman',
      at: [0.5, -1],
      angle: 90,
    },
  ],
  time: 'day',
  views: {
    diorama: {
      w: 640,
      h: 360,
      pitch: 18,
      at: [0, 1.6, 0.4],
    },
    fp: {
      at: [-6, 2],
      angle: 0,
      eye: 1.6,
    },
  },
  paths: {
    walk: [
      [-6, 2],
      [0, 1.5],
      [6, 2],
    ],
  },
  sky: {
    horizon: [
      {
        kind: 'city',
        swatch: 'baseSkyline',
        height: 0.2,
        seed: 3,
      },
    ],
  },
  grime: 0,
  reads: {},
}

/** The two base scenes, by name. */
export const BASE_SCENES: Readonly<Record<'base-interior' | 'base-exterior', AfSector2>> = {
  'base-interior': interior,
  'base-exterior': exterior,
}
