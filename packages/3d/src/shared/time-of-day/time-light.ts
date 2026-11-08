// The time of day a level names, and the light that time casts on a game's own colours. Core owns both, so every game
// (and the editor's views) plays a level in the light its file says, with no rule of its own to drift from the picker.
// Presentation only: the sim never reads it (law 1).

import type { LevelTime } from '../level/af-sector-2.schema.ts'
import { type TimeOfDay, type TimeOverrides, timeOfDay } from './time-of-day.ts'

/** The time a level names, with its own changes over its preset's; the day when it names none. */
export function levelTime(time: LevelTime | undefined): TimeOfDay {
  if (time === undefined) return timeOfDay('day')
  if (typeof time === 'string') return timeOfDay(time)
  const { preset, ...changes } = time
  return timeOfDay(preset ?? 'day', changes as TimeOverrides)
}

/**
 * The share of the day's light every time keeps. The player still has to see the floor they cross at night, and the
 * dimmest times (Night, Bar light) stay told apart by their colour, not by how close to black they are.
 */
const FLOOR = 0.15

const channel = (hex: string, index: 0 | 1 | 2): number =>
  Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255

/** What the time's ambient light is, per channel: its level times its tint. */
function ambient(time: TimeOfDay): readonly [number, number, number] {
  const { level, tint } = time.scene.light.ambient
  return [level * channel(tint, 0), level * channel(tint, 1), level * channel(tint, 2)]
}

/**
 * `colour` (0xRRGGBB, as the game draws it by day) as `time` lights it. The day leaves it as it is. Any other time
 * scales each channel by its ambient light against the day's (its level and its tint, so Golden hour is warm and Night
 * is cool), never below `FLOOR`, then pulls it toward the time's grade tint by how much more grade the time has than the
 * day, which the game's colours already carry.
 */
export function lightByTime(colour: number, time: TimeOfDay): number {
  const day = timeOfDay('day')
  const [now, then] = [ambient(time), ambient(day)]
  const { tint, amount } = time.scene.grade
  const pull = Math.max(0, amount - day.scene.grade.amount)
  let out = 0
  for (const index of [0, 1, 2] as const) {
    const ratio = FLOOR + (1 - FLOOR) * Math.min(1, (now[index] as number) / (then[index] as number))
    const dimmed = (((colour >> (16 - index * 8)) & 0xff) / 255) * ratio
    const graded = dimmed + (channel(tint, index) * ratio - dimmed) * pull
    out = (out << 8) | Math.round(Math.min(1, Math.max(0, graded)) * 255)
  }
  return out
}
