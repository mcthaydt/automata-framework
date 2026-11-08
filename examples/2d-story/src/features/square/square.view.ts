import { pictureView } from '@automata/framework'
import { SQUARE_SIZE } from '../../shared/constants.ts'
import { images, project } from '../level/level-scene.ts'
import { Square } from './square.component.ts'

/**
 * How the square is drawn: as the player start looks in the editor (change it in Characters, press Save). The square's
 * position is its centre and the character stands on its pivot, its feet, so the picture sits half a square lower.
 */
export const squareView = {
  [Square.id]: pictureView(project, 'player-start', images, { offset: { x: 0, y: SQUARE_SIZE / 2 } }),
}
