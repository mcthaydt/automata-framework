// `feel.toml` as a person reads it: each entry is "When something happens", and each of its rows is a sentence ("Shake
// the screen", "Freeze the action") with fields named for what they do, never for their keys. The edits are the kit's
// content edits by key path, so the file keeps its comments and order.

import type { ContentEdit } from '@automata/editor/kit/documents'
import {
  DEFAULT_LIMITS,
  DEFAULT_SQUASH,
  type FeelContent,
  type FeelEntry,
  type Limits,
  resolveLimits,
  type SpringTuning,
} from '@automata/feel'
import { eventWords } from '../../shared/event-words.ts'
import { appendEdits, type Field, setOrInsert } from '../../shared/fields.ts'
import type { Problem } from '../../shared/toml-session.ts'

export { eventWords }

export type Channel = 'camera' | 'pose' | 'visual' | 'word' | 'haptic' | 'audio'

/** Where one effect is in its entry: its channel and its row there. */
export interface EffectPlace {
  readonly channel: Channel
  readonly index: number
}

/** A field of a sentence: the shared kind plus what to say beside it and the value that means "not written". */
export type EffectField = Field & {
  /** A choice that sets this value removes the key, so the file stays as short as the person wrote it. */
  readonly fallback?: number | string
  /** A line under the field (what it means at its limit). */
  readonly hint?: string
}

export interface EffectLine extends EffectPlace {
  readonly words: string
  readonly fields: readonly EffectField[]
}

/** The effects a person can add, in the order the add menu offers them. */
export type EffectKind = 'shake' | 'freeze' | 'flash' | 'tint' | 'squash' | 'word' | 'rumble' | 'sound'

export const EFFECT_KINDS: readonly { readonly kind: EffectKind; readonly words: string }[] = [
  { kind: 'shake', words: 'Shake the screen' },
  { kind: 'freeze', words: 'Freeze the action' },
  { kind: 'flash', words: 'Flash the screen' },
  { kind: 'tint', words: 'Tint the screen' },
  { kind: 'squash', words: 'Squash' },
  { kind: 'word', words: 'Show a word' },
  { kind: 'rumble', words: 'Rumble' },
  { kind: 'sound', words: 'Play a sound' },
]

// What a new effect starts as: a value a person can feel at once and then tune.
const NEW_ROW: Readonly<Record<EffectKind, { readonly channel: Channel; readonly row: object }>> = {
  shake: { channel: 'camera', row: { shake: 0.3 } },
  freeze: { channel: 'pose', row: { hit_stop_ms: 60 } },
  flash: { channel: 'visual', row: { flash: 'white', frames: 2 } },
  tint: { channel: 'visual', row: { tint: 'red', ms: 150, alpha: 0.4 } },
  squash: { channel: 'visual', row: { squash: 0.3 } },
  word: { channel: 'word', row: { key: 'word', words: 'Pow!' } },
  rumble: { channel: 'haptic', row: { strong: 0.5, weak: 0.3, ms: 100 } },
  sound: { channel: 'audio', row: { cue: 'hit' } },
}

const CHANNELS: readonly Channel[] = ['camera', 'pose', 'visual', 'word', 'haptic', 'audio']

const strength = (key: string, label: string, value: number): EffectField => ({
  key,
  label,
  kind: 'number',
  min: 0,
  max: 1,
  step: 0.05,
  value,
})
const ms = (key: string, label: string, value: number, max = 1000): EffectField => ({
  key,
  label,
  unit: 'ms',
  kind: 'number',
  min: 1,
  max,
  step: 10,
  value,
})
const choice = (
  key: string,
  label: string,
  value: string,
  options: readonly { readonly value: string; readonly label: string }[],
  fallback: string,
): EffectField => ({ key, label, kind: 'choice', value, options, fallback })
const text = (key: string, label: string, value: string): EffectField => ({ key, label, kind: 'text', value })

function visualLine(
  row: NonNullable<FeelEntry['visual']>[number],
  index: number,
  limits: Limits,
): EffectLine {
  if (row.flash !== undefined)
    return {
      channel: 'visual',
      index,
      words: 'Flash the screen',
      fields: [
        text('flash', 'Colour', row.flash),
        {
          key: 'frames',
          label: 'How many frames',
          kind: 'number',
          min: 1,
          max: 30,
          step: 1,
          value: row.frames ?? 1,
        },
        {
          // Unset plays the most the limits allow, so the field has no default to fall back to.
          ...strength('alpha', 'How bright', row.alpha ?? limits.flash_alpha),
          ...(row.alpha === undefined
            ? { hint: `As bright as allowed (${String(limits.flash_alpha)})` }
            : {}),
        },
      ],
    }
  if (row.tint !== undefined)
    return {
      channel: 'visual',
      index,
      words: 'Tint the screen',
      fields: [
        text('tint', 'Colour', row.tint),
        ms('ms', 'How long', row.ms ?? 1),
        strength('alpha', 'How strong', row.alpha ?? 0),
      ],
    }
  return {
    channel: 'visual',
    index,
    words: 'Squash',
    fields: [
      {
        key: 'squash',
        label: 'How much',
        kind: 'number',
        min: 0.05,
        max: 2,
        step: 0.05,
        value: row.squash ?? 0,
      },
    ],
  }
}

/** Every effect of one entry, as sentences, channel by channel. */
export function effectLines(entry: FeelEntry, limits: Limits = DEFAULT_LIMITS): EffectLine[] {
  const lines: EffectLine[] = []
  for (const channel of CHANNELS) {
    const rows = entry[channel] ?? []
    rows.forEach((row, index) => {
      if (channel === 'camera' && 'shake' in row)
        lines.push({
          channel,
          index,
          words: 'Shake the screen',
          fields: [
            { ...strength('shake', 'How hard', row.shake), hint: `At full: ${String(limits.shake_px)} px` },
          ],
        })
      else if (channel === 'pose' && 'hit_stop_ms' in row)
        lines.push({
          channel,
          index,
          words: 'Freeze the action',
          fields: [
            ms('hit_stop_ms', 'How long', row.hit_stop_ms),
            choice(
              'target',
              'What freezes',
              row.target ?? 'everything',
              [
                { value: 'everything', label: 'Everything' },
                { value: 'subject', label: 'Only what was hit' },
              ],
              'everything',
            ),
          ],
        })
      else if (channel === 'visual')
        lines.push(visualLine(row as NonNullable<FeelEntry['visual']>[number], index, limits))
      else if (channel === 'word' && 'key' in row)
        lines.push({
          channel,
          index,
          words: 'Show a word',
          fields: [
            text('words', 'What it says', row.words ?? ''),
            choice(
              'at',
              'Where',
              row.at ?? 'middle',
              [
                { value: 'subject', label: 'Over what was hit' },
                { value: 'middle', label: 'Middle of the screen' },
              ],
              'middle',
            ),
            ms('ms', 'How long', row.ms ?? 800, 5000),
          ],
        })
      else if (channel === 'haptic' && 'strong' in row)
        lines.push({
          channel,
          index,
          words: 'Rumble',
          fields: [
            strength('strong', 'Strong motor', row.strong),
            strength('weak', 'Light motor', row.weak),
            ms('ms', 'How long', row.ms),
            {
              key: 'phone_ms',
              label: 'Phone buzz',
              kind: 'number',
              unit: 'ms',
              min: 0,
              max: 1000,
              step: 10,
              value: row.phone_ms ?? 0,
              fallback: 0,
            },
          ],
        })
      else if (channel === 'audio' && 'cue' in row)
        lines.push({ channel, index, words: 'Play a sound', fields: [text('cue', 'Which sound', row.cue)] })
    })
  }
  return lines
}

export function fieldEdit(
  entry: number,
  place: EffectPlace,
  key: string,
  expected: unknown,
  set: number | string,
): ContentEdit {
  return { keyPath: ['entry', entry, place.channel, place.index, key], expected, set }
}

/**
 * The edit a field's new value makes: a value equal to the field's `fallback` removes the key (nothing, when the key was
 * never there), an absent key gets an insert, and anything else changes the value in place.
 */
export function fieldChange(
  entry: number,
  place: EffectPlace,
  field: EffectField,
  before: unknown,
  value: number | string,
): ContentEdit | undefined {
  const keyPath = ['entry', entry, place.channel, place.index, field.key]
  if (field.fallback !== undefined && value === field.fallback)
    return before === undefined ? undefined : { keyPath, remove: true }
  return setOrInsert(keyPath, before, value)
}

/** What to say under a field whose value is above a limit; the game plays the limit instead. */
export function limitNote(content: FeelContent, line: EffectLine, key: string): string | undefined {
  const limits = resolveLimits(content)
  const field = line.fields.find((candidate) => candidate.key === key)
  if (field?.kind !== 'number') return undefined
  if (line.channel === 'pose' && key === 'hit_stop_ms' && field.value > limits.hit_stop_ms)
    return `Above the longest freeze. Players feel ${String(limits.hit_stop_ms)} ms.`
  if (line.channel === 'visual' && key === 'frames' && field.value > limits.flash_frames)
    return `Above the most flash frames. Players see ${String(limits.flash_frames)}.`
  if (
    line.channel === 'visual' &&
    key === 'alpha' &&
    line.words === 'Flash the screen' &&
    field.value > limits.flash_alpha
  )
    return `Brighter than allowed. Players see ${String(limits.flash_alpha)}.`
  return undefined
}

export function addFeelEdit(content: FeelContent, on: string): ContentEdit[] {
  return appendEdits(['entry'], content.entry !== undefined, { on })
}

export const removeFeelEdit = (entry: number): ContentEdit => ({ keyPath: ['entry', entry], remove: true })

/** A word is filed under its event: `player.hit.word`, then `player.hit.word2`. A person never sees the name. */
const wordKey = (entry: FeelEntry): string =>
  `${entry.on}.word${(entry.word?.length ?? 0) === 0 ? '' : String((entry.word?.length ?? 0) + 1)}`

export function addEffectEdit(entry: FeelEntry, index: number, kind: EffectKind): ContentEdit {
  const { channel } = NEW_ROW[kind]
  const row = kind === 'word' ? { key: wordKey(entry), words: 'Pow!' } : NEW_ROW[kind].row
  return entry[channel] === undefined
    ? { keyPath: ['entry', index, channel], insert: [row] }
    : { keyPath: ['entry', index, channel], insert: row }
}

export const removeEffectEdit = (entry: number, place: EffectPlace): ContentEdit => ({
  keyPath: ['entry', entry, place.channel, place.index],
  remove: true,
})

export interface LimitLine {
  readonly key: keyof Limits
  readonly label: string
  readonly unit?: string | undefined
  readonly min: number
  readonly max: number
  readonly step: number
  readonly value: number
}

const LIMITS: readonly Omit<LimitLine, 'value'>[] = [
  { key: 'shake_px', label: 'Most shake', unit: 'px', min: 0, max: 50, step: 1 },
  { key: 'hit_stop_ms', label: 'Longest freeze', unit: 'ms', min: 0, max: 1000, step: 10 },
  { key: 'flash_frames', label: 'Most flash frames', min: 0, max: 30, step: 1 },
  { key: 'flash_alpha', label: 'Brightest flash', min: 0, max: 1, step: 0.05 },
]

/** The hard limits, each with the file's value or the default the game plays with. */
export function limitLines(content: FeelContent): LimitLine[] {
  return LIMITS.map((limit) => ({
    ...limit,
    value: content.limits?.[limit.key] ?? DEFAULT_LIMITS[limit.key],
  }))
}

export function limitEdit(content: FeelContent, key: keyof Limits, value: number): ContentEdit {
  if (content.limits === undefined) return { keyPath: ['limits'], insert: { [key]: value } }
  const current = content.limits[key]
  return current === undefined
    ? { keyPath: ['limits', key], insert: value }
    : { keyPath: ['limits', key], expected: current, set: value }
}

/** A problem in Feel's words: the schema's "two entries answer" names the event as the panel does. */
export function feelProblemWords(problem: Problem, entries: readonly FeelEntry[]): string {
  const [first, index, key] = problem.keyPath
  if (first === 'entry' && typeof index === 'number' && key === 'on' && problem.keyPath.length === 3) {
    const on = entries[index]?.on
    if (on !== undefined && /^two entries answer/i.test(problem.message))
      return `Another feel already answers ${eventWords(on)}.`
  }
  return problem.message
}

export interface SpringLine {
  readonly key: keyof SpringTuning
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly value: number
}

const SPRING: readonly Omit<SpringLine, 'value'>[] = [
  { key: 'f', label: 'Speed', min: 0.5, max: 12, step: 0.5 },
  { key: 'zeta', label: 'Wobble', min: 0, max: 2, step: 0.05 },
  { key: 'r', label: 'Wind-up', min: -2, max: 2, step: 0.1 },
]

/** How squash springs back, each value the file's or the game's default. */
export function springLines(content: FeelContent): SpringLine[] {
  const spring = content.springs?.squash ?? DEFAULT_SQUASH
  return SPRING.map((line) => ({ ...line, value: spring[line.key] }))
}

/**
 * The edit that sets one value of the squash spring. The file's spring needs all three values, so a file with none gets
 * the whole table, the defaults and the changed value.
 */
export function springEdit(content: FeelContent, key: keyof SpringTuning, value: number): ContentEdit {
  const squash = content.springs?.squash
  if (squash !== undefined) return { keyPath: ['springs', 'squash', key], expected: squash[key], set: value }
  const whole = { ...DEFAULT_SQUASH, [key]: value }
  return content.springs === undefined
    ? { keyPath: ['springs'], insert: { squash: whole } }
    : { keyPath: ['springs', 'squash'], insert: whole }
}
