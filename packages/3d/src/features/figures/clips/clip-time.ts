// Clip time (M3 spec §4.4.4): where in a clip `elapsed` seconds of play are (its loop mode), the instant a
// stepped pose shows (its rate, snapping to markers), stretching a clip to the sim's action length, and
// reading a marker.

import { wrapTime } from '../../../shared/timeline/track.ts'
import type { FigureClipDef } from './clip.schema.ts'

/**
 * The clip time after `elapsed` seconds of play. `once` and `hold` clamp to [0, length] (whether `once` has
 * ended is the caller's); `loop` wraps, so `length` itself is 0; `pingpong` runs forward then back over twice
 * the length. A negative `elapsed` is 0.
 */
export function clipTime(clip: FigureClipDef, elapsed: number): number {
  return wrapTime(clip.loop, clip.length, elapsed)
}

/** The play time (seconds since the clip started) of the latest pass over a marker at or before `to`, for a
 * marker at clip time `m`: a loop passes it every `length`, a pingpong twice every `2·length` (out and back),
 * `once` and `hold` once. */
function lastPass(clip: FigureClipDef, m: number, to: number): number | undefined {
  const { length } = clip
  const latest = (first: number, period: number): number | undefined =>
    to < first ? undefined : first + Math.floor((to - first) / period) * period
  switch (clip.loop) {
    case 'once':
    case 'hold':
      return m <= to ? m : undefined
    case 'loop':
      // A marker at the very end is the next pass's start.
      return latest(m === length ? length : m, length)
    case 'pingpong': {
      const out = latest(m, 2 * length)
      const back = latest(2 * length - m, 2 * length)
      if (out === undefined) return back
      if (back === undefined) return out
      return Math.max(out, back)
    }
  }
}

/** The clip time of the marker whose latest pass lies in (from, to] (or [from, to] when `closed`); the latest
 * such pass wins. */
function markerPassed(clip: FigureClipDef, from: number, to: number, closed: boolean): number | undefined {
  let best: { pass: number; m: number } | undefined
  for (const m of Object.values(clip.markers ?? {})) {
    const pass = lastPass(clip, m, to)
    if (pass === undefined || pass < from || (!closed && pass === from)) continue
    if (!best || pass > best.pass) best = { pass, m }
  }
  return best?.m
}

/**
 * The clip time a stepped pose shows after `elapsed` seconds of play (the caller's `(now − startedAt)`, scaled
 * when the clip is retimed), at `rate` steps a second, the previous frame having been at `previous`. The pose
 * step is the floor of `elapsed`; a marker passed since the previous frame (in (previous, elapsed]) is shown on
 * this frame even when this frame is already in a later step; and a step that holds a marker keeps showing it
 * from its instant to the step's end. So a `contact` pose shows on the first frame at or after its marker, never
 * earlier (§4.4.4). Loop wraps and pingpong returns count as passes.
 */
export function stepTime(clip: FigureClipDef, elapsed: number, rate: number, previous?: number): number {
  if (!(rate > 0) || !Number.isFinite(rate))
    throw new RangeError(`stepTime: rate ${rate} is not a positive number`)
  const crossed = previous === undefined ? undefined : markerPassed(clip, previous, elapsed, false)
  if (crossed !== undefined) return crossed
  const start = Math.floor(elapsed * rate) / rate
  return markerPassed(clip, start, elapsed, true) ?? clipTime(clip, start)
}

/**
 * The clip time a smoothly sampled frame shows after `elapsed` seconds of play, the previous frame having been
 * at `previous`: the clip time itself, except that a frame which passes a marker (in (previous, elapsed], loop
 * wraps and pingpong returns included) shows the marker's instant, so the marker's pose is on screen in smooth
 * sampling too. The first frame (no `previous`) shows its own time.
 */
export function smoothTime(clip: FigureClipDef, elapsed: number, previous: number | undefined): number {
  const crossed = previous === undefined ? undefined : markerPassed(clip, previous, elapsed, false)
  return crossed ?? clipTime(clip, elapsed)
}

/** The clip stretched evenly to `length` seconds: its keys, markers and cues with it. */
export function retime(clip: FigureClipDef, length: number): FigureClipDef {
  if (!(length > 0) || !Number.isFinite(length))
    throw new RangeError(`retime: ${length} is not a positive length in seconds`)
  const k = length / clip.length
  // t · k can round past the new length: the clip's end maps to it exactly, and nothing lands beyond it.
  const at = (t: number): number => (t === clip.length ? length : Math.min(t * k, length))
  const last = clip.keys.length - 1
  return {
    ...clip,
    length,
    // The last key lands on the length exactly, so the clip still ends where its keys do.
    keys: clip.keys.map((key, i) => ({ ...key, t: i === last ? length : at(key.t) })),
    ...(clip.markers
      ? { markers: Object.fromEntries(Object.entries(clip.markers).map(([name, t]) => [name, at(t)])) }
      : {}),
    ...(clip.cues ? { cues: clip.cues.map((cue) => ({ ...cue, t: at(cue.t) })) } : {}),
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
