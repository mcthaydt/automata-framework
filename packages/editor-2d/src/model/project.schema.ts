import {
  entityDefIssues,
  entityDefShape,
  fieldDefSchema,
  fieldValuesSchema,
  HEX_COLOR,
} from '@mcthaydt/automata-editor-kit/fields'
import { z } from 'zod'
import { ruleGroupSchema } from '../tiles/autotile/rule.schema'
import { DEF_ID, ITEM_ID } from './ids'
import { FILE_VERSION } from './migrations/migration'
import type { ProjectFile } from './project-types'

// The strict file schema of the 2D editor spec §6.1 over the shapes of §5. Strict means an unknown key at any depth is
// an `unrecognized_keys` issue at its parent, which `openProject` turns into a read-only open (G-p). Keys are listed in
// the order the canonical printer writes them. What a value means in the world (a tile index inside its tileset, a ref
// that resolves) is not decided here: that opens fine and becomes a Check.
//
// Guard rails (ED2D-D13) are bounds here. The fifth, the 1024-cell limit of a layer, needs the level and the layer's
// grid together, so `decodeProject` checks it before it allocates a grid.

const MAX_LEVEL_SIDE = 16384
const MAX_LEVELS = 256
const MAX_LAYER_DEFS = 64

const defId = z.string().regex(DEF_ID)
const itemId = z.string().regex(ITEM_ID)
const color = z.string().regex(HEX_COLOR)
const opacity = z.number().min(0).max(1)
const gridCell = z.number().int().min(4).max(256)
const positiveInt = z.number().int().min(1)
const nonNegativeInt = z.number().int().min(0)

const size = (max: number) => z.strictObject({ w: positiveInt.max(max), h: positiveInt.max(max) })

const intValueDefSchema = z.strictObject({
  value: z.number().int().min(1).max(255),
  id: defId,
  label: z.string().optional(),
  color,
})

const layerDefSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    id: defId,
    label: z.string(),
    kind: z.literal('tiles'),
    grid: gridCell,
    tileset: z.string(),
    opacity,
  }),
  z.strictObject({
    id: defId,
    label: z.string(),
    kind: z.literal('intgrid'),
    grid: gridCell,
    values: z.array(intValueDefSchema),
    opacity,
  }),
  z.strictObject({
    id: defId,
    label: z.string(),
    kind: z.literal('auto'),
    grid: gridCell,
    source: z.string(),
    tileset: z.string(),
    groups: z.array(ruleGroupSchema),
    opacity,
  }),
  z.strictObject({
    id: defId,
    label: z.string(),
    kind: z.literal('entities'),
    grid: gridCell,
    snap: z.boolean(),
  }),
  z.strictObject({
    id: defId,
    label: z.string(),
    kind: z.literal('objects'),
    tileset: z.string(),
    snap: nonNegativeInt,
  }),
])

const tilesetDefSchema = z.strictObject({
  id: defId,
  label: z.string(),
  image: z.string().min(1).optional(),
  imageSize: size(MAX_LEVEL_SIDE),
  tile: size(MAX_LEVEL_SIDE),
  spacing: nonNegativeInt,
  padding: nonNegativeInt,
  tags: z.array(z.strictObject({ tag: z.string(), tiles: z.array(nonNegativeInt) })),
})

/** The kit's entity keys plus the 2D ones; the kit's own rules (id, colour, repeated field ids) run from `superRefine`. */
const entityDef2DSchema = z
  .strictObject({
    ...entityDefShape,
    shape: z.enum(['rect', 'ellipse', 'point', 'tile']),
    size: z.strictObject({ w: z.number().positive(), h: z.number().positive() }),
    pivot: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
    resizable: z.enum(['none', 'x', 'y', 'xy']),
    tile: z.strictObject({ tileset: z.string(), index: nonNegativeInt }).optional(),
    tags: z.array(z.string()),
    min: z.strictObject({ per: z.enum(['level', 'project']), count: positiveInt }).optional(),
  })
  .superRefine((def, ctx) => {
    for (const issue of entityDefIssues(def)) ctx.addIssue({ code: 'custom', ...issue })
  })

const definitionsSchema = z.strictObject({
  layers: z.array(layerDefSchema).max(MAX_LAYER_DEFS),
  tilesets: z.array(tilesetDefSchema),
  entities: z.array(entityDef2DSchema),
  levelFields: z.array(fieldDefSchema),
})

const worldSchema = z
  .strictObject({
    id: defId,
    layout: z.enum(['free', 'grid', 'horizontal', 'vertical']),
    grid: size(MAX_LEVEL_SIDE).optional(),
    placements: z.array(
      z.strictObject({
        level: z.string(),
        x: z.number().int(),
        y: z.number().int(),
        depth: z.number().int(),
      }),
    ),
  })
  .superRefine((world, ctx) => {
    if (world.layout === 'grid' && world.grid === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a grid world needs a snap grid', path: ['grid'] })
    }
    if (world.layout !== 'grid' && world.grid !== undefined) {
      ctx.addIssue({ code: 'custom', message: `a ${world.layout} world has no snap grid`, path: ['grid'] })
    }
  })

const entityInstanceSchema = z.strictObject({
  id: itemId,
  def: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  fields: fieldValuesSchema,
})

const objectInstanceSchema = z.strictObject({
  id: itemId,
  tile: nonNegativeInt,
  x: z.number(),
  y: z.number(),
  flipX: z.boolean(),
  flipY: z.boolean(),
})

/** Which row-string decoder applies to `rows` is the layer definition's `kind`, which `decodeProject` checks against this one. */
const layerInstanceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ def: z.string(), kind: z.literal('tiles'), rows: z.array(z.string()) }),
  z.strictObject({ def: z.string(), kind: z.literal('intgrid'), rows: z.array(z.string()) }),
  z.strictObject({
    def: z.string(),
    kind: z.literal('auto'),
    seed: z.number().int().min(0).max(0xffffffff),
    overrides: z.array(z.string()),
  }),
  z.strictObject({ def: z.string(), kind: z.literal('entities'), items: z.array(entityInstanceSchema) }),
  z.strictObject({ def: z.string(), kind: z.literal('objects'), items: z.array(objectInstanceSchema) }),
])

const levelSchema = z.strictObject({
  id: defId,
  name: z.string(),
  size: size(MAX_LEVEL_SIDE),
  background: z.strictObject({
    color,
    image: z.string().min(1).optional(),
    mode: z.enum(['fit', 'cover', 'repeat', 'repeat-x']),
  }),
  fields: fieldValuesSchema,
  layers: z.array(layerInstanceSchema),
})

export const projectFileSchema: z.ZodType<ProjectFile> = z.strictObject({
  format: z.literal('af2d'),
  version: z.literal(FILE_VERSION),
  name: z.string(),
  template: z.string(),
  defs: definitionsSchema,
  worlds: z.array(worldSchema).min(1),
  levels: z.array(levelSchema).max(MAX_LEVELS),
})
