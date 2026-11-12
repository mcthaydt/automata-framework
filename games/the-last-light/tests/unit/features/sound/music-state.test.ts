import { describe, expect, it } from 'vitest'
import { type MusicInputs, musicStateOf } from '#src/features/sound/music-state.ts'

// The state the audio file's music rules read, from what the sim reported this step. The rules are data (content/audio);
// this is the only part of the music that is code: which facts about the night they may ask about.

const QUIET: MusicInputs = {
  paused: false,
  keypadOpen: false,
  inCutscene: false,
  lightsOut: false,
  figureMode: 'dormant',
  hidden: false,
}

describe('the music state', () => {
  it('is the first night before lights out, with the figure not about', () => {
    expect(musicStateOf(QUIET)).toEqual({
      phase: 'play',
      lightsOut: false,
      figureAbout: false,
      chasing: false,
      hidden: false,
    })
  })

  it('has the figure about once the lights are out and she is not dormant or gone', () => {
    expect(musicStateOf({ ...QUIET, lightsOut: true, figureMode: 'patrol' }).figureAbout).toBe(true)
    expect(musicStateOf({ ...QUIET, lightsOut: true, figureMode: 'dormant' }).figureAbout).toBe(false)
    expect(musicStateOf({ ...QUIET, lightsOut: false, figureMode: 'patrol' }).figureAbout).toBe(false)
  })

  it('is chasing while she hunts or follows Ada', () => {
    for (const mode of ['hunt', 'follow'])
      expect(musicStateOf({ ...QUIET, lightsOut: true, figureMode: mode }).chasing).toBe(true)
    for (const mode of ['patrol', 'investigate', 'flee', 'leaving'])
      expect(musicStateOf({ ...QUIET, lightsOut: true, figureMode: mode }).chasing).toBe(false)
  })

  it('is hidden while Ada hides, and its phase says paused, keypad or cutscene before anything else', () => {
    expect(musicStateOf({ ...QUIET, hidden: true }).hidden).toBe(true)
    expect(musicStateOf({ ...QUIET, paused: true }).phase).toBe('paused')
    expect(musicStateOf({ ...QUIET, keypadOpen: true }).phase).toBe('keypad')
    expect(musicStateOf({ ...QUIET, inCutscene: true }).phase).toBe('cutscene')
    expect(musicStateOf({ ...QUIET, paused: true, keypadOpen: true }).phase).toBe('paused')
  })
})
