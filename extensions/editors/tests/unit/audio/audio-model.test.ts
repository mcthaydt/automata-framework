import type { AudioContent, Voice } from '@automata/audio-synth'
import { openDocument } from '@automata/editor/kit/documents'
import { describe, expect, it } from 'vitest'
import {
  addEventEdit,
  addSoundEdit,
  addVoiceEdit,
  audioProblemWords,
  busWords,
  eventLines,
  eventSoundEdits,
  flagEdit,
  newSoundId,
  soundFields,
  soundFlags,
  voiceFieldEdit,
  voiceLines,
} from '#src/features/audio/audio-model.ts'

const content: AudioContent = {
  cue: [
    {
      id: 'coin',
      about: 'A bright blip when a coin is picked up',
      bus: 'sfx',
      voices: [
        { tone: 'square', from: 880, to: 1320, length: 0.08, volume: 0.4 },
        { hiss: 4000, q: 2, at: 0.02, length: 0.05, volume: 0.1 },
      ],
    },
    { id: 'door', bus: 'sfx', voices: [], draft: true },
  ],
  event: [
    { on: 'coin.picked', cue: 'coin' },
    { on: 'player.jump', silent: 'the jump is felt, not heard' },
  ],
}

describe('the words', () => {
  it('name the buses for a person', () => {
    expect(['music', 'sfx', 'ui', 'voice'].map((bus) => busWords(bus as 'music'))).toEqual([
      'Music',
      'Effects',
      'Menus',
      'Voices',
    ])
  })

  it("give a sound's fields", () => {
    expect(soundFields(content.cue?.[0] as NonNullable<AudioContent['cue']>[number])).toEqual([
      { key: 'about', label: 'What you hear', kind: 'text', value: 'A bright blip when a coin is picked up' },
      {
        key: 'bus',
        label: 'Plays on',
        kind: 'choice',
        value: 'sfx',
        options: [
          { value: 'music', label: 'Music' },
          { value: 'sfx', label: 'Effects' },
          { value: 'ui', label: 'Menus' },
          { value: 'voice', label: 'Voices' },
        ],
      },
    ])
  })

  it('say each voice as a tone or a hiss, with its pitch, timing and loudness', () => {
    const [tone, hiss] = voiceLines(content.cue?.[0] as NonNullable<AudioContent['cue']>[number])
    expect(tone?.words).toBe('Tone')
    expect(tone?.fields.map((field) => [field.label, field.value])).toEqual([
      ['Shape', 'square'],
      ['Starts at', 880],
      ['Ends at', 1320],
      ['Begins after', 0],
      ['Lasts', 0.08],
      ['Loudness', 0.4],
    ])
    expect(hiss?.words).toBe('Hiss')
    expect(hiss?.fields.map((field) => [field.label, field.value])).toEqual([
      ['Pitch', 4000],
      ['How narrow', 2],
      ['Begins after', 0.02],
      ['Lasts', 0.05],
      ['Loudness', 0.1],
    ])
  })

  it('say a hiss that picks its pitch from a range as two pitches, and keep it a range', () => {
    const cue = {
      id: 'wind',
      bus: 'sfx' as const,
      voices: [{ hiss: [400, 1200] as [number, number], q: 1, length: 1, volume: 0.2 }],
    }
    const voice = cue.voices[0] as Voice
    const [hiss] = voiceLines(cue)
    expect(hiss?.fields.slice(0, 2).map((field) => [field.label, field.value])).toEqual([
      ['Lowest pitch', 400],
      ['Highest pitch', 1200],
    ])
    const lowest = hiss?.fields[0] as NonNullable<typeof hiss>['fields'][number]
    const highest = hiss?.fields[1] as NonNullable<typeof hiss>['fields'][number]
    expect(voiceFieldEdit(0, 0, voice, lowest, 300)).toEqual({
      keyPath: ['cue', 0, 'voices', 0, 'hiss', 0],
      expected: 400,
      set: 300,
    })
    expect(voiceFieldEdit(0, 0, voice, highest, 1500)).toEqual({
      keyPath: ['cue', 0, 'voices', 0, 'hiss', 1],
      expected: 1200,
      set: 1500,
    })
    const file = openDocument(
      'audio.toml',
      '[[cue]]\nid = "wind"\nbus = "sfx"\nvoices = [{ hiss = [400, 1200], q = 1, length = 1, volume = 0.2 }]\n',
    )
    const edited = file.edit([voiceFieldEdit(0, 0, voice, lowest, 300)])
    expect(edited.ok && edited.document.value()).toMatchObject({ cue: [{ voices: [{ hiss: [300, 1200] }] }] })
  })

  it("give a sound's switches in words: it never quiets other sounds, and it is not final yet", () => {
    expect(soundFlags({ id: 'a', bus: 'sfx', voices: [], no_duck: true })).toEqual([
      { key: 'no_duck', label: 'Never quiets other sounds', on: true },
      { key: 'draft', label: 'Not final yet', on: false },
    ])
  })

  it('turn a switch on by writing it, and off by taking it out', () => {
    const cue = { id: 'a', bus: 'sfx' as const, voices: [], no_duck: true }
    expect(flagEdit(2, cue, 'draft', true)).toEqual([{ keyPath: ['cue', 2, 'draft'], insert: true }])
    expect(flagEdit(2, cue, 'no_duck', false)).toEqual([{ keyPath: ['cue', 2, 'no_duck'], remove: true }])
    expect(flagEdit(2, cue, 'no_duck', true)).toEqual([])
    expect(flagEdit(2, cue, 'draft', false)).toEqual([])
  })

  it('say what happens on each event', () => {
    expect(eventLines(content)).toEqual([
      { index: 0, on: 'coin.picked', words: 'When coin picked', cue: 'coin', silent: undefined },
      {
        index: 1,
        on: 'player.jump',
        words: 'When player jump',
        cue: undefined,
        silent: 'the jump is felt, not heard',
      },
    ])
  })
})

describe('the edits', () => {
  it('add a sound with a name no other sound has, that can be heard at once', () => {
    expect(newSoundId(content)).toBe('sound-1')
    expect(newSoundId({ cue: [{ id: 'sound-1', bus: 'sfx', voices: [] }] })).toBe('sound-2')
    expect(addSoundEdit(content, 'sound-1')).toEqual([
      {
        keyPath: ['cue'],
        insert: {
          id: 'sound-1',
          bus: 'sfx',
          voices: [{ tone: 'square', from: 660, to: 330, length: 0.12, volume: 0.4 }],
        },
      },
    ])
    // A file with no sounds yet makes its list first, which the top-level key of a real file needs.
    const file = openDocument('content/audio/audio.toml', '[[event]]\non = "a"\nsilent = true\n')
    const edited = file.edit(addSoundEdit({}, 'sound-1'))
    expect(edited.ok).toBe(true)
    if (edited.ok) expect(edited.document.value()).toMatchObject({ cue: [{ id: 'sound-1' }] })
  })

  it('add a tone or a hiss to a sound', () => {
    expect(addVoiceEdit(0, 'hiss')).toEqual({
      keyPath: ['cue', 0, 'voices'],
      insert: { hiss: 2000, q: 1, length: 0.1, volume: 0.3 },
    })
  })

  it('make an event play a sound, taking away its silence', () => {
    expect(eventSoundEdits(content, 1, 'coin')).toEqual([
      { keyPath: ['event', 1, 'silent'], remove: true },
      { keyPath: ['event', 1, 'cue'], insert: 'coin' },
    ])
    expect(eventSoundEdits(content, 0, 'door')).toEqual([
      { keyPath: ['event', 0, 'cue'], expected: 'coin', set: 'door' },
    ])
  })

  it('add an event that plays a sound', () => {
    expect(addEventEdit(content, 'enemy.died', 'coin')).toEqual([
      { keyPath: ['event'], insert: { on: 'enemy.died', cue: 'coin' } },
    ])
    const file = openDocument('content/audio/audio.toml', '[[cue]]\nid = "coin"\nbus = "sfx"\nvoices = []\n')
    const edited = file.edit(addEventEdit({}, 'enemy.died', 'coin'))
    expect(edited.ok).toBe(true)
    if (edited.ok)
      expect(edited.document.value()).toMatchObject({ event: [{ on: 'enemy.died', cue: 'coin' }] })
  })
})

describe('audioProblemWords', () => {
  it('says a missing sound and a doubled event in words', () => {
    expect(audioProblemWords({ keyPath: ['event', 0, 'cue'], message: 'No cue boom.' }, content)).toBe(
      'There is no sound called boom.',
    )
    expect(
      audioProblemWords({ keyPath: ['event', 1, 'on'], message: 'Two entries answer coin.picked.' }, content),
    ).toBe('Another row already answers player jump.')
    expect(audioProblemWords({ keyPath: ['cue', 1, 'id'], message: 'Door is listed twice.' }, content)).toBe(
      'Another sound is called door.',
    )
  })
})
