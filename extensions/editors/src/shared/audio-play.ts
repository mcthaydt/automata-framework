import type { AudioContent } from '@automata/audio-synth'

/**
 * What a Play press asks the page to sound: the file as it is now, and which sound. Shared because Audio plays sounds
 * and Feel plays the sounds its effects name.
 */
export type AudioPlay = (
  content: AudioContent,
  what: { readonly kind: 'sound'; readonly id: string },
) => Promise<void>
