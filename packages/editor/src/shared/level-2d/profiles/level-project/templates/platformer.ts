import type { EntityDef2D, IntValueDef, Project } from '../../../model/project-types'
import type { TemplateDef } from '../../profile'
import { blobRules, valueRule } from './blob-rules'
import { placeholderTileset } from './placeholder-tileset'
import { editCells, placeEntities, starterProject } from './starter'

// The platformer start (2D editor spec §7): a 512 × 288 level on a 16 px grid. Collision is an IntGrid; the `ground`
// auto layer draws it with the 47-tile terrain set, so painting a floor is painting `solid` and the edges, corners and
// inner corners follow. The placeholder tileset `terrain` is 8 × 8 tiles: 0 to 46 are the terrain set, then the hazard
// and water tiles the other collision values draw, then decor.

const TILE = 16
const SOLID = 1
const ONE_WAY = 2
const SPIKE = 3
const WATER = 4
const LADDER = 5

/** Tile indices in `terrain` after the 47 terrain tiles. */
const SPIKE_TILE = 47
const WATER_TILE = 48
const LADDER_TILE = 49
const ONE_WAY_TILE = 50

const collisionValues: IntValueDef[] = [
  { value: SOLID, id: 'solid', label: 'Solid', color: '#64748b' },
  { value: ONE_WAY, id: 'one-way', label: 'One-way', color: '#a78bfa' },
  { value: SPIKE, id: 'spike', label: 'Spike', color: '#ef4444' },
  { value: WATER, id: 'water', label: 'Water', color: '#38bdf8' },
  { value: LADDER, id: 'ladder', label: 'Ladder', color: '#f59e0b' },
]

const entities: EntityDef2D[] = [
  {
    id: 'player-start',
    label: 'Player start',
    color: '#22c55e',
    single: true,
    fields: [],
    shape: 'rect',
    size: { w: 16, h: 24 },
    pivot: { x: 0.5, y: 1 },
    resizable: 'none',
    tags: ['spawn'],
    min: { per: 'project', count: 1 },
  },
  {
    id: 'slime',
    label: 'Slime',
    color: '#a855f7',
    fields: [
      { id: 'hp', type: 'int', label: 'Hit points', min: 1, max: 9, default: 3 },
      { id: 'patrol', type: 'point', label: 'Patrol path', list: true },
      { id: 'tint', type: 'color', label: 'Tint', default: '#7c3aed' },
    ],
    shape: 'rect',
    size: { w: 16, h: 12 },
    pivot: { x: 0.5, y: 1 },
    resizable: 'none',
    tags: ['enemy'],
  },
  {
    id: 'coin',
    label: 'Coin',
    color: '#facc15',
    fields: [],
    shape: 'ellipse',
    size: { w: 8, h: 8 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['pickup'],
  },
  {
    id: 'door',
    label: 'Door',
    color: '#fb923c',
    fields: [
      {
        id: 'target',
        type: 'ref',
        label: 'Leads to',
        required: true,
        to: ['door', 'checkpoint', 'player-start'],
      },
    ],
    shape: 'rect',
    size: { w: 16, h: 32 },
    pivot: { x: 0.5, y: 1 },
    resizable: 'none',
    tags: ['link'],
  },
  {
    id: 'checkpoint',
    label: 'Checkpoint',
    color: '#2dd4bf',
    fields: [],
    shape: 'rect',
    size: { w: 16, h: 32 },
    pivot: { x: 0.5, y: 1 },
    resizable: 'none',
    tags: ['spawn'],
  },
  {
    id: 'moving-platform',
    label: 'Moving platform',
    color: '#94a3b8',
    fields: [
      { id: 'travel', type: 'point', label: 'Travel', default: { x: 64, y: 0 } },
      { id: 'speed', type: 'float', label: 'Speed', min: 0, max: 8, step: 0.25, default: 1 },
    ],
    shape: 'rect',
    size: { w: 48, h: 8 },
    pivot: { x: 0, y: 0 },
    resizable: 'x',
    tags: ['platform'],
  },
]

export const platformerTemplate: TemplateDef<Project> = {
  id: 'platformer',
  label: 'Platformer',
  hint: 'side view',
  create: (ids) =>
    starterProject(
      'Untitled platformer',
      'platformer',
      {
        layers: [
          { id: 'entities', label: 'Entities', kind: 'entities', grid: TILE, snap: true },
          { id: 'decor', label: 'Decor', kind: 'tiles', grid: TILE, tileset: 'terrain', opacity: 1 },
          {
            id: 'ground',
            label: 'Ground',
            kind: 'auto',
            grid: TILE,
            source: 'collision',
            tileset: 'terrain',
            groups: [
              {
                id: 'terrain',
                label: 'Terrain',
                active: true,
                rules: blobRules({ value: SOLID, firstTile: 0, idPrefix: 'ground' }),
              },
              {
                id: 'hazards',
                label: 'Hazards and water',
                active: true,
                rules: [
                  valueRule('spike', SPIKE, SPIKE_TILE),
                  valueRule('water', WATER, WATER_TILE),
                  valueRule('ladder', LADDER, LADDER_TILE),
                  valueRule('one-way', ONE_WAY, ONE_WAY_TILE),
                ],
              },
            ],
            opacity: 1,
          },
          {
            id: 'collision',
            label: 'Collision',
            kind: 'intgrid',
            grid: TILE,
            values: collisionValues,
            opacity: 0.6,
          },
        ],
        tilesets: [
          placeholderTileset({
            id: 'terrain',
            label: 'Terrain',
            columns: 8,
            rows: 8,
            tile: TILE,
            tags: [
              { tag: 'solid', tiles: Array.from({ length: 47 }, (_, i) => i) },
              { tag: 'hazard', tiles: [SPIKE_TILE] },
              { tag: 'water', tiles: [WATER_TILE] },
              { tag: 'ladder', tiles: [LADDER_TILE] },
              { tag: 'one-way', tiles: [ONE_WAY_TILE] },
              { tag: 'decor', tiles: Array.from({ length: 13 }, (_, i) => 51 + i) },
            ],
          }),
        ],
        entities,
        levelFields: [{ id: 'music', type: 'text', label: 'Music', default: '' }],
      },
      {
        id: 'level-1',
        name: 'Level 1',
        size: { w: 512, h: 288 },
        background: { color: '#1b2540', mode: 'fit' },
      },
      (layers) =>
        placeEntities(
          // A two-cell floor along the bottom, and the player standing on it.
          editCells(layers, 'collision', (cells) => cells.fillRect(0, 16, 32, 2, SOLID)),
          'entities',
          [{ id: ids.next(), def: 'player-start', x: 3 * TILE, y: 16 * TILE, fields: {} }],
        ),
    ),
}
