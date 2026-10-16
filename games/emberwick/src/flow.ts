import type { CompiledContentData } from '@mcthaydt/automata-runtime'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'
// Which screen shows. Stand-in for the runtime's Flow manager (M1.5): a pure table, so every transition is
// tested without a browser. Events that make no sense on a screen leave it where it is.

export type Screen = 'splash' | 'menu' | 'room' | 'paused' | 'end'

export type FlowEvent =
  | 'continue' // splash: any key or tap
  | 'play' // menu Play, end Play again
  | 'pause' // the Pause button, Escape or P
  | 'resume'
  | 'quit' // back to the menu
  | 'goal' // the sim's goal.reached
  | 'background' // the host's lifecycle went to background (tab hidden, host overlay, ad)
  | 'menu-request' // the host's "Open game menu"

const TRANSITIONS: Readonly<Record<Screen, Partial<Record<FlowEvent, Screen>>>> = {
  splash: { continue: 'menu' },
  menu: { play: 'room' },
  room: { pause: 'paused', background: 'paused', 'menu-request': 'paused', goal: 'end' },
  paused: { resume: 'room', quit: 'menu' },
  end: { play: 'room', quit: 'menu' },
}

export function next(screen: Screen, event: FlowEvent): Screen {
  return TRANSITIONS[screen][event] ?? screen
}

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
