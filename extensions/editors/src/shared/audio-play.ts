// How an editor asks the page to sound something: Audio's Play, and Feel's sounds, which play through Audio's player.
// Both take it from app/, so the type lives here rather than in either feature.
import type { AudioContent } from '@automata/audio-synth'

/** What a Play press asks the page to sound: the file as it is now, and which sound. */
export type AudioPlay = (
  content: AudioContent,
  what: { readonly kind: 'sound'; readonly id: string },
) => Promise<void>
