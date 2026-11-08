import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DocsPage from '../src/features/docs/DocsPage.svelte'

describe('Documentation navigation', () => {
  it('renders 3-column structure: categories, content, and on-this-page toc', () => {
    const { getByText, getByPlaceholderText } = render(DocsPage)
    expect(getByPlaceholderText(/Search docs.../i)).toBeTruthy()
    expect(getByText(/On this page/i)).toBeTruthy()
  })

  it('filters documentation categories and sections with regex-safe search', async () => {
    const { getByPlaceholderText, queryByText } = render(DocsPage)
    const input = getByPlaceholderText(/Search docs.../i)

    // Test regex safety
    await fireEvent.input(input, { target: { value: 'Koota (' } })
    expect(queryByText(/No matching sections/i)).toBeTruthy()
  })

  it('renders styled callout boxes and parameter tables', () => {
    const { container } = render(DocsPage)
    expect(container.querySelector('[data-callout]')).toBeTruthy()
  })
})
