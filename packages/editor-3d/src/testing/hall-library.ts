// A small game's furniture and materials for the tests of the 3D views: four swatches (a floor, a wall, a ceiling, a crate)
// and a crate that is a box painted with the crate swatch. The same names Ember Hall uses, with sizes that show.
import type { WorldProp, WorldSwatch } from '@automata/3d/world-content'
import type { GameLibrary } from '../shared/level-session/game-library'

const swatch = (ramp: string, step: number): WorldSwatch => ({ ramp, step }) as WorldSwatch

export const HALL_LIBRARY: GameLibrary = {
  found: true,
  swatches: new Map([
    ['floor', swatch('slate', 4)],
    ['wall', swatch('slate', 2)],
    ['ceiling', swatch('slate', 1)],
    ['crate', swatch('amber', 3)],
  ]),
  props: new Map([['crate', { kind: 'box', swatch: 'crate', size: [1.4, 1.2, 1.4] } as WorldProp]]),
  figures: [],
  problems: [],
}
