// The stage's brain: what `createFeel` would draw if the game's event happened, frame by frame, with the player's
// settings. It runs the real runtime (never a copy of it) on frame times it is given, so the preview is what the game
// plays. It never writes the file and never runs the game's simulation: it hears one made-up event.
import {
  type FeelContent,
  type FeelEntry,
  type FeelFrame,
  type FeelSettings,
  matches,
  type Pulse,
  createFeel as startFeel,
} from '@automata/feel'
import { systemClock } from '@automata/framework'

/** The view the stage's square stands for: the event is "about" it, so its squash and freeze land there. */
export const STAGE_SUBJECT = 1

/** An entry's `on` as an event the stage can make: every `*` becomes a name, so `player.*` plays `player.example`. */
export const stageEvent = (on: string): string => on.split('*').join('example')

/**
 * The frames of one event: it is heard at tick 0 on the stage's square, then `count` frames of `frameSeconds` are drawn.
 * Every entry whose pattern matches the event answers, as in the game.
 */
export function stageFrames(
  content: FeelContent,
  on: string,
  settings: FeelSettings,
  reduced: boolean,
  frameSeconds: number,
  count: number,
): FeelFrame[] {
  const feel = startFeel({
    content: () => content,
    settings: () => settings,
    reducedMotion: () => reduced,
    clock: systemClock,
  })
  feel.hear(0, [{ type: stageEvent(on), payload: { entity: STAGE_SUBJECT } }])
  return Array.from({ length: count }, () => feel.frame(0, 0, frameSeconds))
}

/** The other entries that answer the chosen entry's event too, by their place in the file. */
export function alsoPlays(entries: readonly FeelEntry[], index: number): number[] {
  const chosen = entries[index]
  if (chosen === undefined) return []
  const event = stageEvent(chosen.on)
  return entries.flatMap((entry, place) => (place !== index && matches(entry.on, event) ? [place] : []))
}

/** What the stage can reach on this device; each returns whether it happened. */
export interface StageOutputs {
  rumble(pulse: Pulse): boolean
  cue(id: string): boolean
}

interface Actuator {
  playEffect(type: 'dual-rumble', parameters: object): Promise<unknown>
}

/** A connected pad's motors, else the phone's buzz; the cue is played by whoever knows the game's sounds. */
export function browserOutputs(play: (cue: string) => boolean = () => true): StageOutputs {
  return {
    cue: play,
    rumble(pulse) {
      const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []
      const actuator = pads.flatMap((pad) =>
        pad === null ? [] : [(pad as unknown as { vibrationActuator?: Actuator }).vibrationActuator],
      )[0]
      if (actuator !== undefined) {
        void actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: pulse.ms,
          strongMagnitude: pulse.strong,
          weakMagnitude: pulse.weak,
        })
        return true
      }
      return typeof navigator.vibrate === 'function' && navigator.vibrate(pulse.phoneMs ?? pulse.ms)
    },
  }
}

/** What the stage says when the device cannot rumble. */
export const rumbleWords = (pulse: Pulse): string =>
  `Rumble: strong ${String(pulse.strong)}, light ${String(pulse.weak)} for ${String(pulse.ms)} ms`

/** What the stage says when the game has no such sound. */
export const cueWords = (id: string): string => `Plays the sound ${id}`

/** The lines the stage says for the rumbles and sounds in `frames` that the device or the game could not play. */
export function missedOutputs(frames: readonly FeelFrame[], outputs: StageOutputs): string[] {
  const said: string[] = []
  for (const frame of frames) {
    for (const pulse of frame.haptics) if (!outputs.rumble(pulse)) said.push(rumbleWords(pulse))
    for (const cue of frame.cues) if (!outputs.cue(cue)) said.push(cueWords(cue))
  }
  return said
}
