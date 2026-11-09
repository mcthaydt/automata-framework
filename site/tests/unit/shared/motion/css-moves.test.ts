import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const search = read('src/features/search/search.css')
const header = read('src/shared/components/Header.svelte')
const copy = read('src/shared/components/CopyButton.svelte')

/** The text of every `@media (prefers-reduced-motion: no-preference) { ... }` block, braces balanced. */
function motionBlocks(css: string): string {
  const blocks: string[] = []
  const opener = '@media (prefers-reduced-motion: no-preference) {'
  let from = 0
  for (;;) {
    const start = css.indexOf(opener, from)
    if (start < 0) break
    let depth = 1
    let end = start + opener.length
    while (depth > 0 && end < css.length) {
      depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0
      end += 1
    }
    blocks.push(css.slice(start, end))
    from = end
  }
  return blocks.join('\n')
}

// Small entrances for the things a visitor asks for. They only enter: closing is instant, so Escape never waits.
describe('the small CSS moves', () => {
  it('lets the search dialog rise in and its backdrop fade in', () => {
    const moves = motionBlocks(search)
    expect(moves).toMatch(
      /\.search-dialog\[open\]\s*\{[^}]*animation:\s*motion-rise var\(--t-ui\) var\(--ease-out\)/,
    )
    expect(moves).toMatch(/\.search-dialog\[open\]::backdrop\s*\{[^}]*animation:\s*motion-fade var\(--t-ui\)/)
  })

  it('lets the phone menu rise in', () => {
    expect(motionBlocks(header)).toMatch(
      /\.menu\[open\] nav\s*\{[^}]*animation:\s*motion-rise var\(--t-ui\) var\(--ease-out\)/,
    )
  })

  it('fades the copy tick and its status in', () => {
    const moves = motionBlocks(copy)
    expect(moves).toMatch(/motion-fade var\(--t-ui\)/)
    expect(moves).toMatch(/\.copy-control span:not\(:empty\)/)
    expect(moves).toMatch(/button\.ticked :global\(svg\)/)
  })

  it('animates nothing on close', () => {
    for (const css of [search, header, copy]) {
      expect(css).not.toMatch(/\.search-dialog:not\(\[open\]\)|\.menu:not\(\[open\]\) nav\s*\{[^}]*animation/)
    }
  })

  it('names the keyframes only inside a no-preference block', () => {
    for (const css of [search, header, copy]) {
      const outside = css.replace(motionBlocks(css), '')
      expect(outside).not.toMatch(/motion-(rise|fade)/)
    }
  })
})
