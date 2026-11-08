// Every kind of action a switch, a patrol stop or a rule can do, as a piece (`piece.ts`). Same shape as the
// conditions: the sentence a person reads, its fields, how a change is written back, and a new one that means something.
import { effectSchema, type SysEffect } from '@automata/systems/sim'
import type { Field } from '../../../shared/fields.ts'
import { choices } from './conditions.ts'
import {
  hasShape,
  modeWords,
  type Names,
  num,
  type Piece,
  spaced,
  valueField,
  valueFrom,
  valueWords,
} from './piece.ts'
import { placeFields, placeWords, type Spot, writePlace } from './places-field.ts'

export { placeChoices } from './places-field.ts'

const isEffect = (value: unknown): value is SysEffect => effectSchema.safeParse(value).success

/** The piece for an action's kind, or `undefined` for a kind the table lacks. */
export function actionPiece(effect: unknown): Piece<SysEffect> | undefined {
  return ACTIONS.find((piece) => piece.matches(effect))
}

export function actionWords(effect: SysEffect, names: Names): string {
  const piece = actionPiece(effect)
  return piece === undefined ? 'something the editor cannot show yet' : piece.words(effect, names)
}

/** An action the editor shows but does not change: a kind the table lacks. */
export const isReadOnlyAction = (effect: unknown): boolean => actionPiece(effect) === undefined

const seconds = (key: string, label: string, value: number): Field => ({
  key,
  label,
  kind: 'number',
  unit: 's',
  min: 0,
  max: 600,
  step: 0.5,
  value,
})

const modeField = (key: string, label: string, value: string, names: Names): Field => ({
  key,
  label,
  kind: 'choice',
  value,
  options: choices(names.modes, value, modeWords),
})

const whoField = (value: string | undefined, names: Names): Field => ({
  key: 'agent',
  label: 'Who',
  kind: 'choice',
  value: value ?? '',
  options: [{ value: '', label: 'itself' }, ...choices(names.agents, value ?? '', spaced)],
})

const only =
  (kind: string, ...keys: string[]) =>
  (value: unknown): boolean =>
    hasShape(value, [kind], keys) && isEffect(value)

const setMode: Piece<{ setMode: string; agent?: string }> = {
  kind: 'setMode',
  group: 'change',
  menu: 'switch to a mode',
  matches: (value): value is { setMode: string; agent?: string } => only('setMode', 'agent')(value),
  words: (value) =>
    value.agent === undefined
      ? `switch to ${modeWords(value.setMode)}`
      : `switch ${spaced(value.agent)} to ${modeWords(value.setMode)}`,
  fields: (value, names) => [
    whoField(value.agent, names),
    modeField('setMode', 'Mode', value.setMode, names),
  ],
  write(value, key, next) {
    if (key === 'setMode') return { ...value, setMode: String(next) }
    if (key !== 'agent') return value
    return next === '' ? { setMode: value.setMode } : { ...value, agent: String(next) }
  },
  fresh: (names) => ({ setMode: names.modes[0] ?? 'patrol' }),
}

const goTo: Piece<{ goTo: Spot }> = {
  kind: 'goTo',
  group: 'move',
  menu: 'go to a place',
  matches: (value): value is { goTo: Spot } => only('goTo')(value),
  words: (value) => `go to ${placeWords(value.goTo)}`,
  fields: (value, names) => placeFields('place', 'Where', value.goTo, names),
  write: (value, key, next) => ({ goTo: writePlace(value.goTo, key, 'place', next) }),
  fresh: (names) => ({ goTo: names.places[0] ?? 'player' }),
}

const flee: Piece<{ flee: string }> = {
  kind: 'flee',
  group: 'move',
  menu: 'run from something',
  matches: (value): value is { flee: string } => only('flee')(value),
  words: (value) => `run from ${placeWords(value.flee)}`,
  fields: (value, names) => placeFields('place', 'From', value.flee, names).slice(0, 1),
  write: (value, key, next) => (key === 'place' ? { flee: String(next) } : value),
  fresh: () => ({ flee: 'player' }),
}

type Noise = { noise: { at: Spot; loudness: number; kind: string } }
const noise: Piece<Noise> = {
  kind: 'noise',
  group: 'tell',
  menu: 'make a noise',
  matches: (value): value is Noise => only('noise')(value),
  words: ({ noise: { at, loudness, kind } }) =>
    `make ${/^[aeiou]/i.test(spaced(kind)) ? 'an' : 'a'} ${spaced(kind)} noise ${at === 'self' ? 'here' : `at ${placeWords(at)}`}, loudness ${num(loudness)}`,
  fields: ({ noise: { at, loudness, kind } }, names) => [
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
    ...placeFields('at', 'Where', at, names),
  ],
  write(value, key, next) {
    const n = value.noise
    if (key === 'kind') return { noise: { ...n, kind: String(next) } }
    if (key === 'loudness') return { noise: { ...n, loudness: Number(next) } }
    return { noise: { ...n, at: writePlace(n.at, key, 'at', next) } }
  },
  fresh: () => ({ noise: { at: 'self', loudness: 6, kind: 'noise' } }),
}

type SetFact = { set: string; to: boolean | number | string }
const isSetFact = (value: unknown): value is SetFact => hasShape(value, ['set', 'to']) && isEffect(value)

const resetWait: Piece<SetFact> = {
  kind: 'resetWait',
  group: 'change',
  menu: 'reset its wait',
  matches: (value): value is SetFact => isSetFact(value) && value.set === 'self.timer' && value.to === 0,
  words: () => 'reset its wait',
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ set: 'self.timer', to: 0 }),
}

const setFact: Piece<SetFact> = {
  kind: 'set',
  group: 'change',
  menu: 'set a fact',
  matches: (value): value is SetFact => isSetFact(value) && !resetWait.matches(value),
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
  fresh: (names) => ({ set: names.facts[0] ?? 'alarm', to: true }),
}

const emit = (kind: 'cutscene' | 'line', menu: string, say: (id: string) => string, label: string) => {
  const piece: Piece<{ emit: Record<string, string> }> = {
    kind,
    group: 'tell',
    menu,
    matches: (value): value is { emit: Record<string, string> } =>
      only('emit')(value) && kind in (value as { emit: object }).emit,
    words: (value) => say(String(value.emit[kind])),
    fields: (value) => [{ key: kind, label, kind: 'text', value: String(value.emit[kind]) }],
    write: (value, key, next) => (key === kind ? { emit: { [kind]: String(next) } } : value),
    fresh: () => ({ emit: { [kind]: kind === 'line' ? 'line' : 'scene' } }),
  }
  return piece
}

const cutscene = emit('cutscene', 'play a cutscene', (id) => `play the cutscene ${spaced(id)}`, 'Cutscene')
const line = emit('line', 'say a line', (id) => `say the line ${spaced(id)}`, 'Line')

const caught: Piece<{ emit: { caught: string } }> = {
  kind: 'caught',
  group: 'tell',
  menu: 'catch the player',
  matches: (value): value is { emit: { caught: string } } =>
    only('emit')(value) && 'caught' in (value as { emit: object }).emit,
  words: () => 'catch the player',
  fields: () => [],
  write: (value) => value,
  fresh: () => ({ emit: { caught: 'player' } }),
}

const call: Piece<{ call: string }> = {
  kind: 'call',
  group: 'tell',
  menu: 'something the game’s code does',
  matches: (value): value is { call: string } => only('call')(value),
  words: (value) => `do “${value.call}” (in the game’s code)`,
  fields: (value, names) => [
    {
      key: 'call',
      label: 'The game’s code does',
      kind: 'choice',
      value: value.call,
      options: choices(names.hooks, value.call),
    },
  ],
  write: (value, key, next) => (key === 'call' ? { call: String(next) } : value),
  fresh: (names) => ({ call: names.hooks[0] ?? 'stop' }),
}

type Follow = { followThrough: { portal: string; delay: number; then: string; clear?: number } }
const followThrough: Piece<Follow> = {
  kind: 'followThrough',
  group: 'move',
  menu: 'follow the player through a doorway',
  matches: (value): value is Follow => only('followThrough')(value),
  words: ({ followThrough: f }) =>
    `follow the player through ${
      f.portal === 'crossed'
        ? 'the doorway she used'
        : `the doorway from ${f.portal.split('>').map(spaced).join(' to ')}`
    } after ${num(f.delay)} s, then ${modeWords(f.then)}`,
  fields: ({ followThrough: f }, names) => [
    {
      key: 'portal',
      label: 'Doorway',
      kind: 'choice',
      value: f.portal,
      options: [
        { value: 'crossed', label: 'the doorway she just used' },
        ...names.doorways.map((value) => ({ value, label: value.split('>').map(spaced).join(' to ') })),
      ],
    },
    seconds('delay', 'After', f.delay),
    modeField('then', 'Then', f.then, names),
  ],
  write(value, key, next) {
    const f = value.followThrough
    if (key === 'portal') return { followThrough: { ...f, portal: String(next) } }
    if (key === 'delay') return { followThrough: { ...f, delay: Number(next) } }
    if (key === 'then') return { followThrough: { ...f, then: String(next) } }
    return value
  },
  fresh: (names) => ({ followThrough: { portal: 'crossed', delay: 2, then: names.modes[0] ?? 'patrol' } }),
}

type Ambush = {
  ambush: { id: string; agent: string; mode: string; at: Spot; sting: number; grace: number; then: string }
}
let ambushes = 0
const ambush: Piece<Ambush> = {
  kind: 'ambush',
  group: 'move',
  menu: 'lie in wait',
  matches: (value): value is Ambush => only('ambush')(value),
  words: ({ ambush: a }) =>
    `hide, then appear at ${placeWords(a.at)} after ${num(a.sting)} s, wait ${num(a.grace)} s, then ${modeWords(a.then)}`,
  fields: ({ ambush: a }, names) => [
    {
      key: 'agent',
      label: 'Who',
      kind: 'choice',
      value: a.agent,
      options: choices(names.agents, a.agent, spaced),
    },
    modeField('mode', 'Hides in', a.mode, names),
    ...placeFields('at', 'Appears at', a.at, names),
    seconds('sting', 'After', a.sting),
    seconds('grace', 'Then waits', a.grace),
    modeField('then', 'Then', a.then, names),
  ],
  write(value, key, next) {
    const a = value.ambush
    if (key === 'agent' || key === 'mode' || key === 'then') return { ambush: { ...a, [key]: String(next) } }
    if (key === 'sting' || key === 'grace') return { ambush: { ...a, [key]: Number(next) } }
    return { ambush: { ...a, at: writePlace(a.at, key, 'at', next) } }
  },
  // The one-time name is the editor's, never asked for.
  fresh(names) {
    ambushes += 1
    const mode = names.modes[0] ?? 'patrol'
    return {
      ambush: {
        id: `ambush-${ambushes}`,
        agent: names.agents[0] ?? '',
        mode,
        at: names.places[0] ?? 'player',
        sting: 2,
        grace: 1,
        then: names.modes[1] ?? mode,
      },
    }
  },
}

export const ACTIONS: readonly Piece<SysEffect>[] = [
  setMode,
  goTo,
  flee,
  followThrough,
  ambush,
  resetWait,
  setFact,
  noise,
  cutscene,
  line,
  caught,
  call,
] as unknown as readonly Piece<SysEffect>[]
