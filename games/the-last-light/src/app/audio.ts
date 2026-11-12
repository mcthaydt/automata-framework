import { content } from 'virtual:automata/content'
import { audioSchema, type MusicState, stepCue } from '@automata/audio-synth'
import { type AudioStageHandle, audioStage } from '@automata/audio-synth/stage'
import type { GameAudioStart } from '@automata/framework'
import { InSector, resolvedMap } from '@automata/sectors/sim'
import type { SimContext } from '@automata/sim'
import { LEVEL } from '../features/room/room.ts'
import { musicInputsOf } from '../features/sound/music-inputs.ts'
import { musicStateOf } from '../features/sound/music-state.ts'
import { soundEventsOf } from '../features/sound/sound-events.ts'
import { Ada } from '../shared/ada.component.ts'
import { live } from './live.ts'
import { screen } from './screen-state.ts'

// The sound: the audio file (`content/audio/audio.toml`) played through core's buses. The cues answer the sim's events (and the
// names the game gives them), Ada's steps sound by the floor under her, and the music follows the night's state. It never
// writes the sim.

const table = audioSchema.parse((content as unknown as { audio?: { audio?: unknown } }).audio?.audio ?? {})

/** The music files the game ships, by the name a slot knows them (`public/music/<name>.ogg`). */
const TRACKS: Readonly<Record<string, string>> = Object.fromEntries(
  ['the-last-light', 'four-seventeen', 'back-to-bed-ada'].map((name) => [name, `music/${name}.ogg`]),
)

/** The recorded effects the cues name, which the page fetches before the first frame (`defineGame`'s `preload`). */
export const SOUND_FILES: readonly string[] = (table.cue ?? []).flatMap((cue) =>
  cue.sound === undefined ? [] : [cue.sound],
)

/** The cue plays once the audio runs: a cutscene's `sound` key, or a tap. */
export const sounds: { handle: AudioStageHandle | undefined } = { handle: undefined }

/** The floor texture of the room Ada stands in, from the sim's view of her place on the plan. */
function floorUnderAda(): string | undefined {
  const sim = live.sim
  const [ada] = sim?.query(Ada, InSector) ?? []
  if (sim === undefined || ada === undefined) return undefined
  const room = resolvedMap(sim as unknown as SimContext).sectors[ada.get(InSector).sector - 1]
  return LEVEL.sectors.find((sector) => sector.id === room?.id)?.floorTexture
}

/** The audio player of the game, for `defineGame({ audio })`. */
export const audio: GameAudioStart = (services) => {
  // The rows hear the sim's types and the names the game adds to them; a step's noise sounds by the floor it was made on.
  const bus = {
    ...services.bus,
    subscribe: ((name: string, listener: (fact: never) => void) =>
      name === 'sim.step'
        ? services.bus.subscribe('sim.step', (fact) => {
            for (const event of fact.events)
              if (event.type === 'systems.noise' && (event.payload as { kind?: string }).kind === 'step') {
                const cue = stepCue(table.steps, floorUnderAda())
                if (cue !== undefined) sounds.handle?.cue(cue)
              }
            listener({ ...fact, events: [...fact.events, ...soundEventsOf(fact.events)] } as never)
          })
        : services.bus.subscribe(name as 'sim.step', listener as never)) as typeof services.bus.subscribe,
  }
  const stop = audioStage({
    content: () => table,
    tracks: TRACKS,
    state: (): MusicState => musicStateOf(musicInputsOf(live.sim, screen.keypadOpen)),
    ready: (handle) => {
      sounds.handle = handle
    },
    onFault: (message) => console.warn(message),
  })({ ...services, bus })
  return () => {
    stop?.()
    sounds.handle = undefined
  }
}
