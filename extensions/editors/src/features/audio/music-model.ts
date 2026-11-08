// Music in Audio is imported, never made: a track is a sound file the game folder holds, and Audio decides which track
// plays when and how the game switches between them. A track is a `slot` in the file; a rule says "when the game is in
// this state, play that track". Nothing here makes a note.
import type { AudioContent, Condition, MusicRule, Slot } from '@automata/audio-synth'
import { isTrackFile, trackAlias } from '@automata/audio-synth/stage'
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { SuiteWorkspace } from '@automata/editor/kit/ports'
import { appendEdits, type Field, setOrInsert } from '../../shared/fields.ts'

export { isTrackFile, trackAlias }

/** The track files in the game folder. */
export async function trackFiles(workspace: SuiteWorkspace): Promise<string[]> {
  return (await workspace.files()).map((file) => file.path).filter(isTrackFile)
}

/** The track files no track plays yet (its sound or, when it names none, its own name). */
export function unusedTracks(content: AudioContent, files: readonly string[]): string[] {
  const used = new Set((content.slot ?? []).map((slot) => slot.sound ?? slot.id))
  return files.filter((path) => isTrackFile(path) && !used.has(trackAlias(path)))
}

/** A track from a file: it loops, at a level that sits under the effects. */
export function addTrackEdit(content: AudioContent, path: string): ContentEdit[] {
  const id = trackAlias(path)
  return appendEdits(['slot'], content.slot !== undefined, { id, mode: 'loop', volume: 0.7, sound: id })
}

const seconds = (key: string, label: string, value: number, max: number): Field => ({
  key,
  label,
  kind: 'number',
  unit: 's',
  min: 0,
  max,
  step: 0.1,
  value,
})

/** How a track plays and how the game switches to it. */
export function trackFields(slot: Slot): Field[] {
  return [
    {
      key: 'mode',
      label: 'Plays',
      kind: 'choice',
      value: slot.mode,
      options: [
        { value: 'loop', label: 'Over and over' },
        { value: 'once', label: 'Once through' },
      ],
    },
    { key: 'volume', label: 'Loudness', kind: 'number', min: 0, max: 1, step: 0.05, value: slot.volume },
    seconds('fade', 'Fades in over', slot.fade ?? 2, 30),
    seconds('seam', 'Fades into its own start over', slot.seam ?? 0, 30),
    seconds('delay', 'Starts after', slot.delay ?? 0, 30),
  ]
}

export function trackEdit(index: number, field: Field, before: unknown, value: number | string): ContentEdit {
  return setOrInsert(['slot', index, field.key], before, value)
}

const valueWords = (value: string | number | boolean): string =>
  typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)

/** One thing a rule asks of the game's state, in words ("danger is at least 2"). */
export function conditionWords(key: string, condition: Condition): string {
  if (typeof condition === 'object' && !Array.isArray(condition)) {
    const { atLeast, atMost } = condition as { atLeast?: number; atMost?: number }
    if (atLeast !== undefined && atMost !== undefined)
      return `${key} is between ${String(atLeast)} and ${String(atMost)}`
    if (atLeast !== undefined) return `${key} is at least ${String(atLeast)}`
    if (atMost !== undefined) return `${key} is at most ${String(atMost)}`
  }
  if (Array.isArray(condition)) return `${key} is ${condition.map(valueWords).join(' or ')}`
  return `${key} is ${valueWords(condition as string | number | boolean)}`
}

export interface RuleLine {
  readonly index: number
  readonly words: string
  readonly conditions: readonly { readonly key: string; readonly words: string }[]
}

const playsWords = (slot: string): string =>
  slot === 'hold' ? 'keep what plays' : slot === 'silence' ? 'play nothing' : `play ${slot}`

/** The rules top to bottom, as the game reads them: the first that holds plays. */
export function ruleLines(content: AudioContent): RuleLine[] {
  return (content.music_rule ?? []).map((rule, index) => {
    const conditions = Object.entries(rule.when).map(([key, condition]) => ({
      key,
      words: conditionWords(key, condition),
    }))
    const asks = conditions.map((condition) => condition.words).join(' and ')
    return {
      index,
      conditions,
      words: `${asks === '' ? 'Otherwise' : `When ${asks}`}: ${playsWords(rule.slot)}`,
    }
  })
}

export function addRuleEdit(content: AudioContent, slot: string): ContentEdit[] {
  return appendEdits(['music_rule'], content.music_rule !== undefined, { when: {}, slot })
}

/** A rule moved from one place to another: the first matching rule plays, so the order is the meaning. */
export function moveRuleEdits(content: AudioContent, from: number, to: number): ContentEdit[] {
  const rule = content.music_rule?.[from]
  if (rule === undefined || from === to) return []
  return [
    { keyPath: ['music_rule', from], remove: true },
    { keyPath: ['music_rule'], insert: rule, at: to },
  ]
}

/** One condition of a rule set to a new asking, or taken away (`undefined`). */
export function conditionEdits(
  rule: MusicRule,
  index: number,
  key: string,
  condition: Condition | undefined,
): ContentEdit[] {
  const keyPath = ['music_rule', index, 'when', key]
  const before = rule.when[key]
  if (condition === undefined) return before === undefined ? [] : [{ keyPath, remove: true }]
  return [
    before === undefined ? { keyPath, insert: condition } : { keyPath, expected: before, set: condition },
  ]
}

/** How many rules play the track at `index`. */
export const rulesPlaying = (content: AudioContent, index: number): number =>
  (content.music_rule ?? []).filter((rule) => rule.slot === content.slot?.[index]?.id).length

/** Removing a track sets the rules that played it to play nothing (so the file stays valid), then removes the track. */
export function removeTrackEdits(content: AudioContent, index: number): ContentEdit[] {
  const id = content.slot?.[index]?.id
  const rules = (content.music_rule ?? []).flatMap((rule, at) =>
    rule.slot === id
      ? [{ keyPath: ['music_rule', at, 'slot'], expected: id, set: 'silence' } as ContentEdit]
      : [],
  )
  return [...rules, { keyPath: ['slot', index], remove: true }]
}

/** The tracks a rule can play, in words: the game's own, then keeping what plays or silence. */
export function playChoices(content: AudioContent): { value: string; label: string }[] {
  return [
    ...(content.slot ?? []).map((slot) => ({ value: slot.id, label: slot.id })),
    { value: 'hold', label: 'Keep what plays' },
    { value: 'silence', label: 'Nothing' },
  ]
}
