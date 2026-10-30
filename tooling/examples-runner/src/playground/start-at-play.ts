import { type CompiledContentData, contentHashOf } from '@mcthaydt/automata-runtime'

interface Content {
  readonly data: CompiledContentData
  readonly hash: string
}

/**
 * The content a playground run starts with: the same, but entering the play screen instead of the default title,
 * so an edit shows in the running game without a press on Play after every change. Only when the flow is the
 * default one's shape (it starts at `title` and `title` goes to `play`) and the game has no save: a game with a save
 * keeps its title, where the player picks a slot (core-saves). The hash is recomputed with the runtime's own
 * `contentHashOf`, the function its boot check runs, so the check passes. The sim is untouched: its seed, plugins and setup are not
 * content.
 */
export function startAtPlay<C extends Content>(game: { readonly content: C; readonly saves?: unknown }): C {
  const { content } = game
  const { flow } = content.data
  const fromTitleToPlay = flow.transitions.some((step) => step.from === 'title' && step.to === 'play')
  if (game.saves !== undefined || flow.entry !== 'title' || !fromTitleToPlay) return content
  const data: CompiledContentData = { ...content.data, flow: { ...flow, entry: 'play' } }
  return { ...content, data, hash: contentHashOf(data) }
}
