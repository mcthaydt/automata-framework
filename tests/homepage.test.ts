import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Page from '../src/routes/+page.svelte'

describe('Homepage', () => {
  it('renders value proposition, terminal quickstart, and feature pillars', () => {
    const { getByText, getAllByText } = render(Page)
    expect(getByText(/The deterministic game framework/i)).toBeTruthy()
    expect(getAllByText(/npx automata create-game/i).length).toBeGreaterThan(0)
    expect(getByText(/Pure Determinism/i)).toBeTruthy()
    expect(getByText(/Modern Rendering/i)).toBeTruthy()
    expect(getByText(/Effect Boundaries/i)).toBeTruthy()
  })
})
