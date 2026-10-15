import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { SHOWCASE_GAMES } from '../src/data/showcase'
import ShowcasePage from '../src/routes/showcase/+page.svelte'

describe('Showcase Page', () => {
  it('data covers Emberwick, FloorFifty, and The Last Light', () => {
    const titles = SHOWCASE_GAMES.map((g) => g.title)
    expect(titles).toContain('Emberwick')
    expect(titles).toContain('FloorFifty')
    expect(titles).toContain('The Last Light')
  })

  it('renders starter and reference project headings', () => {
    const { getByRole } = render(ShowcasePage)
    expect(getByRole('heading', { name: 'Emberwick' })).toBeTruthy()
    expect(getByRole('heading', { name: 'FloorFifty' })).toBeTruthy()
    expect(getByRole('heading', { name: 'The Last Light' })).toBeTruthy()
  })
})
