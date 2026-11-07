import type { CompiledContentData } from '@automata/framework'
import { canonicalJson, hex64, utf8, xxhash64 } from '@automata/sim/hash'

// Emberwick's flow, as compiled content the runtime reads.

const FLOW_DATA: CompiledContentData = {
  flow: {
    entry: 'splash',
    screens: ['end', 'menu', 'paused', 'room', 'splash'],
    terminal: [],
    // Sorted by from, event, then to, as the content compiler writes them.
    transitions: [
      { from: 'end', event: 'play', to: 'room', transition: 'cut' },
      { from: 'end', event: 'quit', to: 'menu', transition: 'cut' },
      { from: 'menu', event: 'play', to: 'room', transition: 'cut' },
      { from: 'paused', event: 'quit', to: 'menu', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'room', transition: 'cut' },
      { from: 'room', event: 'goal', to: 'end', transition: 'cut' },
      { from: 'room', event: 'pause', to: 'paused', transition: 'cut' },
      { from: 'splash', event: 'continue', to: 'menu', transition: 'cut' },
    ],
  },
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: ['splash'],
  },
}

/**
 * Emberwick's screens and how they connect, as the runtime reads them (it checks the hash at boot). The
 * runtime pauses the room itself when the host goes to the background or opens its menu (`openMenu`).
 */
export const EMBERWICK_FLOW: { readonly data: CompiledContentData; readonly hash: string } = {
  data: FLOW_DATA,
  hash: hex64(xxhash64(utf8(canonicalJson(FLOW_DATA)))),
}
