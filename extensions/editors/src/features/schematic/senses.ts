// A character's senses as a person reads them: one sentence with its fields each, and a menu to add one it lacks. The
// table is the whole vocabulary; a sense of a kind it lacks cannot exist (the schema has exactly these five).
import type { Sense } from '@automata/systems/sim'
import type { Field } from '../../shared/fields.ts'
import { metres } from './pieces/conditions.ts'
import { num, spaced, YES_NO } from './pieces/piece.ts'

export type SenseKind = 'sight' | 'sound' | 'touch' | 'light' | 'warmth'

/** What a person reads beside the light and warmth senses in a 2D level (the systems lint's words). */
export const TWO_D_LINT =
  "2D levels have no lamps, so this sense never notices anything unless the game's code says how bright it is."

export const SENSE_MENU: readonly { readonly kind: SenseKind; readonly menu: string }[] = [
  { kind: 'sight', menu: 'It can see' },
  { kind: 'sound', menu: 'It can hear' },
  { kind: 'touch', menu: 'It can feel a touch' },
  { kind: 'light', menu: 'It notices light' },
  { kind: 'warmth', menu: 'It feels warmth' },
]

export const senseKind = (sense: Sense): SenseKind => Object.keys(sense)[0] as SenseKind

/** The senses a character has not got yet, for the add menu. */
export const missingSenses = (have: readonly Sense[]): typeof SENSE_MENU =>
  SENSE_MENU.filter((entry) => !have.some((sense) => senseKind(sense) === entry.kind))

/** A new sense that passes the schema and does something at once. */
export function freshSense(kind: SenseKind): Sense {
  switch (kind) {
    case 'sight':
      return { sight: { range: 5 } }
    case 'sound':
      return { sound: {} }
    case 'touch':
      return { touch: { radius: 0.6 } }
    case 'light':
      return { light: { radius: 2 } }
    case 'warmth':
      return { warmth: { sources: {} } }
  }
}

/** Whether boxes and shut doors block this sight: only `wallsOnly: false` says so (the sim's `probe.ts`). */
const blocksView = (sight: { readonly wallsOnly?: boolean | undefined }): boolean => sight.wallsOnly === false

/** The sentence for a sense. */
export function senseWords(sense: Sense): string {
  if ('sight' in sense)
    return `Sees up to ${num(sense.sight.range)} m. Boxes and closed doors block its view: ${blocksView(sense.sight) ? 'yes' : 'no'}`
  if ('sound' in sense)
    return sense.sound.reach === undefined ? 'Hears from anywhere' : `Hears up to ${num(sense.sound.reach)} m`
  if ('touch' in sense) return `Touches within ${num(sense.touch.radius)} m`
  if ('light' in sense) return `Notices light within ${num(sense.light.radius ?? 2)} m`
  const sources = Object.entries(sense.warmth.sources)
  return sources.length === 0
    ? 'Feels warmth: nothing yet'
    : `Feels ${sources.map(([name, radius]) => `${spaced(name)} within ${num(radius)} m`).join(', ')}`
}

/** The fields a sense shows. Warmth shows a pair for each thing it feels. */
export function senseFields(sense: Sense): Field[] {
  if ('sight' in sense)
    return [
      metres('range', 'Sees up to', sense.sight.range),
      {
        key: 'blocked',
        label: 'Boxes and closed doors block its view',
        kind: 'choice',
        value: blocksView(sense.sight) ? 'yes' : 'no',
        options: YES_NO,
      },
    ]
  if ('sound' in sense)
    return [
      {
        key: 'limit',
        label: 'Hears',
        kind: 'choice',
        value: sense.sound.reach === undefined ? 'anywhere' : 'near',
        options: [
          { value: 'anywhere', label: 'from anywhere' },
          { value: 'near', label: 'only up to a distance' },
        ],
      },
      ...(sense.sound.reach === undefined ? [] : [metres('reach', 'Hears up to', sense.sound.reach)]),
    ]
  if ('touch' in sense) return [metres('radius', 'Touches within', sense.touch.radius, 10)]
  if ('light' in sense) return [metres('radius', 'Notices light within', sense.light.radius ?? 2, 30)]
  return Object.entries(sense.warmth.sources).flatMap(([name, radius]) => [
    { key: `name:${name}`, label: 'Feels', kind: 'text' as const, value: name },
    metres(`radius:${name}`, `Within (${spaced(name)})`, radius, 30),
  ])
}

/** The sense after a field changed. A key the sense does not have leaves it as it is. */
export function writeSense(sense: Sense, key: string, next: unknown): Sense {
  if ('sight' in sense) {
    if (key === 'range') return { sight: { ...sense.sight, range: Number(next) } }
    if (key === 'blocked') {
      // The game's default (no field) is walls only, so "no" removes the field and "yes" has to write it.
      const { wallsOnly: _gone, ...rest } = sense.sight
      return { sight: next === 'yes' ? { ...rest, wallsOnly: false } : rest }
    }
    return sense
  }
  if ('sound' in sense) {
    if (key === 'limit') return { sound: next === 'near' ? { reach: 10 } : {} }
    if (key === 'reach') return { sound: { reach: Number(next) } }
    return sense
  }
  if ('touch' in sense) return key === 'radius' ? { touch: { radius: Number(next) } } : sense
  if ('light' in sense) return key === 'radius' ? { light: { radius: Number(next) } } : sense
  const sources = { ...sense.warmth.sources }
  if (key.startsWith('radius:')) sources[key.slice(7)] = Number(next)
  else if (key.startsWith('name:')) {
    const from = key.slice(5)
    const to = String(next)
    if (to === '' || (to !== from && to in sources)) return sense
    return {
      warmth: {
        sources: Object.fromEntries(
          Object.entries(sources).map(([name, r]) => [name === from ? to : name, r]),
        ),
      },
    }
  }
  return { warmth: { sources } }
}

/** A warmth sense with one more thing it feels, named for the first free object. */
export function withWarmthSource(sense: Sense, name: string): Sense {
  if (!('warmth' in sense)) return sense
  return { warmth: { sources: { ...sense.warmth.sources, [name]: 3 } } }
}
