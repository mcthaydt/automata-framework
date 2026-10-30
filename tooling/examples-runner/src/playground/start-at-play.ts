import type { CompiledContentData } from '@mcthaydt/automata-runtime'
import { canonicalJson, hex64, utf8, xxhash64 } from '@mcthaydt/automata-sim/hash'

interface Content {
  readonly data: CompiledContentData
  readonly hash: string
}

/**
 * The content a playground run starts with: the same, but entering the play screen instead of the default title,
 * so an edit shows in the running game without a press on Play after every change. Only when the flow is the
 * default one's shape (it starts at `title` and `title` goes to `play`); a game's own flow is left as it is. The
 * hash is recomputed with the content compiler's formula, as the game package hashes its default content, so the
 * runtime's boot check passes. The sim is untouched: its seed, plugins and setup are not content.
 */
export function startAtPlay<C extends Content>(content: C): C {
  const { flow } = content.data
  const fromTitleToPlay = flow.transitions.some((step) => step.from === 'title' && step.to === 'play')
  if (flow.entry !== 'title' || !fromTitleToPlay) return content
  const data: CompiledContentData = { ...content.data, flow: { ...flow, entry: 'play' } }
  return { ...content, data, hash: hex64(xxhash64(utf8(canonicalJson(data)))) }
}
