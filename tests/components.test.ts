import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
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
})
