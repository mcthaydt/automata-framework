import { pictureView } from '@automata/framework'
import { SystemsAgent } from '@automata/systems/sim'
import { SQUARE_SIZE } from '../../shared/constants.ts'
import { project } from '../../shared/level/level-content.ts'
import { images } from '../../shared/level/level-scene.ts'
import { Square } from '../../shared/square.component.ts'

/**
 * How a body is drawn: the player's square as the player start looks in the editor, the guard as the guard does (change
 * either in Characters, press Save). The player's position is the square's centre and the character stands on its pivot,
 * its feet, so the picture sits half a square lower; the guard's position is already his feet.
 */
const heroView = pictureView(project, 'player-start', images, { offset: { x: 0, y: SQUARE_SIZE / 2 } })
const guardView = pictureView(project, 'guard', images)

export const squareView = {
  [Square.id]: ((row, id) =>
    (row.components[SystemsAgent.id] === undefined ? heroView : guardView)(row, id)) as typeof heroView,
}
