// A feel table and helpers for the runtime's tests: the spec's example, a feel made over it, frames at drawn ticks.

import { fakeClock } from '@automata/framework/testing'
import type { SimEvent } from '@automata/sim'
import { parse } from 'smol-toml'
import {
  createFeel,
  DEFAULT_SETTINGS,
  type Feel,
  type FeelFrame,
  type FeelOptions,
} from '../features/frame/feel'
import type { FeelContent } from '../shared/feel.schema'

const TABLE = `
[limits]
shake_px = 3
hit_stop_ms = 120
flash_frames = 3
flash_alpha = 0.85

[springs]
squash = { f = 4, zeta = 0.35, r = 0 }

[[entry]]
on = "slam"
camera = [{ shake = 0.6 }]
pose = [{ hit_stop_ms = 90, target = "subject" }]
visual = [{ flash = "white", frames = 2 }, { squash = 0.35 }, { tint = "red", ms = 600, alpha = 0.4 }]
word = [{ key = "feel.word.slam", at = "subject" }]
haptic = [{ strong = 0.6, weak = 0.4, ms = 90, phone_ms = 18 }]
audio = [{ cue = "slam" }]

[[entry]]
on = "door.*"
audio = [{ cue = "creak" }]
`
export const content = parse(TABLE) as unknown as FeelContent
export const FRAME: number = 1 / 60

export const make = (over: Partial<FeelOptions> = {}): Feel =>
  createFeel({
    content: () => content,
    settings: () => DEFAULT_SETTINGS,
    reducedMotion: () => false,
    clock: fakeClock(),
    ...over,
  })
/** Frames at drawn ticks `from..to`, one per tick. */
export const frames = (feel: Feel, from: number, to: number): FeelFrame[] =>
  Array.from({ length: to - from + 1 }, (_, i) => feel.frame(from + i, 0, FRAME))
export const quiet = (f: FeelFrame): boolean =>
  f.offset[0] === 0 &&
  f.offset[1] === 0 &&
  f.frozen.length === 0 &&
  f.flash === null &&
  f.tint === null &&
  f.squash.size === 0 &&
  f.words.length === 0 &&
  f.haptics.length === 0 &&
  f.cues.length === 0
export const slam = (entity?: number): SimEvent => ({
  type: 'slam',
  payload: entity === undefined ? {} : { entity },
})
