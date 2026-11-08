// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readGuides } from '../../../src/shared/framework/guides.ts'

// The docs come from the framework's own `docs/guides/` at build time (W7): moving or renaming a guide fails here.
describe('readGuides', () => {
  const guides = readGuides()

  it('lists How it works, the editor guide and the four publish guides, in the order of index.md', () => {
    expect(guides.map((guide) => guide.slug)).toEqual([
      'how-it-works',
      'editor',
      'extensions',
      'publish-to-web',
      'publish-to-itch',
      'publish-to-desktop',
      'publish-to-ruken',
    ])
  })

  it('has a guide that says what an extension is and how to add one, and links the Reference', () => {
    const extensions = guides.find((guide) => guide.slug === 'extensions')
    expect(extensions?.title).toBe('Extensions: add what your game needs')
    expect(extensions?.content).toContain('pnpm add @automata/')
    expect(extensions?.content).toContain('](/api)')
  })

  it('names no count of packages in How it works, so adding one cannot make it wrong', () => {
    const text = guides.find((guide) => guide.slug === 'how-it-works')?.content ?? ''
    expect(text).not.toMatch(/\b(four|\d+) packages\b/i)
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

  describe('on a folder of its own', () => {
    let root = ''
    afterEach(() => rmSync(root, { recursive: true, force: true }))

    function folder(files: Record<string, string>): string {
      root = mkdtempSync(join(tmpdir(), 'guides-'))
      mkdirSync(join(root, 'docs/guides'), { recursive: true })
      for (const [name, text] of Object.entries(files)) writeFileSync(join(root, 'docs/guides', name), text)
      return root
    }

    it('leaves out a guide index.md does not list', () => {
      const dir = folder({
        'index.md': '# Guides\n\n1. [B](./b.md)\n',
        'a.md': '# A\n\nAbout a.\n',
        'b.md': '# B\n\nAbout b.\n',
      })
      expect(readGuides(dir).map((guide) => guide.slug)).toEqual(['b'])
    })

    it('stops the build on a listed guide that does not exist', () => {
      const dir = folder({ 'index.md': '# Guides\n\n1. [Gone](./gone.md)\n' })
      expect(() => readGuides(dir)).toThrow('docs/guides/index.md lists gone.md')
    })
  })
})
