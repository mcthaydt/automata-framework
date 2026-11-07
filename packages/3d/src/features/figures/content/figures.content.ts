// The figures' content kinds (M3 spec §4.4.1: "libraries are content too"). Every kind is a collection, one
// TOML file per item, and none goes to the sim: figures are presentation (law 1), so their content stays out
// of the sim's partition and hash. References between them are `contentRef`s, so the content compiler reports
// a missing id at its file, line and column (F-e).

import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { clipSchema } from '../clips/clip.schema.ts'
import { figureSchema } from '../figure/figure.schema.ts'
import { poseSchema } from '../motion/pose.schema.ts'
import { figureActionSchema } from './figure-action.schema.ts'
import { gaitSchema } from './gait.schema.ts'
import { hairStyleSchema } from './hair.schema.ts'
import { headwearSchema } from './headwear.schema.ts'
import { itemSchema } from './item.schema.ts'
import { rigLimitsSchema } from './rig-limits.schema.ts'
import { seatSchema } from './seat.schema.ts'
import { standSchema } from './stand.schema.ts'
import { swatchSchema } from './swatch.schema.ts'

const presentation = { sim: false } as const

export const figureContent: ContentSchemaDef<'figure'> = defineContentSchema(
  'figure',
  figureSchema,
  { folder: 'figures' },
  presentation,
)
export const figureSwatchContent: ContentSchemaDef<'figure-swatch'> = defineContentSchema(
  'figure-swatch',
  swatchSchema,
  { folder: 'figure-swatches' },
  presentation,
)
export const figureGaitContent: ContentSchemaDef<'figure-gait'> = defineContentSchema(
  'figure-gait',
  gaitSchema,
  { folder: 'figure-gaits' },
  presentation,
)
export const figureHairContent: ContentSchemaDef<'figure-hair'> = defineContentSchema(
  'figure-hair',
  hairStyleSchema,
  { folder: 'figure-hair' },
  presentation,
)
export const figureHeadwearContent: ContentSchemaDef<'figure-headwear'> = defineContentSchema(
  'figure-headwear',
  headwearSchema,
  { folder: 'figure-headwear' },
  presentation,
)
export const figureItemContent: ContentSchemaDef<'figure-item'> = defineContentSchema(
  'figure-item',
  itemSchema,
  { folder: 'figure-items' },
  presentation,
)
export const figureStandContent: ContentSchemaDef<'figure-stand'> = defineContentSchema(
  'figure-stand',
  standSchema,
  { folder: 'figure-stands' },
  presentation,
)
export const figureSeatContent: ContentSchemaDef<'figure-seat'> = defineContentSchema(
  'figure-seat',
  seatSchema,
  { folder: 'figure-seats' },
  presentation,
)
export const figureRigContent: ContentSchemaDef<'figure-rig'> = defineContentSchema(
  'figure-rig',
  rigLimitsSchema,
  { folder: 'figure-rigs' },
  presentation,
)

export const figurePoseContent: ContentSchemaDef<'figure-pose'> = defineContentSchema(
  'figure-pose',
  poseSchema,
  { folder: 'figure-poses' },
  presentation,
)

export const figureClipContent: ContentSchemaDef<'figure-clip'> = defineContentSchema(
  'figure-clip',
  clipSchema,
  { folder: 'figure-clips' },
  presentation,
)

export const figureActionContent: ContentSchemaDef<'figure-action'> = defineContentSchema(
  'figure-action',
  figureActionSchema,
  { folder: 'figure-actions' },
  presentation,
)

/** Every figures kind, for `figuresExtension` and for a game that registers them itself. */
export const FIGURE_CONTENT: readonly ContentSchemaDef[] = [
  figureContent,
  figureSwatchContent,
  figureGaitContent,
  figureHairContent,
  figureHeadwearContent,
  figureItemContent,
  figureStandContent,
  figureSeatContent,
  figureRigContent,
  figurePoseContent,
  figureClipContent,
  figureActionContent,
]
