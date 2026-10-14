import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Footer from '../src/lib/components/Footer.svelte'
import Header from '../src/lib/components/Header.svelte'
import TerminalBox from '../src/lib/components/TerminalBox.svelte'
import { highlightCode } from '../src/lib/utils/highlight'

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

  it('renders AI link in navigation header', () => {
    const { getByRole } = render(Header)
    expect(getByRole('link', { name: /AI/i })).toBeTruthy()
  })

  it('includes AI portal link in footer', () => {
    const { getByRole } = render(Footer)
    expect(getByRole('link', { name: /AI & Skills/i })).toBeTruthy()
  })
})
