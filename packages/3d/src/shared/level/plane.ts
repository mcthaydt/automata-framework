// A plane as a file writes it, read and changed without changing its form: a number stays a number and an object stays
// an object, so an edit to a height touches one value of the text and nothing around it.
import type { Plane } from './af-sector-2-parts.schema.ts'

/** A plane as the file writes it: a number for the height alone, or the plane's members. */
export type WrittenPlane = number | Plane

/** The height of a plane, however it is written. */
export function planeZ(plane: WrittenPlane): number {
  return typeof plane === 'number' ? plane : plane.z
}

/** The plane at another height, in the form it was written: a number stays a number, an object keeps its members. */
export function withPlaneZ(plane: WrittenPlane, z: number): WrittenPlane {
  return typeof plane === 'number' ? z : { ...plane, z }
}
