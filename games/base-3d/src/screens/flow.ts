// base-3d's flow (M3 spec §4.7, DESIGN.md §13), as compiled content the runtime reads and checks the hash of at boot:
// splash → menu (the default title) → room (the default play) ⇄ paused ⇄ settings, the end on the ember, and the
// game over when Wick is defeated: Continue plays on from the area entrance, Quit goes to the menu. Play ⇄ items (the
// I key and the HUD's Items button, GAME-3D.1e part 5b) and play ⇄ map (the M key and the HUD's Map button, 5c).
import type { CompiledContentData } from '@mcthaydt/automata-runtime'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'

const FLOW_DATA: CompiledContentData = {
  flow: {
    entry: 'splash',
    screens: ['end', 'game-over', 'items', 'map', 'paused', 'play', 'settings', 'splash', 'title'],
    terminal: [],
    // Sorted by from, event, then to, as the content compiler writes them.
    transitions: [
      { from: 'end', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'game-over', event: 'continue', to: 'play', transition: 'cut' },
      { from: 'game-over', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'items', event: 'back', to: 'play', transition: 'cut' },
      { from: 'map', event: 'close', to: 'play', transition: 'cut' },
      { from: 'paused', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
      { from: 'paused', event: 'settings', to: 'settings', transition: 'cut' },
      { from: 'play', event: 'defeated', to: 'game-over', transition: 'cut' },
      { from: 'play', event: 'ember', to: 'end', transition: 'cut' },
      { from: 'play', event: 'items', to: 'items', transition: 'cut' },
      { from: 'play', event: 'map', to: 'map', transition: 'cut' },
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
