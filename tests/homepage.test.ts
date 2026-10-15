import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Page from '../src/routes/+page.svelte'

describe('Homepage', () => {
  it('leads with a playable starter and real source, without an unverified public installer', () => {
    const view = render(Page)
    expect(view.getByRole('heading', { level: 1 }).textContent).toMatch(/Games, in.*your hands/)
    expect(view.getByRole('link', { name: 'Play the starter' }).getAttribute('href')).toBe('#play')
    expect(view.container.querySelector('iframe')?.getAttribute('src')).toBe('/demos/base-2d/index.html')
    expect(view.queryByText(/npx automata/)).toBeNull()
    expect(view.getByText('motion.ts')).toBeTruthy()
  })
})
