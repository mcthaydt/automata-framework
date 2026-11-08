// What is wrong with a cutscene, worked out in the page from the file and the game's lines, and said where it is: on the
// key or bar it is about. The cutscene lint also needs a 3D map (a camera in a wall, dead air); that waits for a
// cutscenes check a made game can run, so none of it is run here.
import type { CutsceneScript } from '@automata/cutscenes/sim'
import { MIN_SHOT } from '@automata/cutscenes/tools'
import { endOf, keysOf, TRACK_ORDER, type TrackId, timeOf } from './tracks.ts'

export interface SceneProblem {
  readonly track: TrackId
  readonly index: number
  readonly words: string
}

/** A line the game has, by id: its words, which are empty until they are written. */
export type LineWords = ReadonlyMap<string, string>

const seconds = (value: number): string => `${String(Math.round(value * 10) / 10)} s`

export function sceneProblems(script: CutsceneScript, lines: LineWords): SceneProblem[] {
  const found: SceneProblem[] = []
  const add = (track: TrackId, index: number, words: string): void => {
    found.push({ track, index, words })
  }

  const captions = script.caption ?? []
  captions.forEach((caption, index) => {
    const words = lines.get(caption.line)
    if (words === undefined) add('caption', index, 'This step’s words were removed.')
    else if (words.trim() === '') add('caption', index, 'These words have nothing written yet.')
  })
  // Two words on screen at once: the later one is where the overlap is told.
  const byStart = captions
    .map((caption, index) => ({ caption, index }))
    .sort((a, b) => a.caption.t - b.caption.t)
  byStart.forEach(({ caption, index }, place) => {
    const before = byStart[place - 1]
    if (before !== undefined && before.caption.until > caption.t + 1e-9)
      add(
        'caption',
        index,
        `Two words on screen overlap from ${seconds(caption.t)} to ${seconds(Math.min(before.caption.until, caption.until))}.`,
      )
  })

  for (const track of TRACK_ORDER) {
    keysOf(script, track).forEach((key, index) => {
      if (timeOf(track, key) > script.duration + 1e-9)
        add(track, index, 'This step comes after the end of the scene.')
      else if ((endOf(track, key) ?? 0) > script.duration + 1e-9)
        add(track, index, 'This step runs past the end of the scene.')
    })
  }

  // A shot runs from the start, or a cut, to the next cut. Keys at one time are a cut, not a shot.
  const starts = script.camera
    .map((key, index) => ({ key, index }))
    .filter(({ key }, place) => place === 0 || key.cut === true)
  starts.forEach(({ key, index }, place) => {
    const end = Math.min(script.duration, starts[place + 1]?.key.t ?? script.duration)
    if (end - key.t + 1e-9 < MIN_SHOT && end > key.t)
      add('camera', index, 'This shot is shorter than a second.')
  })

  return found
}
