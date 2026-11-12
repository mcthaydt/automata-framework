import {
  buildWorld,
  DEFAULT_LOOK,
  swatchColour,
  swatchGlow,
  timeOfDay,
  type World,
  worldLighting,
} from '@automata/3d'
import { type AfSector2, readLevel } from '@automata/3d/level'
import { albedoTiles, worldKitLibrary } from '@automata/world-kit'
import levelFile from '../../../content/levels/prologue.af-sector.json' with { type: 'json' }

// The ward as the screen draws it: the level's rooms and props built into pieces, lit at night by its own lamps. The level is
// the game's file (the 3D level editor saves it), so what is drawn is what the editor shows. The props are the kit's presets
// until the dressing arrives with the painted figures (workstream 4).

/** The level, as the 3D level editor wrote it. */
export const LEVEL: AfSector2 = readLevel(levelFile).level

/** The level built into pieces and lamps; a problem is a sentence, never a crash (the rest still draws). */
export const WORLD: World = buildWorld(LEVEL, worldKitLibrary)

/** The ward is a night room lit by its lamps. */
export const TIME = timeOfDay('lampLit')

/** The room's light: its lamps, and the night's ambient, under the look's profile. */
export const LIGHTING = worldLighting(WORLD, TIME, { night: true })

/** What the world builder needs to colour and light a piece: the kit's swatches, their glow and their photo tiles. */
export const PAINT = {
  colourOf: (swatch: string) => swatchColour(worldKitLibrary, swatch),
  glow: (swatch: string) => swatchGlow(worldKitLibrary, swatch),
  tiles: albedoTiles(worldKitLibrary.swatches as Parameters<typeof albedoTiles>[0]),
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
