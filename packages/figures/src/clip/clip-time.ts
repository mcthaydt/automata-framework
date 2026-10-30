// Clip time (M3 spec §4.4.4): where in a clip `elapsed` seconds of play are (its loop mode), the instant a
// stepped pose shows (its rate, snapping to markers), stretching a clip to the sim's action length, and
// reading a marker.

import type { FigureClipDef } from './clip.schema'

/**
 * The clip time after `elapsed` seconds of play. `once` and `hold` clamp to [0, length] (whether `once` has
 * ended is the caller's); `loop` wraps, so `length` itself is 0; `pingpong` runs forward then back over twice
 * the length. A negative `elapsed` is 0.
 */
export function clipTime(clip: FigureClipDef, elapsed: number): number {
  const { length } = clip
  const t = Math.max(0, elapsed)
  switch (clip.loop) {
    case 'once':
    case 'hold':
      return Math.min(t, length)
    case 'loop':
      return t % length
    case 'pingpong': {
      const u = t % (2 * length)
      return u <= length ? u : 2 * length - u
    }
  }
}

/**
 * The clip time a stepped pose shows at clip time `t`, at `rate` steps a second: `t` floored to its step,
 * except that a step holding a marker shows the marker's instant from that instant on (the latest such marker
 * at or before `t`). So a `contact` pose shows on the first frame at or after its marker, never earlier and
 * never a step late (§4.4.4 "stepped sampling snaps to markers").
 */
export function stepTime(clip: FigureClipDef, t: number, rate: number): number {
  if (!(rate > 0) || !Number.isFinite(rate))
    throw new RangeError(`stepTime: rate ${rate} is not a positive number`)
  const start = Math.floor(t * rate) / rate
  let shown = start
  for (const marker of Object.values(clip.markers ?? {}))
    if (marker >= start && marker <= t && marker > shown) shown = marker
  return shown
}

/** The clip stretched evenly to `length` seconds: its keys, markers and cues with it. */
export function retime(clip: FigureClipDef, length: number): FigureClipDef {
  if (!(length > 0) || !Number.isFinite(length))
    throw new RangeError(`retime: ${length} is not a positive length in seconds`)
  const k = length / clip.length
  const last = clip.keys.length - 1
  return {
    ...clip,
    length,
    // The last key lands on the length exactly, so the clip still ends where its keys do.
    keys: clip.keys.map((key, i) => ({ ...key, t: i === last ? length : key.t * k })),
    ...(clip.markers
      ? { markers: Object.fromEntries(Object.entries(clip.markers).map(([name, t]) => [name, t * k])) }
      : {}),
    ...(clip.cues ? { cues: clip.cues.map((cue) => ({ ...cue, t: cue.t * k })) } : {}),
  }
}

/** The time of the marker `name`; a missing one is a RangeError naming it. */
export function markerTime(clip: FigureClipDef, name: string): number {
  const t = clip.markers?.[name]
  if (t === undefined) {
    const names = Object.keys(clip.markers ?? {}).join(', ') || 'none'
    throw new RangeError(`the clip has no marker ${name} (markers: ${names})`)
  }
  return t
}
