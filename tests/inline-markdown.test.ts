import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Inline from '../src/lib/components/InlineText.svelte'

describe('Readable documentation links', () => {
  it('renders safe links and code while keeping raw HTML as text', () => {
    const view = render(Inline, { props: { text: 'Read [setup](/start), use `sim.step`, and keep <script>alert(1)</script> as text.' } })
    expect(view.getByRole('link', { name: 'setup' }).getAttribute('href')).toBe('/start')
    expect(view.container.querySelector('code')?.textContent).toBe('sim.step')
    expect(view.container.querySelector('script')).toBeNull()
  })
  it('does not create links for executable or cross-origin relative URLs', () => {
    const view = render(Inline, { props: { text: '[bad](javascript:alert) [remote](//example.com) [escape](/\\example.com)' } })
    expect(view.queryAllByRole('link')).toHaveLength(0)
  })
})
