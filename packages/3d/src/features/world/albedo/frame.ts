// A world place and normal in a frame: ((p − o)·x, ·y, ·z) and (n·x, n·y, n·z).
import type { TexFrame } from '../surface.ts'

const dot = (a: readonly number[], b: readonly number[]): number =>
  (a[0] as number) * (b[0] as number) +
  (a[1] as number) * (b[1] as number) +
  (a[2] as number) * (b[2] as number)

export function toLocal(
  f: TexFrame,
  p: readonly number[],
  n: readonly number[],
): [readonly number[], readonly number[]] {
  const d = [(p[0] as number) - f.o[0], (p[1] as number) - f.o[1], (p[2] as number) - f.o[2]]
  return [
    [dot(d, f.x), dot(d, f.y), dot(d, f.z)],
    [dot(n, f.x), dot(n, f.y), dot(n, f.z)],
  ]
}
