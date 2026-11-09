import type { EntityDef2D, Project } from '../../../model/project-types'
import type { TemplateDef } from '../../profile'
import { edgeRules, valueRule } from './blob-rules'
import { placeholderTileset } from './placeholder-tileset'
import { editCells, placeEntities, starterProject } from './starter'

// The top-down RPG start: a 320 × 240 level on a 16 px grid. `walls` is an IntGrid of what blocks
// the player; the `walls-art` auto layer draws it with a 16-tile wall set, so painting a wall paints its edges. The
// ground is plain hand-placed tiles and the props free-placed objects. The placeholder tileset `overworld` is 8 × 4:
//   0 to 7 ground (grass, flowers, path, sand, water, floor, dark floor, bridge), 8 to 23 walls (the edge set),
//   24 shore, 25 door frame, 26 to 31 props (tree, bush, rock, lamp, well, crate).

const TILE = 16
const BLOCKED = 1
const WATER = 2
const DOOR_FRAME = 3

const GRASS_TILE = 0
const WALL_FIRST_TILE = 8
const WATER_TILE = 4
const DOOR_FRAME_TILE = 25

const FACINGS = ['down', 'up', 'left', 'right']

const point = (id: string, label: string) => ({ id, type: 'point' as const, label })

const entities: EntityDef2D[] = [
  {
    id: 'player-start',
    label: 'Player start',
    color: '#22c55e',
    single: true,
    fields: [],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['spawn'],
    min: { per: 'project', count: 1 },
  },
  {
    id: 'npc',
    label: 'Villager',
    color: '#38bdf8',
    fields: [
      { id: 'name', type: 'text', label: 'Name', default: 'Villager' },
      { id: 'dialogue', type: 'text', label: 'Dialogue', multiline: true, default: '' },
      { id: 'facing', type: 'enum', label: 'Facing', options: FACINGS, default: 'down' },
      { ...point('route', 'Route'), list: true },
    ],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['character'],
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
        to: ['player-start', 'door', 'warp'],
      },
      { id: 'facing', type: 'enum', label: 'Face on arrival', options: FACINGS, default: 'down' },
    ],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['link'],
  },
  {
    id: 'warp',
    label: 'Warp',
    color: '#a78bfa',
    fields: [
      {
        id: 'target',
        type: 'ref',
        label: 'Leads to',
        required: true,
        to: ['player-start', 'door', 'warp'],
      },
      { id: 'facing', type: 'enum', label: 'Face on arrival', options: FACINGS, default: 'down' },
    ],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'xy',
    tags: ['link'],
  },
  {
    id: 'chest',
    label: 'Chest',
    color: '#facc15',
    fields: [
      { id: 'item', type: 'text', label: 'Item', default: '' },
      { id: 'amount', type: 'int', label: 'Amount', min: 1, default: 1 },
    ],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['pickup'],
  },
  {
    id: 'sign',
    label: 'Sign',
    color: '#d6d3d1',
    fields: [{ id: 'text', type: 'text', label: 'Text', multiline: true, default: '' }],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['interact'],
  },
  {
    id: 'trigger',
    label: 'Trigger',
    color: '#f472b6',
    fields: [{ id: 'event', type: 'text', label: 'Event', default: '' }],
    shape: 'rect',
    size: { w: 32, h: 32 },
    pivot: { x: 0, y: 0 },
    resizable: 'xy',
    tags: ['area'],
  },
  {
    id: 'enemy',
    label: 'Enemy',
    color: '#ef4444',
    fields: [
      { id: 'hp', type: 'int', label: 'Hit points', min: 1, max: 99, default: 3 },
      { id: 'aggro', type: 'int', label: 'Aggro range (tiles)', min: 0, max: 16, default: 4 },
    ],
    shape: 'rect',
    size: { w: 16, h: 16 },
    pivot: { x: 0.5, y: 0.5 },
    resizable: 'none',
    tags: ['enemy'],
  },
]

export const topdownRpgTemplate: TemplateDef<Project> = {
  id: 'topdown-rpg',
  label: 'Top-down',
  hint: 'walk around a map',
  create: (ids) =>
    starterProject(
      'Untitled RPG',
      'topdown-rpg',
      {
        layers: [
          { id: 'entities', label: 'Characters and items', kind: 'entities', grid: TILE, snap: true },
          { id: 'props', label: 'Props', kind: 'objects', tileset: 'overworld', snap: 0 },
          {
            id: 'walls-art',
            label: 'Wall art',
            kind: 'auto',
            grid: TILE,
            source: 'walls',
            tileset: 'overworld',
            groups: [
              {
                id: 'walls',
                label: 'Walls',
                active: true,
                rules: edgeRules({ value: BLOCKED, firstTile: WALL_FIRST_TILE, idPrefix: 'wall' }),
              },
              {
                id: 'features',
                label: 'Water and doors',
                active: true,
                rules: [
                  valueRule('water', WATER, WATER_TILE),
                  valueRule('door-frame', DOOR_FRAME, DOOR_FRAME_TILE),
                ],
              },
            ],
            opacity: 1,
          },
          {
            id: 'walls',
            label: 'Walls',
            kind: 'intgrid',
            grid: TILE,
            values: [
              { value: BLOCKED, id: 'blocked', label: 'Blocked', color: '#6b7280' },
              { value: WATER, id: 'water', label: 'Water', color: '#3b82f6' },
              { value: DOOR_FRAME, id: 'door-frame', label: 'Door frame', color: '#a16207' },
            ],
            opacity: 0.6,
          },
          { id: 'ground', label: 'Ground', kind: 'tiles', grid: TILE, tileset: 'overworld', opacity: 1 },
        ],
        tilesets: [
          placeholderTileset({
            id: 'overworld',
            label: 'Overworld',
            columns: 8,
            rows: 4,
            tile: TILE,
            tags: [
              { tag: 'ground', tiles: [0, 1, 2, 3, 5, 6, 7] },
              { tag: 'water', tiles: [WATER_TILE, 24] },
              { tag: 'wall', tiles: Array.from({ length: 16 }, (_, i) => WALL_FIRST_TILE + i) },
              { tag: 'door', tiles: [DOOR_FRAME_TILE] },
              { tag: 'prop', tiles: [26, 27, 28, 29, 30, 31] },
            ],
          }),
        ],
        entities,
        levelFields: [{ id: 'area', type: 'text', label: 'Area', default: '' }],
      },
      { id: 'map-1', name: 'Map 1', size: { w: 320, h: 240 }, background: { color: '#14532d', mode: 'fit' } },
      (layers) =>
        placeEntities(
          // Grass everywhere, the player in the middle.
          editCells(layers, 'ground', (cells) => cells.fillRect(0, 0, 20, 15, GRASS_TILE + 1)),
          'entities',
          [{ id: ids.next(), def: 'player-start', x: 10 * TILE, y: 7.5 * TILE, fields: {} }],
        ),
    ),
}
