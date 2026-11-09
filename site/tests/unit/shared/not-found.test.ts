import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import NotFound from '#src/shared/components/NotFound.svelte'

describe('the page for a missing address', () => {
  it('says plainly what happened and offers the home page first, then the docs', () => {
    const view = render(NotFound)
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe('Page not found')
    expect(view.getByText('There is no page at this address. It may have moved.')).toBeTruthy()
    const home = view.getByRole('link', { name: 'Go to the home page' })
    expect(home.getAttribute('href')).toBe('/')
    expect(home.className).toContain('button')
    const docs = view.getByRole('link', { name: 'Read the docs' })
    expect(docs.getAttribute('href')).toBe('/docs')
    // A button of its own (48 px), not a bare text link that is 27 px tall.
    expect(docs.className).toContain('button')
    expect(docs.className).toContain('secondary')
  })

  it('keeps itself out of search results', () => {
    render(NotFound)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  })
})
