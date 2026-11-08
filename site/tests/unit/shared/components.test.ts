import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CodeBlock from '#src/shared/components/CodeBlock.svelte'
import Footer from '#src/shared/components/Footer.svelte'
import Header from '#src/shared/components/Header.svelte'
import { REPOSITORY_PUBLIC } from '#src/shared/site.js'
import { highlightCode } from '#src/shared/utils/highlight.ts'

describe('UI Components', () => {
  it('the command box renders command text and a copy button', () => {
    const { getByText, getByRole } = render(CodeBlock, {
      props: { code: 'npx automata create-game', variant: 'command' },
    })
    expect(getByText('npx automata create-game')).toBeTruthy()
    expect(getByRole('button', { name: /copy/i })).toBeTruthy()
  })

  it('highlightCode returns highlighted html string', async () => {
    const html = await highlightCode('const x = 1;', 'typescript')
    expect(html).toContain('const')
    expect(html).toContain('pre')
  })

  it('leads the header with the five pages a visitor looks for, and Make a game', () => {
    const view = render(Header)
    const main = view.getByRole('navigation', { name: 'Main navigation' })
    expect([...main.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'Docs',
      'Examples',
      'Editor',
      'Reference',
      'Changelog',
    ])
    expect(view.getByRole('link', { name: 'Make a game' }).getAttribute('href')).toBe('/start')
  })

  it("links GitHub only once the repository is public, so no visitor meets GitHub's 404", () => {
    const view = render(Header)
    // REPOSITORY_PUBLIC is false until the Owner opens the repository on launch day (site.js).
    expect(REPOSITORY_PUBLIC).toBe(false)
    expect(view.queryByRole('link', { name: 'GitHub' })).toBeNull()
  })

  it('links the footer to one reference, the licence pages and a way to get in touch', () => {
    const view = render(Footer)
    expect(view.getAllByRole('link', { name: 'Reference' }).map((link) => link.getAttribute('href'))).toEqual(
      ['/api'],
    )
    expect(view.getByRole('link', { name: 'The app' }).getAttribute('href')).toBe('/app')
    expect(view.getByRole('link', { name: 'Changelog' }).getAttribute('href')).toBe('/changelog')
    expect(view.getByRole('link', { name: 'Level editor' }).getAttribute('href')).toBe('/editor')
    expect(view.queryByRole('link', { name: 'GitHub' })).toBeNull()
    for (const name of ['Privacy', 'Terms', 'Contact']) expect(view.getByRole('link', { name })).toBeTruthy()
    expect(view.queryByRole('link', { name: /AI|Showcase|Complete API/ })).toBeNull()
  })
})
