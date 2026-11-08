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
const FLOOR = 0.4

/**
 * How far the grade reaches: the library's grade amounts are small (the look's passes grade a picture, this grades the
 * colours themselves), and the six times must read as six moods, so each is drawn a little further toward its tint.
 */
const GRADE_REACH = 1.8

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
  const pull = Math.min(1, GRADE_REACH * Math.max(0, amount - day.scene.grade.amount))
  let out = 0
  for (const index of [0, 1, 2] as const) {
    const ratio = FLOOR + (1 - FLOOR) * Math.min(1, (now[index] as number) / (then[index] as number))
    const dimmed = (((colour >> (16 - index * 8)) & 0xff) / 255) * ratio
    const graded = dimmed + (channel(tint, index) * ratio - dimmed) * pull
    out = (out << 8) | Math.round(Math.min(1, Math.max(0, graded)) * 255)
  }
  return out
}

/**
 * The stepped-light material reads the hemisphere in linear light and cuts it into whole steps, so a hemisphere dimmer
 * than its first step draws every surface black. This is the share of a full light (linear, the sky and ground averaged,
 * as a wall facing sideways sees them) that the dimmest time still keeps, so Night is dark, not gone.
 */
const HEMISPHERE_FLOOR = 0.14

const GAMMA = 2.2
const toLinear = (value: number): number => value ** GAMMA
const fromLinear = (value: number): number => value ** (1 / GAMMA)

/** `colour` with every channel multiplied by `gain` in linear light (hue kept; a channel stops at full). */
function gained(colour: number, gain: number): number {
  let out = 0
  for (const index of [0, 1, 2] as const) {
    const linear = toLinear(((colour >> (16 - index * 8)) & 0xff) / 255)
    out = (out << 8) | Math.round(Math.min(1, fromLinear(Math.min(1, linear * gain))) * 255)
  }
  return out
}

const meanLinear = (colour: number): number =>
  ([0, 1, 2] as const).reduce<number>(
    (sum, index) => sum + toLinear(((colour >> (16 - index * 8)) & 0xff) / 255),
    0,
  ) / 3

/**
 * The hemisphere a game lights its room with (`sky` above, `ground` below, both as drawn by day) as `time` lights it:
 * each through `lightByTime`, then both brought up together, never apart, when the time would leave the stepped material
 * less than `HEMISPHERE_FLOOR`, so the room keeps the time's colour and a step of light to be seen by.
 */
export function lightHemisphere(
  sky: number,
  ground: number,
  time: TimeOfDay,
): { readonly skyColor: number; readonly groundColor: number } {
  const [skyColor, groundColor] = [lightByTime(sky, time), lightByTime(ground, time)]
  const level = (meanLinear(skyColor) + meanLinear(groundColor)) / 2
  if (level >= HEMISPHERE_FLOOR) return { skyColor, groundColor }
  const gain = HEMISPHERE_FLOOR / level
  return { skyColor: gained(skyColor, gain), groundColor: gained(groundColor, gain) }
}
