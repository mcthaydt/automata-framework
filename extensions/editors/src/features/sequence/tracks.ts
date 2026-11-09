// A cutscene as rows of marks: one row for each track the scene uses (and one for each actor), a mark for each key.
// Not every track keys by `t` (a clip uses `at`, a shake is `[from, to, metres]`, a words-on-screen key has `t` and
// `until`), so every time read and write goes through the accessors here.
import type { CutsceneScript } from '@automata/cutscenes/sim'

export type TrackId =
  | 'camera'
  | 'actor'
  | 'caption'
  | 'sound'
  | 'light'
  | 'doors'
  | 'time'
  | 'grade'
  | 'props'
  | 'cues'
  | 'shake'
  | 'flicker'
  | 'fade'

/** The rows in the order a person reads them. */
export const TRACK_ORDER: readonly TrackId[] = [
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

export const TRACK_WORDS: Readonly<Record<TrackId, string>> = {
  camera: 'Camera',
  actor: 'Someone',
  caption: 'Words on screen',
  sound: 'Sounds',
  light: 'Lights',
  doors: 'Doors',
  time: 'Time of day',
  grade: 'Mood',
  props: 'Props',
  cues: 'Clips',
  shake: 'Shake',
  flicker: 'Flicker',
  fade: 'Fade',
}

// A lamp, a door, a prop, the time of day and a mood belong to a 3D level. A 2D game keeps the keys but shows nothing.
const ONLY_3D: ReadonlySet<TrackId> = new Set(['light', 'doors', 'time', 'grade', 'props', 'flicker'])

export interface Mark {
  /** The key's place in its track's list in the file. */
  readonly index: number
  readonly t: number
  readonly until?: number | undefined
  /** 0, or higher when other keys of the row share its time, so each can be tapped. */
  readonly lane: number
}

export interface Row {
  readonly id: string
  readonly words: string
  readonly track: TrackId
  /** The actor's name, on an actor's row. */
  readonly who?: string | undefined
  readonly only3d: boolean
  readonly marks: readonly Mark[]
}

type AnyKey = Readonly<Record<string, unknown>> | readonly number[]

/** The track's keys in the file, or none. */
export function keysOf(script: CutsceneScript, track: TrackId): readonly AnyKey[] {
  const keys = (script as unknown as Record<string, readonly AnyKey[] | undefined>)[
    track === 'camera' ? 'camera' : track
  ]
  return keys ?? []
}

const isWindow = (track: TrackId): boolean => track === 'shake' || track === 'flicker'

export function timeOf(track: TrackId, key: AnyKey): number {
  if (isWindow(track)) return (key as readonly number[])[0] as number
  const fields = key as Readonly<Record<string, unknown>>
  return (track === 'cues' ? fields.at : fields.t) as number
}

export function endOf(track: TrackId, key: AnyKey): number | undefined {
  if (isWindow(track)) return (key as readonly number[])[1]
  if (track === 'caption') return (key as { until?: number }).until
  return undefined
}

/** Where the key’s time (or, with `end`, the end of its bar) is written in the file. */
export function timePath(track: TrackId, index: number, end = false): (string | number)[] {
  if (isWindow(track)) return [track, index, end ? 1 : 0]
  if (track === 'caption' && end) return [track, index, 'until']
  return [track, index, track === 'cues' ? 'at' : 't']
}

function marksOf(track: TrackId, keys: readonly AnyKey[], only?: (key: AnyKey) => boolean): Mark[] {
  const taken = new Map<number, number>()
  const marks: Mark[] = []
  keys.forEach((key, index) => {
    if (only !== undefined && !only(key)) return
    const t = timeOf(track, key)
    const lane = taken.get(t) ?? 0
    taken.set(t, lane + 1)
    marks.push({ index, t, until: endOf(track, key), lane })
  })
  return marks
}

const capital = (id: string): string => {
  const spaced = id.replace(/[_.-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** The rows of a scene; in a 2D game the rows that belong to a 3D level say so. */
export function rows(script: CutsceneScript, is2d: boolean): Row[] {
  const out: Row[] = []
  for (const track of TRACK_ORDER) {
    const keys = keysOf(script, track)
    if (keys.length === 0) continue
    if (track === 'actor') {
      const people = [...new Set(keys.map((key) => (key as { who: string }).who))]
      for (const who of people) {
        out.push({
          id: `actor:${who}`,
          words: capital(who),
          track,
          who,
          only3d: false,
          marks: marksOf(track, keys, (key) => (key as { who: string }).who === who),
        })
      }
      continue
    }
    out.push({
      id: track,
      words: TRACK_WORDS[track],
      track,
      only3d: is2d && ONLY_3D.has(track),
      marks: marksOf(track, keys),
    })
  }
  return out
}

export interface AddableRow {
  readonly track: TrackId
  readonly words: string
  readonly only3d: boolean
}

/** The rows a person can still add: every track the scene does not use. Sounds are not offered, nothing plays them. */
export function addableRows(script: CutsceneScript, is2d: boolean): AddableRow[] {
  return TRACK_ORDER.filter(
    (track) => track !== 'sound' && (track === 'actor' || keysOf(script, track).length === 0),
  ).map((track) => ({
    track,
    words: track === 'actor' ? 'Someone walking' : TRACK_WORDS[track],
    only3d: is2d && ONLY_3D.has(track),
  }))
}
