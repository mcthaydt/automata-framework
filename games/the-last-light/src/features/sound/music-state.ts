import type { MusicState } from '@automata/audio-synth'

/** What the sim and the screen report this step, for the music. */
export interface MusicInputs {
  readonly paused: boolean
  readonly keypadOpen: boolean
  readonly inCutscene: boolean
  /** The puzzle fact `lightsOut`. */
  readonly lightsOut: boolean
  /** The figure's mode in the creature's file (`dormant`, `patrol`, `hunt`, …). */
  readonly figureMode: string
  /** Ada is hiding. */
  readonly hidden: boolean
}

/**
 * The state the `music_rule` rows of `content/audio/audio.toml` read each frame. The rules are data (which slot plays when);
 * this fixes which facts they may ask about: the phase (`paused` and `keypad` hold the music, a cutscene has its own), whether
 * the lights are out, whether the figure is about (awake after the lights go) or chasing, and whether Ada hides.
 */
export function musicStateOf(inputs: MusicInputs): MusicState {
  const awake = inputs.figureMode !== 'dormant'
  return {
    phase: inputs.paused ? 'paused' : inputs.keypadOpen ? 'keypad' : inputs.inCutscene ? 'cutscene' : 'play',
    lightsOut: inputs.lightsOut,
    figureAbout: inputs.lightsOut && awake,
    chasing: inputs.figureMode === 'hunt' || inputs.figureMode === 'follow',
    hidden: inputs.hidden,
  }
}
