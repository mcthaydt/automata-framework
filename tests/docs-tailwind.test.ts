import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import DocsPage from '../src/routes/docs/+page.svelte'

describe('Tailwind-Inspired Docs Page', () => {
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
    expect(queryByText(/ECS Simulation/i)).toBeTruthy()
  })

  it('renders styled callout boxes and parameter tables', () => {
    const { container } = render(DocsPage)
    expect(container.querySelector('[data-callout]')).toBeTruthy()
  })
})
