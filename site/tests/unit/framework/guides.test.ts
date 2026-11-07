// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readGuides } from '../../../src/shared/framework/guides.ts'

// The docs come from the framework's own `docs/guides/` at build time (W7): moving or renaming a guide fails here.
describe('readGuides', () => {
  const guides = readGuides()

  it('lists the editor guide and the four publish guides', () => {
    expect(guides.map((guide) => guide.slug)).toEqual(
      expect.arrayContaining([
        'editor',
        'publish-to-desktop',
        'publish-to-itch',
        'publish-to-ruken',
        'publish-to-web',
      ]),
    )
  })

  it('takes each title from its heading and keeps the body below it', () => {
    const editor = guides.find((guide) => guide.slug === 'editor')
    expect(editor?.title).toBe('Draw levels in the editor')
    expect(editor?.content.startsWith('# ')).toBe(false)
    expect(editor?.description.length).toBeGreaterThan(0)
  })

  it('points a link to another guide at its page', () => {
    for (const guide of guides) expect(guide.content).not.toMatch(/\]\(\.\/[a-z0-9-]+\.md/)
  })
})
