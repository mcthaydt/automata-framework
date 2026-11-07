// Helpers the edit tests share: the level or the sentence out of a result, and the corners of a rectangle.
import type { EditResult } from '../model/edit'

/** The level an edit answered with; the test fails, with the reason, when the edit was refused. */
export function levelOf<D>(result: EditResult<D>): D {
  if (!result.ok) throw new Error(`the edit was refused: ${result.reason}`)
  return result.level
}

/** The reason an edit was refused with; the test fails when the edit was not refused. */
export function reasonOf<D>(result: EditResult<D>): string {
  if (result.ok) throw new Error('the edit was not refused')
  return result.reason
}

/** A rectangle's four corners, counter-clockwise from (x0, z0). */
export const rect = (
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): readonly (readonly [number, number])[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
]

/** The value, which a test knows is there. */
export function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('the test expected a value that is missing')
  return value
}
