// Changing a cutscene's keys in time: where a key may go, the edit that moves it, the keys a new step starts from, and
// what a shorter scene takes away. Every time is a tenth of a second and stays inside the scene; a key stops at its
// neighbours on its row, because the file refuses a camera key before the one before it (and an actor key likewise).

import type { CutsceneScript } from '@automata/cutscenes/sim'
import type { ContentEdit } from '@automata/editor/kit/documents'
import { appendEdits } from '../../shared/fields.ts'
import { endOf, keysOf, type TrackId, timeOf, timePath } from './tracks.ts'

const tenth = (value: number): number => Math.round(value * 10) / 10
const hundredth = (value: number): number => Math.round(value * 100) / 100

export const snap = (t: number, duration: number): number => Math.min(duration, Math.max(0, tenth(t)))

const whoOf = (key: unknown): string | undefined => (key as { who?: string }).who

/** The least and most time a key may have, from the keys beside it on its row. */
export function bounds(script: CutsceneScript, track: TrackId, index: number): [number, number] {
  const keys = keysOf(script, track)
  if (track === 'camera') {
    const before = keys[index - 1]
    const after = keys[index + 1]
    return [
      before === undefined ? 0 : timeOf(track, before),
      after === undefined ? script.duration : timeOf(track, after),
    ]
  }
  if (track === 'actor') {
    const who = whoOf(keys[index])
    const same = keys.map((key, at) => ({ key, at })).filter(({ key }) => whoOf(key) === who)
    const place = same.findIndex(({ at }) => at === index)
    const before = same[place - 1]
    const after = same[place + 1]
    return [
      before === undefined ? 0 : timeOf(track, before.key),
      after === undefined ? script.duration : timeOf(track, after.key),
    ]
  }
  return [0, script.duration]
}

/** A key's time (or, with `end`, the end of its bar) changed; `undefined` when it would not change. */
export function retimeEdit(
  script: CutsceneScript,
  track: TrackId,
  index: number,
  t: number,
  end = false,
): ContentEdit | undefined {
  const key = keysOf(script, track)[index]
  if (key === undefined) return undefined
  const current = end ? endOf(track, key) : timeOf(track, key)
  if (current === undefined) return undefined
  const [least, most] = bounds(script, track, index)
  // A bar's end stays after its start; its start stays before its end.
  const low = end ? tenth(timeOf(track, key) + 0.1) : least
  const high =
    !end && endOf(track, key) !== undefined
      ? Math.min(most, tenth((endOf(track, key) as number) - 0.1))
      : most
  const next = Math.min(high, Math.max(low, snap(t, script.duration)))
  return next === current ? undefined : { keyPath: timePath(track, index, end), expected: current, set: next }
}

/** A whole key dragged to start at `t`: a bar keeps its length, and stops at the end of the scene. */
export function moveEdits(script: CutsceneScript, track: TrackId, index: number, t: number): ContentEdit[] {
  const key = keysOf(script, track)[index]
  if (key === undefined) return []
  const start = timeOf(track, key)
  const end = endOf(track, key)
  if (end === undefined) {
    const edit = retimeEdit(script, track, index, t)
    return edit === undefined ? [] : [edit]
  }
  const length = end - start
  const next = Math.min(tenth(script.duration - length), Math.max(0, snap(t, script.duration)))
  if (next === start) return []
  const shifted = tenth(next + length)
  const first: ContentEdit = { keyPath: timePath(track, index), expected: start, set: next }
  const last: ContentEdit = { keyPath: timePath(track, index, true), expected: end, set: shifted }
  // The end goes first when the bar moves later, so it never passes the start at any moment.
  return next > start ? [last, first] : [first, last]
}

/** What the director says the scene holds at the playhead; a new key starts from it. */
export interface StateAtPlayhead {
  readonly camera: { readonly pos: readonly number[]; readonly look: readonly number[] }
  readonly actors: Readonly<
    Record<string, { readonly x: number; readonly z: number; readonly facing: number }>
  >
  readonly fade: number
}

export interface NewKeyOptions {
  /** The actor, or the person a clip starts on. */
  readonly who?: string | undefined
  /** The line, lamp, door, time, mood, prop or clip the new step is about. */
  readonly name?: string | undefined
}

const v3 = (values: readonly number[]): [number, number, number] => [
  hundredth(values[0] ?? 0),
  hundredth(values[1] ?? 0),
  hundredth(values[2] ?? 0),
]

/** The new key for a track at `t`, or `undefined` when it needs a name it was not given. */
function newKey(
  script: CutsceneScript,
  track: TrackId,
  t: number,
  state: StateAtPlayhead,
  options: NewKeyOptions,
): unknown {
  const { who, name } = options
  switch (track) {
    case 'camera':
      return { t, pos: v3(state.camera.pos), look: v3(state.camera.look) }
    case 'actor': {
      if (who === undefined) return undefined
      const there = state.actors[who]
      return {
        who,
        t,
        x: hundredth(there?.x ?? 0),
        z: hundredth(there?.z ?? 0),
        ...(there === undefined ? {} : { facing: there.facing }),
      }
    }
    case 'caption':
      return name === undefined
        ? undefined
        : { t, until: tenth(Math.min(script.duration, t + 2)), line: name }
    case 'light':
      return name === undefined ? undefined : { t, lamp: name, level: 1 }
    case 'doors':
      return name === undefined ? undefined : { t, door: name, open: 1 }
    case 'time':
      return name === undefined ? undefined : { t, time: name }
    case 'grade':
      return name === undefined ? undefined : { t, grade: name }
    case 'props':
      return name === undefined ? undefined : { t, prop: name }
    case 'cues':
      return who === undefined || name === undefined ? undefined : { at: t, who, clip: name }
    case 'shake':
      return [t, tenth(Math.min(script.duration, t + 0.5)), 0.1]
    case 'flicker':
      return [t, tenth(Math.min(script.duration, t + 0.5))]
    case 'fade':
      return { t, value: tenth(state.fade) }
    default:
      return undefined
  }
}

/** The edits that add a key at `t` in time order, starting from what the scene holds there. */
export function addKeyEdits(
  script: CutsceneScript,
  track: TrackId,
  t: number,
  state: StateAtPlayhead,
  options: NewKeyOptions = {},
): ContentEdit[] | undefined {
  const at = snap(t, script.duration)
  const key = newKey(script, track, at, state, options)
  if (key === undefined) return undefined
  const keys = keysOf(script, track)
  const group = (other: unknown): boolean => track !== 'actor' || whoOf(other) === options.who
  // Before the first key of its row that comes later; with none, at the end.
  const later = keys.findIndex((other) => group(other) && timeOf(track, other) > at)
  const place = later === -1 ? keys.length : later
  if (keys.length === 0) return appendEdits([track], false, key)
  return [{ keyPath: [track], insert: key, at: place }]
}

/** Takes a key away, but never the last camera key: a scene always has somewhere to look from. */
export function removeKeyEdit(
  script: CutsceneScript,
  track: TrackId,
  index: number,
): ContentEdit | undefined {
  if (track === 'camera' && script.camera.length <= 1) return undefined
  return { keyPath: [track, index], remove: true }
}

/** A new length. Steps that start after it go, and a bar that runs past it ends at it; `dropped` counts the steps. */
export function durationEdits(
  script: CutsceneScript,
  length: number,
): { edits: ContentEdit[]; dropped: number } {
  const next = Math.max(0.1, tenth(length))
  const edits: ContentEdit[] = [{ keyPath: ['duration'], expected: script.duration, set: next }]
  if (next >= script.duration) return { edits, dropped: 0 }
  let dropped = 0
  const tracks: TrackId[] = [
    'camera',
    'actor',
    'caption',
    'sound',
    'light',
    'doors',
    'time',
    'grade',
    'props',
    'cues',
    'shake',
    'flicker',
    'fade',
  ]
  for (const track of tracks) {
    const keys = keysOf(script, track)
    // Later keys first, so each place stays right while the ones before it are still there.
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index] as never
      const start = timeOf(track, key)
      const keepsOne = track === 'camera' && index === 0
      const end = endOf(track, key)
      // A bar that would start at the new end has no length left, so it goes too.
      const gone = end === undefined ? start > next : start >= next
      if (gone && !keepsOne) {
        edits.push({ keyPath: [track, index], remove: true })
        dropped += 1
        continue
      }
      if (end !== undefined && end > next && next > start)
        edits.push({ keyPath: timePath(track, index, true), expected: end, set: next })
    }
  }
  return { edits, dropped }
}
