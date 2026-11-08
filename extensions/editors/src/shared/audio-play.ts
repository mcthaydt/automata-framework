// The page's sound player as an editor sees it. Audio plays a sound with it, and Feel plays the sound a feel names, so
// the type is shared rather than imported from one feature by the other.
import type { AudioContent } from '@automata/audio-synth'

/** What a Play press asks the page to sound: the file as it is now, and which sound. */
export type AudioPlay = (
  content: AudioContent,
  what: { readonly kind: 'sound'; readonly id: string },
) => Promise<void>
