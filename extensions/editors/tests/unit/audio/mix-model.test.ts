import type { AudioContent } from '@automata/audio-synth'
import { openDocument } from '@automata/editor/kit/documents'
import { describe, expect, it } from 'vitest'
import {
  addDuckEdits,
  duckBusEdits,
  duckFieldEdit,
  duckLines,
  masterEdit,
  masterField,
} from '#src/features/audio/mix-model.ts'

const content: AudioContent = {
  master_gain: 0.8,
  duck: [
    { bus: 'voice', duck: ['music'], db: -6, attack: 0.1, release: 0.5 },
    { bus: 'sfx', duck: ['music', 'ui'], db: -12, attack: 0, release: 1.5 },
  ],
}

describe('the mix', () => {
  it('gives the overall volume, full when the file says nothing', () => {
    expect(masterField(content)).toMatchObject({
      label: 'Overall volume',
      kind: 'number',
      min: 0,
      max: 1,
      value: 0.8,
    })
    expect(masterField({})).toMatchObject({ value: 1 })
    expect(masterEdit(content, 0.5)).toEqual({ keyPath: ['master_gain'], expected: 0.8, set: 0.5 })
    expect(masterEdit({}, 0.5)).toEqual({ keyPath: ['master_gain'], insert: 0.5 })
  })

  it('reads each duck as a sentence', () => {
    expect(duckLines(content).map((line) => line.words)).toEqual([
      'While a voice plays, music drops 6 dB (in 0.1 s, back in 0.5 s)',
      'While an effect plays, music and menus drop 12 dB (at once, back in 1.5 s)',
    ])
  })

  it('has fields in words, with the drop shown as a plain number of dB', () => {
    const [first] = duckLines(content)
    expect(first?.fields.map((field) => [field.label, field.value])).toEqual([
      ['While this plays', 'voice'],
      ['It drops by', 6],
      ['Drops in', 0.1],
      ['Comes back in', 0.5],
    ])
  })

  it('writes the drop as the negative dB the file holds, and never writes -0', () => {
    const rule = content.duck?.[0] as NonNullable<AudioContent['duck']>[number]
    const [first] = duckLines(content)
    const byField = first?.fields[1] as NonNullable<typeof first>['fields'][number]
    expect(duckFieldEdit(0, rule, byField, 9)).toEqual({ keyPath: ['duck', 0, 'db'], expected: -6, set: -9 })
    expect(Object.is((duckFieldEdit(0, rule, byField, 0) as { set: number }).set, 0)).toBe(true)
  })

  it('turns a bus that drops on or off, always leaving one', () => {
    const rule = content.duck?.[1] as NonNullable<AudioContent['duck']>[number]
    expect(duckBusEdits(1, rule, 'voice', true)).toEqual([
      { keyPath: ['duck', 1, 'duck'], expected: ['music', 'ui'], set: ['music', 'ui', 'voice'] },
    ])
    expect(duckBusEdits(1, rule, 'ui', false)).toEqual([
      { keyPath: ['duck', 1, 'duck'], expected: ['music', 'ui'], set: ['music'] },
    ])
    const only = content.duck?.[0] as NonNullable<AudioContent['duck']>[number]
    expect(duckBusEdits(0, only, 'music', false)).toEqual([])
  })

  it('adds a duck that works at once, and makes the list first in one edit when the file has none', () => {
    const file = openDocument('audio.toml', '[[cue]]\nid = "a"\nbus = "sfx"\nvoices = []\n')
    const edited = file.edit(addDuckEdits({}))
    expect(edited.ok && edited.document.text).toContain('[[duck]]\nbus = "voice"')
    expect(edited.ok && (edited.document.value() as AudioContent).duck?.[0]).toMatchObject({
      bus: 'voice',
      duck: ['music'],
      db: -6,
    })
  })
})
