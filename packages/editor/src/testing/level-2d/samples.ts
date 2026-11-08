import { packTile } from '../../shared/level-2d/model/cells-codec'
import { counterIds, type IdSource } from '../../shared/level-2d/model/ids'
import type { Project } from '../../shared/level-2d/model/project-types'
import { platformerTemplate } from '../../shared/level-2d/profiles/level-project/templates/platformer'
import { topdownRpgTemplate } from '../../shared/level-2d/profiles/level-project/templates/topdown-rpg'
import {
  entity,
  paintLayer,
  renameLevel,
  withEntities,
  withLevel,
  withNewLevel,
  withObjects,
} from './project-edit'

// The two sample projects of the 2D editor: Mossgate (a platformer) and Hollowmere (a top-down RPG). Both are
// built from the built-in templates with the same helpers, so they prove one editor holds both genres. They are the
// fixtures of acceptance G-i (export) and the content a journey test opens.

const tile = (index: number): number => packTile(index, false, false)

/** Mossgate: two linked levels. Collision values: 1 solid, 2 one-way, 3 spike, 4 water, 5 ladder. */
export function mossgate(ids: IdSource = counterIds()): Project {
  let project = renameLevel(
    { ...platformerTemplate.create(ids), name: 'Mossgate' },
    'level-1',
    'moss-steps',
    'Moss Steps',
  )
  project = withNewLevel(project, 'root-cellar', { x: 560, y: 0 })
  project = withLevel(project, 'root-cellar', (level) => ({ ...level, name: 'Root Cellar' }))
  const doorToCellar = ids.next()
  const doorToSteps = ids.next()

  // Moss Steps: a step, a floating platform, a one-way ledge with a ladder, a spike and a pool in the floor.
  project = paintLayer(project, 'moss-steps', 'collision', (cells) => {
    cells.fillRect(8, 15, 3, 1, 1)
    cells.fillRect(16, 11, 6, 1, 1)
    cells.fillRect(24, 12, 5, 1, 2)
    cells.fillRect(23, 12, 1, 4, 5)
    cells.fillRect(13, 15, 2, 1, 3)
    cells.fillRect(26, 16, 4, 2, 4)
  })
  project = paintLayer(project, 'moss-steps', 'decor', (cells) => {
    cells.set(2, 15, tile(51))
    cells.set(5, 15, packTile(52, true, false))
    cells.set(18, 15, tile(53))
    cells.set(20, 15, packTile(51, true, false))
  })
  project = withLevel(project, 'moss-steps', (level) => ({ ...level, fields: { music: 'mossgate-theme' } }))
  const patrol = (from: number, to: number, y: number): { x: number; y: number }[] => [
    { x: from, y },
    { x: to, y },
  ]
  project = withEntities(project, 'moss-steps', [
    entity(ids.next(), 'slime', 60, 256, { hp: 3, patrol: patrol(32, 112, 256) }),
    entity(ids.next(), 'slime', 330, 256, { hp: 5, patrol: patrol(300, 380, 256), tint: '#22c55e' }),
    entity(ids.next(), 'slime', 304, 176, { hp: 2, patrol: patrol(272, 336, 176) }),
    entity(ids.next(), 'coin', 148, 222),
    entity(ids.next(), 'coin', 190, 200),
    entity(ids.next(), 'coin', 280, 160),
    entity(ids.next(), 'coin', 320, 160),
    entity(ids.next(), 'checkpoint', 400, 256),
    entity(doorToCellar, 'door', 480, 256, { target: { target: doorToSteps, container: 'root-cellar' } }),
  ])

  // Root Cellar: a floor, a ledge, and the way back.
  project = paintLayer(project, 'root-cellar', 'collision', (cells) => {
    cells.fillRect(0, 16, 32, 2, 1)
    cells.fillRect(12, 12, 8, 1, 1)
  })
  return withEntities(project, 'root-cellar', [
    entity(doorToSteps, 'door', 48, 256, { target: { target: doorToCellar, container: 'moss-steps' } }),
    entity(ids.next(), 'coin', 208, 168),
    entity(ids.next(), 'coin', 240, 168),
    entity(ids.next(), 'coin', 272, 168),
  ])
}

const GRASS = 1
const FLOWERS = 2
const PATH = 3
const FLOOR = 6
const TREE = 26

/** Hollowmere: a village, an inn and a forest path. Walls values: 1 blocked, 2 water, 3 door frame. */
export function hollowmere(ids: IdSource = counterIds()): Project {
  let project = renameLevel(
    { ...topdownRpgTemplate.create(ids), name: 'Hollowmere' },
    'map-1',
    'village',
    'Village',
  )
  project = withNewLevel(project, 'inn', { x: 340, y: 0 })
  project = withNewLevel(project, 'forest-path', { x: 680, y: 0 })
  project = withLevel(project, 'inn', (level) => ({ ...level, name: 'Inn' }))
  project = withLevel(project, 'forest-path', (level) => ({ ...level, name: 'Forest Path' }))
  const villageDoor = ids.next()
  const innDoor = ids.next()
  const forestStart = ids.next()

  // Village: a path through the grass, the inn's walls with a door frame, a pond, trees.
  project = paintLayer(project, 'village', 'ground', (cells) => {
    cells.fillRect(0, 7, 20, 1, PATH)
    for (const [x, y] of [
      [3, 3],
      [4, 4],
      [15, 10],
      [16, 11],
    ] as const) {
      cells.set(x, y, FLOWERS)
    }
  })
  project = paintLayer(project, 'village', 'walls', (cells) => {
    cells.fillRect(13, 1, 6, 4, 1)
    cells.set(15, 4, 3)
    cells.fillRect(2, 10, 4, 3, 2)
  })
  project = withLevel(project, 'village', (level) => ({ ...level, fields: { area: 'Hollowmere' } }))
  project = withObjects(
    project,
    'village',
    [
      [24, 32],
      [56, 24],
      [280, 200],
      [296, 168],
      [40, 200],
    ].map(([x, y]) => ({
      id: ids.next(),
      tile: TREE,
      x: x as number,
      y: y as number,
      flipX: false,
      flipY: false,
    })),
  )
  project = withEntities(project, 'village', [
    entity(ids.next(), 'npc', 96, 104, {
      name: 'Mira',
      dialogue: 'The inn serves stew until sundown.',
      facing: 'right',
      route: [
        { x: 96, y: 104 },
        { x: 144, y: 104 },
      ],
    }),
    entity(ids.next(), 'npc', 200, 168, {
      name: 'Old Tam',
      dialogue: 'Mind the wood at night.',
      facing: 'left',
    }),
    entity(villageDoor, 'door', 248, 72, { target: { target: innDoor, container: 'inn' }, facing: 'up' }),
    {
      id: ids.next(),
      def: 'warp',
      x: 312,
      y: 112,
      w: 16,
      h: 32,
      fields: { target: { target: forestStart, container: 'forest-path' }, facing: 'right' },
    },
  ])

  // Inn: a floor inside four walls, a door frame to leave by, a chest and a sign.
  project = paintLayer(project, 'inn', 'ground', (cells) => cells.fillRect(0, 0, 20, 15, FLOOR))
  project = paintLayer(project, 'inn', 'walls', (cells) => {
    cells.fillRect(0, 0, 20, 1, 1)
    cells.fillRect(0, 0, 1, 15, 1)
    cells.fillRect(19, 0, 1, 15, 1)
    cells.fillRect(0, 14, 20, 1, 1)
    cells.set(10, 14, 3)
  })
  project = withLevel(project, 'inn', (level) => ({ ...level, fields: { area: 'Hollowmere' } }))
  project = withEntities(project, 'inn', [
    entity(innDoor, 'door', 168, 232, {
      target: { target: villageDoor, container: 'village' },
      facing: 'down',
    }),
    entity(ids.next(), 'chest', 48, 48, { item: 'Brass key', amount: 1 }),
    entity(ids.next(), 'sign', 96, 40, { text: 'Rooms upstairs.' }),
  ])

  // Forest path: grass with a trail, where the warp arrives, and one enemy.
  project = paintLayer(project, 'forest-path', 'ground', (cells) => {
    cells.fillRect(0, 0, 20, 15, GRASS)
    cells.fillRect(0, 7, 14, 1, PATH)
  })
  project = withLevel(project, 'forest-path', (level) => ({ ...level, fields: { area: 'Whispering wood' } }))
  project = withObjects(project, 'forest-path', [
    { id: ids.next(), tile: TREE, x: 100, y: 40, flipX: false, flipY: false },
    { id: ids.next(), tile: TREE, x: 160, y: 200, flipX: true, flipY: false },
  ])
  return withEntities(project, 'forest-path', [
    entity(forestStart, 'player-start', 24, 120),
    entity(ids.next(), 'enemy', 200, 120, { hp: 3, aggro: 4 }),
  ])
}
