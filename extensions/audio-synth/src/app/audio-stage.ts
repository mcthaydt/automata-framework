// A game's own audio player: the audio table playing in the running game. Cues sound for the sim's events (the event map's
// rows), and music follows the game's state through the music rules, switching tracks with the slot's fade. It plays
// through core's audio service and its buses (never a context of its own), hears the presentation bus and never writes
// the sim. Nothing sounds before the player's first tap: the browser keeps the audio locked until then.

import { type Clock, type GameAudioStart, systemClock } from '@automata/framework'
import { createAudioSynth } from '../features/synth/audio-synth'
import { createMusicDirector, type MusicDirector, type MusicState } from '../features/synth/music'
import { createMusicPlayer, type MusicPlayer } from '../features/synth/music-player'
import type { AudioContent } from '../shared/audio.schema'

/** What a game gives `audioStage`. */
export interface AudioStageOptions {
  /** The audio table (read live, so a saved change shows on the next event or the next music check). */
  readonly content: () => AudioContent
  /** The imported music: a track's name to the address of its file (`tracksFrom`). */
  readonly tracks?: Readonly<Record<string, string>> | undefined
  /** What the game is in, for the music rules to read (`{ mode: 'chase' }`). Asked about ten times a second. */
  readonly state?: (() => MusicState) | undefined
  readonly clock?: Clock | undefined
  /** Fetches a music file's bytes. Default: `fetch`. */
  readonly load?: ((url: string) => Promise<ArrayBuffer>) | undefined
  /** Something would not play (a missing music file): say it where the game says such things. */
  readonly onFault?: ((message: string) => void) | undefined
  /** Hands the game the means to play a cue by name once audio is running (Feel's sounds, a button's click). */
  readonly ready?: ((handle: AudioStageHandle) => void) | undefined
  /** Hears what sounds: each cue as it plays, and the music as it is asked for. For a debug panel or a test. */
  readonly watch?: ((note: AudioNote) => void) | undefined
}

/** What the game may do with the player once it runs. */
export interface AudioStageHandle {
  /** Plays the cue called `id` now. False before the audio is unlocked, or when the table has no such cue. */
  cue(id: string): boolean
}

/** What the player did: a cue sounded, or this music was asked for (`null` is silence). */
export type AudioNote = { readonly cue: string } | { readonly music: string | null }

/** How often the music asks the game what state it is in. */
const MUSIC_EVERY_MS = 100

/** The `audio` of `defineGame`: `defineGame({ audio: audioStage({ content, tracks, state }) })`. */
export function audioStage(options: AudioStageOptions): GameAudioStart {
  return ({ audio, bus }) => {
    const clock = options.clock ?? systemClock
    const synth = createAudioSynth({
      content: options.content,
      port: {
        input: (name) => audio.input(name),
        duck: (name, amount, seconds) => audio.duck(name, amount, seconds),
      },
    })
    // The picture and the sound share a step: a cue sounds as the step that caused it is drawn.
    const stopHearing = bus.subscribe('sim.step', ({ tick, events }) => {
      // Before the unlock nothing can sound, and an event heard now must not sound late once it is unlocked.
      if (!audio.unlocked.get()) return
      synth.hear(tick, events)
      for (const id of synth.frame(tick).played) options.watch?.({ cue: id })
    })
    options.ready?.({
      cue(id) {
        if (!audio.unlocked.get() || !synth.play(id)) return false
        options.watch?.({ cue: id })
        return true
      },
    })

    let player: MusicPlayer | undefined
    let director: MusicDirector | undefined
    let directedFor: AudioContent | undefined
    let last = clock.now()
    let asked: string | null = null
    let stopped = false
    let timer: unknown
    const checkMusic = (): void => {
      timer = clock.setTimeout(checkMusic, MUSIC_EVERY_MS)
      const now = clock.now()
      const seconds = (now - last) / 1000
      last = now
      if (!audio.unlocked.get()) return
      const content = options.content()
      if (player === undefined) {
        const output = audio.input('music')
        player = createMusicPlayer({
          context: output.context as BaseAudioContext,
          output,
          tracks: options.tracks ?? {},
          load: options.load,
          onFault: options.onFault,
        })
      }
      // A saved change to the slots or rules starts a director over them.
      if (director === undefined || directedFor !== content) {
        director = createMusicDirector({ slots: content.slot ?? [], rules: content.music_rule ?? [] })
        directedFor = content
      }
      player.setMaster(content.master_gain ?? 1)
      const picked = director.step(options.state?.() ?? {}, seconds)
      const slot = picked === null ? null : ((content.slot ?? []).find((each) => each.id === picked) ?? null)
      player.play(slot)
      if (asked !== (slot?.id ?? null)) {
        asked = slot?.id ?? null
        options.watch?.({ music: asked })
      }
    }
    timer = clock.setTimeout(checkMusic, MUSIC_EVERY_MS)

    return () => {
      if (stopped) return
      stopped = true
      clock.clearTimeout(timer)
      stopHearing()
      player?.dispose()
    }
  }
}
