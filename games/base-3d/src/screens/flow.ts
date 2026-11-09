// base-3d's flow (M3 spec §4.7), as compiled content the runtime reads and checks the hash of at boot: splash → menu (the
// default title) → room (the default play) ⇄ paused ⇄ settings, and the end on the goal ember.
import type { CompiledContentData } from '@automataframework/automata'
import { canonicalJson, hex64, utf8, xxhash64 } from '@automataframework/automata-sim/hash'

const FLOW_DATA: CompiledContentData = {
  flow: {
    entry: 'splash',
    screens: ['end', 'paused', 'play', 'settings', 'splash', 'title'],
    terminal: [],
    // Sorted by from, event, then to, as the content compiler writes them.
    transitions: [
      { from: 'end', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'paused', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
      { from: 'paused', event: 'settings', to: 'settings', transition: 'cut' },
      { from: 'play', event: 'goal', to: 'end', transition: 'cut' },
      { from: 'play', event: 'pause', to: 'paused', transition: 'cut' },
      { from: 'settings', event: 'back', to: 'paused', transition: 'cut' },
      { from: 'splash', event: 'continue', to: 'title', transition: 'cut' },
      { from: 'title', event: 'play', to: 'play', transition: 'cut' },
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

/** The flow and its hash (`hex64(xxhash64(utf8(canonicalJson(data))))`, as `defaultContent` writes it). */
export const BASE3D_FLOW: { readonly data: CompiledContentData; readonly hash: string } = {
  data: FLOW_DATA,
  hash: hex64(xxhash64(utf8(canonicalJson(FLOW_DATA)))),
}
