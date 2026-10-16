import { parseRoom, type RoomSource } from '../../automata-framework/examples/base-2d/src/content/room'

/** Move the start marker on its existing row; the room parser remains the validation owner. */
export function withStart(source: RoomSource, column: number): RoomSource {
  const room = parseRoom(source)
  if (!Number.isInteger(column) || column < 0 || column >= room.width) {
    throw new Error('Choose a whole column inside the room')
  }
  const row = source.rows[room.start.ty]
  if (column !== room.start.tx && row[column] !== '.') throw new Error('Choose an empty tile for the start')
  const tiles = [...row]
  tiles[room.start.tx] = '.'
  tiles[column] = 'P'
  const rows = [...source.rows]
  rows[room.start.ty] = tiles.join('')
  const changed = { ...source, rows }
  parseRoom(changed)
  return changed
}
