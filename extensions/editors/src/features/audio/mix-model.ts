// The mix: how loud everything is overall, and the ducks, which quiet some sounds while others play ("While a voice
// plays, music drops 6 dB"). In the file a duck's drop is a negative number of dB; on screen it is the plain number of dB
// it drops by. Both are heard in play: the player scales every sound by the overall volume and applies the ducks.
import type { AudioContent, BusId, DuckRule } from '@automata/audio-synth'
import type { ContentEdit } from '@automata/editor/kit/documents'
import { appendEdits, type Field, setOrInsert } from '../../shared/fields.ts'
import { busWords } from './audio-model.ts'

const BUSES: readonly BusId[] = ['music', 'sfx', 'ui', 'voice']

/** Overall volume, 0 to 1: the file's `master_gain`, which is full when the file leaves it out. */
export const masterField = (content: AudioContent): Field => ({
  key: 'master_gain',
  label: 'Overall volume',
  kind: 'number',
  min: 0,
  max: 1,
  step: 0.05,
  value: content.master_gain ?? 1,
})

export const masterEdit = (content: AudioContent, value: number): ContentEdit =>
  setOrInsert(['master_gain'], content.master_gain, value)

// A bus as the thing that plays ("a voice plays") and as what drops ("music drops", "effects drop").
const PLAYS: Readonly<Record<BusId, string>> = {
  music: 'music',
  sfx: 'an effect',
  ui: 'a menu sound',
  voice: 'a voice',
}
const DROPS: Readonly<Record<BusId, { name: string; plural: boolean }>> = {
  music: { name: 'music', plural: false },
  sfx: { name: 'effects', plural: true },
  ui: { name: 'menus', plural: true },
  voice: { name: 'voices', plural: true },
}

const list = (words: readonly string[]): string =>
  words.length <= 1
    ? (words[0] ?? '')
    : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`
const secondsWords = (value: number): string => `${String(value)} s`

export interface DuckLine {
  readonly index: number
  readonly words: string
  readonly fields: readonly Field[]
  /** The buses that can drop, each with whether this duck drops it. */
  readonly buses: readonly { readonly bus: BusId; readonly label: string; readonly on: boolean }[]
}

function duckLine(rule: DuckRule, index: number): DuckLine {
  const dropped = rule.duck.map((bus) => DROPS[bus])
  const verb = dropped.length > 1 || dropped.some((one) => one.plural) ? 'drop' : 'drops'
  const subject = dropped.length === 0 ? 'nothing' : list(dropped.map((one) => one.name))
  const depth = Math.abs(rule.db)
  const timing = `${rule.attack === 0 ? 'at once' : `in ${secondsWords(rule.attack)}`}, back ${rule.release === 0 ? 'at once' : `in ${secondsWords(rule.release)}`}`
  const seconds = (key: string, label: string, value: number): Field => ({
    key,
    label,
    kind: 'number',
    unit: 's',
    min: 0,
    max: 10,
    step: 0.05,
    value,
  })
  return {
    index,
    words: `While ${PLAYS[rule.bus]} plays, ${subject} ${verb} ${String(depth)} dB (${timing})`,
    fields: [
      {
        key: 'bus',
        label: 'While this plays',
        kind: 'choice',
        value: rule.bus,
        options: BUSES.map((bus) => ({ value: bus, label: busWords(bus) })),
      },
      { key: 'db', label: 'It drops by', kind: 'number', unit: 'dB', min: 0, max: 60, step: 1, value: depth },
      seconds('attack', 'Drops in', rule.attack),
      seconds('release', 'Comes back in', rule.release),
    ],
    buses: BUSES.map((bus) => ({ bus, label: busWords(bus), on: rule.duck.includes(bus) })),
  }
}

export const duckLines = (content: AudioContent): DuckLine[] => (content.duck ?? []).map(duckLine)

/** A field of a duck set; the drop is written as the negative dB the file holds. */
export function duckFieldEdit(
  index: number,
  rule: DuckRule,
  field: Field,
  value: number | string,
): ContentEdit {
  if (field.key === 'db') return setOrInsert(['duck', index, 'db'], rule.db, value === 0 ? 0 : -Number(value))
  return setOrInsert(
    ['duck', index, field.key],
    (rule as unknown as Record<string, unknown>)[field.key],
    value,
  )
}

/** A bus turned on or off for a duck to drop. A duck always drops at least one bus, so the last stays on. */
export function duckBusEdits(index: number, rule: DuckRule, bus: BusId, on: boolean): ContentEdit[] {
  if (on === rule.duck.includes(bus)) return []
  if (!on && rule.duck.length <= 1) return []
  const next = on ? [...rule.duck, bus] : rule.duck.filter((one) => one !== bus)
  return [{ keyPath: ['duck', index, 'duck'], expected: [...rule.duck], set: next }]
}

/** A new duck: a voice quiets the music a little, so it is useful the moment it is added. */
export const addDuckEdits = (content: AudioContent): ContentEdit[] =>
  appendEdits(['duck'], content.duck !== undefined, {
    bus: 'voice',
    duck: ['music'],
    db: -6,
    attack: 0.1,
    release: 0.5,
  })
