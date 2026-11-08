import type { AudioContent } from '@automata/audio-synth'
import { openDocument } from '@automata/editor/kit/documents'
import { describe, expect, it } from 'vitest'
import {
  keepQuietEdits,
  moveEventEdits,
  quietReasonEdit,
  shadowedRows,
  shadowWords,
  unanswered,
} from '#src/features/audio/event-model.ts'
import type { GameEvent } from '#src/shared/game-events.ts'

const event = (id: string): GameEvent => ({ id, words: id, from: 'The game’s events', noSubject: false })

const content: AudioContent = {
  cue: [{ id: 'a', bus: 'sfx', voices: [] }],
  event: [
    { on: 'player.*', cue: 'a' },
    { on: 'coin.picked', cue: 'a' },
    { on: 'player.hit', cue: 'a' },
    { on: 'door.opens', silent: 'it is silent in the dark' },
  ],
}

describe('which rows never play', () => {
  it('finds a row an earlier row already answers, and the row that answers it', () => {
    expect(shadowedRows(content)).toEqual([{ index: 2, by: 0 }])
  })

  it('keeps a pattern below an exact row: the exact row still plays first for its own event', () => {
    expect(
      shadowedRows({
        event: [
          { on: 'player.hit', cue: 'a' },
          { on: 'player.*', cue: 'a' },
        ],
      }),
    ).toEqual([])
  })

  it('says it in words', () => {
    expect(shadowWords(content.event?.[0]?.on ?? '')).toBe(
      'Never plays: any player event above answers first.',
    )
    expect(shadowWords('coin.picked')).toBe('Never plays: coin picked above answers first.')
    expect(shadowWords('*')).toBe('Never plays: anything above answers first.')
  })

  it('moves a row up above the one that answers it, in one change that reads back', () => {
    const edits = moveEventEdits(content, 2, 0)
    expect(edits).toEqual([
      { keyPath: ['event', 2], remove: true },
      { keyPath: ['event'], insert: { on: 'player.hit', cue: 'a' }, at: 0 },
    ])
    const file = openDocument(
      'audio.toml',
      '[[event]]\non = "player.*"\ncue = "a"\n\n[[event]]\non = "coin.picked"\ncue = "a"\n\n[[event]]\non = "player.hit"\ncue = "a"\n',
    )
    const moved = file.edit(edits)
    expect(moved.ok && (moved.document.value() as AudioContent).event?.map((row) => row.on)).toEqual([
      'player.hit',
      'player.*',
      'coin.picked',
    ])
    expect(moved.ok && shadowedRows(moved.document.value() as AudioContent)).toEqual([])
  })

  it('does nothing when there is nowhere to move', () => {
    expect(moveEventEdits(content, 1, 1)).toEqual([])
    expect(moveEventEdits(content, 9, 0)).toEqual([])
  })
})

describe('what nothing plays yet', () => {
  it('lists the game’s events no row answers, a pattern counting for what it matches', () => {
    expect(
      unanswered(content, [
        event('player.hit'),
        event('door.opens'),
        event('enemy.died'),
        event('coin.picked'),
      ]).map((each) => each.id),
    ).toEqual(['enemy.died'])
    expect(unanswered({}, [event('a.b')]).map((each) => each.id)).toEqual(['a.b'])
  })

  it('keeps one quiet with a reason that can be changed', () => {
    expect(keepQuietEdits(content, 'enemy.died')).toEqual([
      { keyPath: ['event'], insert: { on: 'enemy.died', silent: 'Quiet on purpose.' } },
    ])
    expect(quietReasonEdit(3, 'it is silent in the dark', 'doors creak in the music')).toEqual({
      keyPath: ['event', 3, 'silent'],
      expected: 'it is silent in the dark',
      set: 'doors creak in the music',
    })
  })
})
