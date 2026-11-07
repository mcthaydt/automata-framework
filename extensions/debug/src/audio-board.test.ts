import type { AudioContent } from '@automata/audio-synth'
import { describe, expect, it, vi } from 'vitest'
import { audioBoard } from './audio-board'

const content: AudioContent = {
  cue: [
    { id: 'ping', bus: 'ui', voices: [], about: 'confirm' },
    { id: 'thud', bus: 'sfx', voices: [], draft: true },
  ],
  bed: [{ id: 'hum', bus: 'music', volume: 0.2, drones: [{ wave: 'sine', freq: 55 }] }],
  event: [
    { on: 'ui.confirm', cue: 'ping' },
    { on: 'hit.*', cue: 'thud' },
    { on: 'tick.*', silent: 'bookkeeping' },
  ],
}
const controls = () => ({ play: vi.fn(), startBed: vi.fn(), stopBed: vi.fn(), playing: vi.fn(() => ['hum']) })

describe('audioBoard', () => {
  it('lists each cue with its bus, line and the events that play it', () => {
    const board = audioBoard(() => content, controls())
    expect(board.cues()).toEqual([
      { id: 'ping', bus: 'ui', about: 'confirm', draft: false, events: ['ui.confirm'] },
      { id: 'thud', bus: 'sfx', draft: true, events: ['hit.*'] },
    ])
  })
  it('lists the beds', () => {
    expect(audioBoard(() => content, controls()).beds()).toEqual([{ id: 'hum', bus: 'music', draft: false }])
  })
  it('sends play and the bed controls through', () => {
    const c = controls()
    const board = audioBoard(() => content, c)
    board.play('ping')
    board.startBed('hum')
    board.stopBed('hum')
    expect(c.play).toHaveBeenCalledWith('ping')
    expect(c.startBed).toHaveBeenCalledWith('hum')
    expect(c.stopBed).toHaveBeenCalledWith('hum')
    expect(board.playing()).toEqual(['hum'])
  })
  it('reads the content each time, so a reload shows', () => {
    let now = content
    const board = audioBoard(() => now, controls())
    now = { cue: [{ id: 'new', bus: 'sfx', voices: [] }] }
    expect(board.cues().map((c) => c.id)).toEqual(['new'])
  })
})
