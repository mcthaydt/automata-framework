// The text of `virtual:automata/content`. The Vite plugin serves it, and the phone app writes the same text
// into the game it plays, so a game reads one module whichever of them built it.

import type { CompiledContent } from './compile-tree'

/** The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`. */
export const VIRTUAL_MODULE_ID = 'virtual:automata/content'

/**
 * The source text of `virtual:automata/content` for compiled content. `simContent` is built from `content`'s own
 * properties (`{ "room": content["room"], ... }`) rather than a second JSON literal, so the bundle holds the data
 * once and the two share their objects.
 */
export const contentModuleText = (content: CompiledContent): string => {
  const simFields = Object.keys(content.sim.data)
    .sort()
    .map((kind) => `${JSON.stringify(kind)}: content[${JSON.stringify(kind)}]`)
  return [
    `export const content = ${content.files.get('content.json') ?? '{}'}`,
    `export const contentHash = ${JSON.stringify(content.hash)}`,
    `export const simContent = { ${simFields.join(', ')} }`,
    `export const simContentHash = ${JSON.stringify(content.sim.hash)}`,
    '',
  ].join('\n')
}
