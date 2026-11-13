import { defineContentSchema } from '@automata/content/schema'
import { lcdProfileSchema, lcdScreenOptionsSchema } from '@automata/lcd-panel'
import { retroProfileSchema } from '@automata/retro-crisp'
import { z } from 'zod'

// The profiles of the picture's two passes (`app/look-passes.ts`): the old game's retro grade and LCD panel. The numbers are the old
// game's, which are the two extensions' defaults, so `content/look.toml` holds only the keys the game changes. Presentation only: the
// file is not the sim's, so it is outside its hash. This file holds the schema alone, so the build's config can read it without the renderer.

/**
 * The room's light, as a gain on the old game's. The old game multiplied a texel's linear colour by its light and showed the product as it
 * was; the framework's `srgb` light multiplies the sRGB colour, so the same lamp numbers draw much brighter. `lamps` scales every lamp's
 * strength (1 is the old game's number, which is too bright); the ambient, key and fill are the old game's own.
 */
const lightGainSchema = z.strictObject({
  lamps: z.number().positive('lamps is above 0').max(2, 'lamps is 2 or less').default(1),
  /**
   * The share of the old game's contact darkening (wall feet, inside corners, furniture feet) that also multiplies a lamp's light:
   * the old game multiplied its whole light by it, lamps included, and a pool of lamp light is darker where it meets a wall.
   * 0 leaves the lamps alone (the framework's default); the ambient and fill take it always.
   */
  contact: z.number().min(0, 'contact is 0 to 1').max(1, 'contact is 0 to 1').default(0),
})

/**
 * A patch of window light on the floor (`LightPatch` in `@automata/3d`): stripes between the bars' shadows, laid where the old game's
 * moonlight fell. The room's baked light is per vertex and cannot say them, so the stage draws each as a picture added to the floor.
 */
const moonlightSchema = z.strictObject({
  id: z.string().min(1),
  window: z.tuple([z.number(), z.number()]),
  centre: z.tuple([z.number(), z.number()]),
  width: z.number().positive('width is above 0'),
  length: z.number().positive('length is above 0'),
  /** The rooms (sector ids) it shows in; every room if none. */
  rooms: z.array(z.string()).optional(),
  bars: z.number().int().min(1).max(8).default(4),
  gain: z.number().min(0, 'gain is 0 to 1').max(1, 'gain is 0 to 1').default(0.5),
  colour: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, 'colour is #rrggbb')
    .optional(),
})

/**
 * The LCD panel's mesh, stripes and scanlines drawn at the screen's pixels (`lcdPanelScreenFilter`), a line on the last pixel of each
 * `cellPixels` cell, so a figure's texels fall between lines. Left out, the field pass draws them as its `[lcd]` profile says.
 */
const lcdScreenSchema = lcdProfileSchema
  .pick({ grid: true, balance: true, subpixels: true, layout: true, scanlines: true, brightness: true })
  .extend(lcdScreenOptionsSchema.shape)

/** What `content/look.toml` says: each pass's profile, the gain on the room's lamps and the patches of moonlight. A setting out of range or unknown is refused, naming it. */
export const lookProfilesSchema = z.strictObject({
  retro: retroProfileSchema.default(() => retroProfileSchema.parse({})),
  lcd: lcdProfileSchema.default(() => lcdProfileSchema.parse({})),
  lcdScreen: lcdScreenSchema.optional(),
  light: lightGainSchema.default(() => lightGainSchema.parse({})),
  moonlight: z.array(moonlightSchema).default([]),
})

export type LookProfiles = z.infer<typeof lookProfilesSchema>

/** The kind the game registers (vite.config.ts) to read `content/look.toml`. */
export const lookProfilesContent = defineContentSchema(
  'look',
  lookProfilesSchema,
  { file: 'look.toml' },
  { sim: false },
)
