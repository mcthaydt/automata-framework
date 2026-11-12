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
      'Pricing',
      'Changelog',
    ])
    expect(main.querySelector('a[href="/app"]')?.textContent).toBe('Pricing')
    // The editor is a page of its own, not one of the site's routes: the link goes straight to it and loads it whole.
    // In the bar and in the folded menu alike.
    const editors = view.getAllByRole('link', { name: 'Editor' })
    expect(editors).toHaveLength(2)
    for (const editor of editors) {
      expect(editor.getAttribute('href')).toBe('/editor/app/')
      expect(editor.hasAttribute('data-sveltekit-reload')).toBe(true)
    }
    expect(view.container.querySelectorAll('a[href="/editor"]')).toHaveLength(0)
    expect(main.querySelector('a[href="/docs"]')?.hasAttribute('data-sveltekit-reload')).toBe(false)
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
    expect(view.getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/app')
    expect(view.container.textContent).toContain('No credits, ever.')
    expect(view.getByRole('link', { name: 'Changelog' }).getAttribute('href')).toBe('/changelog')
    const editor = view.getByRole('link', { name: 'Level editor' })
    expect(editor.getAttribute('href')).toBe('/editor/app/')
    expect(editor.hasAttribute('data-sveltekit-reload')).toBe(true)
    expect(view.queryByRole('link', { name: 'GitHub' })).toBeNull()
    for (const name of ['Privacy', 'Terms', 'Contact']) expect(view.getByRole('link', { name })).toBeTruthy()
    expect(view.queryByRole('link', { name: /AI|Showcase|Complete API/ })).toBeNull()
  })
})
