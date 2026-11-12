import { content } from 'virtual:automata/content'
import {
  buildWorld,
  contactSchema,
  DEFAULT_LOOK,
  swatchColour,
  swatchGlow,
  timeOfDay,
  type World,
  type WorldLibrary,
  worldLighting,
} from '@automata/3d'
import { type AfSector2, modelsOf, readLevel } from '@automata/3d/level'
import { albedoTiles, worldKitLibrary } from '@automata/world-kit'
import levelFile from '../../../content/levels/prologue.af-sector.json' with { type: 'json' }
import { OWN_TILES } from './tiles.ts'

// The ward as the screen draws it: the level's rooms and props built into pieces, lit at night by its own lamps. The level is
// the game's file (the 3D level editor saves it), so what is drawn is what the editor shows. The props are the kit's presets
// until the dressing arrives with the painted figures (workstream 4).

/** The level, as the 3D level editor wrote it. */
export const LEVEL: AfSector2 = readLevel(levelFile).level

/** The model files the level's props name: the old game's furniture, which the page loads before the first frame. */
export const MODEL_FILES: readonly string[] = modelsOf(LEVEL)

/** The kit's swatches and props, and the game's own swatches (`content/world-swatches`): the clinic's plaster is not a step of the kit's. */
export const LIBRARY: WorldLibrary = {
  ...worldKitLibrary,
  swatches: { ...worldKitLibrary.swatches, ...content['world-swatch'] },
}

/** The level built into pieces and lamps; a problem is a sentence, never a crash (the rest still draws). */
export const WORLD: World = buildWorld(LEVEL, LIBRARY)

/** The gain on the old game's lamp numbers, from `content/look.toml` (`[light]`): the framework's light is brighter than the old game's for them. */
const LAMP_GAIN = content.look?.light.lamps ?? 1
/** The share of the contact darkening the lamps' light takes, from `content/look.toml` (`[light] contact`): 0 is the framework's default. */
const LAMP_CONTACT = content.look?.light.contact ?? 0

/** The ward is a night room lit by its lamps. */
export const TIME = timeOfDay('lampLit')

/** The room's light: its lamps, and the night's ambient, under the look's profile. */
const OLD_LIGHTING = worldLighting(WORLD, TIME, { night: true })
export const LIGHTING = {
  ...OLD_LIGHTING,
  lamps: OLD_LIGHTING.lamps.map((lamp) => ({ ...lamp, strength: lamp.strength * LAMP_GAIN })),
  // The old game's strengths (the defaults), with the lamps' light taking the darkening too.
  contact: LAMP_CONTACT > 0 ? contactSchema.parse({ lamps: LAMP_CONTACT }) : undefined,
}

/** What the world builder needs to colour and light a piece: the kit's swatches, their glow and their photo tiles. */
export const PAINT = {
  colourOf: (swatch: string) => swatchColour(LIBRARY, swatch),
  glow: (swatch: string) => swatchGlow(LIBRARY, swatch),
  tiles: albedoTiles(LIBRARY.swatches as Parameters<typeof albedoTiles>[0], OWN_TILES),
  look: DEFAULT_LOOK,
} as const

/** The middle of a room's footprint, on the plan: where a peek into it looks. */
export function centreOf(room: string): { readonly x: number; readonly z: number } | undefined {
  const sector = LEVEL.sectors.find((each) => each.id === room)
  if (sector === undefined || sector.corners.length === 0) return undefined
  let x = 0
  let z = 0
  for (const [cx, cz] of sector.corners) {
    x += cx
    z += cz
  }
  return { x: x / sector.corners.length, z: z / sector.corners.length }
}
