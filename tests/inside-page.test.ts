import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, within } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Footer from '../src/lib/components/Footer.svelte'
import Page from '../src/routes/inside/+page.svelte'
import { stackSections } from '../src/lib/stack'

// PRODUCT.4w. /inside lays out the framework's generated stack page and changes none of its words.

const markdown = readFileSync(resolve(import.meta.dirname, '../src/data/stack.md'), 'utf8')
const { intro, sections } = stackSections(markdown)

describe('/inside', () => {
  it('shows the framework’s title and one section per entry, each reachable from the overview', () => {
    const view = render(Page)
    expect(view.getByRole('heading', { level: 1, name: "What's inside" })).toBeTruthy()
    for (const section of sections) {
      const heading = view.getByRole('heading', { level: 2, name: section.title })
      expect(heading.id, section.title).toBe(section.id)
    }
    const overview = within(view.getByRole('region', { name: 'Libraries, tiers, versions and licenses' }))
    const libraries = intro.find(block => block.type === 'table')!.tableRows!.map(row => row[0]!.replace(/^\[|\]\(#.*\)$/g, ''))
    expect(libraries).toHaveLength(11)
    for (const name of libraries) {
      const link = overview.getByRole('link', { name })
      expect(view.container.querySelector(link.getAttribute('href')!), name).toBeTruthy()
    }
  })

  it('shows every package, version and license the framework’s tables list', () => {
    const view = render(Page)
    const words = (cell: string) => cell.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '')
    const cells = [...intro, ...sections.flatMap(section => section.blocks)].flatMap(block => block.type === 'table' ? block.tableRows!.flat() : [])
    expect(cells.length).toBeGreaterThan(30)
    const shown = [...view.container.querySelectorAll('td')].map(td => td.textContent)
    for (const cell of cells) expect(shown, cell).toContain(words(cell))
  })

  it('labels the tier of each library, Core or Plus', () => {
    const view = render(Page)
    expect(view.container.textContent).toMatch(/Tier:\s*Core/)
    expect(view.container.textContent).toMatch(/Tier:\s*Plus/)
  })

  it('leaks no markdown: no asterisks, backticks, link syntax or generated-file comment', () => {
    const text = render(Page).container.textContent!
    expect(text).not.toMatch(/\*\*|`|\]\(|<!--|Do not edit by hand/)
  })

  it('links the one framework file the page mentions to the framework’s source', () => {
    const view = render(Page)
    expect(view.getByRole('link', { name: 'versions.md' }).getAttribute('href')).toBe('https://github.com/mcthaydt/automata-framework/blob/main/docs/versions.md')
  })
})

describe('the footer', () => {
  it('links /inside', () => {
    expect(render(Footer).getByRole('link', { name: 'What’s inside' }).getAttribute('href')).toBe('/inside')
  })
})
