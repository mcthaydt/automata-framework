import type { AudioContent } from '@automata/audio-synth'
import { describe, expect, it } from 'vitest'
import {
  addEventEdit,
  addSoundEdit,
  addVoiceEdit,
  audioProblemWords,
  busWords,
  eventLines,
  eventSoundEdits,
  newSoundId,
  soundFields,
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
      ['Around', 4000],
      ['How narrow', 2],
      ['Begins after', 0.02],
      ['Lasts', 0.05],
      ['Loudness', 0.1],
    ])
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
    expect(addSoundEdit(content, 'sound-1')).toEqual({
      keyPath: ['cue'],
      insert: {
        id: 'sound-1',
        bus: 'sfx',
        voices: [{ tone: 'square', from: 660, to: 330, length: 0.12, volume: 0.4 }],
      },
    })
    expect(addSoundEdit({}, 'sound-1')).toMatchObject({ keyPath: ['cue'], insert: [{ id: 'sound-1' }] })
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
    expect(addEventEdit(content, 'enemy.died', 'coin')).toEqual({
      keyPath: ['event'],
      insert: { on: 'enemy.died', cue: 'coin' },
    })
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
