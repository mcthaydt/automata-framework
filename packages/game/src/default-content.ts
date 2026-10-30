// The content a game gets when it has no `content/` folder (DX spec §3.1): the default screens' flow and the
// facts Ruken needs, hashed with the content compiler's formula so the runtime's boot check passes unchanged.
import type { CompiledContentData } from '@mcthaydt/automata-runtime'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'

export interface GameContent {
  readonly data: CompiledContentData
  /** `hex64(xxhash64(utf8(canonicalJson(data))))`, as `@mcthaydt/automata-content` writes it. */
  readonly hash: string
}

const DATA: CompiledContentData = {
  flow: {
    entry: 'title',
    screens: ['title', 'play', 'paused', 'settings'],
    terminal: [],
    transitions: [
      { from: 'title', event: 'play', to: 'play', transition: 'cut' },
      { from: 'play', event: 'pause', to: 'paused', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
      { from: 'paused', event: 'quit', to: 'title', transition: 'cut' },
      { from: 'paused', event: 'settings', to: 'settings', transition: 'cut' },
      { from: 'settings', event: 'back', to: 'paused', transition: 'cut' },
    ],
  },
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: ['title'],
  },
}

let content: GameContent | undefined

const hashed = (data: CompiledContentData): GameContent => ({
  data,
  hash: hex64(xxhash64(utf8(canonicalJson(data)))),
})

/**
 * The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings` (M4.4), and its hash. With `preload`,
 * the title screen waits for those files (`assets`), which the runtime fetches with byte progress under the stall
 * rule before the renderer starts.
 */
export function defaultContent(preload: readonly string[] = []): GameContent {
  if (preload.length > 0) return hashed({ ...DATA, assets: { screens: { title: { files: [...preload] } } } })
  content ??= hashed(DATA)
  return content
}
