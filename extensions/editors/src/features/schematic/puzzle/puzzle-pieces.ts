// A puzzle's conditions and effects as pieces (`../pieces/piece.ts`), the same way a character's are: the sentence a person
// reads, the fields in it, and how one change is written back. A puzzle's conditions (is a fact so, is an item carried)
// and effects (set a fact, give an item, play a cutscene) are not a character's, so they are a table of their own; the
// inspector rows and the add menus read it the same way.
import {
  type Cond,
  condSchema,
  type Effect,
  effectSchema,
  type Point,
  type Value,
} from '@automata/puzzle/sim'
import { choices } from '../pieces/conditions.ts'
import {
  hasShape,
  type Names,
  num,
  type Piece,
  spaced,
  valueField,
  valueFrom,
  valueWords,
} from '../pieces/piece.ts'

const isCond = (value: unknown): value is Cond => condSchema.safeParse(value).success
const isEffect = (value: unknown): value is Effect => effectSchema.safeParse(value).success

const items = (names: Names): readonly string[] => names.items ?? []
const itemWords = (item: string): string => `the ${spaced(item)}`

// ── Conditions ────────────────────────────────────────────────────────────────────────────────────────────────

type FactCond = Extract<Cond, { fact: string }>
const isFact = (value: unknown): value is FactCond =>
  hasShape(value, ['fact'], ['is', 'atLeast', 'atMost']) && isCond(value)

const fact: Piece<FactCond> = {
  kind: 'fact',
  group: 'true',
  menu: 'a fact is …',
  matches: isFact,
  words(value) {
    const name = `“${spaced(value.fact)}”`
    const parts: string[] = []
    if (value.is !== undefined) parts.push(`is ${valueWords(value.is)}`)
    if (value.atLeast !== undefined) parts.push(`is at least ${num(value.atLeast)}`)
    if (value.atMost !== undefined)
      parts.push(`${value.atLeast === undefined ? 'is ' : ''}at most ${num(value.atMost)}`)
    return `${name} ${parts.length === 0 ? 'is set' : parts.join(' and ')}`
  },
  fields(value, names) {
    const fields = [
      {
        key: 'fact',
        label: 'Fact',
        kind: 'choice' as const,
        value: value.fact,
        options: choices(names.facts, value.fact, spaced),
      },
    ]
    if (value.is !== undefined) fields.push(valueField('is', 'Is', value.is) as never)
    const bound = (key: 'atLeast' | 'atMost', label: string, at: number): never =>
      ({ key, label, kind: 'number', min: -1000, max: 1000, step: 1, value: at }) as never
    if (value.atLeast !== undefined) fields.push(bound('atLeast', 'At least', value.atLeast))
    if (value.atMost !== undefined) fields.push(bound('atMost', 'At most', value.atMost))
    return fields
  },
  write(value, key, next) {
    if (key === 'fact') return { ...value, fact: String(next) }
    if (key === 'is' && value.is !== undefined) return { ...value, is: valueFrom(value.is as Value, next) }
    if (key === 'atLeast') return { ...value, atLeast: Number(next) }
    if (key === 'atMost') return { ...value, atMost: Number(next) }
    return value
  },
  fresh: (names) => ({ fact: names.facts[0] ?? 'done', is: true }),
}

const has: Piece<{ has: string }> = {
  kind: 'has',
  group: 'where',
  menu: 'is carrying an item',
  matches: (value): value is { has: string } => hasShape(value, ['has']) && isCond(value),
  words: (value) => `has ${itemWords(value.has)}`,
  fields: (value, names) => [
    {
      key: 'has',
      label: 'Item',
      kind: 'choice',
      value: value.has,
      options: choices(items(names), value.has, spaced),
    },
  ],
  write: (value, key, next) => (key === 'has' ? { has: String(next) } : value),
  fresh: (names) => ({ has: items(names)[0] ?? 'key' }),
}

/** A sentence turned round: "is yes" becomes "is not yes", "has the crank" "does not have the crank". */
function negate(text: string): string {
  if (text.startsWith('has ')) return `does not have ${text.slice(4)}`
  return text.includes(' is ') ? text.replace(' is ', ' is not ') : `not (${text})`
}

const not: Piece<{ not: Cond }> = {
  kind: 'not',
  group: 'true',
  menu: 'not …',
  matches: (value): value is { not: Cond } => {
    if (!hasShape(value, ['not']) || !isCond(value)) return false
    const inner = (value as { not: Cond }).not
    // Two deep, or around "any", it is read only.
    return puzzleCondPiece(inner) !== undefined && !('not' in inner)
  },
  words: (value, names) => negate(puzzleCondWords(value.not, names)),
  fields: (value, names) => puzzleCondPiece(value.not)?.fields(value.not, names) ?? [],
  write(value, key, next) {
    const piece = puzzleCondPiece(value.not)
    return piece === undefined ? value : { not: piece.write(value.not, key, next) }
  },
  fresh: (names) => ({ not: has.fresh(names) }),
}

/** What the add menu offers for a condition. */
export const PUZZLE_CONDITIONS: readonly Piece<Cond>[] = [fact, has, not] as unknown as readonly Piece<Cond>[]

/** The piece for a condition, or `undefined` for one the table does not change (an "any", a "not" inside a "not"). */
export function puzzleCondPiece(cond: unknown): Piece<Cond> | undefined {
  return PUZZLE_CONDITIONS.find((piece) => piece.matches(cond))
}

export function puzzleCondWords(cond: Cond, names: Names): string {
  const piece = puzzleCondPiece(cond)
  if (piece !== undefined) return piece.words(cond, names)
  if ('any' in cond) return `any of: ${cond.any.map((c) => puzzleCondWords(c, names)).join('; ')}`
  return 'something the editor cannot show yet'
}

// ── Effects ───────────────────────────────────────────────────────────────────────────────────────────────────

const only =
  <K extends string>(kind: K, ...optional: string[]) =>
  (value: unknown): boolean =>
    hasShape(value, [kind], optional) && isEffect(value)

const set: Piece<{ set: string; to: Value }> = {
  kind: 'set',
  group: 'change',
  menu: 'set a fact',
  matches: (value): value is { set: string; to: Value } => hasShape(value, ['set', 'to']) && isEffect(value),
  words: (value) => `set “${spaced(value.set)}” to ${valueWords(value.to)}`,
  fields: (value, names) => [
    {
      key: 'set',
      label: 'Fact',
      kind: 'choice',
      value: value.set,
      options: choices(names.facts, value.set, spaced),
    },
    valueField('to', 'To', value.to),
  ],
  write: (value, key, next) =>
    key === 'set'
      ? { ...value, set: String(next) }
      : key === 'to'
        ? { ...value, to: valueFrom(value.to, next) }
        : value,
  fresh: (names) => ({ set: names.facts[0] ?? 'done', to: true }),
}

const add: Piece<{ add: string; by: number }> = {
  kind: 'add',
  group: 'change',
  menu: 'change a count',
  matches: (value): value is { add: string; by: number } => hasShape(value, ['add', 'by']) && isEffect(value),
  words: (value) =>
    value.by < 0
      ? `take ${num(-value.by)} off “${spaced(value.add)}”`
      : `add ${num(value.by)} to “${spaced(value.add)}”`,
  fields: (value, names) => [
    {
      key: 'add',
      label: 'Fact',
      kind: 'choice',
      value: value.add,
      options: choices(names.facts, value.add, spaced),
    },
    { key: 'by', label: 'By', kind: 'number', min: -1000, max: 1000, step: 1, value: value.by },
  ],
  write: (value, key, next) =>
    key === 'add' ? { ...value, add: String(next) } : key === 'by' ? { ...value, by: Number(next) } : value,
  fresh: (names) => ({ add: names.facts[0] ?? 'count', by: 1 }),
}

const itemEffect = (
  kind: 'give' | 'take',
  menu: string,
  say: (item: string) => string,
): Piece<Record<string, string>> => ({
  kind,
  group: 'change',
  menu,
  matches: (value): value is Record<string, string> => only(kind)(value),
  words: (value) => say(itemWords(value[kind] ?? '')),
  fields: (value, names) => [
    {
      key: kind,
      label: 'Item',
      kind: 'choice',
      value: value[kind] ?? '',
      options: choices(items(names), value[kind] ?? '', spaced),
    },
  ],
  write: (value, key, next) => (key === kind ? { [kind]: String(next) } : value),
  fresh: (names) => ({ [kind]: items(names)[0] ?? 'key' }),
})

type Noise = { noise: { at: Point | string; loudness: number; kind: string } }
const noise: Piece<Noise> = {
  kind: 'noise',
  group: 'tell',
  menu: 'make a noise',
  matches: (value): value is Noise => only('noise')(value),
  words({ noise: { at, loudness, kind } }) {
    const where = typeof at === 'string' ? spaced(at) : `the point ${num(at.x)} across, ${num(at.z)} down`
    return `make ${/^[aeiou]/i.test(spaced(kind)) ? 'an' : 'a'} ${spaced(kind)} noise at ${where}, loudness ${num(loudness)}`
  },
  fields({ noise: { at, loudness, kind } }, names) {
    const fields: ReturnType<Piece<Noise>['fields']> = [
      { key: 'kind', label: 'Kind of noise', kind: 'text', value: kind },
      {
        key: 'loudness',
        label: 'How loud',
        kind: 'number',
        unit: 'm',
        min: 0,
        max: 60,
        step: 1,
        value: loudness,
      },
    ]
    if (typeof at === 'string')
      fields.push({
        key: 'at',
        label: 'Where',
        kind: 'choice',
        value: at,
        options: choices(names.places, at, spaced),
      })
    return fields
  },
  write(value, key, next) {
    const n = value.noise
    if (key === 'kind') return { noise: { ...n, kind: String(next) } }
    if (key === 'loudness') return { noise: { ...n, loudness: Number(next) } }
    if (key === 'at') return { noise: { ...n, at: String(next) } }
    return value
  },
  fresh: (names) => ({ noise: { at: names.places[0] ?? 'here', loudness: 6, kind: 'noise' } }),
}

const textEffect = (
  kind: 'cutscene' | 'dialogue' | 'call',
  menu: string,
  say: (text: string) => string,
  label: string,
  fallback: string,
  options?: (names: Names) => readonly string[],
): Piece<Record<string, string>> => ({
  kind,
  group: 'tell',
  menu,
  matches: (value): value is Record<string, string> => only(kind)(value),
  words: (value) => say(value[kind] ?? ''),
  fields: (value, names) => [
    options === undefined
      ? { key: kind, label, kind: 'text', value: value[kind] ?? '' }
      : {
          key: kind,
          label,
          kind: 'choice',
          value: value[kind] ?? '',
          options: choices(options(names), value[kind] ?? ''),
        },
  ],
  write: (value, key, next) => (key === kind ? { [kind]: String(next) } : value),
  fresh: (names) => ({ [kind]: options?.(names)[0] ?? fallback }),
})

const flag = (kind: 'checkpoint' | 'keypad', menu: string, words: string): Piece<Record<string, true>> => ({
  kind,
  group: 'tell',
  menu,
  matches: (value): value is Record<string, true> => only(kind)(value),
  words: () => words,
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ [kind]: true }),
})

type Exit = { exit: { to: string; cutscene: string } }
const exit: Piece<Exit> = {
  kind: 'exit',
  group: 'tell',
  menu: 'leave the scene',
  matches: (value): value is Exit => only('exit')(value),
  words: ({ exit: e }) => `leave for ${spaced(e.to)}, with the cutscene ${spaced(e.cutscene)}`,
  fields: ({ exit: e }) => [
    { key: 'to', label: 'Leave for', kind: 'text', value: e.to },
    { key: 'cutscene', label: 'With the cutscene', kind: 'text', value: e.cutscene },
  ],
  write: (value, key, next) =>
    key === 'to' || key === 'cutscene' ? { exit: { ...value.exit, [key]: String(next) } } : value,
  fresh: () => ({ exit: { to: 'next', cutscene: 'leave' } }),
}

/** What the add menu offers for an effect. */
export const PUZZLE_EFFECTS: readonly Piece<Effect>[] = [
  set,
  add,
  itemEffect('give', 'pick up an item', (item) => `pick up ${item}`),
  itemEffect('take', 'lose an item', (item) => `lose ${item}`),
  noise,
  textEffect('cutscene', 'play a cutscene', (t) => `play the cutscene ${spaced(t)}`, 'Cutscene', 'scene'),
  textEffect(
    'dialogue',
    'start a conversation',
    (t) => `start the conversation ${spaced(t)}`,
    'Conversation',
    'talk',
  ),
  flag('checkpoint', 'save a checkpoint', 'save a checkpoint'),
  flag('keypad', 'open the keypad', 'open the keypad'),
  exit,
  textEffect(
    'call',
    'something the game’s code does',
    (t) => `do “${t}” (in the game’s code)`,
    'The game’s code does',
    'stop',
    (names) => names.hooks,
  ),
] as unknown as readonly Piece<Effect>[]

export function puzzleEffectPiece(effect: unknown): Piece<Effect> | undefined {
  return PUZZLE_EFFECTS.find((piece) => piece.matches(effect))
}

export function puzzleEffectWords(effect: Effect, names: Names): string {
  const piece = puzzleEffectPiece(effect)
  return piece === undefined ? 'something the editor cannot show yet' : piece.words(effect, names)
}
