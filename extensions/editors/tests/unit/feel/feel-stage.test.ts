import type { FeelContent, FeelSettings } from '@automata/feel'
import { describe, expect, it } from 'vitest'
import {
  alsoPlays,
  missedOutputs,
  type StageOutputs,
  stageEvent,
  stageFrames,
} from '#src/features/feel/feel-stage.ts'

const FULL: FeelSettings = { reduceFlashing: false, haptics: true, intensity: 1 }
const DT = 1 / 60

const hit: FeelContent = {
  entry: [{ on: 'player.hit', camera: [{ shake: 1 }], visual: [{ flash: 'white', frames: 2 }] }],
}

describe('stageFrames', () => {
  it('shakes and flashes on the frames after the event, then settles', () => {
    const frames = stageFrames(hit, 'player.hit', FULL, false, DT, 10)
    expect(frames[0]?.offset).not.toEqual([0, 0])
    expect(frames[0]?.flash).toMatchObject({ colour: 'white' })
    expect(frames[3]?.flash).toBeNull()
  })

  it('drops the flash for a player who wants less flashing', () => {
    const frames = stageFrames(hit, 'player.hit', { ...FULL, reduceFlashing: true }, false, DT, 10)
    expect(frames.every((frame) => frame.flash === null)).toBe(true)
  })

  it('does not move the picture at strength off', () => {
    const frames = stageFrames(hit, 'player.hit', { ...FULL, intensity: 0 }, false, DT, 10)
    expect(frames.every((frame) => frame.offset[0] === 0 && frame.offset[1] === 0)).toBe(true)
  })

  it('plays a pattern with a made-up name, together with the entries that match it', () => {
    const content: FeelContent = {
      entry: [
        { on: 'player.*', camera: [{ shake: 1 }] },
        { on: '*', visual: [{ flash: 'red', frames: 2 }] },
      ],
    }
    expect(stageEvent('player.*')).toBe('player.example')
    const frames = stageFrames(content, 'player.*', FULL, false, DT, 4)
    expect(frames[0]?.offset).not.toEqual([0, 0])
    expect(frames[0]?.flash).toMatchObject({ colour: 'red' })
  })
})

describe('alsoPlays', () => {
  const entries = [{ on: 'player.hit' }, { on: 'player.*' }, { on: 'door.*' }, { on: '*' }]
  it('gives the other entries that answer the same event', () => {
    expect(alsoPlays(entries, 0)).toEqual([1, 3])
    expect(alsoPlays(entries, 2)).toEqual([3])
  })
  it('gives what really answers the made-up event, so “anything” plays with the other catch-alls only', () => {
    // The stage hears `example`; `player.hit` is not a feel for it, as in the game.
    expect(alsoPlays(entries, 3)).toEqual([])
    expect(alsoPlays([{ on: '*' }, { on: '*' }], 0)).toEqual([1])
  })
})

describe('missedOutputs', () => {
  const content: FeelContent = {
    entry: [{ on: 'player.hit', haptic: [{ strong: 0.5, weak: 0.3, ms: 100 }], audio: [{ cue: 'hit' }] }],
  }
  const frames = stageFrames(content, 'player.hit', FULL, false, DT, 3)

  it('says what it would do in words when the device cannot rumble and the game lacks the sound', () => {
    const none: StageOutputs = { rumble: () => false, cue: () => false }
    expect(missedOutputs(frames, none)).toEqual([
      'Rumble: strong 0.5, light 0.3 for 100 ms',
      'Plays the sound hit',
    ])
  })

  it('says nothing when both play', () => {
    const all: StageOutputs = { rumble: () => true, cue: () => true }
    expect(missedOutputs(frames, all)).toEqual([])
  })
})
