import { describe, expect, it } from 'vitest'
import { embedPage } from './embed-page.ts'

const gameUrl = 'http://localhost:6380/html/placeholder/index.html'

/** The attributes of the page's one iframe, parsed from the HTML (the page is static, so a regex is enough). */
function frameAttributes(html: string): Record<string, string> {
  const tag = /<iframe\b([^>]*)>/.exec(html)?.[1]
  if (tag === undefined) throw new Error('no iframe')
  return Object.fromEntries([...tag.matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].map((m) => [m[1], m[2] ?? '']))
}

describe('the itch-like embed page', () => {
  it('frames the game from its own origin with fullscreen allowed, as itch.io does', () => {
    const frame = frameAttributes(embedPage({ gameUrl, blockStorage: false }))
    expect(frame.src).toBe(gameUrl)
    expect(frame).toHaveProperty('allowfullscreen')
    expect(frame.allow?.split(';').map((item) => item.trim())).toContain('fullscreen *')
    expect(frame).not.toHaveProperty('sandbox')
  })

  it('with blocked storage, sandboxes the frame without allow-same-origin so the browser denies it storage', () => {
    const frame = frameAttributes(embedPage({ gameUrl, blockStorage: true }))
    const tokens = frame.sandbox?.split(' ') ?? []
    expect(tokens).toContain('allow-scripts')
    expect(tokens).not.toContain('allow-same-origin')
    expect(frame.src).toBe(gameUrl)
  })

  it('escapes the game URL', () => {
    const html = embedPage({ gameUrl: 'http://localhost:1/"><script>x</script>', blockStorage: false })
    expect(html).not.toContain('<script>x')
    expect(frameAttributes(html).src).toBe('http://localhost:1/&quot;&gt;&lt;script&gt;x&lt;/script&gt;')
  })
})
