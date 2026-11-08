// @automata/level-2d/sim: a 2D level as `Places` (rooms from its areas, walls from its solid cells, positions from the
// game's own component), and the position component a game with none uses. A sim entry: no Node, no clock.
export { cellWalls } from '../shared/sim/cell-walls.ts'
export { Level2dAt } from '../shared/sim/level-2d.component.ts'
export { level2dPlugin } from '../shared/sim/level-2d.plugin.ts'
export {
  type Level2dPlacesOptions,
  type Level2dPosition,
  level2dPlaces,
} from '../shared/sim/level-2d-places.ts'
