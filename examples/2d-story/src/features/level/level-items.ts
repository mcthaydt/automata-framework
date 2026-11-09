import { entitiesOf } from '@automata/content/level-2d'
import { startLevel } from './level-content.ts'

/** Where the editor placed the first character of a kind, in the level's pixels (its pivot, the feet). */
export function itemOf(def: string): { readonly x: number; readonly y: number } {
  const item = entitiesOf(startLevel, 'entities').find((each) => each.def === def)
  if (item === undefined)
    throw new Error(`The level needs a "${def}". Place one in the editor and press Save.`)
  return { x: item.x, y: item.y }
}
