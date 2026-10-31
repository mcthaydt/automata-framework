import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readGuides } from '../scripts/sync-guides'
import { syncDocs } from '../scripts/sync-docs'

// M8.6w: the site renders the framework's `docs/guide` at framework.ref; it keeps no hand copy of a guide (M8-D14).
const temps: string[] = []
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }) })
function framework(files: Record<string, string> | undefined): string {
  const dir = mkdtempSync(join(tmpdir(), 'guides-'))
  temps.push(dir)
  if (files) {
    mkdirSync(join(dir, 'docs', 'guide'), { recursive: true })
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, 'docs', 'guide', name), text)
  }
  return dir
}
const guide = (title: string, body = 'Body.\n', extra = '') => `---\ntitle: ${title}\ndescription: About ${title}.\norder: 1\n${extra}---\n\n# ${title}\n\n${body}`

describe('readGuides', () => {
  it('reads each guide as a docs section in the Guides category, ordered by its order and then its name', () => {
    const dir = framework({
      'b-second.md': guide('Second').replace('order: 1', 'order: 2'),
      'a-first.md': guide('First'),
      'c-third.md': guide('Third').replace('order: 1', 'order: 1'),
    })
    const guides = readGuides(dir)
    expect(guides.map((g) => g.slug)).toEqual(['guide-a-first', 'guide-c-third', 'guide-b-second'])
    expect(guides[0]).toMatchObject({ title: 'First', category: 'Guides', description: 'About First.' })
    expect(guides[0].content).toContain('# First')
    expect(guides[0].content).not.toContain('order: 1')
  })

  it('finds no guides, and no error, before the framework has written any', () => {
    expect(readGuides(framework(undefined))).toEqual([])
  })

  it('refuses a guide with no title or description, naming the file', () => {
    expect(() => readGuides(framework({ 'bad.md': '# No front matter\n' }))).toThrow(/bad\.md/)
    expect(() => readGuides(framework({ 'bad.md': '---\ntitle: T\n---\n# T\n' }))).toThrow(/description/)
  })

  it('points links between guides at the site pages, and leaves other links alone', () => {
    const dir = framework({
      'a.md': guide('A', 'See [B](./b.md#part) and [site](https://example.com) and [api](../api.md).\n'),
      'b.md': guide('B'),
    })
    const content = readGuides(dir)[0].content
    expect(content).toContain('[B](/docs/guide-b#part)')
    expect(content).toContain('[site](https://example.com)')
  })

  it('puts the guides into the docs the site publishes, and into llms-guides.txt', () => {
    const output = mkdtempSync(join(tmpdir(), 'guides-out-'))
    temps.push(output)
    const docs = syncDocs(output, { frameworkDir: framework({ 'a.md': guide('Publishing to itch.io', '## Steps\n\nRun butler.\n') }) })
    expect(docs.find((d) => d.slug === 'guide-a')?.category).toBe('Guides')
    expect(docs.find((d) => d.slug === 'guide-a')?.toc.map((t) => t.text)).toEqual(['Steps'])
    expect(readFileSync(join(output, 'static', 'llms-guides.txt'), 'utf8')).toContain('Run butler.')
  })
})
