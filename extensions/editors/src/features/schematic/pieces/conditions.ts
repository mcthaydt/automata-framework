// Every kind of condition a switch or a rule can ask, as a piece (`piece.ts`): the sentence a person reads, the fields
// in it, and how a change to one field is written back. The facts the interpreter gives meaning to (`self.idle`,
// `self.blocked`, `pursuit.hidden`, a character's own notes) are pieces of their own, so they read as what they mean.
import { type Probe, probeSchema } from '@automata/systems/sim'
import type { Field } from '../../../shared/fields.ts'
import {
  factFrom,
  hasShape,
  modeWords,
  type Names,
  NEW_FACT,
  num,
  type Piece,
  spaced,
  UNNAMED_FACT,
  valueField,
  valueFrom,
  valueWords,
  YES_NO,
} from './piece.ts'

const isProbe = (value: unknown): value is Probe => probeSchema.safeParse(value).success

export const metres = (key: string, label: string, value: number, max = 60): Field => ({
  key,
  label,
  kind: 'number',
  unit: 'm',
  min: 0,
  max,
  step: 0.5,
  value,
})

/** The choices for a field: the file's names, and the current value even when the file no longer has it. */
export function choices(
  list: readonly string[],
  current: string,
  words: (name: string) => string = (name) => name,
): { value: string; label: string }[] {
  const all = list.includes(current) || current === '' ? list : [...list, current]
  return all.map((value) => ({ value, label: words(value) }))
}

/**
 * The fields that name a fact: the choice (the puzzle's facts, the file's, then "a new fact…"), and, while a made-up
 * fact has no name yet, a text field to name it.
 */
export function factFields(key: string, current: string, names: Names): Field[] {
  const choice: Field = {
    key,
    label: 'Fact',
    kind: 'choice',
    value: current,
    options: [...choices(names.facts, current, spaced), { value: NEW_FACT, label: 'a new fact…' }],
  }
  return current === UNNAMED_FACT
    ? [choice, { key: `${key}.name`, label: 'Name it', kind: 'text', value: '' }]
    : [choice]
}

/** The fact a change to `key` leaves: a chosen one, or the name typed for a made-up one (empty keeps what it was). */
export function writeFact(current: string, key: string, field: string, next: unknown): string {
  if (key === field) return factFrom(next)
  if (key === `${field}.name`) return String(next).trim() || current
  return current
}

/** The piece for a probe's kind, or `undefined` for a kind the table lacks. */
export function conditionPiece(probe: unknown): Piece<Probe> | undefined {
  return CONDITIONS.find((piece) => piece.matches(probe))
}

/** A sentence turned round: "sees the player" becomes "does not see the player". */
function negate(text: string): string {
  if (text.startsWith('sees ')) return `does not see ${text.slice(5)}`
  if (text.startsWith('hears ')) return `does not hear ${text.slice(6)}`
  if (text.startsWith('saw ')) return `did not see ${text.slice(4)}`
  if (text.startsWith('is ')) return `is not ${text.slice(3)}`
  if (text.startsWith('has ')) return `has not ${text.slice(4)}`
  if (text.includes(' is not ')) return text.replace(' is not ', ' is ')
  if (text.includes(' is ')) return text.replace(' is ', ' is not ')
  return `not (${text})`
}

export function conditionWords(probe: Probe, names: Names): string {
  const piece = conditionPiece(probe)
  return piece === undefined ? 'something the editor cannot show yet' : piece.words(probe, names)
}

/** A condition the editor shows but does not change: a kind the table lacks, or a `not` inside a `not`. */
export function isReadOnlyCondition(probe: unknown): boolean {
  if (conditionPiece(probe) === undefined) return true
  const inner = (probe as { not?: unknown }).not
  return (
    inner !== undefined &&
    (conditionPiece(inner) === undefined || (inner as { not?: unknown }).not !== undefined)
  )
}

const rest = <T extends object>(value: T, key: string): T => {
  const { [key]: _gone, ...others } = value as Record<string, unknown>
  return others as T
}

const sees: Piece<{ sees: true }> = {
  kind: 'sees',
  group: 'notices',
  menu: 'sees the player',
  matches: (value): value is { sees: true } =>
    hasShape(value, ['sees']) && (value as { sees: unknown }).sees === true,
  words: () => 'sees the player',
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ sees: true }),
}

const heard: Piece<{ heard: string; reach?: number }> = {
  kind: 'heard',
  group: 'notices',
  menu: 'hears a noise',
  matches: (value): value is { heard: string; reach?: number } => hasShape(value, ['heard'], ['reach']),
  words(value) {
    if (value.heard === '*')
      return value.reach === undefined ? 'hears anything' : `hears anything within ${num(value.reach)} m`
    const kind = `a ${spaced(value.heard)}`
    return value.reach === undefined
      ? `hears ${kind} from anywhere`
      : `hears ${kind} within ${num(value.reach)} m`
  },
  fields: (value) => [
    { key: 'heard', label: 'Kind of noise', kind: 'text', value: value.heard === '*' ? '*' : value.heard },
    ...(value.reach === undefined ? [] : [metres('reach', 'Within', value.reach)]),
  ],
  write: (value, key, next) =>
    key === 'heard'
      ? { ...value, heard: String(next) }
      : key === 'reach'
        ? { ...value, reach: Number(next) }
        : value,
  fresh: () => ({ heard: '*' }),
}

const inLight: Piece<{ inLight: true; radius?: number }> = {
  kind: 'inLight',
  group: 'notices',
  menu: 'is in light',
  matches: (value): value is { inLight: true; radius?: number } =>
    hasShape(value, ['inLight'], ['radius']) && (value as { inLight: unknown }).inLight === true,
  words: (value) =>
    value.radius === undefined ? 'is in light' : `is in light (within ${num(value.radius)} m)`,
  fields: (value) => (value.radius === undefined ? [] : [metres('radius', 'Within', value.radius)]),
  write: (value, key, next) => (key === 'radius' ? { ...value, radius: Number(next) } : value),
  fresh: () => ({ inLight: true }),
}

const warmthWithin: Piece<{ warmthWithin: number }> = {
  kind: 'warmthWithin',
  group: 'notices',
  menu: 'is near warmth',
  matches: (value): value is { warmthWithin: number } =>
    hasShape(value, ['warmthWithin']) &&
    typeof (value as { warmthWithin: unknown }).warmthWithin === 'number',
  words: (value) => `is within ${num(value.warmthWithin)} m of warmth`,
  fields: (value) => [metres('warmthWithin', 'Within', value.warmthWithin)],
  write: (value, key, next) => (key === 'warmthWithin' ? { warmthWithin: Number(next) } : value),
  fresh: () => ({ warmthWithin: 3 }),
}

const touching: Piece<{ touching: true; radius?: number }> = {
  kind: 'touching',
  group: 'notices',
  menu: 'is touching the player',
  matches: (value): value is { touching: true; radius?: number } =>
    hasShape(value, ['touching'], ['radius']) && (value as { touching: unknown }).touching === true,
  words: (value) =>
    value.radius === undefined ? 'is touching the player' : `is within ${num(value.radius)} m of the player`,
  fields: (value) => (value.radius === undefined ? [] : [metres('radius', 'Within', value.radius, 10)]),
  write: (value, key, next) => (key === 'radius' ? { ...value, radius: Number(next) } : value),
  fresh: () => ({ touching: true }),
}

const sawHide: Piece<{ sawHide: { radius: number; los?: boolean } }> = {
  kind: 'sawHide',
  group: 'notices',
  menu: 'saw the player hide',
  matches: (value): value is { sawHide: { radius: number; los?: boolean } } =>
    hasShape(value, ['sawHide']) && isProbe(value),
  words: ({ sawHide: { radius, los } }) =>
    `saw the player hide within ${num(radius)} m${los === true ? ', in sight' : ''}`,
  fields: ({ sawHide: { radius, los } }) => [
    metres('radius', 'Within', radius),
    { key: 'los', label: 'In sight', kind: 'choice', value: los === true ? 'yes' : 'no', options: YES_NO },
  ],
  write: (value, key, next) =>
    key === 'radius'
      ? { sawHide: { ...value.sawHide, radius: Number(next) } }
      : key === 'los'
        ? { sawHide: { ...value.sawHide, los: next === 'yes' } }
        : value,
  fresh: () => ({ sawHide: { radius: 4, los: true } }),
}

const at: Piece<{ at: string }> = {
  kind: 'at',
  group: 'where',
  menu: 'is at a place',
  matches: (value): value is { at: string } =>
    hasShape(value, ['at']) && typeof (value as { at: unknown }).at === 'string',
  words: (value) => `is at ${spaced(value.at)}`,
  fields: (value, names) => [
    {
      key: 'at',
      label: 'Place',
      kind: 'choice',
      value: value.at,
      options: choices(names.places, value.at, spaced),
    },
  ],
  write: (value, key, next) => (key === 'at' ? { at: String(next) } : value),
  fresh: (names) => ({ at: names.places[0] ?? '' }),
}

const crossed: Piece<{ crossed: true }> = {
  kind: 'crossed',
  group: 'where',
  menu: 'the player went through a doorway',
  matches: (value): value is { crossed: true } =>
    hasShape(value, ['crossed']) && (value as { crossed: unknown }).crossed === true,
  words: () => 'the player just went through a doorway',
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ crossed: true }),
}

type FactProbe = { fact: string; is: boolean | number | string }
const isFact = (value: unknown): value is FactProbe => hasShape(value, ['fact', 'is']) && isProbe(value)

const factNamed =
  (fact: string, is: unknown) =>
  (value: unknown): value is FactProbe =>
    isFact(value) && value.fact === fact && value.is === is

const idle: Piece<FactProbe> = {
  kind: 'idle',
  group: 'where',
  menu: 'has got where it was going',
  matches: factNamed('self.idle', true),
  words: () => 'has got where it was going',
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ fact: 'self.idle', is: true }),
}

const blocked: Piece<FactProbe> = {
  kind: 'blocked',
  group: 'where',
  menu: 'is stuck',
  matches: factNamed('self.blocked', true),
  words: () => 'is stuck',
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ fact: 'self.blocked', is: true }),
}

const hidden: Piece<FactProbe> = {
  kind: 'hidden',
  group: 'where',
  menu: 'the player is hiding',
  matches: (value): value is FactProbe =>
    isFact(value) && value.fact === 'pursuit.hidden' && typeof value.is === 'string',
  words: (value) =>
    value.is === '' ? 'the player is not hiding' : `the player is hiding in ${valueWords(value.is)}`,
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ fact: 'pursuit.hidden', is: '' }),
}

const own: Piece<FactProbe> = {
  kind: 'own',
  group: 'true',
  menu: 'its own note is …',
  matches: (value): value is FactProbe =>
    isFact(value) && value.fact.startsWith('self.') && !idle.matches(value) && !blocked.matches(value),
  words: (value) => `its own “${spaced(value.fact.slice(5))}” is ${valueWords(value.is)}`,
  fields: (value) => [
    { key: 'name', label: 'Its own note', kind: 'text', value: value.fact.slice(5) },
    valueField('is', 'Is', value.is),
  ],
  write: (value, key, next) =>
    key === 'name'
      ? { ...value, fact: `self.${String(next)}` }
      : key === 'is'
        ? { ...value, is: valueFrom(value.is, next) }
        : value,
  fresh: () => ({ fact: 'self.seen', is: true }),
}

const fact: Piece<FactProbe> = {
  kind: 'fact',
  group: 'true',
  menu: 'a fact is …',
  matches: (value): value is FactProbe =>
    isFact(value) && !value.fact.startsWith('self.') && !hidden.matches(value),
  words: (value) => `“${spaced(value.fact)}” is ${valueWords(value.is)}`,
  fields: (value, names) => [...factFields('fact', value.fact, names), valueField('is', 'Is', value.is)],
  write: (value, key, next) =>
    key === 'is'
      ? { ...value, is: valueFrom(value.is, next) }
      : key === 'fact' || key === 'fact.name'
        ? { ...value, fact: writeFact(value.fact, key, 'fact', next) }
        : value,
  fresh: (names) => ({ fact: names.facts[0] ?? 'alarm', is: true }),
}

const mode: Piece<{ mode: string; agent?: string }> = {
  kind: 'mode',
  group: 'true',
  menu: 'is in a mode',
  matches: (value): value is { mode: string; agent?: string } =>
    hasShape(value, ['mode'], ['agent']) && typeof (value as { mode: unknown }).mode === 'string',
  words: (value) =>
    `${value.agent === undefined ? '' : `${spaced(value.agent)} `}is in ${modeWords(value.mode)}`.trimStart(),
  fields: (value, names) => [
    {
      key: 'agent',
      label: 'Who',
      kind: 'choice',
      value: value.agent ?? '',
      options: [{ value: '', label: 'itself' }, ...choices(names.agents, value.agent ?? '', spaced)],
    },
    {
      key: 'mode',
      label: 'Mode',
      kind: 'choice',
      value: value.mode,
      options: choices(names.modes, value.mode, modeWords),
    },
  ],
  write(value, key, next) {
    if (key === 'mode') return { ...value, mode: String(next) }
    if (key !== 'agent') return value
    return next === '' ? (rest(value, 'agent') as { mode: string }) : { ...value, agent: String(next) }
  },
  fresh: (names) => ({ mode: names.modes[0] ?? 'patrol' }),
}

const timer: Piece<{ timer: number }> = {
  kind: 'timer',
  group: 'time',
  menu: 'has stood still for a while',
  matches: (value): value is { timer: number } =>
    hasShape(value, ['timer']) && typeof (value as { timer: unknown }).timer === 'number',
  words: (value) => `has stood still more than ${num(value.timer)} s`,
  fields: (value) => [
    {
      key: 'timer',
      label: 'More than',
      kind: 'number',
      unit: 's',
      min: 0,
      max: 600,
      step: 0.5,
      value: value.timer,
    },
  ],
  write: (value, key, next) => (key === 'timer' ? { timer: Number(next) } : value),
  fresh: () => ({ timer: 5 }),
}

const not: Piece<{ not: Probe }> = {
  kind: 'not',
  group: 'true',
  menu: 'not …',
  matches: (value): value is { not: Probe } => hasShape(value, ['not']) && isProbe(value),
  words: (value, names) => {
    const inner = value.not
    const text = conditionWords(inner, names)
    return 'not' in inner ? `not (${text})` : negate(text)
  },
  // A `not` shows the fields of what it turns round; two deep, it is read only.
  fields: (value, names) =>
    isReadOnlyCondition(value) ? [] : (conditionPiece(value.not)?.fields(value.not, names) ?? []),
  write(value, key, next) {
    if (isReadOnlyCondition(value)) return value
    const piece = conditionPiece(value.not)
    return piece === undefined ? value : { not: piece.write(value.not, key, next) }
  },
  fresh: () => ({ not: { sees: true } }),
}

// The special facts come before the general one, so a fact with its own meaning reads as that meaning.
export const CONDITIONS: readonly Piece<Probe>[] = [
  sees,
  heard,
  inLight,
  warmthWithin,
  touching,
  sawHide,
  at,
  crossed,
  idle,
  blocked,
  hidden,
  own,
  fact,
  mode,
  timer,
  not,
] as unknown as readonly Piece<Probe>[]
