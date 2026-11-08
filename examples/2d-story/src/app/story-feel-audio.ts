import { content } from 'virtual:automata/content'
import { audioSchema, type MusicState } from '@automata/audio-synth'
import { type AudioNote, type AudioStageHandle, audioStage, tracksFrom } from '@automata/audio-synth/stage'
import { feelSchema } from '@automata/feel'
import { feelStage } from '@automata/feel/stage'
import type { GameAudioStart, PixiStage, PixiStageHooks } from '@automata/framework'
import { LEVEL } from '../features/level/level.ts'

// What the player feels and hears, from the files Feel and Audio write (`content/feel/feel.toml`, `content/audio/audio.toml`
// and the tracks in `assets/music`). Both are presentation: they hear the sim's events and never write it. A game with no such
// file feels and hears nothing extra, and a file saved in the editors shows on the next run of the story.

const feelTable = feelSchema.parse(content.feel?.feel ?? {})
const audioTable = audioSchema.parse(content.audio?.audio ?? {})

/** The music files a person put in `assets/music`, by their names in Audio. */
const found: Record<string, string> = import.meta.glob('/assets/music/*', {
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
}
export const log: FeelAudioLog = { cues: [], music: null, tracks: Object.keys(tracks) }

/** The sound player's handle once audio runs: Feel plays the sounds it names through it. */
let sounds: AudioStageHandle | undefined

/** Feel on the renderer's stage: shakes, flashes, freezes, squashes and words, with its sounds and rumbles handed on. */
export function feelOnStage(stage: PixiStage): PixiStageHooks {
  return feelStage({
    content: () => feelTable,
    size: { width: LEVEL.width, height: LEVEL.height },
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
    onFault: (message) => console.warn(message),
  })(services)
  return () => {
    stopWatching()
    stop?.()
    sounds = undefined
  }
}
