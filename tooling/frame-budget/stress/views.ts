import type { EntityView } from '@mcthaydt/automata-render-pixi'
import type { FieldRecord } from '@mcthaydt/automata-sim'
import { Sprite, Texture } from 'pixi.js'

const SUB = 256
const SIZE = 3

type Row = Readonly<Record<string, Readonly<FieldRecord>>>

/**
 * One sprite per entity, placed between the last two ticks (sub-tick interpolation) and tinted by its pulse.
 * Reads the rows in place: nothing is allocated per frame.
 */
export function bodyView(): EntityView {
  const sprite = new Sprite(Texture.WHITE)
  sprite.width = SIZE
  sprite.height = SIZE
  return {
    container: sprite,
    update(curr: Row, prev: Row | undefined, alpha = 1) {
      const now = curr['stress-body']
      if (now === undefined) return
      const before = prev?.['stress-body'] ?? now
      const x = (before.x as number) + ((now.x as number) - (before.x as number)) * alpha
      const y = (before.y as number) + ((now.y as number) - (before.y as number)) * alpha
      sprite.position.set(x / SUB, y / SUB)
      const phase = (curr['stress-pulse']?.phase as number | undefined) ?? 0
      sprite.tint = 0x406080 | ((phase & 0x7f) << 16)
    },
  }
}
