import type { AudioContent } from '@automata/audio-synth'

// What a Play press asks the page to sound. Audio's editor and Feel's preview both hand one to the page, so the type lives
// here and neither feature reaches into the other.

/** What a Play press asks the page to sound: the file as it is now, and which sound. */
export type AudioPlay = (
  content: AudioContent,
  what: { readonly kind: 'sound'; readonly id: string },
) => Promise<void>
