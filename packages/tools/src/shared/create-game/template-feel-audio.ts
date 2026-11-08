import type { TemplateFile } from './template-file.ts'

// What the player feels and hears, wired the same way in every kind of game: Feel on the renderer's stage and Audio on the
// game's audio, both read from the files the editors write. The one thing that differs is where the game's size comes from
// (a 2D game's is its level's, a 3D game's is its screen's), so that is the one thing this takes.

/** Where a game's size is found: the import line that brings it in, and the expression that is `{ width, height }`. */
export interface GameSize {
  readonly import: string
  readonly expr: string
}

/** The game's `src/app/feel-audio.ts`. */
export const feelAudioFile = (size: GameSize): TemplateFile => ({
  path: 'src/app/feel-audio.ts',
  content: () => `import { content } from 'virtual:automata/content'
import { audioSchema } from '@automata/audio-synth'
import { type AudioStageHandle, audioStage, tracksFrom } from '@automata/audio-synth/stage'
import { feelSchema } from '@automata/feel'
import { feelStage } from '@automata/feel/stage'
import type { GameAudioStart, PixiStage, PixiStageHooks } from '@automata/framework'
${size.import}

// What the player feels and hears, from the files the Feel and Audio editors write (content/feel/feel.toml,
// content/audio/audio.toml and the tracks in assets/music). Both only present: they hear the sim's events and never write
// it. A file saved in the editors shows the next time the game starts, which \`pnpm dev\` does for you.

const feelTable = feelSchema.parse(content.feel?.feel ?? {})
const audioTable = audioSchema.parse(content.audio?.audio ?? {})

/** The music files a person put in assets/music, by their names in Audio (relative, so the build names no root path). */
const found: Record<string, string> = import.meta.glob('../../assets/music/*', {
  eager: true,
  query: '?url',
  import: 'default',
})
const tracks = tracksFrom(found)

/** The sound player once audio runs: Feel plays the sounds it names through it. */
let sounds: AudioStageHandle | undefined

/** Feel on the renderer's stage: shakes, flashes, freezes, squashes and words, with its sounds and rumbles handed on. */
export function feelOnStage(stage: PixiStage): PixiStageHooks {
  return feelStage({
    content: () => feelTable,
    size: ${size.expr},
    onCue: (cue) => void sounds?.cue(cue),
    onHaptic: (pulse) => {
      // A phone buzzes once; a game pad's motors are the host's to drive.
      if (pulse.phoneMs !== undefined) navigator.vibrate?.(pulse.phoneMs)
    },
  })(stage)
}

/** The audio player: the sounds the events name, and the music the rules pick (rules that ask for nothing play at once). */
export const audio: GameAudioStart = (services) => {
  const stop = audioStage({
    content: () => audioTable,
    tracks,
    state: () => ({}),
    ready: (handle) => {
      sounds = handle
    },
    onFault: (message) => console.warn(message),
  })(services)
  return () => {
    stop?.()
    sounds = undefined
  }
}
`,
})
