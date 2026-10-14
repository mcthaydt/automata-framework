import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AiPage from '../src/routes/ai/+page.svelte'

describe('AI & LLMs Page', () => {
  it('renders hero title and agent installation tabs', () => {
    const { getByText, getAllByText } = render(AiPage)
    expect(getByText(/Automata AI & Agent Skills/i)).toBeTruthy()
    expect(getAllByText(/Claude Code/i).length).toBeGreaterThan(0)
    expect(getAllByText(/Cursor/i).length).toBeGreaterThan(0)
  })

  it('renders the 5 Golden Laws for LLMs', () => {
    const { getByText } = render(AiPage)
    expect(getByText(/The 5 Golden Rules for LLMs/i)).toBeTruthy()
    expect(getByText(/Sub-tick Interpolation/i)).toBeTruthy()
    expect(getByText(/Zero Eval CSP/i)).toBeTruthy()
  })

  it('provides links to plain-text llms.txt endpoints', () => {
    const { getByRole } = render(AiPage)
    expect(getByRole('link', { name: /view llms\.txt/i })).toBeTruthy()
  })
})
