// Imported by both `.` and `./extra`, so tsdown emits it as a chunk and renames its exports.

/** Subtracts `b` from `a`. */
export function subtract(a: number, b: number): number {
  return a - b
}

/** Doubles `by`; `.` exports it as `scale`. */
export function internalScale(by: number): number {
  return by * 2
}
