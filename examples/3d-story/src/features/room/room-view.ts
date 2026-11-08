import {
  buildWorld,
  drawWorld,
  type Look,
  type Occluders,
  swatchColour,
  type WorldLibrary,
  type WorldScene,
} from '@automata/3d'
import { ROOM_LEVEL } from './room.ts'

/** The room's swatches and props, from the game's content (content/world-swatches and content/world-props). */
export function worldLibraryOf(content: unknown): WorldLibrary {
  const kinds = content as {
    readonly 'world-swatch': WorldLibrary['swatches']
    readonly 'world-prop': NonNullable<WorldLibrary['props']>
  }
  return { swatches: kinds['world-swatch'], props: kinds['world-prop'] }
}

/**
 * Draws the room under `parent`: its floor, walls, ceiling and props. The walls and ceiling between the camera and
 * Wick are cut away by the occluders, so he is always in view.
 */
export function drawRoom(
  parent: WorldScene['parent'],
  occluders: Occluders,
  library: WorldLibrary,
  look: Look,
): void {
  const world = buildWorld(ROOM_LEVEL, library)
  drawWorld({ parent, occluders, colourOf: (swatch) => swatchColour(library, swatch), look }, world.pieces)
}
