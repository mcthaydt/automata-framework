import { type CompiledContentData, contentHashOf } from '@automata/framework'

// Shared by the two places that frame an example after the visitor has already pressed Play: the site's playground
// (its harness) and the runner's own pages when the address asks for it (`?play`, the site's 3D pages). Browser code:
// it imports the umbrella only.

interface Content {
  readonly data: CompiledContentData
  readonly hash: string
}

/**
 * The content a framed run starts with: the same, but entering the play screen instead of the default title, so the
 * visitor's one press on the page's Play is the only one. Only when the flow is the default one's shape (it starts at
 * `title` and `title` goes to `play`) and the game has no save: a game with a save keeps its title, where the player
 * picks a slot (core-saves). The hash is recomputed with the runtime's own `contentHashOf`, the function its boot check
 * runs, so the check passes. The sim is untouched: its seed, plugins and setup are not content.
 */
export function startAtPlay<C extends Content>(game: { readonly content: C; readonly saves?: unknown }): C {
  const { content } = game
  const { flow } = content.data
  const fromTitleToPlay = flow.transitions.some((step) => step.from === 'title' && step.to === 'play')
  if (game.saves !== undefined || flow.entry !== 'title' || !fromTitleToPlay) return content
  const data: CompiledContentData = { ...content.data, flow: { ...flow, entry: 'play' } }
  return { ...content, data, hash: contentHashOf(data) }
}
