// The pure parts of the blockout `shots` stage (M6 spec §4.11): which camera zone a point is in, where to stand for each zone, and whether a
// grey shot of it is legible. The shots themselves are the game's (a command in the spec, BP-D2).
import type { Blockout, Expanded, ZoneSpec } from '@mcthaydt/automata-sector-format/blockout'
import type { PngImage } from './png.ts'

type Plan = { readonly x: number; readonly z: number }

/** A zone's area as a test on a point (exclusive bounds, an open side is `null` or absent). */
const inArea = (zone: ZoneSpec, p: Plan): boolean => {
  const area = zone.area
  if (area === undefined) return true
  for (const axis of ['x', 'z'] as const) {
    const [lo, hi] = area[axis] ?? [null, null]
    if (lo !== null && lo !== undefined && !(p[axis] > lo)) return false
    if (hi !== null && hi !== undefined && !(p[axis] < hi)) return false
  }
  return true
}

/** The zone a point is in: the first is the rest of the map, and a later zone is carved out of the ones before it (the last to match wins). */
export function zoneAt(zones: readonly ZoneSpec[], p: Plan): string {
  for (let i = zones.length - 1; i > 0; i -= 1)
    if (inArea(zones[i] as ZoneSpec, p)) return (zones[i] as ZoneSpec).id
  return (zones[0] as ZoneSpec).id
}

export interface StandingPoint {
  readonly zone: string
  /** Where the camera's subject stands: x, z, and the way it faces. */
  readonly place: readonly [number, number, number]
}

/**
 * Where to stand for each zone: the spawn or the first nav node inside it (the source's rule), facing as the spawn faces. A zone with
 * neither is skipped and listed, not guessed at.
 */
export function standingPoints(
  blockout: Pick<Blockout, 'zones'>,
  expanded: Pick<Expanded, 'spawn' | 'nodes'>,
): { points: StandingPoint[]; skipped: string[] } {
  const candidates: Plan[] = [
    expanded.spawn,
    ...Object.keys(expanded.nodes).map((id) => expanded.nodes[id] as Plan),
  ]
  const points: StandingPoint[] = []
  const skipped: string[] = []
  for (const zone of blockout.zones) {
    const at = candidates.find((p) => zoneAt(blockout.zones, p) === zone.id)
    if (at === undefined) skipped.push(zone.id)
    else points.push({ zone: zone.id, place: [at.x, at.z, expanded.spawn.facing] })
  }
  return { points, skipped }
}

export interface Legible {
  /** The luminance mean must lie in this range (0..255). */
  readonly mean: readonly [number, number]
  /** The spread between the 10th and 90th percentile must be at least this. */
  readonly spread: number
}
export const DEFAULT_LEGIBLE: Legible = { mean: [60, 200], spread: 40 }

export interface LuminanceStats {
  readonly mean: number
  readonly spread: number
}

/** Mean luminance (Rec. 709 weights, alpha ignored) and the 10th to 90th percentile spread, over every pixel. */
export function luminanceStats(image: PngImage): LuminanceStats {
  const count = image.width * image.height
  const values = new Float64Array(count)
  const { data, channels } = image
  let sum = 0
  for (let i = 0; i < count; i += 1) {
    const at = i * channels
    const y =
      channels >= 3
        ? 0.2126 * (data[at] as number) +
          0.7152 * (data[at + 1] as number) +
          0.0722 * (data[at + 2] as number)
        : (data[at] as number)
    values[i] = y
    sum += y
  }
  const sorted = Float64Array.from(values).sort()
  const at = (fraction: number): number =>
    sorted[Math.min(count - 1, Math.max(0, Math.round(fraction * (count - 1))))] as number
  return count === 0 ? { mean: 0, spread: 0 } : { mean: sum / count, spread: at(0.9) - at(0.1) }
}

export const judge = (stats: LuminanceStats, legible: Legible): boolean =>
  stats.mean >= legible.mean[0] && stats.mean <= legible.mean[1] && stats.spread >= legible.spread
