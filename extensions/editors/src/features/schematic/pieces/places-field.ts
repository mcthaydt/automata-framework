// The places an action may name, and the field that picks one. A name, a point in metres, or one of the words the
// interpreter knows (`PLACES`): the player, itself, the last noise, the nearest light, the nearest warm thing.
import type { Field } from '../../../shared/fields.ts'
import { choices } from './conditions.ts'
import { type Names, num, spaced } from './piece.ts'

export type Spot = string | { readonly x: number; readonly z: number }

/** The value a "point…" choice has in a field, before she types where. */
export const POINT = '$point'

const SPECIAL: readonly { readonly value: string; readonly words: string }[] = [
  { value: 'player', words: 'the player' },
  { value: 'self', words: 'itself' },
  { value: 'noise', words: 'the last noise it heard' },
  { value: 'light', words: 'the nearest light' },
  { value: 'warmth', words: 'the nearest warm thing' },
]

/** What a place field offers, in order: the special places, each character, each named place, then a point. */
export function placeChoices(names: Names): { value: string; words: string }[] {
  return [
    ...SPECIAL,
    ...names.agents.map((value) => ({ value, words: spaced(value) })),
    ...names.places.map((value) => ({ value, words: spaced(value) })),
    { value: POINT, words: 'a point…' },
  ]
}

const specialWords = (name: string): string | undefined =>
  SPECIAL.find((place) => place.value === name)?.words

/** A place as it reads in a sentence ("the player", "bedside", "the point 1 across, 2 down"). */
export function placeWords(spot: Spot): string {
  if (typeof spot === 'string') return specialWords(spot) ?? spaced(spot)
  return `the point ${num(spot.x)} across, ${num(spot.z)} down`
}

/** The fields that choose a place: the choice, and for a point the two numbers. */
export function placeFields(key: string, label: string, spot: Spot, names: Names): Field[] {
  const current = typeof spot === 'string' ? spot : POINT
  const known = placeChoices(names)
  const options = known.some((choice) => choice.value === current)
    ? known.map((choice) => ({ value: choice.value, label: choice.words }))
    : [
        ...known.map((choice) => ({ value: choice.value, label: choice.words })),
        ...choices([], current, spaced),
      ]
  const field: Field = { key, label, kind: 'choice', value: current, options }
  if (typeof spot === 'string') return [field]
  const metres = (axis: 'x' | 'z', name: string): Field => ({
    key: axis,
    label: name,
    kind: 'number',
    unit: 'm',
    min: -500,
    max: 500,
    step: 0.5,
    value: spot[axis],
  })
  return [field, metres('x', 'Across'), metres('z', 'Down')]
}

/**
 * The place after a field changed: a different choice, or one coordinate of the point. `key` is the place's own key
 * (`'place'`); the point's two numbers are `'x'` and `'z'`.
 */
export function writePlace(spot: Spot, key: string, own: string, next: unknown): Spot {
  if (key === own) return next === POINT ? { x: 0, z: 0 } : String(next)
  if (typeof spot === 'string') return spot
  if (key === 'x') return { x: Number(next), z: spot.z }
  if (key === 'z') return { x: spot.x, z: Number(next) }
  return spot
}
