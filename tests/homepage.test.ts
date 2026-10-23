import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Page from '../src/routes/+page.svelte'

describe('Homepage', () => {
  it('leads with a playable starter and real source, without an unverified public installer', () => {
    const view = render(Page)
    expect(view.getByRole('heading', { level: 1 }).textContent).toMatch(/Make a game.*Make it yours/)
    expect(view.getByRole('link', { name: 'Play the starter' }).getAttribute('href')).toBe('#play')
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(view.getAllByRole('img', { name: 'Emberwick platforming gameplay' }).length).toBeGreaterThan(0)
    expect(view.getAllByRole('link', { name: 'Try a double jump' }).every(link => link.getAttribute('href') === '/start#worked-change')).toBe(true)
    expect(view.queryByText(/npx automata/)).toBeNull()
    expect(view.getByRole('region', { name: 'games/emberwick/src/content/room.ts' })).toBeTruthy()
  })
})
