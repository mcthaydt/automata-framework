import { content } from 'virtual:automata/content'
import { audioSchema, type MusicState } from '@automata/audio-synth'
import { type AudioNote, type AudioStageHandle, audioStage, tracksFrom } from '@automata/audio-synth/stage'
import { type FeelFrame, feelSchema } from '@automata/feel'
import { feelStage } from '@automata/feel/stage'
import type { GameAudioStart, PixiStage, PixiStageHooks } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'

// What the player feels and hears, from the files Feel and Audio write (`content/feel/feel.toml`, `content/audio/audio.toml`
// and the tracks in `assets/music`). Both are presentation: they hear the sim's events and never write it. A game with no such
// file feels and hears nothing extra, and a file saved in the editors shows on the next run of the story.

const feelTable = feelSchema.parse(content.feel?.feel ?? {})
const audioTable = audioSchema.parse(content.audio?.audio ?? {})

/** The music files a person put in `assets/music`, by their names in Audio. */
const found: Record<string, string> = import.meta.glob('../../assets/music/*', {
  eager: true,
  query: '?url',
  import: 'default',
})
const tracks = tracksFrom(found)

/** What a test or a debug panel can read of what played: the cues, and the music asked for. */
export interface FeelAudioLog {
  readonly cues: string[]
  music: string | null
  /** The music files the game found. */
  readonly tracks: readonly string[]
  /** What the sound player could not do (a sound it could not make, a track it could not load); empty when all went well. */
  readonly faults: string[]
  /** What the player saw: the frames a shake, a flash and a tint were on, and the words that showed. */
  readonly felt: { shake: number; flash: number; tint: number; words: string[] }
}
export const log: FeelAudioLog = {
  cues: [],
  music: null,
  tracks: Object.keys(tracks),
  faults: [],
  felt: { shake: 0, flash: 0, tint: 0, words: [] },
}

// The journeys read this log from the dev page (what played, what the player saw). It is set again each time the module is
// evaluated, which a saved change to the files above does. A release build defines `__AUTOMATA_DEBUG__` false: it never ships.
declare const __AUTOMATA_DEBUG__: boolean
if (__AUTOMATA_DEBUG__) (globalThis as { __storyLog?: unknown }).__storyLog = log

/** Counts one drawn frame into `log.felt`. */
export function noteFrame(frame: FeelFrame): void {
  if (frame.offset[0] !== 0 || frame.offset[1] !== 0) log.felt.shake += 1
  if (frame.flash !== null) log.felt.flash += 1
  if (frame.tint !== null) log.felt.tint += 1
  for (const word of frame.words) if (word.words !== undefined) log.felt.words.push(word.words)
}

/** The sound player's handle once audio runs: Feel plays the sounds it names through it. */
let sounds: AudioStageHandle | undefined

/** Feel on the renderer's stage: shakes, flashes, freezes, squashes and words, with its sounds and rumbles handed on. */
export function feelOnStage(stage: PixiStage): PixiStageHooks {
  return feelStage({
    content: () => feelTable,
    size: { width: LEVEL.width, height: LEVEL.height },
    onFrame: noteFrame,
    onCue: (cue) => void sounds?.cue(cue),
    onHaptic: (pulse) => {
      // A phone buzzes once; a game pad's motors are the host's to drive.
      if (pulse.phoneMs !== undefined) navigator.vibrate?.(pulse.phoneMs)
    },
  })(stage)
}

/**
 * What the music rules read, from what happens: `mode` is `chase` while the guard hunts or follows, else `calm`.
 * (The guard's modes are the Schematic's: patrol, hunt, follow.)
 */
function watchMode(bus: Parameters<GameAudioStart>[0]['bus'], state: { mode: string }): () => void {
  return bus.subscribe('sim.events', (events) => {
    for (const event of events) {
      if (event.type !== 'systems.mode') continue
      const to = (event.payload as { to?: unknown }).to
      state.mode = to === 'patrol' ? 'calm' : 'chase'
    }
  })
}

/** The audio player: the event map's sounds and the music the rules pick for the story's state. */
export const audio: GameAudioStart = (services) => {
  const state = { mode: 'calm' }
  const stopWatching = watchMode(services.bus, state)
  const note = (what: AudioNote): void => {
    if ('cue' in what) log.cues.push(what.cue)
    else log.music = what.music
  }
  const stop = audioStage({
    content: () => audioTable,
    tracks,
    state: (): MusicState => state,
    ready: (handle) => {
      sounds = handle
    },
    watch: note,
    onFault: (message) => {
      log.faults.push(message)
      console.warn(message)
    },
  })(services)
  return () => {
    stopWatching()
    stop?.()
    sounds = undefined
  }
}
