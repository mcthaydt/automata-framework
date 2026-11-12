import type { ContentLevel } from '@automata/content/level-2d'

// Where a script's anchors stand on a 2D level. The only anchor a flat level has is `actor:<name>`: a character the
// person named in the editor, at the point they put it. The level is in pixels and a script in metres, so this divides by
// the metre once. Starting a character at `actor:<name>` means moving it in the editor moves its scene too.

/** The point of an anchor in metres, or undefined when the level lacks it. Pass it to `placeScript` and to the lint's world. */
export type AnchorOf = (anchor: string) => { readonly x: number; readonly z: number } | undefined

/** The anchors of `level`'s named characters; `metre` is level pixels to a metre. */
export function levelAnchors(level: ContentLevel, metre: number): AnchorOf {
  const named = new Map<string, { readonly x: number; readonly z: number }>()
  for (const layer of level.layers)
    if (layer.kind === 'entities')
      for (const item of layer.items) {
        const name = item.fields.name
        if (typeof name === 'string' && name !== '') named.set(name, { x: item.x / metre, z: item.y / metre })
      }
  return (anchor) => (anchor.startsWith('actor:') ? named.get(anchor.slice('actor:'.length)) : undefined)
}
