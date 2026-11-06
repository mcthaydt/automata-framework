import type { ProjectFile } from '../../shared/level-2d/model/project-types'

// Project files the tests share. They are plain data in the file shape (grids as row strings), canonical as
// `printProject` prints them, so the same fixture serves the schema, the codec and the open-rules tests.

/** The smallest valid file: no definitions, one empty world, no levels. */
export function minimalProjectFile(): ProjectFile {
  return {
    format: 'af2d',
    version: 1,
    name: 'Minimal',
    template: 'blank',
    defs: { layers: [], tilesets: [], entities: [], levelFields: [] },
    worlds: [{ id: 'main', layout: 'free', placements: [] }],
    levels: [],
  }
}

/**
 * A platformer-and-RPG-shaped file that uses every shape of the project model once: all five layer kinds, a placeholder
 * tileset, entity definitions with typed fields (a ref, a point list, a bounded int, a single, a minimum), an auto
 * layer with a rule, two levels in a free world, flips, an object and a level background image.
 */
export function richProjectFile(): ProjectFile {
  return {
    format: 'af2d',
    version: 1,
    name: 'Mossgate',
    template: 'platformer',
    defs: {
      layers: [
        { id: 'entities', label: 'Entities', kind: 'entities', grid: 16, snap: true },
        { id: 'props', label: 'Props', kind: 'objects', tileset: 'terrain', snap: 0 },
        {
          id: 'ground-art',
          label: 'Ground art',
          kind: 'auto',
          grid: 16,
          source: 'collision',
          tileset: 'terrain',
          groups: [
            {
              id: 'fill',
              label: 'Fill',
              active: true,
              rules: [
                {
                  id: 'solid-top',
                  active: true,
                  size: 3,
                  pattern: ['any', 'empty', 'any', 'any', { is: 1 }, 'any', 'any', 'filled', 'any'],
                  tiles: [1, 2],
                  chance: 1,
                  flipX: true,
                  flipY: false,
                  breakOnMatch: true,
                  outside: 'same',
                },
              ],
            },
          ],
          opacity: 1,
        },
        { id: 'decor', label: 'Decor', kind: 'tiles', grid: 16, tileset: 'terrain', opacity: 0.5 },
        {
          id: 'collision',
          label: 'Collision',
          kind: 'intgrid',
          grid: 16,
          values: [
            { value: 1, id: 'solid', label: 'Solid', color: '#ff0000' },
            { value: 2, id: 'water', color: '#0000ff' },
          ],
          opacity: 1,
        },
      ],
      tilesets: [
        {
          id: 'terrain',
          label: 'Terrain (placeholder)',
          imageSize: { w: 128, h: 128 },
          tile: { w: 16, h: 16 },
          spacing: 0,
          padding: 0,
          tags: [{ tag: 'solid', tiles: [1, 2, 3] }],
        },
      ],
      entities: [
        {
          id: 'door',
          label: 'Door',
          color: 'entity/door',
          fields: [{ id: 'target', type: 'ref', required: true, to: ['door'] }],
          shape: 'tile',
          size: { w: 16, h: 32 },
          pivot: { x: 0.5, y: 1 },
          resizable: 'none',
          tile: { tileset: 'terrain', index: 4 },
          tags: ['link'],
        },
        {
          id: 'player-start',
          label: 'Player start',
          color: '#00ff00',
          single: true,
          fields: [],
          shape: 'point',
          size: { w: 16, h: 16 },
          pivot: { x: 0.5, y: 1 },
          resizable: 'none',
          tags: ['spawn'],
          min: { per: 'project', count: 1 },
        },
        {
          id: 'slime',
          fields: [
            { id: 'hp', type: 'int', default: 3, min: 1, max: 9 },
            { id: 'patrol', type: 'point', list: true },
          ],
          shape: 'ellipse',
          size: { w: 16, h: 16 },
          pivot: { x: 0.5, y: 1 },
          resizable: 'x',
          tags: [],
        },
      ],
      levelFields: [{ id: 'music', type: 'enum', options: ['none', 'calm', 'tense'], default: 'none' }],
    },
    worlds: [
      {
        id: 'main',
        layout: 'free',
        placements: [
          { level: 'start', x: 0, y: 0, depth: 0 },
          { level: 'cellar', x: 0, y: 64, depth: 0 },
        ],
      },
    ],
    levels: [
      {
        id: 'cellar',
        name: 'Cellar',
        size: { w: 32, h: 32 },
        background: { color: '#000000', image: 'art/cellar.png', mode: 'repeat-x' },
        fields: {},
        layers: [
          {
            def: 'entities',
            kind: 'entities',
            items: [
              {
                id: '0000000d',
                def: 'door',
                x: 16,
                y: 32,
                fields: { target: { target: '0000000c', container: 'start' } },
              },
            ],
          },
          { def: 'props', kind: 'objects', items: [] },
          { def: 'ground-art', kind: 'auto', seed: 7, overrides: ['.*2', '.*2'] },
          { def: 'decor', kind: 'tiles', rows: ['.*2', '.*2'] },
          { def: 'collision', kind: 'intgrid', rows: ['.*2', '1*2'] },
        ],
      },
      {
        id: 'start',
        name: 'Start',
        size: { w: 64, h: 48 },
        background: { color: '#1b1b2f', mode: 'fit' },
        fields: { music: 'calm' },
        layers: [
          {
            def: 'entities',
            kind: 'entities',
            items: [
              { id: '00000009', def: 'player-start', x: 16, y: 32, fields: {} },
              {
                id: '0000000a',
                def: 'slime',
                x: 32,
                y: 32,
                w: 24,
                fields: {
                  hp: 3,
                  patrol: [
                    { x: 16, y: 32 },
                    { x: 48, y: 32 },
                  ],
                },
              },
              {
                id: '0000000c',
                def: 'door',
                x: 48,
                y: 32,
                fields: { target: { target: '0000000d', container: 'cellar' } },
              },
            ],
          },
          {
            def: 'props',
            kind: 'objects',
            items: [{ id: '0000000b', tile: 7, x: 20, y: 12, flipX: false, flipY: true }],
          },
          { def: 'ground-art', kind: 'auto', seed: 1234, overrides: ['.*4', '.*4', '.*4'] },
          { def: 'decor', kind: 'tiles', rows: ['.*4', '. 5h .*2', '.*4'] },
          { def: 'collision', kind: 'intgrid', rows: ['.*4', '. 2 .*2', '1*4'] },
        ],
      },
    ],
  }
}
