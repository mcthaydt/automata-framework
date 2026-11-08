import type { AudioContent } from '@automata/audio-synth'
import { describe, expect, it } from 'vitest'
import {
  addRuleEdit,
  addTrackEdit,
  conditionEdits,
  conditionWords,
  isTrackFile,
  moveRuleEdits,
  ruleLines,
  trackAlias,
  trackFields,
  unusedTracks,
} from '#src/features/audio/music-model.ts'

const content: AudioContent = {
  slot: [
    { id: 'calm', mode: 'loop', volume: 0.6, sound: 'calm-theme' },
    { id: 'chase', mode: 'loop', volume: 0.9, fade: 0.5 },
  ],
  music_rule: [
    { when: { danger: { atLeast: 2 } }, slot: 'chase' },
    { when: {}, slot: 'calm' },
  ],
}

describe('the files that are tracks', () => {
  it('are the sound files a game folder holds, by their ending', () => {
    expect(isTrackFile('assets/music/calm-theme.ogg')).toBe(true)
    expect(isTrackFile('assets/music/Chase.MP3')).toBe(true)
    expect(isTrackFile('assets/music/notes.txt')).toBe(false)
  })

  it('name the track by the file’s own name, as the game knows its sound', () => {
    expect(trackAlias('assets/music/calm-theme.ogg')).toBe('calm-theme')
    expect(trackAlias('assets/music/Boss Fight.mp3')).toBe('boss-fight')
  })

  it('leave out the ones a track already uses, whether by its sound or by its name', () => {
    const files = [
      'assets/music/calm-theme.ogg',
      'assets/music/chase.ogg',
      'assets/music/boss.ogg',
      'a/readme.txt',
    ]
    expect(unusedTracks(content, files)).toEqual(['assets/music/boss.ogg'])
  })

  it('start as a loop at a level that sits under the effects', () => {
    expect(addTrackEdit(content, 'assets/music/boss.ogg')).toEqual({
      keyPath: ['slot'],
      insert: { id: 'boss', mode: 'loop', volume: 0.7, sound: 'boss' },
    })
    expect(addTrackEdit({}, 'assets/music/boss.ogg')).toEqual({
      keyPath: ['slot'],
      insert: [{ id: 'boss', mode: 'loop', volume: 0.7, sound: 'boss' }],
    })
  })
})

describe('trackFields', () => {
  it('say how the game switches to a track, in words', () => {
    const [chase] = [content.slot?.[1]]
    if (chase === undefined) throw new Error('no track')
    expect(trackFields(chase).map((field) => field.label)).toEqual([
      'Plays',
      'Loudness',
      'Fades in over',
      'Fades into its own start over',
      'Starts after',
    ])
    expect(trackFields(chase).find((field) => field.key === 'fade')).toMatchObject({ value: 0.5, unit: 's' })
    expect(trackFields(chase).find((field) => field.key === 'mode')).toMatchObject({ value: 'loop' })
  })
})

describe('ruleLines', () => {
  it('read each rule top to bottom as a sentence, the last as “Otherwise”', () => {
    expect(ruleLines(content).map((line) => line.words)).toEqual([
      'When danger is at least 2: play chase',
      'Otherwise: play calm',
    ])
  })

  it('say hold and silence in words', () => {
    const odd: AudioContent = {
      slot: [],
      music_rule: [
        { when: { hidden: true }, slot: 'hold' },
        { when: { place: ['cave', 'mine'] }, slot: 'silence' },
      ],
    }
    expect(ruleLines(odd).map((line) => line.words)).toEqual([
      'When hidden is yes: keep what plays',
      'When place is cave or mine: play nothing',
    ])
  })

  it('say a condition in words', () => {
    expect(conditionWords('danger', { atLeast: 2, atMost: 5 })).toBe('danger is between 2 and 5')
    expect(conditionWords('danger', { atMost: 1 })).toBe('danger is at most 1')
    expect(conditionWords('place', 'cave')).toBe('place is cave')
  })
})

describe('rule edits', () => {
  it('add a rule that plays a track whatever the game’s state', () => {
    expect(addRuleEdit(content, 'chase')).toEqual({
      keyPath: ['music_rule'],
      insert: { when: {}, slot: 'chase' },
    })
    expect(addRuleEdit({}, 'chase')).toEqual({
      keyPath: ['music_rule'],
      insert: [{ when: {}, slot: 'chase' }],
    })
  })

  it('move a rule up by taking it out and putting it back one place earlier, in one change', () => {
    expect(moveRuleEdits(content, 1, 0)).toEqual([
      { keyPath: ['music_rule', 1], remove: true },
      { keyPath: ['music_rule'], insert: { when: {}, slot: 'calm' }, at: 0 },
    ])
  })

  it('set a condition to “at least”, “at most” or an exact value, and take it away', () => {
    expect(conditionEdits(content.music_rule?.[0] as never, 0, 'danger', { atLeast: 3 })).toEqual([
      { keyPath: ['music_rule', 0, 'when', 'danger'], expected: { atLeast: 2 }, set: { atLeast: 3 } },
    ])
    expect(conditionEdits(content.music_rule?.[1] as never, 1, 'danger', { atLeast: 1 })).toEqual([
      { keyPath: ['music_rule', 1, 'when', 'danger'], insert: { atLeast: 1 } },
    ])
    expect(conditionEdits(content.music_rule?.[0] as never, 0, 'danger', undefined)).toEqual([
      { keyPath: ['music_rule', 0, 'when', 'danger'], remove: true },
    ])
  })
})
