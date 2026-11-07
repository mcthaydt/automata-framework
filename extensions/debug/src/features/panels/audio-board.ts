// The audio board's port: every cue and bed of the `audio` content, with the events that play each cue, over the controls
// the game has (its mixer's `play`, the synth's beds). The content is read each time, so a reload shows.
import type { AudioContent } from '@automata/audio-synth'
import type { AudioBoardPort } from '../../shared/host'

/**
 * What the audio board needs from the game's mixer and synth: play a cue, start or stop a bed and
 * say which beds are playing.
 */
export interface AudioControls {
  play(cue: string): void
  startBed(id: string): void
  stopBed(id: string): void
  playing(): readonly string[]
}

/**
 * Builds the audio board for the debug overlay from the game's audio content and its controls. The
 * content is read each time, so a reload shows.
 */
export function audioBoard(content: () => AudioContent, controls: AudioControls): AudioBoardPort {
  return {
    cues: () => {
      const now = content()
      return (now.cue ?? []).map((cue) => ({
        id: cue.id,
        bus: cue.bus,
        ...(cue.about === undefined ? {} : { about: cue.about }),
        draft: cue.draft === true,
        events: (now.event ?? []).filter((e) => e.cue === cue.id).map((e) => e.on),
      }))
    },
    beds: () =>
      (content().bed ?? []).map((bed) => ({
        id: bed.id,
        bus: bed.bus,
        ...(bed.about === undefined ? {} : { about: bed.about }),
        draft: bed.draft === true,
      })),
    play: (cue) => controls.play(cue),
    startBed: (id) => controls.startBed(id),
    stopBed: (id) => controls.stopBed(id),
    playing: () => controls.playing(),
  }
}
