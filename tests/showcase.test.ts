import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { SHOWCASE_GAMES } from '../src/data/showcase'
import ShowcasePage from '../src/routes/showcase/+page.svelte'

// STANDALONE.1 (Owner, 2026-10-31: "automata framework is standalone"): the showcase is the framework's own starter
// and reviewed community games; the projects the framework was extracted from are not shown.
describe('Showcase Page', () => {
  it('data is the framework’s own starter', () => {
    expect(SHOWCASE_GAMES.map((g) => g.title)).toEqual(['Emberwick'])
  })

  it('renders the starter and no reference projects', () => {
    const { getByRole, queryByRole, container } = render(ShowcasePage)
    expect(getByRole('heading', { name: 'Emberwick' })).toBeTruthy()
    expect(queryByRole('heading', { name: 'Reference projects' })).toBeNull()
    expect(container.textContent).not.toMatch(/floor\s?fifty|last light/i)
  })
})
