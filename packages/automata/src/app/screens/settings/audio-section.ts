// The Audio group's data: the player's audio choices and the words that name them. The buses are
// runtime's `AUDIO_BUS_NAMES`, in their order; ui does not import runtime, so their names are repeated here.

/** An audio bus (runtime's `AudioBusName`). */
export type AudioBus = 'master' | 'music' | 'sfx' | 'ui' | 'voice'
/** The buses the Audio group offers, in the order it shows them. */
export const AUDIO_BUSES: readonly AudioBus[] = ['master', 'music', 'sfx', 'ui', 'voice']

/** The player's audio choices (runtime's `AudioSettings`): the mutes, and a gain per bus from 0 to 1. */
export interface AudioValue {
  readonly muted: boolean
  readonly muteUnfocused: boolean
  readonly gains: Readonly<Record<AudioBus, number>>
}

/** One change in the Audio group: a toggle's new state, or a bus's new gain. */
export type AudioSectionChange =
  | { readonly kind: 'muted'; readonly value: boolean }
  | { readonly kind: 'muteUnfocused'; readonly value: boolean }
  | { readonly kind: 'gain'; readonly bus: AudioBus; readonly value: number }

/** Every word the Audio group shows, in the game's language. */
export interface AudioCopy {
  readonly title: string
  readonly mute: string
  /** "Mute in background": silent while another window has focus. */
  readonly muteUnfocused: string
  /** A toggle's state words. */
  readonly on: string
  readonly off: string
  readonly buses: Readonly<Record<AudioBus, string>>
  /** A gain as the player reads it: "50%". */
  percent(value: number): string
  /** When sound could not start (A-e). */
  readonly unavailable: string
  /** While the host's own volume is below full. */
  readonly hostVolume: string
}
