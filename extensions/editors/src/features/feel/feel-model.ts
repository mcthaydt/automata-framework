// `feel.toml` as a person reads it: each entry is "When something happens", and each of its rows is a sentence ("Shake
// the screen", "Freeze the action") with fields named for what they do, never for their keys. The edits are the kit's
// content edits by key path, so the file keeps its comments and order.

import type { ContentEdit } from '@automata/editor/kit/documents'
import { DEFAULT_LIMITS, type FeelContent, type FeelEntry, type Limits } from '@automata/feel'
import type { Problem } from '../../shared/toml-session.ts'

export type Channel = 'camera' | 'pose' | 'visual' | 'word' | 'haptic' | 'audio'

/** Where one effect is in its entry: its channel and its row there. */
export interface EffectPlace {
  readonly channel: Channel
  readonly index: number
}

export type EffectField =
  | {
      readonly key: string
      readonly label: string
      readonly kind: 'number'
      readonly unit?: string
      readonly min: number
      readonly max: number
      readonly step: number
      readonly value: number
    }
  | { readonly key: string; readonly label: string; readonly kind: 'text'; readonly value: string }

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
  word: { channel: 'word', row: { key: 'hit' } },
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
const ms = (key: string, label: string, value: number): EffectField => ({
  key,
  label,
  unit: 'ms',
  kind: 'number',
  min: 1,
  max: 1000,
  step: 10,
  value,
})
const text = (key: string, label: string, value: string): EffectField => ({ key, label, kind: 'text', value })

/** An event id in words: `player.hit` is "player hit", `door.*` is "any door event", `*` is "anything". */
export function eventWords(on: string): string {
  const words = (part: string): string => part.replace(/[._-]+/g, ' ').trim()
  if (on.trim() === '*') return 'anything'
  if (on.endsWith('*')) return `any ${words(on.slice(0, -1))} event`
  return words(on)
}

function visualLine(row: NonNullable<FeelEntry['visual']>[number], index: number): EffectLine {
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
export function effectLines(entry: FeelEntry): EffectLine[] {
  const lines: EffectLine[] = []
  for (const channel of CHANNELS) {
    const rows = entry[channel] ?? []
    rows.forEach((row, index) => {
      if (channel === 'camera' && 'shake' in row)
        lines.push({
          channel,
          index,
          words: 'Shake the screen',
          fields: [strength('shake', 'How hard', row.shake)],
        })
      else if (channel === 'pose' && 'hit_stop_ms' in row)
        lines.push({
          channel,
          index,
          words: 'Freeze the action',
          fields: [ms('hit_stop_ms', 'How long', row.hit_stop_ms)],
        })
      else if (channel === 'visual')
        lines.push(visualLine(row as NonNullable<FeelEntry['visual']>[number], index))
      else if (channel === 'word' && 'key' in row)
        lines.push({
          channel,
          index,
          words: 'Show a word',
          fields: [text('key', 'Which word', row.key), ms('ms', 'How long', row.ms ?? 800)],
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

export function addFeelEdit(content: FeelContent, on: string): ContentEdit {
  return content.entry === undefined
    ? { keyPath: ['entry'], insert: [{ on }] }
    : { keyPath: ['entry'], insert: { on } }
}

export const removeFeelEdit = (entry: number): ContentEdit => ({ keyPath: ['entry', entry], remove: true })

export function addEffectEdit(entry: FeelEntry, index: number, kind: EffectKind): ContentEdit {
  const { channel, row } = NEW_ROW[kind]
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
