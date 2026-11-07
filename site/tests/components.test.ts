import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Footer from '../src/shared/components/Footer.svelte'
import Header from '../src/shared/components/Header.svelte'
import TerminalBox from '../src/shared/components/TerminalBox.svelte'
import { highlightCode } from '../src/shared/utils/highlight'

describe('UI Components', () => {
  it('TerminalBox renders command text and copy button', () => {
    const { getByText, getByRole } = render(TerminalBox, {
      props: { command: 'npx automata create-game' },
    })
    expect(getByText('npx automata create-game')).toBeTruthy()
    expect(getByRole('button', { name: /copy/i })).toBeTruthy()
  })

  it('highlightCode returns highlighted html string', async () => {
    const html = await highlightCode('const x = 1;', 'typescript')
    expect(html).toContain('const')
    expect(html).toContain('pre')
  })

  it('leads the header with the four pages a visitor looks for, and Get started', () => {
    const view = render(Header)
    const main = view.getByRole('navigation', { name: 'Main navigation' })
    expect([...main.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'Docs',
      'Examples',
      'Editor',
      'API',
    ])
    expect(view.getByRole('link', { name: 'Get started' }).getAttribute('href')).toBe('/start')
  })

  it('links the footer to one reference, the licence pages and a way to get in touch', () => {
    const view = render(Footer)
    expect(view.getAllByRole('link', { name: 'Reference' }).map((link) => link.getAttribute('href'))).toEqual(
      ['/api'],
    )
    for (const name of ['Privacy', 'Terms', 'Contact']) expect(view.getByRole('link', { name })).toBeTruthy()
    expect(view.queryByRole('link', { name: /AI|Showcase|Complete API/ })).toBeNull()
  })
})
